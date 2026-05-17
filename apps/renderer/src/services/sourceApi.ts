import type { KnowledgeExtractResponse, SourceDetail, SourceRecord } from "@knowledgebase-dev/api-types";
import { apiFetch } from "./apiClient";
import { organizationQuery, type OrganizationFilters } from "./organizationApi";

export async function listSources(filters?: OrganizationFilters): Promise<SourceRecord[]> {
  return apiFetch<SourceRecord[]>(`/sources${organizationQuery(filters)}`);
}

export async function getSource(sourceId: string): Promise<SourceDetail> {
  return apiFetch<SourceDetail>(`/sources/${sourceId}`);
}

export async function extractKnowledgeFromSource(sourceId: string): Promise<KnowledgeExtractResponse> {
  return apiFetch<KnowledgeExtractResponse>("/knowledge-units:extract", {
    method: "POST",
    body: JSON.stringify({ source_id: sourceId })
  });
}
