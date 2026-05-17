import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";

const root = process.cwd();
const python = join(root, ".venv", "bin", "python");

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
    server.on("error", reject);
  });
}

async function waitFor(url, headers = {}) {
  const started = Date.now();
  while (Date.now() - started < 15000) {
    try {
      const response = await fetch(url, { headers });
      if (response.ok) return response;
    } catch {
      // Retry until sidecar is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function apiJson(apiBase, path, { token, method = "GET", body } = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-kb-local-token": token
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json();
  return { response, payload };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  run("node", ["scripts/ensure-python-env.mjs"]);
  const dataDir = mkdtempSync(join(tmpdir(), "kbdev-i18n-"));
  const token = "smoke-token-i18n";
  const port = await freePort();
  const apiBase = `http://127.0.0.1:${port}/api`;
  const child = spawn(
    python,
    ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(port)],
    {
      cwd: join(root, "apps", "api"),
      env: {
        ...process.env,
        PYTHONPATH: join(root, "apps", "api"),
        KB_APP_DATA_DIR: dataDir,
        KB_LOCAL_TOKEN: token
      },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );
  child.stdout.on("data", (data) => process.stdout.write(data));
  child.stderr.on("data", (data) => process.stderr.write(data));

  try {
    await waitFor(`${apiBase}/health`);
    const unauthorized = await fetch(`${apiBase}/settings`);
    assert(unauthorized.status === 401, "settings endpoint must require local token");

    const defaults = await apiJson(apiBase, "/settings", { token });
    assert(defaults.response.ok, "GET /settings default failed");
    assert(defaults.payload.language === "zh-CN", "settings default language must be zh-CN");

    const english = await apiJson(apiBase, "/settings", {
      token,
      method: "PATCH",
      body: { language: "en-US" }
    });
    assert(english.response.ok, "PATCH /settings en-US failed");
    assert(english.payload.language === "en-US", "settings language did not switch to en-US");

    const persistedEnglish = await apiJson(apiBase, "/settings", { token });
    assert(persistedEnglish.payload.language === "en-US", "settings en-US did not persist");

    const chinese = await apiJson(apiBase, "/settings", {
      token,
      method: "PATCH",
      body: { language: "zh-CN" }
    });
    assert(chinese.response.ok, "PATCH /settings zh-CN failed");
    assert(chinese.payload.language === "zh-CN", "settings language did not switch to zh-CN");

    const invalid = await apiJson(apiBase, "/settings", {
      token,
      method: "PATCH",
      body: { language: "fr-FR" }
    });
    assert(invalid.response.status === 422, "invalid language must return 422");
    assert(invalid.payload.error?.code === "validation_error", "invalid language must use validation_error");

    console.log("SMOKE_P0_I18N_SETTINGS_OK");
  } finally {
    child.kill("SIGTERM");
    rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
