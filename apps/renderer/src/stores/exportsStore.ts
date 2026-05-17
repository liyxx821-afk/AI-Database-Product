import { create } from "zustand";
import type {
  KnowledgeExportResponse,
  KnowledgeUnitExportRequest,
  ProjectExportRequest
} from "@knowledgebase-dev/api-types";
import { hasBridge } from "../services/apiClient";
import { exportKnowledgeUnits, exportProject } from "../services/exportsApi";

type ViewState = "loading" | "empty" | "degraded" | "recoverable_error" | "done";

type KnowledgeExportStore = {
  state: ViewState;
  errorCode?: string;
  lastExport?: KnowledgeExportResponse;
  exportKnowledgeUnits: (
    payload: KnowledgeUnitExportRequest
  ) => Promise<KnowledgeExportResponse | undefined>;
  exportProject: (payload: ProjectExportRequest) => Promise<KnowledgeExportResponse | undefined>;
};

export const useKnowledgeExportStore = create<KnowledgeExportStore>((set) => ({
  state: "empty",
  async exportKnowledgeUnits(payload: KnowledgeUnitExportRequest) {
    if (!hasBridge()) {
      set({ state: "degraded", errorCode: "desktop_bridge_unavailable" });
      return undefined;
    }
    set({ state: "loading", errorCode: undefined });
    try {
      const exported = await exportKnowledgeUnits(payload);
      set({
        state: exported.record_count ? "done" : "empty",
        errorCode: undefined,
        lastExport: exported
      });
      return exported;
    } catch (error) {
      set({
        state: "recoverable_error",
        errorCode: error instanceof Error ? error.message : "knowledge_export_failed"
      });
      return undefined;
    }
  },
  async exportProject(payload: ProjectExportRequest) {
    if (!hasBridge()) {
      set({ state: "degraded", errorCode: "desktop_bridge_unavailable" });
      return undefined;
    }
    set({ state: "loading", errorCode: undefined });
    try {
      const exported = await exportProject(payload);
      set({
        state: exported.record_count ? "done" : "empty",
        errorCode: undefined,
        lastExport: exported
      });
      return exported;
    } catch (error) {
      set({
        state: "recoverable_error",
        errorCode: error instanceof Error ? error.message : "project_export_failed"
      });
      return undefined;
    }
  }
}));
