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
  const dataDir = mkdtempSync(join(tmpdir(), "kbdev-search-ask-"));
  const token = "smoke-token-search-ask";
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
        title: "Retrieval Preview Smoke Source",
        content:
          "Retrieval Preview connects Search and Ask to confirmed Knowledge Units. " +
          "Evidence Pack items bind Citation Trace labels back to Source and Chunk."
      })
    });
    if (!imported.review_task_ids?.length) throw new Error("review task missing");

    const pendingPreview = await jsonFetch(`${apiBase}/retrieval/preview`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: "Retrieval Preview Evidence Pack" })
    });
    if (pendingPreview.evidence_pack.failure_type !== "no_retrieval_result") {
      throw new Error("pending_review KU entered retrieval preview");
    }

    await jsonFetch(`${apiBase}/review-tasks/${imported.review_task_ids[0]}:confirm`, {
      method: "POST",
      headers
    });

    const preview = await jsonFetch(`${apiBase}/retrieval/preview`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: "Retrieval Preview Evidence Pack" })
    });
    if (preview.evidence_pack.status !== "ready") throw new Error("evidence pack not ready");
    if (!preview.evidence_pack.items.length) throw new Error("evidence item missing");
    if (!preview.query_explanation.retrieval_strategy_profile) {
      throw new Error("query explanation missing retrieval strategy profile");
    }
    if (!preview.citation_labels.length) throw new Error("citation labels missing");
    if (preview.provider_status !== "degraded") {
      throw new Error("sqlite-vec degraded status was not surfaced");
    }

    const pack = await jsonFetch(`${apiBase}/evidence-packs/${preview.evidence_pack_id}`, {
      headers
    });
    if (pack.items[0].id !== preview.evidence_item_ids[0]) {
      throw new Error("evidence pack detail did not return item-level evidence");
    }

    const answer = await jsonFetch(`${apiBase}/retrieval/evidence-only`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: "Search Ask Citation Trace" })
    });
    if (answer.output_type !== "evidence_only_answer") throw new Error("wrong answer type");
    if (!answer.evidence_item_ids.length) throw new Error("answer evidence missing");

    const emptyPreview = await jsonFetch(`${apiBase}/retrieval/preview`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: "zzzz-not-present" })
    });
    if (emptyPreview.evidence_pack.failure_type !== "no_retrieval_result") {
      throw new Error("empty retrieval did not expose no_retrieval_result");
    }
    if (emptyPreview.evidence_item_ids.length) throw new Error("empty retrieval returned evidence");

    console.log("SMOKE_P0_SEARCH_ASK_OK");
  } finally {
    child.kill("SIGTERM");
    rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
