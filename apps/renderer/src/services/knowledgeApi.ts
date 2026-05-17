import type { KnowledgeUnitRecord } from "@knowledgebase-dev/api-types";
import { apiFetch } from "./apiClient";

export async function listKnowledgeUnits(status?: string): Promise<KnowledgeUnitRecord[]> {
  const suffix = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch<KnowledgeUnitRecord[]>(`/knowledge-units${suffix}`);
}
