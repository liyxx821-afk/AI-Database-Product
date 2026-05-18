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

function localeBlock(source, locale) {
  const marker = `  "${locale}": {`;
  const start = source.indexOf(marker);
  assert(start >= 0, `${locale} messages block is missing`);
  const openBrace = source.indexOf("{", start);
  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let index = openBrace; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaping) {
        escaping = false;
      } else if (character === "\\") {
        escaping = true;
      } else if (character === "\"") {
        inString = false;
      }
      continue;
    }

    if (character === "\"") {
      inString = true;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(openBrace + 1, index);
    }
  }

  throw new Error(`${locale} messages block end is missing`);
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
  const uiStateType = readRepoFile("apps", "renderer", "src", "types", "uiState.ts");
  const packageJson = JSON.parse(readRepoFile("package.json"));

  const zhKeys = collectMessageKeys(localeBlock(i18n, "zh-CN"));
  const enKeys = collectMessageKeys(localeBlock(i18n, "en-US"));
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

  assert(uiStateType.includes("export type UiState"), "shared UiState type is missing");
  const repeatedUiStateUnion =
    /type\s+\w+\s*=\s*"loading"\s*\|\s*"empty"\s*\|\s*"degraded"\s*\|\s*"recoverable_error"\s*\|\s*"done"/;
  const stateFiles = [
    ["apps", "renderer", "src", "app", "App.tsx"],
    ["apps", "renderer", "src", "stores", "retrievalStore.ts"],
    ["apps", "renderer", "src", "stores", "feedbackMemoryStore.ts"],
    ["apps", "renderer", "src", "stores", "organizationStore.ts"],
    ["apps", "renderer", "src", "stores", "exportsStore.ts"],
    ["apps", "renderer", "src", "stores", "textToSqlStore.ts"]
  ];
  for (const parts of stateFiles) {
    const file = readRepoFile(...parts);
    assert(!repeatedUiStateUnion.test(file), `${parts.join("/")} repeats UiState union`);
  }

  assert(
    packageJson.scripts?.["smoke:p0-ui-polish"] === "node scripts/smoke-p0-ui-polish.mjs",
    "package.json smoke:p0-ui-polish script is missing"
  );

  run("pnpm", ["--filter", "@knowledgebase-dev/renderer", "build"]);
  console.log("SMOKE_P0_UI_POLISH_OK");
}

main();
