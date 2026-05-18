import type {
  GraphPreviewResponse,
  KnowledgeRelationCreateRequest,
  KnowledgeRelationPatchRequest,
  KnowledgeRelationRecord,
  KnowledgeRelationDeleteResponse
} from "@knowledgebase-dev/api-types";
import { apiFetch } from "./apiClient";
import { organizationQuery, type OrganizationFilters } from "./organizationApi";

export type RelationFilters = OrganizationFilters & {
  status?: string;
};

export async function listRelations(filters: RelationFilters = {}): Promise<KnowledgeRelationRecord[]> {
  const query = organizationQuery(filters);
  const params = new URLSearchParams(query.slice(1));
  if (filters.status) params.set("status", filters.status);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<KnowledgeRelationRecord[]>(`/relations${suffix}`);
}

export async function createRelation(
  payload: KnowledgeRelationCreateRequest
): Promise<KnowledgeRelationRecord> {
  return apiFetch<KnowledgeRelationRecord>("/relations", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateRelation(
  relationId: string,
  payload: KnowledgeRelationPatchRequest
): Promise<KnowledgeRelationRecord> {
  return apiFetch<KnowledgeRelationRecord>(`/relations/${relationId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function archiveRelation(
  relationId: string
): Promise<KnowledgeRelationDeleteResponse> {
  return apiFetch<KnowledgeRelationDeleteResponse>(`/relations/${relationId}`, {
    method: "DELETE"
  });
}

export async function getGraphPreview(
  filters: OrganizationFilters = {}
): Promise<GraphPreviewResponse> {
  return apiFetch<GraphPreviewResponse>(`/graph/preview${organizationQuery(filters)}`);
}
