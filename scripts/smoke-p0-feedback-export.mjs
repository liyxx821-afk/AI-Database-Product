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

async function expectUnauthorized(url) {
  const response = await fetch(url);
  const body = await response.json();
  if (response.status !== 401 || body.error?.code !== "sidecar_auth_failed") {
    throw new Error(`Expected unauthorized response from ${url}: ${JSON.stringify(body)}`);
  }
}

function parseCsv(content) {
  const [headerLine, ...rows] = content.trim().split(/\r?\n/);
  const headers = headerLine.split(",");
  return {
    headers,
    rows: rows.map((row) => {
      const values = row.split(",");
      return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    })
  };
}

async function main() {
  run("node", ["scripts/ensure-python-env.mjs"]);
  const dataDir = mkdtempSync(join(tmpdir(), "kbdev-feedback-export-"));
  const token = "smoke-token-feedback-export";
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
    await expectUnauthorized(`${apiBase}/feedback/export?format=json`);

    const imported = await jsonFetch(`${apiBase}/text-imports`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: "Feedback Export Smoke Source",
        content:
          "Feedback export keeps diagnostics redacted and excludes source excerpts " +
          "while preserving query and citation labels for replay."
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
      body: JSON.stringify({ query: "Feedback Export Citation Replay" })
    });
    if (!answer.answer_id) throw new Error("answer id missing");
    if (!answer.evidence_item_ids.length) throw new Error("answer evidence missing");

    for (const [feedbackType, comment] of [
      ["useful", "useful export event"],
      ["bad_citation", "bad citation export event"],
      ["missing_source", "missing source export event"]
    ]) {
      await jsonFetch(`${apiBase}/feedback`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          feedback_type: feedbackType,
          evidence_pack_id: answer.evidence_pack_id,
          ai_answer_id: answer.answer_id,
          evidence_item_id: answer.evidence_item_ids[0],
          comment
        })
      });
    }

    const events = await jsonFetch(`${apiBase}/feedback`, { headers });
    if (events.length !== 3) throw new Error("feedback diagnostics list count mismatch");

    const jsonExport = await jsonFetch(`${apiBase}/feedback/export?format=json`, { headers });
    if (jsonExport.format !== "json") throw new Error("json export format mismatch");
    if (jsonExport.record_count !== 3) throw new Error("json export record count mismatch");
    if (jsonExport.redacted !== true || jsonExport.includes_source_text !== false) {
      throw new Error("json export redaction flags mismatch");
    }
    const jsonPayload = JSON.parse(jsonExport.content);
    if (jsonPayload.summary.total !== 3 || jsonPayload.events.length !== 3) {
      throw new Error("json export payload mismatch");
    }
    if (!jsonPayload.events.every((event) => event.query === "Feedback Export Citation Replay")) {
      throw new Error("json export query context missing");
    }

    const csvExport = await jsonFetch(
      `${apiBase}/feedback/export?format=csv&feedback_type=bad_citation&target_type=evidence_item` +
        `&ai_answer_id=${answer.answer_id}&evidence_pack_id=${answer.evidence_pack_id}` +
        `&evidence_item_id=${answer.evidence_item_ids[0]}`,
      { headers }
    );
    if (csvExport.format !== "csv") throw new Error("csv export format mismatch");
    if (csvExport.record_count !== 1) throw new Error("csv export record count mismatch");
    const csv = parseCsv(csvExport.content);
    const expectedHeader = [
      "id",
      "feedback_type",
      "target_type",
      "target_id",
      "evidence_pack_id",
      "ai_answer_id",
      "evidence_item_id",
      "ranking_effect",
      "query",
      "citation_label",
      "comment",
      "created_at"
    ].join(",");
    if (csv.headers.join(",") !== expectedHeader) throw new Error("csv export header mismatch");
    if (csv.rows[0].feedback_type !== "bad_citation") throw new Error("csv feedback filter failed");
    if (csv.rows[0].ranking_effect !== "negative_weight_suggestion") {
      throw new Error("csv ranking effect missing");
    }
    if (csv.rows[0].query !== "Feedback Export Citation Replay") {
      throw new Error("csv query context missing");
    }
    if (!csv.rows[0].citation_label) throw new Error("csv citation label missing");

    const combinedExport = JSON.stringify(jsonExport) + csvExport.content;
    for (const secret of [token, dataDir, "excludes source excerpts while preserving"]) {
      if (combinedExport.includes(secret)) {
        throw new Error(`export leaked redacted value: ${secret}`);
      }
    }

    console.log("SMOKE_P0_FEEDBACK_EXPORT_OK");
  } finally {
    child.kill("SIGTERM");
    rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
