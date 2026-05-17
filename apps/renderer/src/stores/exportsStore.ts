import { create } from "zustand";
import type {
  KnowledgeExportHistoryRecord,
  KnowledgeExportResponse,
  KnowledgeUnitExportRequest,
  ProjectExportRequest
} from "@knowledgebase-dev/api-types";
import { hasBridge } from "../services/apiClient";
import {
  deleteKnowledgeExportHistory,
  exportKnowledgeUnits,
  exportProject,
  listKnowledgeExportHistory
} from "../services/exportsApi";
import { resolveErrorCode } from "../utils/errors";

type ViewState = "loading" | "empty" | "degraded" | "recoverable_error" | "done";

type KnowledgeExportStore = {
  state: ViewState;
  historyState: ViewState;
  errorCode?: string;
  historyErrorCode?: string;
  lastExport?: KnowledgeExportResponse;
  history: KnowledgeExportHistoryRecord[];
  exportKnowledgeUnits: (
    payload: KnowledgeUnitExportRequest
  ) => Promise<KnowledgeExportResponse | undefined>;
  exportProject: (payload: ProjectExportRequest) => Promise<KnowledgeExportResponse | undefined>;
  refreshHistory: () => Promise<void>;
  deleteHistory: (historyId: string) => Promise<void>;
};

export const useKnowledgeExportStore = create<KnowledgeExportStore>((set) => ({
  state: "empty",
  historyState: "empty",
  history: [],
  async exportKnowledgeUnits(payload: KnowledgeUnitExportRequest) {
    if (!hasBridge()) {
      set({ state: "degraded", errorCode: "desktop_bridge_unavailable" });
      return undefined;
    }
    set({ state: "loading", errorCode: undefined });
    try {
      const exported = await exportKnowledgeUnits(payload);
      const history = await listKnowledgeExportHistory();
      set({
        state: exported.record_count ? "done" : "empty",
        errorCode: undefined,
        lastExport: exported,
        history,
        historyState: history.length ? "done" : "empty",
        historyErrorCode: undefined
      });
      return exported;
    } catch (error) {
      set({
        state: "recoverable_error",
        errorCode: resolveErrorCode(error, "knowledge_export_failed")
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
      const history = await listKnowledgeExportHistory();
      set({
        state: exported.record_count ? "done" : "empty",
        errorCode: undefined,
        lastExport: exported,
        history,
        historyState: history.length ? "done" : "empty",
        historyErrorCode: undefined
      });
      return exported;
    } catch (error) {
      set({
        state: "recoverable_error",
        errorCode: resolveErrorCode(error, "project_export_failed")
      });
      return undefined;
    }
  },
  async refreshHistory() {
    if (!hasBridge()) {
      set({
        history: [],
        historyState: "degraded",
        historyErrorCode: "desktop_bridge_unavailable"
      });
      return;
    }
    set({ historyState: "loading", historyErrorCode: undefined });
    try {
      const history = await listKnowledgeExportHistory();
      set({
        history,
        historyState: history.length ? "done" : "empty",
        historyErrorCode: undefined
      });
    } catch (error) {
      set({
        historyState: "recoverable_error",
        historyErrorCode: resolveErrorCode(error, "knowledge_export_history_failed")
      });
    }
  },
  async deleteHistory(historyId: string) {
    if (!hasBridge()) {
      set({
        historyState: "degraded",
        historyErrorCode: "desktop_bridge_unavailable"
      });
      return;
    }
    set({ historyState: "loading", historyErrorCode: undefined });
    try {
      await deleteKnowledgeExportHistory(historyId);
      const history = await listKnowledgeExportHistory();
      set({
        history,
        historyState: history.length ? "done" : "empty",
        historyErrorCode: undefined
      });
    } catch (error) {
      set({
        historyState: "recoverable_error",
        historyErrorCode: resolveErrorCode(error, "knowledge_export_history_delete_failed")
      });
    }
  }
}));
