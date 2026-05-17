import path from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { appIdentity, defaultRendererRoute } from "@knowledgebase-dev/shared-config";
import { SidecarManager, type SidecarRuntime } from "./sidecar.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const sidecar = new SidecarManager();
let mainWindow: BrowserWindow | null = null;
const isDesktopSmoke = process.env.KB_DESKTOP_SMOKE === "1";
type DesktopSmokeMode = "desktop-runtime-smoke" | "packaged-runtime-smoke";
const smokeMode: DesktopSmokeMode =
  process.env.KB_DESKTOP_SMOKE_MODE === "packaged-runtime-smoke"
    ? "packaged-runtime-smoke"
    : "desktop-runtime-smoke";

if (process.env.KB_DESKTOP_USER_DATA_DIR) {
  app.setPath("userData", process.env.KB_DESKTOP_USER_DATA_DIR);
}

function resourcePath(...parts: string[]): string {
  return path.join(process.resourcesPath, ...parts);
}

function firstExistingPath(paths: string[]): string | null {
  return paths.find((candidate) => existsSync(candidate)) ?? null;
}

function preloadPath(): string {
  if (process.env.KB_PRELOAD_PATH) return process.env.KB_PRELOAD_PATH;
  const packagedPreload = firstExistingPath([
    resourcePath("desktop-preload", "preload.js"),
    resourcePath("desktop-preload", "dist", "preload.js")
  ]);
  if (app.isPackaged && packagedPreload) return packagedPreload;
  return path.join(repoRoot, "apps", "desktop-preload", "dist", "preload.js");
}

type RendererEntry = {
  url: string;
  mode: "remote" | "static";
};

function rendererEntry(): RendererEntry {
  if (process.env.KB_RENDERER_URL) {
    return { url: process.env.KB_RENDERER_URL, mode: "remote" };
  }

  const rendererDistDir =
    process.env.KB_RENDERER_DIST_DIR ??
    (app.isPackaged ? firstExistingPath([resourcePath("renderer"), resourcePath("renderer", "dist")]) : null);
  if (rendererDistDir) {
    const indexPath = path.join(rendererDistDir, "index.html");
    if (!existsSync(indexPath)) {
      throw new Error(`Renderer static entry is missing: ${indexPath}`);
    }
    return {
      url: `${pathToFileURL(indexPath).toString()}#${defaultRendererRoute}`,
      mode: "static"
    };
  }

  return { url: "http://127.0.0.1:5173/dashboard", mode: "remote" };
}

