import type {
  CitationAnnotationListResponse,
  CitationAnnotationPatchRequest,
  CitationAnnotationRecord,
  CitationAnnotationRequest,
  CitationCompareResponse,
  EvidenceOnlyResponse,
  EvidencePackDetail,
  RetrievalPreviewResponse
} from "@knowledgebase-dev/api-types";
import { apiFetch } from "./apiClient";

export async function previewRetrieval(query: string): Promise<RetrievalPreviewResponse> {
  return apiFetch<RetrievalPreviewResponse>("/retrieval/preview", {
    method: "POST",
    body: JSON.stringify({ query })
  });
}

export async function askEvidenceOnly(query: string): Promise<EvidenceOnlyResponse> {
  return apiFetch<EvidenceOnlyResponse>("/retrieval/evidence-only", {
    method: "POST",
    body: JSON.stringify({ query })
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
