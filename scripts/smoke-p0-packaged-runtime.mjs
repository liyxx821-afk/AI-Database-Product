import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = process.cwd();
const electronBin = join(root, "apps", "desktop-main", "node_modules", ".bin", "electron");

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
  throw new Error("Electron packaged runtime smoke did not produce a result file.");
}

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function copyRuntimeDir(source, destination) {
  cpSync(source, destination, {
    recursive: true,
    filter: (entry) => {
      const basename = entry.split(/[\\/]/).at(-1);
      return !["__pycache__", ".pytest_cache", ".ruff_cache"].includes(basename ?? "");
    }
  });
}

function hashDirectory(directory) {
  const hash = createHash("sha256");
  function visit(current) {
    for (const name of readdirSync(current).sort()) {
      const filePath = join(current, name);
      const stat = statSync(filePath);
      if (stat.isDirectory()) {
        visit(filePath);
        continue;
      }
      hash.update(resolve(filePath).slice(resolve(directory).length));
      hash.update(readFileSync(filePath));
    }
  }
  visit(directory);
  return hash.digest("hex");
}

async function main() {
  run("node", ["scripts/ensure-python-env.mjs"]);
  run("pnpm", ["--filter", "@knowledgebase-dev/runtime-contracts", "build"]);
  run("pnpm", ["--filter", "@knowledgebase-dev/shared-config", "build"]);
  run("pnpm", ["--filter", "@knowledgebase-dev/api-types", "build"]);
  run("pnpm", ["--filter", "@knowledgebase-dev/desktop-preload", "build"]);
  run("pnpm", ["--filter", "@knowledgebase-dev/desktop-main", "build"]);
  run("pnpm", ["--filter", "@knowledgebase-dev/renderer", "build"]);

  const tempRoot = join(tmpdir(), `kbdev-packaged-runtime-smoke-${Date.now()}-${process.pid}`);
  const artifactRoot = join(tempRoot, "runtime-artifact");
  const rendererDistDir = join(artifactRoot, "renderer");
  const preloadDir = join(artifactRoot, "desktop-preload");
  const preloadPath = join(preloadDir, "preload.js");
  const sidecarAppDir = join(artifactRoot, "sidecar-api");
  const userDataDir = join(tempRoot, "user-data");
  const sidecarLogDir = join(userDataDir, "KnowledgeBaseDev", "logs");
  const resultPath = join(tempRoot, "packaged-runtime-smoke-result.json");
  let electronChild = null;

  try {
    mkdirSync(artifactRoot, { recursive: true });
    mkdirSync(userDataDir, { recursive: true });
    copyRuntimeDir(join(root, "apps", "renderer", "dist"), rendererDistDir);
    copyRuntimeDir(join(root, "apps", "desktop-preload", "dist"), preloadDir);
    copyRuntimeDir(join(root, "apps", "api"), sidecarAppDir);
    assert(existsSync(electronBin), "Electron binary is missing; run pnpm install before packaged runtime smoke.");
    assert(existsSync(join(rendererDistDir, "index.html")), "Renderer dist index.html was not copied.");
    assert(existsSync(preloadPath), "Preload artifact was not copied.");
    assert(existsSync(join(sidecarAppDir, "app", "main.py")), "Sidecar API artifact was not copied.");

    const artifactHashBefore = hashDirectory(artifactRoot);
    const electron = startProcess(
      electronBin,
      [join(root, "apps", "desktop-main", "dist", "main.js")],
      {
        KB_DESKTOP_SMOKE: "1",
        KB_DESKTOP_SMOKE_MODE: "packaged-runtime-smoke",
        KB_DESKTOP_SMOKE_RESULT_PATH: resultPath,
        KB_DESKTOP_USER_DATA_DIR: userDataDir,
        KB_RENDERER_DIST_DIR: rendererDistDir,
        KB_PRELOAD_PATH: preloadPath,
        KB_SIDECAR_APP_DIR: sidecarAppDir,
        KB_SIDECAR_LOG_DIR: sidecarLogDir
      }
    );
    electronChild = electron.child;

    const { result, exit } = await waitForSmokeResult(resultPath, electron.child);
    const output = electron.output();
    assert(result.ok === true, `packaged runtime smoke failed: ${result.error ?? "unknown error"}`);
    if (!exit) {
      electron.child.kill("SIGTERM");
      await new Promise((resolve) => setTimeout(resolve, 500));
    } else if (exit.code !== 0) {
      throw new Error(`Electron exited with ${exit.code}. stdout=${output.stdout} stderr=${output.stderr}`);
    }
    assert(result.mode === "packaged-runtime-smoke", "packaged runtime smoke mode mismatch");
    assert(result.rendererMode === "static", "renderer must load in static mode");
    assert(result.rendererUrl.startsWith("file://"), "renderer must load from file:// static dist");
    assert(result.rendererUrl.includes("#/dashboard"), "static renderer must start at dashboard hash route");
    assert(result.preloadPath === preloadPath, "preload artifact path mismatch");
    assert(result.sidecar?.appDir === sidecarAppDir, "sidecar artifact path mismatch");
    assert(result.sidecar?.status === "ready", "sidecar status must be ready");
    assert(result.sidecar?.apiBaseUrl?.startsWith("http://127.0.0.1:"), "sidecar must bind to 127.0.0.1");
    assert(result.sidecar?.logPath?.startsWith(sidecarLogDir), "sidecar log must be under app data logs");
    assert(!result.sidecar.logPath.startsWith(root), "sidecar log must not be written under the repo");

    const probe = result.rendererProbe;
    assert(probe?.bridgeAvailable === true, "preload bridge must be available");
    assert(probe.locationHref?.startsWith("file://"), "renderer location must be file://");
    assert(probe.locationHref?.includes("#/dashboard"), "renderer location must keep dashboard hash route");
    assert(probe.config?.apiBaseUrl === result.sidecar.apiBaseUrl, "bridge API base URL must match sidecar");
    assert(probe.config?.appName === "KnowledgeBaseDev", "bridge app name mismatch");
    assert(Boolean(probe.config?.appVersion), "bridge app version is missing");
    assert(probe.config?.hasLocalToken === true, "bridge must provide local token only inside bridge/API wrapper");
    assert(probe.config?.localTokenLength >= 32, "local session token is too short");
    assert(!Object.hasOwn(probe.config, "localToken"), "smoke result must not include the local token");
    assert(probe.healthStatus === 200, "renderer health fetch failed");
    assert(probe.unauthorizedSettingsStatus === 401, "settings endpoint must reject missing token");
    assert(probe.settingsStatus === 200, "settings endpoint must accept bridge token");
    assert(probe.runtimeApiStatus === 200, "runtime endpoint must accept bridge token");
    assert(probe.runtimeStatus?.runtime_state === "ready", "Electron runtime status must be ready");
    assert(probe.bodyTextLength > 0, "renderer document must not be blank");
    assert(result.shutdown?.exited === true, "sidecar must exit during Electron shutdown");

    if (result.sidecar.pid) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      assert(!isPidAlive(result.sidecar.pid), "sidecar process must not remain alive after Electron exits");
    }

    const serialized = JSON.stringify(result);
    const logText = readFileSync(result.sidecar.logPath, "utf8");
    assert(logText.trim().length > 0, "sidecar log should contain startup/shutdown output");
    assert(!serialized.includes("KB_LOCAL_TOKEN"), "smoke result leaked a token env key");
    assert(!logText.includes("KB_LOCAL_TOKEN"), "sidecar log leaked a token env key");
    assert(hashDirectory(artifactRoot) === artifactHashBefore, "runtime artifact should remain read-only during smoke");
    console.log("SMOKE_P0_PACKAGED_RUNTIME_OK");
  } finally {
    if (electronChild && electronChild.exitCode === null && electronChild.signalCode === null) {
      electronChild.kill("SIGTERM");
    }
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
