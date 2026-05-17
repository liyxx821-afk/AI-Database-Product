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

async function expectUnauthorized(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (response.status !== 401 || body.error?.code !== "sidecar_auth_failed") {
    throw new Error(`Expected unauthorized response for ${url}, got ${response.status}`);
  }
}

function assertNoLeak(label, text, forbiddenValues) {
  for (const value of forbiddenValues) {
    if (value && text.includes(value)) {
      throw new Error(`${label} leaked ${value}`);
    }
  }
  for (const marker of ["smoke-token-knowledge-export", "knowledgebase.sqlite", "app_data"]) {
    if (text.includes(marker)) throw new Error(`${label} leaked ${marker}`);
  }
}

function inspectZip(contentBase64) {
  const script = [
    "import base64, io, json, sys, zipfile",
    "raw = base64.b64decode(sys.stdin.read().strip())",
    "with zipfile.ZipFile(io.BytesIO(raw)) as archive:",
    "    names = sorted(archive.namelist())",
    "    manifest = json.loads(archive.read('manifest.json'))",
    "    knowledge_units = json.loads(archive.read('knowledge-units.json'))",
    "    combined = '\\n'.join(archive.read(name).decode('utf-8') for name in names)",
    "print(json.dumps({'names': names, 'manifest': manifest, 'knowledge_units': knowledge_units, 'combined': combined}, ensure_ascii=False))"
  ].join("\n");
  const result = spawnSync(python, ["-c", script], {
    cwd: root,
    input: contentBase64,
    encoding: "utf-8"
  });
  if (result.status !== 0) {
    throw new Error(`zip inspection failed: ${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

async function main() {
  run("node", ["scripts/ensure-python-env.mjs"]);
  const dataDir = mkdtempSync(join(tmpdir(), "kbdev-knowledge-export-"));
  const token = "smoke-token-knowledge-export";
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
    await expectUnauthorized(`${apiBase}/exports/knowledge-units`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}"
    });

    const folder = await jsonFetch(`${apiBase}/folders`, {
      method: "POST",
      headers,
      body: JSON.stringify({ project_id: "default-space", name: "D115 Smoke Folder" })
    });
    const tag = await jsonFetch(`${apiBase}/tags`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        project_id: "default-space",
        name: "D115 Smoke Topic",
        namespace: "topic",
        tag_type: "topic_tag"
      })
    });
    const imported = await jsonFetch(`${apiBase}/text-imports`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: "D115 Knowledge Export",
        content: "D115 knowledge export confirmed asset keeps folder tag citation records."
      })
    });
    const sourceId = imported.source_id;
    const knowledgeUnitId = imported.candidate_knowledge_unit_ids[0];
    await jsonFetch(`${apiBase}/sources/${sourceId}/organization`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ folder_id: folder.id, tag_ids: [tag.id] })
    });

    const pendingMarkdown = await jsonFetch(`${apiBase}/exports/knowledge-units`, {
      method: "POST",
      headers,
      body: JSON.stringify({ format: "markdown", folder_id: folder.id, tag_ids: [tag.id] })
    });
    if (pendingMarkdown.record_count !== 0) {
      throw new Error("pending_review KU was exported by default");
    }

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
        include_chunks: true,
        include_sources: true
      })
    });
    if (markdownExport.record_count !== 1 || !markdownExport.content.includes("status: \"confirmed\"")) {
      throw new Error("filtered Markdown export did not include confirmed KU");
    }
    if (!markdownExport.content.includes("citation_label:")) {
      throw new Error("Markdown export missing citation frontmatter");
    }
    assertNoLeak("markdown export", markdownExport.content, forbiddenValues);

    const jsonExport = await jsonFetch(`${apiBase}/exports/knowledge-units`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        format: "json",
        knowledge_unit_ids: [knowledgeUnitId],
        include_chunks: true,
        include_sources: true
      })
    });
    const jsonContent = JSON.parse(jsonExport.content);
    if (jsonContent.manifest.record_count !== 1) {
      throw new Error("JSON export manifest record count mismatch");
    }
    if (jsonContent.knowledge_units[0].id !== knowledgeUnitId) {
      throw new Error("JSON export did not include expected KU");
    }
    assertNoLeak("json export", jsonExport.content, forbiddenValues);

    const zipExport = await jsonFetch(`${apiBase}/exports/project`, {
      method: "POST",
      headers,
      body: JSON.stringify({ project_id: "default-space" })
    });
    if (zipExport.format !== "zip" || !zipExport.content_base64) {
      throw new Error("Project export did not return zip base64 content");
    }
    const inspected = inspectZip(zipExport.content_base64);
    const expectedFiles = [
      "README.md",
      "chunks.json",
      "folders.json",
      "knowledge-units.json",
      "manifest.json",
      "sources.json",
      "tags.json"
    ];
    if (JSON.stringify(inspected.names) !== JSON.stringify(expectedFiles)) {
      throw new Error(`Project export file list mismatch: ${JSON.stringify(inspected.names)}`);
    }
    if (!inspected.knowledge_units.some((unit) => unit.id === knowledgeUnitId)) {
      throw new Error("Project export missing confirmed KU");
    }
    assertNoLeak("project export", inspected.combined, forbiddenValues);

    const excludingTag = await jsonFetch(`${apiBase}/tags`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        project_id: "default-space",
        name: "D115 Smoke Excluding",
        namespace: "topic",
        tag_type: "topic_tag"
      })
    });
    const excluded = await jsonFetch(`${apiBase}/exports/knowledge-units`, {
      method: "POST",
      headers,
      body: JSON.stringify({ format: "json", tag_ids: [excludingTag.id] })
    });
    if (excluded.record_count !== 0) {
      throw new Error("tag filter did not exclude non-matching KU");
    }

    console.log("SMOKE_P0_KNOWLEDGE_EXPORT_OK");
  } finally {
    child.kill("SIGTERM");
    rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