async function createWindow(): Promise<void> {
  const entry = rendererEntry();
  const runtime = await sidecar.start(app.getPath("userData"), {
    allowFileRendererOrigin: entry.mode === "static"
  });
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    title: appIdentity.appName,
    backgroundColor: "#f5f5f5",
    webPreferences: {
      preload: preloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  const loaded = new Promise<void>((resolve, reject) => {
    mainWindow?.webContents.once("did-finish-load", () => resolve());
    mainWindow?.webContents.once("did-fail-load", (_event, errorCode, errorDescription) => {
      reject(new Error(`Renderer failed to load: ${errorCode} ${errorDescription}`));
    });
  });
  await mainWindow.loadURL(entry.url);
  await loaded;
  mainWindow.webContents.send("runtime-status", {
    runtime_state: runtime.status,
    status_reason: runtime.statusReason
  });

  if (isDesktopSmoke) {
    await runDesktopSmoke(runtime, entry);
  }
}

type DesktopSmokeResult = {
  ok: boolean;
  mode: DesktopSmokeMode;
  rendererUrl: string;
  rendererMode: RendererEntry["mode"];
  preloadPath: string;
  sidecar: {
    pid: number | null;
    apiBaseUrl: string | null;
    status: string;
    health: "available" | "degraded";
    appDir: string | null;
    logPath: string | null;
  };
  rendererProbe?: unknown;
  shutdown?: Awaited<ReturnType<SidecarManager["stop"]>>;
  error?: string;
};

function writeDesktopSmokeResult(result: DesktopSmokeResult): void {
  const resultPath = process.env.KB_DESKTOP_SMOKE_RESULT_PATH;
  if (!resultPath) {
    console.log(`KB_DESKTOP_SMOKE_RESULT ${JSON.stringify(result)}`);
    return;
  }
  mkdirSync(path.dirname(resultPath), { recursive: true });
  writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}

function exitDesktopSmoke(code: number): void {
  mainWindow?.destroy();
  mainWindow = null;
  app.exit(code);
  setTimeout(() => process.exit(code), 250);
}

async function runDesktopSmoke(runtime: SidecarRuntime, entry: RendererEntry): Promise<void> {
  const baseResult = {
    mode: smokeMode,
    rendererUrl: entry.url,
    rendererMode: entry.mode,
    preloadPath: preloadPath(),
    sidecar: {
      pid: runtime.pid,
      apiBaseUrl: runtime.apiBaseUrl,
      status: runtime.status,
      health: runtime.status === "ready" ? ("available" as const) : ("degraded" as const),
      appDir: runtime.appDir,
      logPath: runtime.logPath
    }
  };

  try {
    if (!mainWindow) throw new Error("Main window is not available for desktop smoke.");
    const rendererProbe = await mainWindow.webContents.executeJavaScript(`
      (async () => {
        const bridge = window.knowledgeBase;
        if (!bridge) throw new Error("desktop_bridge_unavailable");
        const config = await bridge.runtime.getRuntimeConfig();
        const runtimeStatus = await bridge.runtime.getRuntimeStatus();
        const healthResponse = await fetch(config.apiBaseUrl + "/health");
        const unauthorizedSettings = await fetch(config.apiBaseUrl + "/settings");
        const authorizedHeaders = { "x-kb-local-token": config.localToken };
        const settingsResponse = await fetch(config.apiBaseUrl + "/settings", { headers: authorizedHeaders });
        const runtimeResponse = await fetch(config.apiBaseUrl + "/system/runtime", { headers: authorizedHeaders });
        const settingsPayload = await settingsResponse.json();
        const runtimePayload = await runtimeResponse.json();
        return {
          bridgeAvailable: Boolean(bridge),
          config: {
            apiBaseUrl: config.apiBaseUrl,
            appName: config.appName,
            appVersion: config.appVersion,
            hasLocalToken: Boolean(config.localToken),
            localTokenLength: config.localToken ? config.localToken.length : 0
          },
          healthStatus: healthResponse.status,
          unauthorizedSettingsStatus: unauthorizedSettings.status,
          settingsStatus: settingsResponse.status,
          settingsLanguage: settingsPayload.language,
          runtimeApiStatus: runtimeResponse.status,
          runtimeApiState: runtimePayload.runtime_state,
          runtimeStatus,
          bodyTextLength: (document.body?.innerText || "").trim().length,
          locationHref: window.location.href
        };
      })();
    `);
    const shutdown = await sidecar.stop();
    writeDesktopSmokeResult({ ok: true, ...baseResult, rendererProbe, shutdown });
    exitDesktopSmoke(0);
  } catch (error) {
    const shutdown = await sidecar.stop();
    writeDesktopSmokeResult({
      ok: false,
      ...baseResult,
      shutdown,
      error: error instanceof Error ? error.message : "desktop_smoke_failed"
    });
    exitDesktopSmoke(1);
  }
}

ipcMain.handle("runtime:get-config", () => {
  const runtime = sidecar.getRuntime();
  if (!runtime) {
    throw new Error("Sidecar runtime is not ready.");
  }
  return {
    apiBaseUrl: runtime.apiBaseUrl,
    localToken: runtime.localToken,
    appName: appIdentity.appName,
    appVersion: appIdentity.version
  };
});

ipcMain.handle("runtime:get-status", () => {
  const runtime = sidecar.getRuntime();
  return {
    runtime_state: runtime?.status ?? "booting",
    status_reason: runtime?.statusReason ?? null,
    sidecar: {
      pid: runtime?.pid ?? null,
      url: runtime?.apiBaseUrl ?? null,
      health: runtime?.status === "ready" ? "available" : "degraded"
    }
  };
});

ipcMain.handle("native:open-file-dialog", async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openFile", "multiSelections"]
  });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle("native:export-diagnostics", async () => {
  const runtime = sidecar.getRuntime();
  return {
    appName: appIdentity.appName,
    runtime_state: runtime?.status ?? "booting",
    redacted: true,
    includes_source_text: false
  };
});

app.whenReady().then(createWindow).catch(async (error) => {
  const shutdown = await sidecar.stop();
  if (isDesktopSmoke) {
    writeDesktopSmokeResult({
      ok: false,
      mode: smokeMode,
      rendererUrl: process.env.KB_RENDERER_URL ?? "http://127.0.0.1:5173/dashboard",
      rendererMode: "remote",
      preloadPath: preloadPath(),
      sidecar: {
        pid: sidecar.getRuntime()?.pid ?? null,
        apiBaseUrl: sidecar.getRuntime()?.apiBaseUrl ?? null,
        status: sidecar.getRuntime()?.status ?? "degraded",
        health: "degraded",
        appDir: sidecar.getRuntime()?.appDir ?? null,
        logPath: sidecar.getRuntime()?.logPath ?? null
      },
      shutdown,
      error: error instanceof Error ? error.message : "desktop_boot_failed"
    });
    exitDesktopSmoke(1);
    return;
  }
  console.error(error);
  app.quit();
});

app.on("window-all-closed", async () => {
  await sidecar.stop();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", async () => {
  await sidecar.stop();
});
