import { create } from "zustand";
import type { FileRecord } from "@knowledgebase-dev/api-types";
import { hasBridge } from "../services/apiClient";
import { listFiles, parseFile, verifyFile } from "../services/fileApi";
import { storeErrorCode } from "./errors";

type FileStore = {
  files: FileRecord[];
  state: "loading" | "empty" | "degraded" | "recoverable_error" | "done";
  errorCode: string | null;
  refresh: () => Promise<void>;
  verify: (fileId: string) => Promise<void>;
  parse: (fileId: string) => Promise<void>;
};

export const useFileStore = create<FileStore>((set, get) => ({
  files: [],
  state: "empty",
  errorCode: null,
  refresh: async () => {
    if (!hasBridge()) {
      set({ state: "degraded", errorCode: "desktop_bridge_unavailable" });
      return;
    }
    set({ state: "loading", errorCode: null });
    try {
      const files = await listFiles();
      set({ files, state: files.length ? "done" : "empty", errorCode: null });
    } catch (error) {
      set({
        state: "recoverable_error",
        errorCode: storeErrorCode(error, "file_list_failed")
      });
    }
  },
  verify: async (fileId: string) => {
    if (!hasBridge()) {
      set({ state: "degraded", errorCode: "desktop_bridge_unavailable" });
      return;
    }
    try {
      const verified = await verifyFile(fileId);
      set({
        files: get().files.map((file) => (file.id === fileId ? verified : file)),
        errorCode: null
      });
    } catch (error) {
      set({ errorCode: storeErrorCode(error, "file_verify_failed") });
    }
  },
  parse: async (fileId: string) => {
    if (!hasBridge()) {
      set({ state: "degraded", errorCode: "desktop_bridge_unavailable" });
      return;
    }
    try {
      await parseFile(fileId);
      const files = await listFiles();
      set({ files, state: files.length ? "done" : "empty", errorCode: null });
    } catch (error) {
      set({ errorCode: storeErrorCode(error, "file_parse_failed") });
    }
  }
}));
