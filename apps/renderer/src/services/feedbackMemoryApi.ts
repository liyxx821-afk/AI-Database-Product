import type {
  FeedbackRequest,
  FeedbackResponse,
  MemoryDraftRecord,
  MemoryDraftRequest
} from "@knowledgebase-dev/api-types";
import { apiFetch } from "./apiClient";

export async function submitFeedback(payload: FeedbackRequest): Promise<FeedbackResponse> {
  return apiFetch<FeedbackResponse>("/feedback", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function createMemoryDraft(payload: MemoryDraftRequest): Promise<MemoryDraftRecord> {
  return apiFetch<MemoryDraftRecord>("/memory-drafts", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function listMemoryDrafts(): Promise<MemoryDraftRecord[]> {
  return apiFetch<MemoryDraftRecord[]>("/memory-drafts");
}
