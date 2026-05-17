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
  const dataDir = mkdtempSync(join(tmpdir(), "kbdev-space-tag-"));
  const token = "smoke-token-space-tag";
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
    const projects = await jsonFetch(`${apiBase}/projects`, { headers });
    if (!projects.some((project) => project.id === "default-space")) {
      throw new Error("default-space project missing");
    }

    const folder = await jsonFetch(`${apiBase}/folders`, {
      method: "POST",
      headers,
      body: JSON.stringify({ project_id: "default-space", name: "D114 Smoke Folder" })
    });
    if (!folder.mirror_tag_id) throw new Error("folder mirror tag missing");

    const mirrorTags = await jsonFetch(`${apiBase}/tags?namespace=folder`, { headers });
    if (!mirrorTags.some((tag) => tag.id === folder.mirror_tag_id)) {
      throw new Error("folder mirror tag not listed");
    }

    const topicTag = await jsonFetch(`${apiBase}/tags`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        project_id: "default-space",
        name: "D114 Smoke Topic",
        namespace: "topic",
        tag_type: "topic_tag"
      })
    });

    const imported = await jsonFetch(`${apiBase}/text-imports`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: "D114 Space Tag Metadata",
        content: "D114 space tag metadata filters confirmed knowledge by folder and topic tag."
      })
    });
    const sourceId = imported.source_id;
    const knowledgeUnitId = imported.candidate_knowledge_unit_ids[0];
    if (!knowledgeUnitId) throw new Error("candidate KU missing");

    const sourceOrg = await jsonFetch(`${apiBase}/sources/${sourceId}/organization`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ folder_id: folder.id, tag_ids: [topicTag.id] })
    });
    if (!sourceOrg.synced_knowledge_unit_ids.includes(knowledgeUnitId)) {
      throw new Error("source organization did not sync KU");
    }

    const filteredSources = await jsonFetch(
      `${apiBase}/sources?folder_id=${encodeURIComponent(folder.id)}&tag_ids=${encodeURIComponent(topicTag.id)}`,
      { headers }
    );
    if (filteredSources.length !== 1 || filteredSources[0].id !== sourceId) {
      throw new Error("source folder/tag filter failed");
    }

    const pendingPreview = await jsonFetch(`${apiBase}/retrieval/preview`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: "D114 space tag metadata",
        folder_id: folder.id,
        tag_ids: [topicTag.id]
      })
    });
    if (pendingPreview.evidence_pack.failure_type !== "no_retrieval_result") {
      throw new Error("pending_review KU entered filtered retrieval");
    }

    await jsonFetch(`${apiBase}/review-tasks/${imported.review_task_ids[0]}:confirm`, {
      method: "POST",
      headers
    });

    const filteredKus = await jsonFetch(
      `${apiBase}/knowledge-units?status=confirmed&folder_id=${encodeURIComponent(folder.id)}&tag_ids=${encodeURIComponent(topicTag.id)}`,
      { headers }
    );
    if (filteredKus.length !== 1 || filteredKus[0].id !== knowledgeUnitId) {
      throw new Error("KU folder/tag filter failed");
    }

    const matchingPreview = await jsonFetch(`${apiBase}/retrieval/preview`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: "D114 space tag metadata",
        folder_id: folder.id,
        tag_ids: [topicTag.id]
      })
    });
    if (matchingPreview.evidence_pack.status !== "ready") {
      throw new Error("filtered retrieval did not return confirmed evidence");
    }
    if (matchingPreview.query_explanation.filters.folder_id !== folder.id) {
      throw new Error("query explanation did not preserve folder filter");
    }

    const excludingTag = await jsonFetch(`${apiBase}/tags`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        project_id: "default-space",
        name: "D114 Smoke Excluding",
        namespace: "topic",
        tag_type: "topic_tag"
      })
    });
    const excludedPreview = await jsonFetch(`${apiBase}/retrieval/preview`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: "D114 space tag metadata",
        folder_id: folder.id,
        tag_ids: [excludingTag.id]
      })
    });
    if (excludedPreview.evidence_item_ids.length) {
      throw new Error("excluding tag filter still returned evidence");
    }

    const kuOnlyTag = await jsonFetch(`${apiBase}/tags`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        project_id: "default-space",
        name: "D114 Smoke KU Only",
        namespace: "custom",
        tag_type: "custom_tag"
      })
    });
    await jsonFetch(`${apiBase}/knowledge-units/${knowledgeUnitId}/organization`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ folder_id: folder.id, tag_ids: [kuOnlyTag.id] })
    });
    const kuOnlyFilter = await jsonFetch(
      `${apiBase}/knowledge-units?status=confirmed&tag_ids=${encodeURIComponent(kuOnlyTag.id)}`,
      { headers }
    );
    if (kuOnlyFilter.length !== 1 || kuOnlyFilter[0].id !== knowledgeUnitId) {
      throw new Error("KU-only tag filter failed");
    }

    const summary = await jsonFetch(`${apiBase}/workspace/summary`, { headers });
    if (summary.folder_count < 1 || summary.tag_count < 3) {
      throw new Error("workspace summary did not include organization counts");
    }

    console.log("SMOKE_P0_SPACE_TAG_METADATA_OK");
  } finally {
    child.kill("SIGTERM");
    rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
