import { spawn, spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("node", ["scripts/ensure-python-env.mjs"]);
run("pnpm", ["--filter", "@knowledgebase-dev/runtime-contracts", "build"]);
run("pnpm", ["--filter", "@knowledgebase-dev/api-types", "build"]);
run("pnpm", ["--filter", "@knowledgebase-dev/desktop-preload", "build"]);
run("pnpm", ["--filter", "@knowledgebase-dev/shared-config", "build"]);
run("pnpm", ["--filter", "@knowledgebase-dev/desktop-main", "build"]);

const renderer = spawn("pnpm", ["--filter", "@knowledgebase-dev/renderer", "dev", "--", "--host", "127.0.0.1"], {
  stdio: "inherit",
  env: { ...process.env }
});

await new Promise((resolve) => setTimeout(resolve, 2500));

const desktop = spawn("pnpm", ["--filter", "@knowledgebase-dev/desktop-main", "dev"], {
  stdio: "inherit",
  env: { ...process.env, KB_RENDERER_URL: "http://127.0.0.1:5173/dashboard" }
});

function shutdown() {
  renderer.kill("SIGTERM");
  desktop.kill("SIGTERM");
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
desktop.on("exit", () => shutdown());
