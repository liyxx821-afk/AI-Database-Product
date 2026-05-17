import type {
  FolderRecord,
  KnowledgeUnitOrganizationBatchUpdateRequest,
  OrganizationBatchUpdateResponse,
  OrganizationUpdateRequest,
  OrganizationUpdateResponse,
  ProjectRecord,
  SourceOrganizationBatchUpdateRequest,
  TagCreateRequest,
  TagRecord
} from "@knowledgebase-dev/api-types";
import { apiFetch } from "./apiClient";

export type OrganizationFilters = {
  projectId?: string;
  folderId?: string | null;
  tagIds?: string[];
};

export async function listProjects(): Promise<ProjectRecord[]> {
  return apiFetch<ProjectRecord[]>("/projects");
}

export async function createProject(name: string): Promise<ProjectRecord> {
  return apiFetch<ProjectRecord>("/projects", {
    method: "POST",
    body: JSON.stringify({ name })
  });
}

export async function listFolders(projectId = "default-space"): Promise<FolderRecord[]> {
  return apiFetch<FolderRecord[]>(`/folders?project_id=${encodeURIComponent(projectId)}`);
}

export async function createFolder(projectId: string, name: string): Promise<FolderRecord> {
  return apiFetch<FolderRecord>("/folders", {
    method: "POST",
    body: JSON.stringify({ project_id: projectId, name })
  });
}

export async function listTags(projectId = "default-space", namespace?: string): Promise<TagRecord[]> {
  const params = new URLSearchParams({ project_id: projectId });
  if (namespace) params.set("namespace", namespace);
  return apiFetch<TagRecord[]>(`/tags?${params.toString()}`);
}

export async function createTag(payload: TagCreateRequest): Promise<TagRecord> {
  return apiFetch<TagRecord>("/tags", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateSourceOrganization(
  sourceId: string,
  payload: OrganizationUpdateRequest
): Promise<OrganizationUpdateResponse> {
  return apiFetch<OrganizationUpdateResponse>(`/sources/${sourceId}/organization`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function updateSourcesOrganizationBatch(
  payload: SourceOrganizationBatchUpdateRequest
): Promise<OrganizationBatchUpdateResponse> {
  return apiFetch<OrganizationBatchUpdateResponse>("/sources/organization:batch", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function updateKnowledgeUnitOrganization(
  knowledgeUnitId: string,
  payload: OrganizationUpdateRequest
): Promise<OrganizationUpdateResponse> {
  return apiFetch<OrganizationUpdateResponse>(`/knowledge-units/${knowledgeUnitId}/organization`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function updateKnowledgeUnitsOrganizationBatch(
  payload: KnowledgeUnitOrganizationBatchUpdateRequest
): Promise<OrganizationBatchUpdateResponse> {
  return apiFetch<OrganizationBatchUpdateResponse>("/knowledge-units/organization:batch", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function organizationQuery(filters: OrganizationFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.projectId) params.set("project_id", filters.projectId);
  if (filters.folderId) params.set("folder_id", filters.folderId);
  if (filters.tagIds?.length) params.set("tag_ids", filters.tagIds.join(","));
  const query = params.toString();
  return query ? `?${query}` : "";
}
