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
import { apiFetch } from "./apiClient";

export type FeedbackTargetType = "evidence_pack" | "ai_answer" | "evidence_item";
export type FeedbackExportFormat = "json" | "csv";
export type FeedbackRankingEffect =
  | "positive_weight_suggestion"
  | "negative_weight_suggestion"
  | "diagnostic_only";
export type FeedbackSortOrder = "created_desc" | "created_asc";

export type FeedbackDiagnosticsFilters = {
  feedback_type?: FeedbackRequest["feedback_type"];
  target_type?: FeedbackTargetType;
  evidence_pack_id?: string;
  ai_answer_id?: string;
  evidence_item_id?: string;
  created_from?: string;
  created_to?: string;
  search?: string;
  ranking_effect?: FeedbackRankingEffect;
  has_comment?: boolean;
  sort?: FeedbackSortOrder;
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

export async function getFeedbackSummary(
  filters: FeedbackDiagnosticsFilters = {}
): Promise<FeedbackDiagnosticsSummary> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<FeedbackDiagnosticsSummary>(`/feedback/summary${suffix}`);
}

export async function exportFeedbackDiagnostics(
  format: FeedbackExportFormat,
  filters: FeedbackDiagnosticsFilters = {}
): Promise<FeedbackDiagnosticsExportResponse> {
  const params = new URLSearchParams({ format });
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return apiFetch<FeedbackDiagnosticsExportResponse>(`/feedback/export?${params.toString()}`);
}

export async function listFeedbackExportHistory(): Promise<FeedbackExportHistoryRecord[]> {
  return apiFetch<FeedbackExportHistoryRecord[]>("/feedback/export-history");
}

export async function deleteFeedbackExportHistory(historyId: string): Promise<void> {
  await apiFetch<{ deleted: boolean; id: string }>(`/feedback/export-history/${historyId}`, {
    method: "DELETE"
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
