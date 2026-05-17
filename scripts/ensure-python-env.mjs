import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const python = join(root, ".venv", "bin", "python");
const readyMarker = join(root, ".venv", ".kbdev-ready");

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", cwd: root });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(python)) {
  run("python3", ["-m", "venv", ".venv"]);
}

if (existsSync(readyMarker)) {
  process.exit(0);
}

run(python, ["-m", "pip", "install", "--upgrade", "pip"]);
run(python, ["-m", "pip", "install", "-e", ".[core,dev]"]);
writeFileSync(readyMarker, `${new Date().toISOString()}\n`, "utf8");
