import { createHash } from "node:crypto";
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

async function jsonFetch(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`${url} failed: ${JSON.stringify(body)}`);
  }
  return body;
}

async function main() {
  run("node", ["scripts/ensure-python-env.mjs"]);
  const dataDir = mkdtempSync(join(tmpdir(), "kbdev-file-"));
  const token = "smoke-token-file";
  const port = await freePort();
  const apiBase = `http://127.0.0.1:${port}/api`;
  const jsonHeaders = {
    "content-type": "application/json",
    "x-kb-local-token": token
  };
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
    const content = Buffer.from("P0-File upload smoke fixture.\nFile Inspection Z0a only.", "utf8");
    const sha256 = createHash("sha256").update(content).digest("hex");
    const upload = await jsonFetch(`${apiBase}/uploads`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        filename: "p0-file-smoke.md",
        size_bytes: content.length,
        content_type: "text/markdown",
        sha256,
        part_size: 16
      })
    });
    for (let index = 0; index < upload.part_count; index += 1) {
      const part = content.subarray(index * 16, (index + 1) * 16);
      const response = await fetch(`${apiBase}/uploads/${upload.id}/parts/${index + 1}`, {
        method: "PUT",
        headers: {
          "content-type": "application/octet-stream",
          "x-kb-local-token": token
        },
        body: part
      });
      if (!response.ok) {
        throw new Error(`part upload failed: ${JSON.stringify(await response.json())}`);
      }
    }
    const completed = await jsonFetch(`${apiBase}/uploads/${upload.id}:complete`, {
      method: "POST",
      headers: jsonHeaders
    });
    if (completed.status !== "completed") throw new Error("upload did not complete");
    if (completed.integrity_check?.status !== "passed") throw new Error("integrity check did not pass");
    if (completed.inspection?.risk_level !== "low") throw new Error("inspection did not classify fixture");
    const files = await jsonFetch(`${apiBase}/files`, { headers: jsonHeaders });
    if (!files.some((file) => file.id === completed.file_id)) throw new Error("completed file missing");
    console.log("SMOKE_P0_FILE_OK");
  } finally {
    child.kill("SIGTERM");
    rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
