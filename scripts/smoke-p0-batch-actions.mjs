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

function assertNoLeak(label, text, forbiddenValues) {
  for (const value of forbiddenValues) {
    if (value && text.includes(value)) throw new Error(`${label} leaked ${value}`);
  }
  for (const marker of ["smoke-token-batch-actions", "knowledgebase.sqlite", "app_data"]) {
    if (text.includes(marker)) throw new Error(`${label} leaked ${marker}`);
  }
}

async function main() {
  run("node", ["scripts/ensure-python-env.mjs"]);
  const dataDir = mkdtempSync(join(tmpdir(), "kbdev-batch-actions-"));
  const token = "smoke-token-batch-actions";
  const port = await freePort();
  const apiBase = `http://127.0.0.1:${port}/api`;
  const headers = {
    "content-type": "application/json",
    "x-kb-local-token": token
  };
  const forbiddenValues = [token, dataDir];
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

    const unauthorized = await jsonFetchResult(`${apiBase}/sources/organization:batch`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source_ids: ["source_missing"] })
    });
    if (unauthorized.status !== 401 || unauthorized.body.error?.code !== "sidecar_auth_failed") {
      throw new Error("batch organization unauthorized check failed");
    }

    const folder = await jsonFetch(`${apiBase}/folders`, {
      method: "POST",
      headers,
      body: JSON.stringify({ project_id: "default-space", name: "D118 Batch Folder" })
    });
    const tag = await jsonFetch(`${apiBase}/tags`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        project_id: "default-space",
        name: "D118 Batch Topic",
        namespace: "topic",
        tag_type: "topic_tag"
      })
    });

    const imports = [];
    for (const [title, content] of [
      [
        "D118 Batch Alpha",
        "D118 batch actions alpha confirmed evidence supports selected export and annotation."
      ],
      [
        "D118 Batch Beta",
        "D118 batch actions beta confirmed evidence supports selected export and annotation."
      ]
    ]) {
      const imported = await jsonFetch(`${apiBase}/text-imports`, {
        method: "POST",
        headers,
        body: JSON.stringify({ title, content })
      });
      imports.push(imported);
    }
    const sourceIds = imports.map((item) => item.source_id);
    const knowledgeUnitIds = imports.map((item) => item.candidate_knowledge_unit_ids[0]);

    const sourceBatch = await jsonFetch(`${apiBase}/sources/organization:batch`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        source_ids: sourceIds,
        folder_id: folder.id,
        tag_ids: [tag.id]
      })
    });
    if (sourceBatch.updated_count !== 2) throw new Error("source batch did not update two records");
    if (new Set(sourceBatch.synced_knowledge_unit_ids).size !== 2) {
      throw new Error("source batch did not sync derived KUs");
    }

    for (const imported of imports) {
      await jsonFetch(`${apiBase}/review-tasks/${imported.review_task_ids[0]}:confirm`, {
        method: "POST",
        headers
      });
    }

    const kuTag = await jsonFetch(`${apiBase}/tags`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        project_id: "default-space",
        name: "D118 KU Batch Selected",
        namespace: "custom",
        tag_type: "custom_tag"
      })
    });
    const kuBatch = await jsonFetch(`${apiBase}/knowledge-units/organization:batch`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        knowledge_unit_ids: [knowledgeUnitIds[0]],
        folder_id: folder.id,
        tag_ids: [kuTag.id]
      })
    });
    if (kuBatch.updated_count !== 1 || kuBatch.updated_ids[0] !== knowledgeUnitIds[0]) {
      throw new Error("KU batch did not update selected KU");
    }

    const matchingKus = await jsonFetch(
      `${apiBase}/knowledge-units?status=confirmed&folder_id=${encodeURIComponent(folder.id)}`,
      { headers }
    );
    if (matchingKus.length !== 2) throw new Error("batch organization filter mismatch");

    const preview = await jsonFetch(`${apiBase}/retrieval/preview`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: "D118 batch actions selected export annotation",
        folder_id: folder.id,
        tag_ids: [tag.id]
      })
    });
    if (preview.evidence_item_ids.length < 2) {
      throw new Error("batch actions smoke needs multiple evidence items");
    }
    const itemIds = preview.evidence_item_ids.slice(0, 2);

    const batchAnnotation = await jsonFetch(
      `${apiBase}/evidence-packs/${preview.evidence_pack_id}/annotations:batch`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          evidence_item_ids: itemIds,
          annotation_type: "note",
          content: "D118 shared batch annotation"
        })
      }
    );
    if (batchAnnotation.created_count !== 2) throw new Error("batch annotation count mismatch");
    if (
      !batchAnnotation.annotations.every(
        (annotation) => annotation.metadata.source === "citation_detail_batch"
      )
    ) {
      throw new Error("batch annotation metadata mismatch");
    }

    const invalidBatchAnnotation = await jsonFetchResult(
      `${apiBase}/evidence-packs/${preview.evidence_pack_id}/annotations:batch`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          evidence_item_ids: [itemIds[0], "eitem_not_in_pack"],
          annotation_type: "risk",
          content: "bad binding"
        })
      }
    );
    if (
      invalidBatchAnnotation.status !== 404 ||
      invalidBatchAnnotation.body.error?.code !== "evidence_item_not_in_pack"
    ) {
      throw new Error("invalid batch annotation binding check failed");
    }

    const selectedMarkdown = await jsonFetch(`${apiBase}/exports/knowledge-units`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        format: "markdown",
        knowledge_unit_ids: [knowledgeUnitIds[0]],
        include_chunks: true
      })
    });
    if (selectedMarkdown.record_count !== 1) {
      throw new Error("selected markdown export record count mismatch");
    }
    if (!selectedMarkdown.content.includes(knowledgeUnitIds[0])) {
      throw new Error("selected markdown export missing selected KU");
    }
    if (selectedMarkdown.content.includes(knowledgeUnitIds[1])) {
      throw new Error("selected markdown export included unselected KU");
    }
    assertNoLeak("selected markdown export", selectedMarkdown.content, forbiddenValues);

    const selectedJson = await jsonFetch(`${apiBase}/exports/knowledge-units`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        format: "json",
        knowledge_unit_ids: [knowledgeUnitIds[1]]
      })
    });
    const jsonContent = JSON.parse(selectedJson.content);
    if (jsonContent.manifest.record_count !== 1) {
      throw new Error("selected json export manifest mismatch");
    }
    if (jsonContent.knowledge_units[0].id !== knowledgeUnitIds[1]) {
      throw new Error("selected json export did not preserve requested KU");
    }
    assertNoLeak("selected json export", selectedJson.content, forbiddenValues);

    console.log("SMOKE_P0_BATCH_ACTIONS_OK");
  } finally {
    child.kill("SIGTERM");
    rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
