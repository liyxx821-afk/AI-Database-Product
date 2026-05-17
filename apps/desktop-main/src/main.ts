import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { appIdentity } from "@knowledgebase-dev/shared-config";
import { SidecarManager } from "./sidecar.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const sidecar = new SidecarManager();
let mainWindow: BrowserWindow | null = null;

function preloadPath(): string {
  return path.join(repoRoot, "apps", "desktop-preload", "dist", "preload.cjs");
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
  await mainWindow.loadURL(rendererUrl);
  mainWindow.webContents.once("did-finish-load", () => {
    mainWindow?.webContents.send("runtime-status", {
      runtime_state: runtime.status,
      status_reason: runtime.statusReason
    });
  });
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

app.whenReady().then(createWindow);

app.on("window-all-closed", async () => {
  await sidecar.stop();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", async () => {
  await sidecar.stop();
});
