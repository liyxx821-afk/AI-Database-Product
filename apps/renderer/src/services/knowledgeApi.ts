import type { KnowledgeUnitRecord } from "@knowledgebase-dev/api-types";
import { apiFetch } from "./apiClient";
import { organizationQuery, type OrganizationFilters } from "./organizationApi";

export async function listKnowledgeUnits(
  status?: string,
  filters?: OrganizationFilters
): Promise<KnowledgeUnitRecord[]> {
  const query = organizationQuery(filters);
  const params = new URLSearchParams(query.slice(1));
  if (status) params.set("status", status);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<KnowledgeUnitRecord[]>(`/knowledge-units${suffix}`);
}
