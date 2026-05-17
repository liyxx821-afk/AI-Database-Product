import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
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

async function expectUnauthorized(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (response.status !== 401 || body.error?.code !== "sidecar_auth_failed") {
    throw new Error(`Expected unauthorized response for ${url}, got ${response.status}`);
  }
}

function sha256Text(value) {
  return createHash("sha256").update(value, "utf-8").digest("hex");
}

function sha256Base64(value) {
  return createHash("sha256").update(Buffer.from(value, "base64")).digest("hex");
}

function assertNoLeak(label, text, forbiddenValues) {
  for (const value of forbiddenValues) {
    if (value && text.includes(value)) throw new Error(`${label} leaked ${value}`);
  }
  for (const marker of [
    "smoke-token-knowledge-export-history",
    "knowledgebase.sqlite",
    "app_data",
    "D116 export history stores metadata only"
  ]) {
    if (text.includes(marker)) throw new Error(`${label} leaked ${marker}`);
  }
}

async function main() {
  run("node", ["scripts/ensure-python-env.mjs"]);
  const dataDir = mkdtempSync(join(tmpdir(), "kbdev-knowledge-export-history-"));
  const token = "smoke-token-knowledge-export-history";
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
    await expectUnauthorized(`${apiBase}/exports/history`);

    const folder = await jsonFetch(`${apiBase}/folders`, {
      method: "POST",
      headers,
      body: JSON.stringify({ project_id: "default-space", name: "D116 History Folder" })
    });
    const tag = await jsonFetch(`${apiBase}/tags`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        project_id: "default-space",
        name: "D116 History Topic",
        namespace: "topic",
        tag_type: "topic_tag"
      })
    });
    const imported = await jsonFetch(`${apiBase}/text-imports`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: "D116 Knowledge Export History",
        content: "D116 export history stores metadata only for reusable knowledge filters."
      })
    });
    await jsonFetch(`${apiBase}/sources/${imported.source_id}/organization`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ folder_id: folder.id, tag_ids: [tag.id] })
    });
    await jsonFetch(`${apiBase}/review-tasks/${imported.review_task_ids[0]}:confirm`, {
      method: "POST",
      headers
    });

    const markdownExport = await jsonFetch(`${apiBase}/exports/knowledge-units`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        format: "markdown",
        folder_id: folder.id,
        tag_ids: [tag.id],
        include_chunks: true
      })
    });
    const jsonExport = await jsonFetch(`${apiBase}/exports/knowledge-units`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        format: "json",
        knowledge_unit_ids: [imported.candidate_knowledge_unit_ids[0]],
        include_sources: true
      })
    });
    const projectExport = await jsonFetch(`${apiBase}/exports/project`, {
      method: "POST",
      headers,
      body: JSON.stringify({ project_id: "default-space" })
    });

    const history = await jsonFetch(`${apiBase}/exports/history`, { headers });
    if (history.length !== 3) throw new Error("knowledge export history count mismatch");
    if (history[0].export_kind !== "project" || history[0].format !== "zip") {
      throw new Error("project export history ordering mismatch");
    }
    if (history[1].format !== "json" || history[2].format !== "markdown") {
      throw new Error("knowledge export history format ordering mismatch");
    }
    if (history[0].content_sha256 !== sha256Base64(projectExport.content_base64)) {
      throw new Error("project history content hash mismatch");
    }
    if (history[1].content_sha256 !== sha256Text(jsonExport.content)) {
      throw new Error("json history content hash mismatch");
    }
    if (history[2].content_sha256 !== sha256Text(markdownExport.content)) {
      throw new Error("markdown history content hash mismatch");
    }
    if (history[2].filters.folder_id !== folder.id || history[2].filters.tag_ids[0] !== tag.id) {
      throw new Error("history filters cannot be reused");
    }
    if ("content" in history[0] || "content_base64" in history[0]) {
      throw new Error("knowledge export history stored export content");
    }
    assertNoLeak("knowledge export history", JSON.stringify(history), forbiddenValues);

    await jsonFetch(`${apiBase}/exports/history/${history[0].id}`, {
      method: "DELETE",
      headers
    });
    const historyAfterDelete = await jsonFetch(`${apiBase}/exports/history`, { headers });
    if (historyAfterDelete.some((record) => record.id === history[0].id)) {
      throw new Error("knowledge export history delete failed");
    }

    console.log("SMOKE_P0_KNOWLEDGE_EXPORT_HISTORY_OK");
  } finally {
    child.kill("SIGTERM");
    rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
