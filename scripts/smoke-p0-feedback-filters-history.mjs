import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import crypto from "node:crypto";

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

async function expectUnauthorized(url) {
  const response = await fetch(url);
  const body = await response.json();
  if (response.status !== 401 || body.error?.code !== "sidecar_auth_failed") {
    throw new Error(`Expected unauthorized response from ${url}: ${JSON.stringify(body)}`);
  }
}

function sha256(content) {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

async function main() {
  run("node", ["scripts/ensure-python-env.mjs"]);
  const dataDir = mkdtempSync(join(tmpdir(), "kbdev-feedback-filters-history-"));
  const token = "smoke-token-feedback-filters-history";
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
    await expectUnauthorized(`${apiBase}/feedback`);
    await expectUnauthorized(`${apiBase}/feedback/summary`);
    await expectUnauthorized(`${apiBase}/feedback/export?format=json`);
    await expectUnauthorized(`${apiBase}/feedback/export-history`);

    const imported = await jsonFetch(`${apiBase}/text-imports`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: "Feedback Filter History Smoke Source",
        content:
          "Feedback filter history keeps export metadata only. " +
          "It should preserve query and citation fields without leaking source text."
      })
    });
    if (!imported.review_task_ids?.length) throw new Error("review task missing");

    await jsonFetch(`${apiBase}/review-tasks/${imported.review_task_ids[0]}:confirm`, {
      method: "POST",
      headers
    });

    const answer = await jsonFetch(`${apiBase}/retrieval/evidence-only`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: "Feedback Filter History Citation" })
    });
    if (!answer.answer_id) throw new Error("answer id missing");
    if (!answer.evidence_item_ids.length) throw new Error("answer evidence missing");

    for (const [feedbackType, comment] of [
      ["useful", "useful alpha history event"],
      ["bad_citation", "bad citation beta history event"],
      ["missing_source", undefined]
    ]) {
      await jsonFetch(`${apiBase}/feedback`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          feedback_type: feedbackType,
          evidence_pack_id: answer.evidence_pack_id,
          ai_answer_id: answer.answer_id,
          evidence_item_id: answer.evidence_item_ids[0],
          ...(comment ? { comment } : {})
        })
      });
    }

    const searchFiltered = await jsonFetch(`${apiBase}/feedback?search=beta`, { headers });
    if (searchFiltered.length !== 1 || searchFiltered[0].feedback_type !== "bad_citation") {
      throw new Error("search filter failed");
    }

    const negativeFiltered = await jsonFetch(
      `${apiBase}/feedback?ranking_effect=negative_weight_suggestion`,
      { headers }
    );
    if (negativeFiltered.length !== 2) throw new Error("ranking effect filter failed");

    const commented = await jsonFetch(`${apiBase}/feedback?has_comment=true`, { headers });
    if (commented.length !== 2) throw new Error("has_comment=true filter failed");

    const uncommented = await jsonFetch(`${apiBase}/feedback?has_comment=false`, { headers });
    if (uncommented.length !== 1 || uncommented[0].feedback_type !== "missing_source") {
      throw new Error("has_comment=false filter failed");
    }

    const dateFiltered = await jsonFetch(
      `${apiBase}/feedback?created_from=1970-01-01T00:00:00%2B00:00` +
        `&created_to=2999-01-01T00:00:00%2B00:00&sort=created_asc&limit=2`,
      { headers }
    );
    if (dateFiltered.length !== 2) throw new Error("date/sort/limit filter failed");

    const filteredSummary = await jsonFetch(
      `${apiBase}/feedback/summary?ranking_effect=negative_weight_suggestion`,
      { headers }
    );
    if (filteredSummary.total !== 2 || filteredSummary.negative_count !== 2) {
      throw new Error("filtered summary mismatch");
    }

    const jsonExport = await jsonFetch(`${apiBase}/feedback/export?format=json&search=beta`, {
      headers
    });
    if (jsonExport.record_count !== 1 || jsonExport.summary.total !== 1) {
      throw new Error("json filtered export mismatch");
    }

    const csvExport = await jsonFetch(
      `${apiBase}/feedback/export?format=csv&has_comment=false`,
      { headers }
    );
    if (csvExport.record_count !== 1 || !csvExport.content.includes("missing_source")) {
      throw new Error("csv filtered export mismatch");
    }

    const history = await jsonFetch(`${apiBase}/feedback/export-history`, { headers });
    if (history.length !== 2) throw new Error("export history count mismatch");
    if (history[0].format !== "csv" || history[1].format !== "json") {
      throw new Error("export history ordering mismatch");
    }
    if (history[0].content_sha256 !== sha256(csvExport.content)) {
      throw new Error("export history content hash mismatch");
    }
    if ("content" in history[0]) throw new Error("export history stored content");

    const historyBlob = JSON.stringify(history);
    for (const secret of [token, dataDir, "without leaking source text", "Feedback filter history keeps"]) {
      if (historyBlob.includes(secret)) {
        throw new Error(`export history leaked redacted value: ${secret}`);
      }
    }

    await jsonFetch(`${apiBase}/feedback/export-history/${history[0].id}`, {
      method: "DELETE",
      headers
    });
    const historyAfterDelete = await jsonFetch(`${apiBase}/feedback/export-history`, { headers });
    if (historyAfterDelete.some((record) => record.id === history[0].id)) {
      throw new Error("export history delete failed");
    }

    console.log("SMOKE_P0_FEEDBACK_FILTERS_HISTORY_OK");
  } finally {
    child.kill("SIGTERM");
    rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
