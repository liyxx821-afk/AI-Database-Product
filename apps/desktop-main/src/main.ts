import path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { appIdentity } from "@knowledgebase-dev/shared-config";
import { SidecarManager, type SidecarRuntime } from "./sidecar.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const sidecar = new SidecarManager();
let mainWindow: BrowserWindow | null = null;
const isDesktopSmoke = process.env.KB_DESKTOP_SMOKE === "1";

if (process.env.KB_DESKTOP_USER_DATA_DIR) {
  app.setPath("userData", process.env.KB_DESKTOP_USER_DATA_DIR);
}

function preloadPath(): string {
  return path.join(repoRoot, "apps", "desktop-preload", "dist", "preload.js");
}

async function createWindow(): Promise<void> {
  const runtime = await sidecar.start(app.getPath("userData"));
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

  const rendererUrl = process.env.KB_RENDERER_URL ?? "http://127.0.0.1:5173/dashboard";
  const loaded = new Promise<void>((resolve, reject) => {
    mainWindow?.webContents.once("did-finish-load", () => resolve());
    mainWindow?.webContents.once("did-fail-load", (_event, errorCode, errorDescription) => {
      reject(new Error(`Renderer failed to load: ${errorCode} ${errorDescription}`));
    });
  });
  await mainWindow.loadURL(rendererUrl);
  await loaded;
  mainWindow.webContents.send("runtime-status", {
    runtime_state: runtime.status,
    status_reason: runtime.statusReason
  });

  if (isDesktopSmoke) {
    await runDesktopSmoke(runtime, rendererUrl);
  }
}

type DesktopSmokeResult = {
  ok: boolean;
  mode: "desktop-runtime-smoke";
  rendererUrl: string;
  sidecar: {
    pid: number | null;
    apiBaseUrl: string | null;
    status: string;
    health: "available" | "degraded";
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

async function runDesktopSmoke(runtime: SidecarRuntime, rendererUrl: string): Promise<void> {
  const baseResult = {
    mode: "desktop-runtime-smoke" as const,
    rendererUrl,
    sidecar: {
      pid: runtime.pid,
      apiBaseUrl: runtime.apiBaseUrl,
      status: runtime.status,
      health: runtime.status === "ready" ? ("available" as const) : ("degraded" as const)
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
      mode: "desktop-runtime-smoke",
      rendererUrl: process.env.KB_RENDERER_URL ?? "http://127.0.0.1:5173/dashboard",
      sidecar: {
        pid: sidecar.getRuntime()?.pid ?? null,
        apiBaseUrl: sidecar.getRuntime()?.apiBaseUrl ?? null,
        status: sidecar.getRuntime()?.status ?? "degraded",
        health: "degraded"
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
