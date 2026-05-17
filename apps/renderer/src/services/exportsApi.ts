import type {
  KnowledgeExportHistoryRecord,
  KnowledgeExportResponse,
  KnowledgeUnitExportRequest,
  ProjectExportRequest
} from "@knowledgebase-dev/api-types";
import { apiFetch } from "./apiClient";

export type KnowledgeExportKind = "knowledge_units" | "project";
export type KnowledgeUnitExportFormat = "markdown" | "json";

export async function exportKnowledgeUnits(
  payload: KnowledgeUnitExportRequest
): Promise<KnowledgeExportResponse> {
  return apiFetch<KnowledgeExportResponse>("/exports/knowledge-units", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function exportProject(payload: ProjectExportRequest): Promise<KnowledgeExportResponse> {
  return apiFetch<KnowledgeExportResponse>("/exports/project", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function listKnowledgeExportHistory(): Promise<KnowledgeExportHistoryRecord[]> {
  return apiFetch<KnowledgeExportHistoryRecord[]>("/exports/history");
}

export async function deleteKnowledgeExportHistory(historyId: string): Promise<void> {
  await apiFetch<{ deleted: boolean; id: string }>(`/exports/history/${historyId}`, {
    method: "DELETE"
  });
}
