import { spawn, spawnSync } from "node:child_process";

function pnpmCommand(args) {
  if (process.platform === "win32") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", ["corepack", "pnpm", ...args].join(" ")]
    };
  }
  return { command: "corepack", args: ["pnpm", ...args] };
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function runPnpm(args) {
  const command = pnpmCommand(args);
  run(command.command, command.args);
}

function spawnPnpm(args, options) {
  const command = pnpmCommand(args);
  return spawn(command.command, command.args, options);
}

run("node", ["scripts/ensure-python-env.mjs"]);
runPnpm(["--filter", "@knowledgebase-dev/runtime-contracts", "build"]);
runPnpm(["--filter", "@knowledgebase-dev/api-types", "build"]);
runPnpm(["--filter", "@knowledgebase-dev/desktop-preload", "build"]);
runPnpm(["--filter", "@knowledgebase-dev/shared-config", "build"]);
runPnpm(["--filter", "@knowledgebase-dev/desktop-main", "build"]);

const renderer = spawnPnpm(["--filter", "@knowledgebase-dev/renderer", "dev", "--host", "127.0.0.1"], {
  stdio: "inherit",
  env: { ...process.env }
});

await new Promise((resolve) => setTimeout(resolve, 2500));

const desktop = spawnPnpm(["--filter", "@knowledgebase-dev/desktop-main", "exec", "electron", "dist/main.js"], {
  stdio: "inherit",
  env: { ...process.env, KB_RENDERER_URL: "http://127.0.0.1:5173/demo1-ingestion" }
});

function shutdown() {
  renderer.kill("SIGTERM");
  desktop.kill("SIGTERM");
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
desktop.on("exit", () => shutdown());
