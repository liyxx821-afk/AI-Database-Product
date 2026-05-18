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

function assertNoLeak(label, body, token) {
  const text = JSON.stringify(body);
  for (const marker of [token, "knowledgebase.sqlite", "app_data", "storage_path"]) {
    if (text.includes(marker)) throw new Error(`${label} leaked ${marker}`);
  }
}

async function main() {
  run("node", ["scripts/ensure-python-env.mjs"]);
  const dataDir = mkdtempSync(join(tmpdir(), "kbdev-text-to-sql-"));
  const token = "smoke-token-text-to-sql";
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

    const folder = await jsonFetch(`${apiBase}/folders`, {
      method: "POST",
      headers,
      body: JSON.stringify({ project_id: "default-space", name: "D119 SQL Smoke Folder" })
    });

    const tag = await jsonFetch(`${apiBase}/tags`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        project_id: "default-space",
        name: "D119 SQL Smoke Tag",
        namespace: "topic",
        tag_type: "topic_tag"
      })
    });

    const imported = await jsonFetch(`${apiBase}/text-imports`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: "D119 Text To SQL Smoke",
        content:
          "D119 text to SQL structured query preview returns confirmed knowledge with safe SQL trace."
      })
    });
    const sourceId = imported.source_id;
    const knowledgeUnitId = imported.candidate_knowledge_unit_ids[0];
    if (!knowledgeUnitId) throw new Error("candidate KU missing");

    await jsonFetch(`${apiBase}/sources/${sourceId}/organization`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ folder_id: folder.id, tag_ids: [tag.id] })
    });

    const pending = await jsonFetch(`${apiBase}/text-to-sql/preview`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: "D119 text to SQL structured query",
        folder_id: folder.id,
        tag_ids: [tag.id]
      })
    });
    if (pending.row_count !== 0) throw new Error("pending_review KU leaked into SQL preview");

    await jsonFetch(`${apiBase}/review-tasks/${imported.review_task_ids[0]}:confirm`, {
      method: "POST",
      headers
    });

    const kuPreview = await jsonFetch(`${apiBase}/text-to-sql/preview`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: "D119 text to SQL structured query",
        folder_id: folder.id,
        tag_ids: [tag.id],
        limit: 10
      })
    });
    if (kuPreview.template_id !== "confirmed_ku_lookup_v1") throw new Error("KU template mismatch");
    if (!kuPreview.readonly) throw new Error("readonly flag missing");
    if (!kuPreview.generated_sql.startsWith("SELECT")) throw new Error("generated SQL was not SELECT");
    if (kuPreview.row_count !== 1) throw new Error("confirmed KU SQL preview mismatch");
    if (kuPreview.rows[0].knowledge_unit_id !== knowledgeUnitId) {
      throw new Error("confirmed KU row mismatch");
    }
    assertNoLeak("ku preview", kuPreview, token);

    const sourceInventory = await jsonFetch(`${apiBase}/text-to-sql/preview`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: "source inventory for D119",
        folder_id: folder.id,
        tag_ids: [tag.id]
      })
    });
    if (sourceInventory.template_id !== "source_inventory_v1") {
      throw new Error("source inventory template mismatch");
    }
    if (sourceInventory.row_count !== 1 || sourceInventory.rows[0].source_id !== sourceId) {
      throw new Error("source inventory row mismatch");
    }
    assertNoLeak("source inventory", sourceInventory, token);

    await jsonFetch(`${apiBase}/retrieval/preview`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: "D119 text to SQL structured query" })
    });

    const evidenceHistory = await jsonFetch(`${apiBase}/text-to-sql/preview`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: "evidence history D119" })
    });
    if (evidenceHistory.template_id !== "evidence_history_v1") {
      throw new Error("evidence history template mismatch");
    }
    if (!evidenceHistory.columns.includes("retrieval_log_id")) {
      throw new Error("evidence history columns missing");
    }
    if (evidenceHistory.row_count < 1) throw new Error("evidence history rows missing");
    assertNoLeak("evidence history", evidenceHistory, token);

    const malicious = await jsonFetch(`${apiBase}/text-to-sql/preview`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: "DROP TABLE knowledge_units" })
    });
    if (!malicious.readonly) throw new Error("malicious query lost readonly guard");
    if (malicious.generated_sql.includes("DROP TABLE")) {
      throw new Error("malicious query was copied into SQL");
    }

    console.log("SMOKE_P0_TEXT_TO_SQL_OK");
  } finally {
    child.kill("SIGTERM");
    rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
