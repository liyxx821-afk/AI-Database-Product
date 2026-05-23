import type {
  CitationAnnotationListResponse,
  CitationAnnotationBatchRequest,
  CitationAnnotationBatchResponse,
  CitationAnnotationPatchRequest,
  CitationAnnotationRecord,
  CitationAnnotationRequest,
  CitationCompareResponse,
  EvidenceOnlyResponse,
  EvidencePackDetail,
  RagAskResponse,
  RetrievalPreviewResponse
} from "@knowledgebase-dev/api-types";
import { apiFetch } from "./apiClient";
import type { OrganizationFilters } from "./organizationApi";

function retrievalPayload(query: string, filters?: OrganizationFilters) {
  return {
    query,
    project_id: filters?.projectId ?? "default-space",
    folder_id: filters?.folderId ?? null,
    tag_ids: filters?.tagIds ?? []
  };
}

export async function previewRetrieval(
  query: string,
  filters?: OrganizationFilters
): Promise<RetrievalPreviewResponse> {
  return apiFetch<RetrievalPreviewResponse>("/retrieval/preview", {
    method: "POST",
    body: JSON.stringify(retrievalPayload(query, filters))
  });
}

export async function askEvidenceOnly(
  query: string,
  filters?: OrganizationFilters
): Promise<EvidenceOnlyResponse> {
  return apiFetch<EvidenceOnlyResponse>("/retrieval/evidence-only", {
    method: "POST",
    body: JSON.stringify(retrievalPayload(query, filters))
  });
}

export async function askRagDemo(
  query: string,
  filters?: OrganizationFilters,
  topK = 3
): Promise<RagAskResponse> {
  return apiFetch<RagAskResponse>("/rag/ask", {
    method: "POST",
    body: JSON.stringify({ ...retrievalPayload(query, filters), top_k: topK })
  });
}

export async function getEvidencePack(
  evidencePackId: string,
  focusItemId?: string
): Promise<EvidencePackDetail> {
  const params = focusItemId ? `?focus_item_id=${encodeURIComponent(focusItemId)}` : "";
  return apiFetch<EvidencePackDetail>(`/evidence-packs/${evidencePackId}${params}`);
}

export async function getCitationAnnotations(
  evidencePackId: string
): Promise<CitationAnnotationListResponse> {
  return apiFetch<CitationAnnotationListResponse>(
    `/evidence-packs/${evidencePackId}/annotations`
  );
}

export async function createCitationAnnotation(
  evidencePackId: string,
  payload: CitationAnnotationRequest
): Promise<CitationAnnotationRecord> {
  return apiFetch<CitationAnnotationRecord>(`/evidence-packs/${evidencePackId}/annotations`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function createCitationAnnotationsBatch(
  evidencePackId: string,
  payload: CitationAnnotationBatchRequest
): Promise<CitationAnnotationBatchResponse> {
  return apiFetch<CitationAnnotationBatchResponse>(
    `/evidence-packs/${evidencePackId}/annotations:batch`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function updateCitationAnnotation(
  annotationId: string,
  payload: CitationAnnotationPatchRequest
): Promise<CitationAnnotationRecord> {
  return apiFetch<CitationAnnotationRecord>(`/citation-annotations/${annotationId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function deleteCitationAnnotation(annotationId: string): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/citation-annotations/${annotationId}`, {
    method: "DELETE"
  });
}

export async function compareEvidenceItems(
  evidencePackId: string,
  evidenceItemIds: string[]
): Promise<CitationCompareResponse> {
  return apiFetch<CitationCompareResponse>(`/evidence-packs/${evidencePackId}/compare`, {
    method: "POST",
    body: JSON.stringify({ evidence_item_ids: evidenceItemIds })
  });
}
