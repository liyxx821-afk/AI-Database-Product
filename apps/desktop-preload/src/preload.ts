import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("knowledgeBase", {
  runtime: {
    getRuntimeConfig: () => ipcRenderer.invoke("runtime:get-config"),
    getRuntimeStatus: () => ipcRenderer.invoke("runtime:get-status"),
    onRuntimeStatusChange: (callback: (status: unknown) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, status: unknown) => callback(status);
      ipcRenderer.on("runtime-status", listener);
      return () => ipcRenderer.removeListener("runtime-status", listener);
    }
  },
  native: {
    openFileDialog: () => ipcRenderer.invoke("native:open-file-dialog"),
    exportDiagnostics: () => ipcRenderer.invoke("native:export-diagnostics")
  }
});
