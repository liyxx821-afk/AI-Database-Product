import type { TextToSqlPreviewResponse } from "@knowledgebase-dev/api-types";
import { apiFetch } from "./apiClient";
import type { OrganizationFilters } from "./organizationApi";

function textToSqlPayload(query: string, filters?: OrganizationFilters, limit = 50) {
  return {
    query,
    project_id: filters?.projectId ?? "default-space",
    folder_id: filters?.folderId ?? null,
    tag_ids: filters?.tagIds ?? [],
    limit
  };
}

export async function previewTextToSql(
  query: string,
  filters?: OrganizationFilters,
  limit = 50
): Promise<TextToSqlPreviewResponse> {
  return apiFetch<TextToSqlPreviewResponse>("/text-to-sql/preview", {
    method: "POST",
    body: JSON.stringify(textToSqlPayload(query, filters, limit))
  });
}
