import { create } from "zustand";
import type {
  FeedbackDiagnosticsExportResponse,
  FeedbackDiagnosticsSummary,
  FeedbackEventRecord,
  FeedbackExportHistoryRecord,
  FeedbackRequest,
  FeedbackResponse,
  MemoryDraftRecord,
  MemoryDraftRequest
} from "@knowledgebase-dev/api-types";
import { hasBridge } from "../services/apiClient";
import {
  createMemoryDraft,
  deleteFeedbackExportHistory,
  exportFeedbackDiagnostics,
  getFeedbackSummary,
  listFeedbackExportHistory,
  listFeedbackEvents,
  listMemoryDrafts,
  submitFeedback,
  type FeedbackDiagnosticsFilters,
  type FeedbackExportFormat
} from "../services/feedbackMemoryApi";
import { storeErrorCode } from "./errors";

type ViewState = "loading" | "empty" | "degraded" | "recoverable_error" | "done";

type FeedbackMemoryState = {
  feedbackState: ViewState;
  memoryState: ViewState;
  diagnosticsState: ViewState;
  diagnosticsExportState: ViewState;
  exportHistoryState: ViewState;
  feedbackErrorCode?: string;
  memoryErrorCode?: string;
  diagnosticsErrorCode?: string;
  diagnosticsExportErrorCode?: string;
  exportHistoryErrorCode?: string;
  lastFeedback?: FeedbackResponse;
  lastDiagnosticsExport?: FeedbackDiagnosticsExportResponse;
  feedbackEvents: FeedbackEventRecord[];
  feedbackSummary?: FeedbackDiagnosticsSummary;
  feedbackExportHistory: FeedbackExportHistoryRecord[];
  memories: MemoryDraftRecord[];
  submitFeedback: (payload: FeedbackRequest) => Promise<void>;
  createMemoryDraft: (payload: MemoryDraftRequest) => Promise<MemoryDraftRecord | undefined>;
  refreshMemories: () => Promise<void>;
  refreshFeedbackDiagnostics: (filters?: FeedbackDiagnosticsFilters) => Promise<void>;
  exportFeedbackDiagnostics: (
    filters: FeedbackDiagnosticsFilters | undefined,
    format: FeedbackExportFormat
  ) => Promise<FeedbackDiagnosticsExportResponse | undefined>;
  refreshFeedbackExportHistory: () => Promise<void>;
  deleteFeedbackExportHistory: (historyId: string) => Promise<void>;
};

