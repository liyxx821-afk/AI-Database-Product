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

async function uploadFixture(apiBase, token, content, filename) {
  const sha256 = createHash("sha256").update(content).digest("hex");
  const headers = {
    "content-type": "application/json",
    "x-kb-local-token": token
  };
  const upload = await jsonFetch(`${apiBase}/uploads`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      filename,
      size_bytes: content.length,
      content_type: "text/markdown",
      sha256,
      part_size: 1024
    })
  });
  await jsonFetch(`${apiBase}/uploads/${upload.id}/parts/1`, {
    method: "PUT",
    headers: {
      "content-type": "application/octet-stream",
      "x-kb-local-token": token
    },
    body: content
  });
  return jsonFetch(`${apiBase}/uploads/${upload.id}:complete`, {
    method: "POST",
    headers
  });
}

async function main() {
  run("node", ["scripts/ensure-python-env.mjs"]);
  const dataDir = mkdtempSync(join(tmpdir(), "kbdev-parse-"));
  const token = "smoke-token-parse";
  const port = await freePort();
  const apiBase = `http://127.0.0.1:${port}/api`;
  const headers = {
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
    const content = Buffer.from("# P0 Parse\n\nParser Router builds Source and Chunk.", "utf8");
    const completed = await uploadFixture(apiBase, token, content, "p0-parse-smoke.md");
    const parsed = await jsonFetch(`${apiBase}/files/${completed.file_id}:parse`, {
      method: "POST",
      headers
    });
    if (parsed.status !== "completed") throw new Error("parse task did not complete");
    if (!parsed.source_id) throw new Error("source missing after parse");
    if (!parsed.chunk_ids.length) throw new Error("chunks missing after parse");
    const source = await jsonFetch(`${apiBase}/sources/${parsed.source_id}`, { headers });
    if (!source.chunks.length) throw new Error("source detail chunks missing");
    const summary = await jsonFetch(`${apiBase}/workspace/summary`, { headers });
    if (summary.source_count < 1 || summary.chunk_count < 1) {
      throw new Error("workspace summary did not include parsed source");
    }
    console.log("SMOKE_P0_PARSE_OK");
  } finally {
    child.kill("SIGTERM");
    rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
