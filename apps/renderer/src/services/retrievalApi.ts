import type {
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
