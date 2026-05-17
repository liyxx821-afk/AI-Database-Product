import { create } from "zustand";
import type {
  FeedbackRequest,
  FeedbackResponse,
  MemoryDraftRecord,
  MemoryDraftRequest
} from "@knowledgebase-dev/api-types";
import { hasBridge } from "../services/apiClient";
import {
  createMemoryDraft,
  listMemoryDrafts,
  submitFeedback
} from "../services/feedbackMemoryApi";

type ViewState = "loading" | "empty" | "degraded" | "recoverable_error" | "done";

type FeedbackMemoryState = {
  feedbackState: ViewState;
  memoryState: ViewState;
  feedbackErrorCode?: string;
  memoryErrorCode?: string;
  lastFeedback?: FeedbackResponse;
  memories: MemoryDraftRecord[];
  submitFeedback: (payload: FeedbackRequest) => Promise<void>;
  createMemoryDraft: (payload: MemoryDraftRequest) => Promise<MemoryDraftRecord | undefined>;
  refreshMemories: () => Promise<void>;
};

export const useFeedbackMemoryStore = create<FeedbackMemoryState>((set, get) => ({
  feedbackState: "empty",
  memoryState: "empty",
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
        feedbackErrorCode: error instanceof Error ? error.message : "feedback_submit_failed"
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
        memoryErrorCode: error instanceof Error ? error.message : "memory_draft_create_failed"
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
        memoryErrorCode: error instanceof Error ? error.message : "memory_draft_list_failed"
      });
    }
  }
}));
