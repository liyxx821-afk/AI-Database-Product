import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";

const root = process.cwd();
const electronBin = join(root, "apps", "desktop-main", "node_modules", ".bin", "electron");

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === "object" && address) resolve(address.port);
        else reject(new Error("Unable to allocate renderer preview port."));
      });
    });
    server.on("error", reject);
  });
}

async function waitFor(url) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 15000) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      // Renderer preview is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function startProcess(command, args, env) {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (data) => {
    stdout += data.toString();
  });
  child.stderr.on("data", (data) => {
    stderr += data.toString();
  });
  return { child, output: () => ({ stdout, stderr }) };
}

function waitForExit(child) {
  return new Promise((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
}

async function waitForSmokeResult(resultPath, electronChild) {
  const startedAt = Date.now();
  const exitPromise = waitForExit(electronChild);

  while (Date.now() - startedAt < 45000) {
    if (existsSync(resultPath)) {
      const result = JSON.parse(readFileSync(resultPath, "utf8"));
      const exit = await Promise.race([
        exitPromise,
        new Promise((resolve) => setTimeout(() => resolve(null), 10000))
      ]);
      return { result, exit };
    }

    const exit = await Promise.race([
      exitPromise,
      new Promise((resolve) => setTimeout(() => resolve(null), 250))
    ]);
    if (exit) break;
  }

  if (existsSync(resultPath)) {
    return { result: JSON.parse(readFileSync(resultPath, "utf8")), exit: null };
  }
  throw new Error("Electron desktop smoke did not produce a result file.");
}

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  run("node", ["scripts/ensure-python-env.mjs"]);
  run("pnpm", ["--filter", "@knowledgebase-dev/runtime-contracts", "build"]);
  run("pnpm", ["--filter", "@knowledgebase-dev/shared-config", "build"]);
  run("pnpm", ["--filter", "@knowledgebase-dev/api-types", "build"]);
  run("pnpm", ["--filter", "@knowledgebase-dev/desktop-preload", "build"]);
  run("pnpm", ["--filter", "@knowledgebase-dev/desktop-main", "build"]);
  run("pnpm", ["--filter", "@knowledgebase-dev/renderer", "build"]);

  const tempRoot = join(tmpdir(), `kbdev-desktop-smoke-${Date.now()}-${process.pid}`);
  const userDataDir = join(tempRoot, "user-data");
  const resultPath = join(tempRoot, "desktop-smoke-result.json");
  mkdirSync(userDataDir, { recursive: true });
  assert(existsSync(electronBin), "Electron binary is missing; run pnpm install before desktop smoke.");

  const rendererPort = await freePort();
  const rendererUrl = `http://127.0.0.1:${rendererPort}/dashboard`;
  const preview = startProcess(
    "pnpm",
    [
      "--filter",
      "@knowledgebase-dev/renderer",
      "exec",
      "vite",
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      String(rendererPort),
      "--strictPort"
    ],
    {}
  );

  try {
    await waitFor(rendererUrl);
    const electron = startProcess(
      electronBin,
      [join(root, "apps", "desktop-main", "dist", "main.js")],
      {
        KB_DESKTOP_SMOKE: "1",
        KB_DESKTOP_SMOKE_RESULT_PATH: resultPath,
        KB_DESKTOP_USER_DATA_DIR: userDataDir,
        KB_RENDERER_URL: rendererUrl
      }
    );

    const { result, exit } = await waitForSmokeResult(resultPath, electron.child);
    const output = electron.output();
    assert(result.ok === true, `desktop smoke failed: ${result.error ?? "unknown error"}`);
    if (!exit) {
      electron.child.kill("SIGTERM");
      throw new Error(`Electron did not exit after smoke completion. stdout=${output.stdout} stderr=${output.stderr}`);
    }
    if (exit.code !== 0) {
      throw new Error(`Electron exited with ${exit.code}. stdout=${output.stdout} stderr=${output.stderr}`);
    }
    assert(result.mode === "desktop-runtime-smoke", "desktop smoke mode mismatch");
    assert(result.rendererUrl === rendererUrl, "renderer URL mismatch");
    assert(result.sidecar?.status === "ready", "Electron Main sidecar status must be ready");
    assert(result.sidecar?.apiBaseUrl?.startsWith("http://127.0.0.1:"), "sidecar must bind to 127.0.0.1");

    const probe = result.rendererProbe;
    assert(probe?.bridgeAvailable === true, "preload bridge must be available");
    assert(probe.config?.apiBaseUrl === result.sidecar.apiBaseUrl, "bridge API base URL must match sidecar");
    assert(probe.config?.appName === "KnowledgeBaseDev", "bridge app name mismatch");
    assert(Boolean(probe.config?.appVersion), "bridge app version is missing");
    assert(probe.config?.hasLocalToken === true, "bridge must expose a session token to typed fetch only");
    assert(probe.config?.localTokenLength >= 32, "local session token is too short");
    assert(!Object.hasOwn(probe.config, "localToken"), "smoke result must not include the local token");
    assert(probe.healthStatus === 200, "renderer health fetch failed");
    assert(probe.unauthorizedSettingsStatus === 401, "settings endpoint must reject missing token");
    assert(probe.settingsStatus === 200, "settings endpoint must accept bridge token");
    assert(probe.runtimeApiStatus === 200, "runtime endpoint must accept bridge token");
    assert(["ready", "degraded"].includes(probe.runtimeApiState), "runtime API state must be ready or degraded");
    assert(probe.runtimeStatus?.runtime_state === "ready", "Electron runtime status must be ready");
    assert(probe.bodyTextLength > 0, "renderer document must not be blank");
    assert(result.shutdown?.exited === true, "sidecar must exit during Electron shutdown");

    if (result.sidecar.pid) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      assert(!isPidAlive(result.sidecar.pid), "sidecar process must not remain alive after Electron exits");
    }

    const serialized = JSON.stringify(result);
    assert(!serialized.includes("KB_LOCAL_TOKEN"), "smoke result leaked a token env key");
    console.log("SMOKE_P0_DESKTOP_RUNTIME_OK");
  } catch (error) {
    const previewOutput = preview.output();
    console.error(previewOutput.stdout);
    console.error(previewOutput.stderr);
    throw error;
  } finally {
    preview.child.kill("SIGTERM");
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
