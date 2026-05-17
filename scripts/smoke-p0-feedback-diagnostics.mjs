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

async function main() {
  run("node", ["scripts/ensure-python-env.mjs"]);
  const dataDir = mkdtempSync(join(tmpdir(), "kbdev-feedback-diagnostics-"));
  const token = "smoke-token-feedback-diagnostics";
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

    const imported = await jsonFetch(`${apiBase}/text-imports`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: "Feedback Diagnostics Smoke Source",
        content:
          "Feedback Diagnostics replays append-only events with query context and " +
          "citation labels without changing retrieval ranking or confirmed knowledge."
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
      body: JSON.stringify({ query: "Feedback Diagnostics Citation Replay" })
    });
    if (!answer.answer_id) throw new Error("answer id missing");
    if (!answer.evidence_item_ids.length) throw new Error("answer evidence missing");

    for (const [feedbackType, comment] of [
      ["useful", "useful diagnostic event"],
      ["bad_citation", "bad citation diagnostic event"],
      ["missing_source", "missing source diagnostic event"]
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
    const eventTypes = events.map((event) => event.feedback_type).join(",");
    if (eventTypes !== "missing_source,bad_citation,useful") {
      throw new Error(`feedback list was not newest first: ${eventTypes}`);
    }
    if (!events.every((event) => event.query === "Feedback Diagnostics Citation Replay")) {
      throw new Error("feedback diagnostics query context missing");
    }
    if (!events.every((event) => event.citation_label)) {
      throw new Error("feedback diagnostics citation label missing");
    }
    if (events[0].ranking_effect !== "negative_weight_suggestion") {
      throw new Error("negative ranking suggestion missing");
    }

    const badCitation = await jsonFetch(`${apiBase}/feedback?feedback_type=bad_citation`, {
      headers
    });
    if (badCitation.length !== 1 || badCitation[0].feedback_type !== "bad_citation") {
      throw new Error("feedback_type filter failed");
    }

    const byAnswer = await jsonFetch(`${apiBase}/feedback?ai_answer_id=${answer.answer_id}`, {
      headers
    });
    if (byAnswer.length !== 3) throw new Error("ai_answer_id filter failed");

    const byPack = await jsonFetch(`${apiBase}/feedback?evidence_pack_id=${answer.evidence_pack_id}`, {
      headers
    });
    if (byPack.length !== 3) throw new Error("evidence_pack_id filter failed");

    const byItem = await jsonFetch(
      `${apiBase}/feedback?evidence_item_id=${answer.evidence_item_ids[0]}`,
      { headers }
    );
    if (byItem.length !== 3) throw new Error("evidence_item_id filter failed");

    const summary = await jsonFetch(`${apiBase}/feedback/summary`, { headers });
    if (summary.total !== 3) throw new Error("feedback summary total mismatch");
    if (summary.by_type.useful !== 1 || summary.by_type.bad_citation !== 1) {
      throw new Error("feedback summary type counts mismatch");
    }
    if (summary.by_target_type.evidence_item !== 3) {
      throw new Error("feedback summary target counts mismatch");
    }
    if (summary.positive_count !== 1 || summary.negative_count !== 2) {
      throw new Error("feedback summary positive/negative counts mismatch");
    }
    if (summary.feedback_policy.mutates_confirmed_knowledge !== false) {
      throw new Error("feedback policy mutated confirmed knowledge");
    }

    console.log("SMOKE_P0_FEEDBACK_DIAGNOSTICS_OK");
  } finally {
    child.kill("SIGTERM");
    rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