export const useFeedbackMemoryStore = create<FeedbackMemoryState>((set, get) => ({
  feedbackState: "empty",
  memoryState: "empty",
  diagnosticsState: "empty",
  diagnosticsExportState: "empty",
  exportHistoryState: "empty",
  feedbackEvents: [],
  feedbackExportHistory: [],
  memories: [],
  async submitFeedback(payload: FeedbackRequest) {
    if (!hasBridge()) {
      set({
        feedbackState: "degraded",
        feedbackErrorCode: "desktop_bridge_unavailable"
      });
      return;
    }
    set({ feedbackState: "loading", feedbackErrorCode: undefined });
    try {
      const feedback = await submitFeedback(payload);
      set({ feedbackState: "done", feedbackErrorCode: undefined, lastFeedback: feedback });
    } catch (error) {
      set({
        feedbackState: "recoverable_error",
        feedbackErrorCode: storeErrorCode(error, "feedback_submit_failed")
      });
    }
  },
  async createMemoryDraft(payload: MemoryDraftRequest) {
    if (!hasBridge()) {
      set({
        memoryState: "degraded",
        memoryErrorCode: "desktop_bridge_unavailable"
      });
      return undefined;
    }
    set({ memoryState: "loading", memoryErrorCode: undefined });
    try {
      const draft = await createMemoryDraft(payload);
      set({
        memories: [draft, ...get().memories.filter((memory) => memory.id !== draft.id)],
        memoryState: "done",
        memoryErrorCode: undefined
      });
      return draft;
    } catch (error) {
      set({
        memoryState: "recoverable_error",
        memoryErrorCode: storeErrorCode(error, "memory_draft_create_failed")
      });
      return undefined;
    }
  },
  async refreshMemories() {
    if (!hasBridge()) {
      set({
        memories: [],
        memoryState: "degraded",
        memoryErrorCode: "desktop_bridge_unavailable"
      });
      return;
    }
    set({ memoryState: "loading", memoryErrorCode: undefined });
    try {
      const memories = await listMemoryDrafts();
      set({
        memories,
        memoryState: memories.length ? "done" : "empty",
        memoryErrorCode: undefined
      });
    } catch (error) {
      set({
        memoryState: "recoverable_error",
        memoryErrorCode: storeErrorCode(error, "memory_draft_list_failed")
      });
    }
  },
  async refreshFeedbackDiagnostics(filters: FeedbackDiagnosticsFilters = {}) {
    if (!hasBridge()) {
      set({
        feedbackEvents: [],
        feedbackSummary: undefined,
        diagnosticsState: "degraded",
        diagnosticsErrorCode: "desktop_bridge_unavailable"
      });
      return;
    }
    set({ diagnosticsState: "loading", diagnosticsErrorCode: undefined });
    try {
      const [events, summary] = await Promise.all([
        listFeedbackEvents(filters),
        getFeedbackSummary(filters)
      ]);
      set({
        feedbackEvents: events,
        feedbackSummary: summary,
        diagnosticsState: events.length ? "done" : "empty",
        diagnosticsErrorCode: undefined
      });
    } catch (error) {
      set({
        diagnosticsState: "recoverable_error",
        diagnosticsErrorCode: storeErrorCode(error, "feedback_diagnostics_failed")
      });
    }
  },
  async exportFeedbackDiagnostics(filters: FeedbackDiagnosticsFilters = {}, format: FeedbackExportFormat) {
    if (!hasBridge()) {
      set({
        diagnosticsExportState: "degraded",
        diagnosticsExportErrorCode: "desktop_bridge_unavailable"
      });
      return undefined;
    }
    set({ diagnosticsExportState: "loading", diagnosticsExportErrorCode: undefined });
    try {
      const exported = await exportFeedbackDiagnostics(format, filters);
      const history = await listFeedbackExportHistory();
      set({
        lastDiagnosticsExport: exported,
        feedbackExportHistory: history,
        exportHistoryState: history.length ? "done" : "empty",
        exportHistoryErrorCode: undefined,
        diagnosticsExportState: exported.record_count ? "done" : "empty",
        diagnosticsExportErrorCode: undefined
      });
      return exported;
    } catch (error) {
      set({
        diagnosticsExportState: "recoverable_error",
        diagnosticsExportErrorCode: storeErrorCode(error, "feedback_export_failed")
      });
      return undefined;
    }
  },
  async refreshFeedbackExportHistory() {
    if (!hasBridge()) {
      set({
        feedbackExportHistory: [],
        exportHistoryState: "degraded",
        exportHistoryErrorCode: "desktop_bridge_unavailable"
      });
      return;
    }
    set({ exportHistoryState: "loading", exportHistoryErrorCode: undefined });
    try {
      const history = await listFeedbackExportHistory();
      set({
        feedbackExportHistory: history,
        exportHistoryState: history.length ? "done" : "empty",
        exportHistoryErrorCode: undefined
      });
    } catch (error) {
      set({
        exportHistoryState: "recoverable_error",
        exportHistoryErrorCode: storeErrorCode(error, "feedback_export_history_failed")
      });
    }
  },
  async deleteFeedbackExportHistory(historyId: string) {
    if (!hasBridge()) {
      set({
        exportHistoryState: "degraded",
        exportHistoryErrorCode: "desktop_bridge_unavailable"
      });
      return;
    }
    set({ exportHistoryState: "loading", exportHistoryErrorCode: undefined });
    try {
      await deleteFeedbackExportHistory(historyId);
      const history = await listFeedbackExportHistory();
      set({
        feedbackExportHistory: history,
        exportHistoryState: history.length ? "done" : "empty",
        exportHistoryErrorCode: undefined
      });
    } catch (error) {
      set({
        exportHistoryState: "recoverable_error",
        exportHistoryErrorCode: storeErrorCode(error, "feedback_export_history_delete_failed")
      });
    }
  }
}));
