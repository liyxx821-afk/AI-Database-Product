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
  const dataDir = mkdtempSync(join(tmpdir(), "kbdev-ku-"));
  const token = "smoke-token-ku";
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
    const content = Buffer.from(
      "# Candidate KU\n\nParser output becomes pending review knowledge with fallback embedding.",
      "utf8"
    );
    const completed = await uploadFixture(apiBase, token, content, "p0-ku-smoke.md");
    const parsed = await jsonFetch(`${apiBase}/files/${completed.file_id}:parse`, {
      method: "POST",
      headers
    });
    const extracted = await jsonFetch(`${apiBase}/knowledge-units:extract`, {
      method: "POST",
      headers,
      body: JSON.stringify({ source_id: parsed.source_id })
    });
    if (!extracted.candidate_knowledge_unit_ids.length) {
      throw new Error("candidate knowledge unit missing");
    }
    if (!extracted.review_task_ids.length) throw new Error("review task missing");
    if (!extracted.embedding_ids.length) throw new Error("fallback embedding missing");

    const ku = await jsonFetch(
      `${apiBase}/knowledge-units/${extracted.candidate_knowledge_unit_ids[0]}`,
      { headers }
    );
    if (ku.status !== "pending_review") throw new Error("candidate KU bypassed review");
    if (ku.embeddings[0].embedding_profile !== "mock_fixed_384") {
      throw new Error("fallback embedding profile mismatch");
    }
    if (ku.embeddings[0].dimension !== 384) throw new Error("fallback embedding dimension mismatch");

    await jsonFetch(`${apiBase}/review-tasks/${extracted.review_task_ids[0]}:confirm`, {
      method: "POST",
      headers
    });
    const answer = await jsonFetch(`${apiBase}/retrieval/evidence-only`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: "fallback embedding pending review knowledge" })
    });
    if (!answer.evidence_item_ids.length) {
      throw new Error("confirmed KU did not produce evidence");
    }

    const reused = await jsonFetch(`${apiBase}/knowledge-units:extract`, {
      method: "POST",
      headers,
      body: JSON.stringify({ source_id: parsed.source_id })
    });
    if (reused.status !== "reused") throw new Error("extraction did not reuse existing KUs");

    console.log("SMOKE_P0_KU_OK");
  } finally {
    child.kill("SIGTERM");
    rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
