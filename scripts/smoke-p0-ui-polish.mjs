import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function readRepoFile(...parts) {
  return readFileSync(join(root, ...parts), "utf8");
}

function localeBlock(source, locale, endMarker) {
  const marker = `  "${locale}": {`;
  const start = source.indexOf(marker);
  assert(start >= 0, `${locale} messages block is missing`);
  const bodyStart = start + marker.length;
  const end = source.indexOf(endMarker, bodyStart);
  assert(end >= 0, `${locale} messages block end is missing`);
  return source.slice(bodyStart, end);
}

function collectMessageKeys(block) {
  return new Set([...block.matchAll(/^\s+"([^"]+)":/gm)].map((match) => match[1]));
}

function collectUsedTranslationKeys(source) {
  return new Set([...source.matchAll(/\bt\("([^"]+)"/g)].map((match) => match[1]));
}

function main() {
  const app = readRepoFile("apps", "renderer", "src", "app", "App.tsx");
  const styles = readRepoFile("apps", "renderer", "src", "styles.css");
  const i18n = readRepoFile("apps", "renderer", "src", "services", "i18n.ts");
  const packageJson = JSON.parse(readRepoFile("package.json"));

  const zhKeys = collectMessageKeys(localeBlock(i18n, "zh-CN", "\n  },\n  \"en-US\""));
  const enKeys = collectMessageKeys(localeBlock(i18n, "en-US", "\n  }\n} as const"));
  const usedKeys = collectUsedTranslationKeys(app);

  for (const key of usedKeys) {
    assert(zhKeys.has(key), `zh-CN is missing message key ${key}`);
    assert(enKeys.has(key), `en-US is missing message key ${key}`);
  }

  for (const key of zhKeys) {
    assert(enKeys.has(key), `en-US is missing zh-CN key ${key}`);
  }
  for (const key of enKeys) {
    assert(zhKeys.has(key), `zh-CN is missing en-US key ${key}`);
  }

  const routes = [
    "/dashboard",
    "/import",
    "/library",
    "/search",
    "/ask",
    "/graph",
    "/outputs",
    "/settings"
  ];
  for (const route of routes) {
    assert(app.includes(`path: "${route}"`), `route config missing ${route}`);
  }

  const requiredAppMarkers = [
    "BridgeNotice",
    "StateChip",
    "route-summary",
    "workspace-notice"
  ];
  for (const marker of requiredAppMarkers) {
    assert(app.includes(marker), `renderer shell marker missing ${marker}`);
  }

  const requiredStyleMarkers = [
    ".route-summary",
    ".workspace-notice",
    "repeat(auto-fit, minmax(150px, 1fr))",
    "repeat(auto-fit, minmax(220px, 1fr))",
    "@media (max-width: 720px)"
  ];
  for (const marker of requiredStyleMarkers) {
    assert(styles.includes(marker), `renderer style marker missing ${marker}`);
  }

  assert(
    packageJson.scripts?.["smoke:p0-ui-polish"] === "node scripts/smoke-p0-ui-polish.mjs",
    "package.json smoke:p0-ui-polish script is missing"
  );

  run("pnpm", ["--filter", "@knowledgebase-dev/renderer", "build"]);
  console.log("SMOKE_P0_UI_POLISH_OK");
}

main();
