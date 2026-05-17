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
  const dataDir = mkdtempSync(join(tmpdir(), "kbdev-feedback-memory-"));
  const token = "smoke-token-feedback-memory";
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
        title: "Feedback Memory Smoke Source",
        content:
          "Feedback Memory Draft Review should store append-only feedback events " +
          "and create pending review memories without mutating confirmed knowledge."
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
      body: JSON.stringify({ query: "Feedback Memory confirmed knowledge" })
    });
    if (!answer.ai_answer_id && !answer.answer_id) throw new Error("answer id missing");
    if (!answer.evidence_item_ids.length) throw new Error("answer evidence missing");

    const feedback = await jsonFetch(`${apiBase}/feedback`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        feedback_type: "useful",
        evidence_pack_id: answer.evidence_pack_id,
        ai_answer_id: answer.answer_id,
        evidence_item_id: answer.evidence_item_ids[0]
      })
    });
    if (feedback.target_type !== "evidence_item") throw new Error("feedback target mismatch");
    if (feedback.feedback_policy.mutates_confirmed_knowledge !== false) {
      throw new Error("feedback policy mutated confirmed knowledge");
    }

    const draft = await jsonFetch(`${apiBase}/memory-drafts`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        source_answer_id: answer.answer_id,
        content: "Remember that D-107 feedback is append-only and memory drafts require review.",
        memory_type: "decision"
      })
    });
    if (draft.status !== "pending_review") throw new Error("memory draft was not pending review");
    if (!draft.review_task_id) throw new Error("memory review task missing");

    const reviewTasks = await jsonFetch(`${apiBase}/review-tasks`, { headers });
    const memoryTask = reviewTasks.find((task) => task.target_type === "memory" && task.target_id === draft.id);
    if (!memoryTask) throw new Error("memory task was not listed");

    await jsonFetch(`${apiBase}/review-tasks/${memoryTask.id}:confirm`, {
      method: "POST",
      headers
    });

    const confirmed = await jsonFetch(`${apiBase}/memory-drafts/${draft.id}`, { headers });
    if (confirmed.status !== "confirmed") throw new Error("memory was not confirmed");
    if (confirmed.user_confirmed !== true) throw new Error("memory confirmation flag missing");

    const drafts = await jsonFetch(`${apiBase}/memory-drafts`, { headers });
    if (!drafts.some((memory) => memory.id === draft.id)) {
      throw new Error("memory draft list missing confirmed memory");
    }

    console.log("SMOKE_P0_FEEDBACK_MEMORY_OK");
  } finally {
    child.kill("SIGTERM");
    rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
