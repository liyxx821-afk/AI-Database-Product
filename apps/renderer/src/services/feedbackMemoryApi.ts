import type {
  FeedbackDiagnosticsSummary,
  FeedbackEventRecord,
  FeedbackRequest,
  FeedbackResponse,
  MemoryDraftRecord,
  MemoryDraftRequest
} from "@knowledgebase-dev/api-types";
import { apiFetch } from "./apiClient";

export type FeedbackTargetType = "evidence_pack" | "ai_answer" | "evidence_item";

export type FeedbackDiagnosticsFilters = {
  feedback_type?: FeedbackRequest["feedback_type"];
  target_type?: FeedbackTargetType;
  evidence_pack_id?: string;
  ai_answer_id?: string;
  evidence_item_id?: string;
  limit?: number;
};

export async function submitFeedback(payload: FeedbackRequest): Promise<FeedbackResponse> {
  return apiFetch<FeedbackResponse>("/feedback", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function listFeedbackEvents(
  filters: FeedbackDiagnosticsFilters = {}
): Promise<FeedbackEventRecord[]> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<FeedbackEventRecord[]>(`/feedback${suffix}`);
}

export async function getFeedbackSummary(): Promise<FeedbackDiagnosticsSummary> {
  return apiFetch<FeedbackDiagnosticsSummary>("/feedback/summary");
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
