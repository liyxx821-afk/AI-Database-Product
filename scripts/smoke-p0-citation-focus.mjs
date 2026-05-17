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

async function jsonFetchResult(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  return { status: response.status, body };
}

async function main() {
  run("node", ["scripts/ensure-python-env.mjs"]);
  const dataDir = mkdtempSync(join(tmpdir(), "kbdev-citation-focus-"));
  const token = "smoke-token-citation-focus";
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
    const imports = [];
    for (const [title, content] of [
      [
        "Citation Focus Alpha Source",
        "Citation focus trace alpha source should bind Knowledge Unit, Chunk, Source, and evidence item."
      ],
      [
        "Citation Focus Beta Source",
        "Citation focus trace beta source should support focused replay, copied ids, and source summary."
      ]
    ]) {
      const imported = await jsonFetch(`${apiBase}/text-imports`, {
        method: "POST",
        headers,
        body: JSON.stringify({ title, content })
      });
      if (!imported.review_task_ids?.length) throw new Error(`review task missing for ${title}`);
      imports.push(imported);
    }

    for (const imported of imports) {
      await jsonFetch(`${apiBase}/review-tasks/${imported.review_task_ids[0]}:confirm`, {
        method: "POST",
        headers
      });
    }

    const preview = await jsonFetch(`${apiBase}/retrieval/preview`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: "Citation focus trace source" })
    });
    if (preview.evidence_item_ids.length < 2) {
      throw new Error("citation focus smoke needs multiple evidence items");
    }

    const detail = await jsonFetch(`${apiBase}/evidence-packs/${preview.evidence_pack_id}`, {
      headers
    });
    if (detail.detail_summary.item_count !== detail.items.length) {
      throw new Error("detail summary item count mismatch");
    }
    if (detail.detail_summary.source_count < 2) throw new Error("source count summary missing");
    if (detail.detail_summary.knowledge_unit_count < 2) {
      throw new Error("knowledge unit count summary missing");
    }
    if (!detail.detail_summary.rank_score_min || !detail.detail_summary.rank_score_max) {
      throw new Error("rank score range missing");
    }
    if (detail.detail_summary.focused_item_id !== null) {
      throw new Error("unfocused detail should not set focused item");
    }

    const targetItem = detail.items[1];
    const focused = await jsonFetch(
      `${apiBase}/evidence-packs/${preview.evidence_pack_id}?focus_item_id=${targetItem.id}`,
      { headers }
    );
    if (focused.detail_summary.focused_item_id !== targetItem.id) {
      throw new Error("focused item id was not echoed");
    }
    const focusedItem = focused.items.find((item) => item.id === targetItem.id);
    if (!focusedItem) throw new Error("focused item missing from detail items");
    if (focusedItem.knowledge_unit_status !== "confirmed") {
      throw new Error("focused item lost confirmed KU binding");
    }
    const tracePath = focusedItem.citation_trace.trace_path ?? [];
    const traceTypes = tracePath.map((node) => node.type).join(">");
    if (traceTypes !== "evidence_pack>evidence_item>knowledge_unit>chunk>source") {
      throw new Error(`trace path mismatch: ${traceTypes}`);
    }
    const copyPayload = focusedItem.citation_trace.copy_payload;
    if (copyPayload.evidence_item_id !== targetItem.id) {
      throw new Error("copy payload evidence item id mismatch");
    }
    if (!copyPayload.knowledge_unit_id || !copyPayload.chunk_id || !copyPayload.source_id) {
      throw new Error("copy payload missing source/chunk/KU ids");
    }
    const copyBlob = JSON.stringify(copyPayload);
    for (const leaked of ["focused replay", "copied ids", "source summary"]) {
      if (copyBlob.includes(leaked)) {
        throw new Error(`copy payload leaked source text: ${leaked}`);
      }
    }

    const invalidFocus = await jsonFetchResult(
      `${apiBase}/evidence-packs/${preview.evidence_pack_id}?focus_item_id=eitem_not_in_pack`,
      { headers }
    );
    if (
      invalidFocus.status !== 404 ||
      invalidFocus.body.error?.code !== "evidence_item_not_in_pack"
    ) {
      throw new Error(`invalid focus response mismatch: ${JSON.stringify(invalidFocus.body)}`);
    }

    const noEvidencePreview = await jsonFetch(`${apiBase}/retrieval/preview`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: "zzzz-citation-focus-no-result" })
    });
    const noEvidenceDetail = await jsonFetch(
      `${apiBase}/evidence-packs/${noEvidencePreview.evidence_pack_id}`,
      { headers }
    );
    if (noEvidenceDetail.items.length) throw new Error("no evidence detail returned items");
    if (noEvidenceDetail.detail_summary.no_evidence_reason !== "no_retrieval_result") {
      throw new Error("no evidence reason missing from detail summary");
    }

    console.log("SMOKE_P0_CITATION_FOCUS_OK");
  } finally {
    child.kill("SIGTERM");
    rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
