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
  const dataDir = mkdtempSync(join(tmpdir(), "kbdev-citation-detail-"));
  const token = "smoke-token-citation-detail";
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
    const imported = await jsonFetch(`${apiBase}/text-imports`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: "Citation Detail Smoke Source",
        content:
          "Citation Detail replay must show Knowledge Unit status, Source origin, " +
          "Chunk excerpt, Citation Trace, and provider fallback without creating memory."
      })
    });
    if (!imported.review_task_ids?.length) throw new Error("review task missing");

    const pendingPreview = await jsonFetch(`${apiBase}/retrieval/preview`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: "Citation Detail Source Chunk" })
    });
    const pendingDetail = await jsonFetch(
      `${apiBase}/evidence-packs/${pendingPreview.evidence_pack_id}`,
      { headers }
    );
    if (pendingDetail.failure_type !== "no_retrieval_result") {
      throw new Error("pending detail did not expose no_retrieval_result");
    }
    if (pendingDetail.items.length) throw new Error("pending_review evidence leaked into detail");

    await jsonFetch(`${apiBase}/review-tasks/${imported.review_task_ids[0]}:confirm`, {
      method: "POST",
      headers
    });

    const preview = await jsonFetch(`${apiBase}/retrieval/preview`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: "Citation Detail Source Chunk" })
    });
    const detail = await jsonFetch(`${apiBase}/evidence-packs/${preview.evidence_pack_id}`, {
      headers
    });
    if (detail.query !== "Citation Detail Source Chunk") throw new Error("detail query mismatch");
    if (!detail.query_explanation.retrieval_strategy_profile) {
      throw new Error("detail query explanation missing");
    }
    if (detail.provider_status !== "degraded") throw new Error("provider fallback missing");
    const item = detail.items[0];
    if (!item) throw new Error("detail evidence item missing");
    if (item.knowledge_unit_status !== "confirmed") throw new Error("KU status missing");
    if (item.knowledge_unit_type !== "claim") throw new Error("KU type missing");
    if (item.source_origin !== "text_import") throw new Error("source origin missing");
    if (!item.chunk_content_excerpt.includes("Citation Detail")) {
      throw new Error("chunk excerpt missing");
    }
    if (item.citation_trace.profile !== "p0_citation_trace_source_chunk_v1") {
      throw new Error("citation trace profile missing");
    }

    const answer = await jsonFetch(`${apiBase}/retrieval/evidence-only`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: "Citation Detail provider fallback" })
    });
    const answerDetail = await jsonFetch(`${apiBase}/evidence-packs/${answer.evidence_pack_id}`, {
      headers
    });
    if (!answerDetail.items.length) throw new Error("answer detail replay missing evidence");
    if (!answerDetail.citation_trace_summary.includes("Evidence Pack uses")) {
      throw new Error("answer detail citation summary missing");
    }

    console.log("SMOKE_P0_CITATION_DETAIL_OK");
  } finally {
    child.kill("SIGTERM");
    rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
