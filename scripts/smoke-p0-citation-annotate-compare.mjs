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
  const dataDir = mkdtempSync(join(tmpdir(), "kbdev-citation-annotate-compare-"));
  const token = "smoke-token-citation-annotate-compare";
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
        "Citation Annotation Compare Alpha",
        "Citation annotation compare alpha source text should stay out of copy-safe summaries."
      ],
      [
        "Citation Annotation Compare Beta",
        "Citation annotation compare beta source text should stay out of copy-safe summaries."
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
      body: JSON.stringify({ query: "Citation annotation compare source" })
    });
    if (preview.evidence_item_ids.length < 2) {
      throw new Error("citation annotate compare smoke needs multiple evidence items");
    }
    const packId = preview.evidence_pack_id;
    const itemIds = preview.evidence_item_ids.slice(0, 2);

    const created = await jsonFetch(`${apiBase}/evidence-packs/${packId}/annotations`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        evidence_item_id: itemIds[0],
        annotation_type: "note",
        content: "first annotation from smoke"
      })
    });
    if (created.content !== "first annotation from smoke") {
      throw new Error("annotation content was not persisted");
    }

    const updated = await jsonFetch(`${apiBase}/citation-annotations/${created.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        annotation_type: "risk",
        content: "updated annotation from smoke"
      })
    });
    if (updated.annotation_type !== "risk") throw new Error("annotation type was not updated");

    const annotations = await jsonFetch(`${apiBase}/evidence-packs/${packId}/annotations`, {
      headers
    });
    if (annotations.total !== 1 || annotations.counts_by_type.risk !== 1) {
      throw new Error("annotation list/counts mismatch");
    }

    const detail = await jsonFetch(`${apiBase}/evidence-packs/${packId}`, { headers });
    if (detail.detail_summary.annotation_count !== 1) {
      throw new Error("detail annotation summary missing");
    }

    const compare = await jsonFetch(`${apiBase}/evidence-packs/${packId}/compare`, {
      method: "POST",
      headers,
      body: JSON.stringify({ evidence_item_ids: itemIds })
    });
    if (compare.item_count !== 2) throw new Error("compare item count mismatch");
    if (!compare.copy_safe_summary) throw new Error("compare summary missing");
    if (!compare.differences || compare.differences.knowledge_unit_count < 1) {
      throw new Error("compare differences missing");
    }
    const compareBlob = JSON.stringify(compare);
    for (const leaked of ["alpha source text", "beta source text", token, dataDir]) {
      if (compareBlob.includes(leaked)) throw new Error(`compare leaked unsafe content: ${leaked}`);
    }
    for (const item of compare.items) {
      if (item.knowledge_unit_status !== "confirmed") {
        throw new Error("compare item lost confirmed KU binding");
      }
      const traceTypes = item.trace_path.map((node) => node.type).join(">");
      if (traceTypes !== "evidence_pack>evidence_item>knowledge_unit>chunk>source") {
        throw new Error(`compare trace path mismatch: ${traceTypes}`);
      }
      if (item.copy_payload.evidence_item_id !== item.id) {
        throw new Error("compare copy payload evidence item mismatch");
      }
    }

    const invalidAnnotation = await jsonFetchResult(
      `${apiBase}/evidence-packs/${packId}/annotations`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          evidence_item_id: "eitem_not_in_pack",
          annotation_type: "note",
          content: "invalid"
        })
      }
    );
    if (
      invalidAnnotation.status !== 404 ||
      invalidAnnotation.body.error?.code !== "evidence_item_not_in_pack"
    ) {
      throw new Error(`invalid annotation mismatch: ${JSON.stringify(invalidAnnotation.body)}`);
    }

    const invalidCompare = await jsonFetchResult(`${apiBase}/evidence-packs/${packId}/compare`, {
      method: "POST",
      headers,
      body: JSON.stringify({ evidence_item_ids: [itemIds[0], "eitem_not_in_pack"] })
    });
    if (
      invalidCompare.status !== 404 ||
      invalidCompare.body.error?.code !== "evidence_item_not_in_pack"
    ) {
      throw new Error(`invalid compare mismatch: ${JSON.stringify(invalidCompare.body)}`);
    }

    await jsonFetch(`${apiBase}/citation-annotations/${created.id}`, {
      method: "DELETE",
      headers
    });
    const afterDelete = await jsonFetch(`${apiBase}/evidence-packs/${packId}/annotations`, {
      headers
    });
    if (afterDelete.total !== 0) throw new Error("annotation delete did not persist");

    console.log("SMOKE_P0_CITATION_ANNOTATE_COMPARE_OK");
  } finally {
    child.kill("SIGTERM");
    rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
