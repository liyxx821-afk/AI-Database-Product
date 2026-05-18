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

async function expectError(url, options, code) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (response.ok) throw new Error(`${url} unexpectedly succeeded`);
  if (body.error?.code !== code) {
    throw new Error(`${url} expected ${code}, got ${JSON.stringify(body)}`);
  }
}

async function main() {
  run("node", ["scripts/ensure-python-env.mjs"]);
  const dataDir = mkdtempSync(join(tmpdir(), "kbdev-relations-graph-"));
  const token = "smoke-token-relations-graph";
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
    await expectError(`${apiBase}/relations`, {}, "sidecar_auth_failed");

    const folder = await jsonFetch(`${apiBase}/folders`, {
      method: "POST",
      headers,
      body: JSON.stringify({ project_id: "default-space", name: "D121 Smoke Folder" })
    });
    const tag = await jsonFetch(`${apiBase}/tags`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        project_id: "default-space",
        name: "D121 Smoke Tag",
        namespace: "topic",
        tag_type: "topic_tag"
      })
    });

    const kuIds = [];
    const reviewIds = [];
    const sourceIds = [];
    for (const index of [0, 1]) {
      const imported = await jsonFetch(`${apiBase}/text-imports`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: `D121 Relation Smoke ${index}`,
          content: `D121 relation graph preview confirmed node ${index}.`
        })
      });
      kuIds.push(imported.candidate_knowledge_unit_ids[0]);
      reviewIds.push(imported.review_task_ids[0]);
      sourceIds.push(imported.source_id);
    }

    await jsonFetch(`${apiBase}/sources/organization:batch`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        source_ids: sourceIds,
        folder_id: folder.id,
        tag_ids: [tag.id]
      })
    });

    await expectError(
      `${apiBase}/relations`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          source_knowledge_unit_id: kuIds[0],
          target_knowledge_unit_id: kuIds[1],
          relation_type: "supports"
        })
      },
      "knowledge_unit_not_confirmed"
    );

    for (const reviewId of reviewIds) {
      await jsonFetch(`${apiBase}/review-tasks/${reviewId}:confirm`, {
        method: "POST",
        headers
      });
    }

    const relation = await jsonFetch(`${apiBase}/relations`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        source_knowledge_unit_id: kuIds[0],
        target_knowledge_unit_id: kuIds[1],
        relation_type: "supports",
        description: "D121 smoke manual relation"
      })
    });
    if (relation.status !== "confirmed") throw new Error("relation was not confirmed");

    await expectError(
      `${apiBase}/relations`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          source_knowledge_unit_id: kuIds[0],
          target_knowledge_unit_id: kuIds[1],
          relation_type: "supports"
        })
      },
      "relation_duplicate"
    );
    await expectError(
      `${apiBase}/relations`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          source_knowledge_unit_id: kuIds[0],
          target_knowledge_unit_id: kuIds[0],
          relation_type: "similar_to"
        })
      },
      "invalid_relation_target"
    );

    const relationList = await jsonFetch(
      `${apiBase}/relations?folder_id=${encodeURIComponent(folder.id)}&tag_ids=${encodeURIComponent(tag.id)}`,
      { headers }
    );
    if (relationList.length !== 1 || relationList[0].id !== relation.id) {
      throw new Error("relation list filter failed");
    }

    const graph = await jsonFetch(
      `${apiBase}/graph/preview?folder_id=${encodeURIComponent(folder.id)}&tag_ids=${encodeURIComponent(tag.id)}`,
      { headers }
    );
    if (graph.summary.edge_count !== 1 || graph.summary.node_count !== 2) {
      throw new Error("graph summary mismatch");
    }
    if (graph.summary.relation_type_counts.supports !== 1) {
      throw new Error("relation type count mismatch");
    }
    if (new Set(graph.nodes.map((node) => node.id)).size !== 2) {
      throw new Error("graph nodes missing");
    }

    const patched = await jsonFetch(`${apiBase}/relations/${relation.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ relation_type: "derived_from", description: "updated relation" })
    });
    if (patched.relation_type !== "derived_from") throw new Error("relation patch failed");

    const archived = await jsonFetch(`${apiBase}/relations/${relation.id}`, {
      method: "DELETE",
      headers
    });
    if (archived.status !== "archived") throw new Error("relation archive failed");

    const archivedGraph = await jsonFetch(
      `${apiBase}/graph/preview?folder_id=${encodeURIComponent(folder.id)}&tag_ids=${encodeURIComponent(tag.id)}`,
      { headers }
    );
    if (archivedGraph.summary.edge_count !== 0) {
      throw new Error("archived relation leaked into graph preview");
    }

    console.log("SMOKE_P0_RELATIONS_GRAPH_OK");
  } finally {
    child.kill("SIGTERM");
    rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
