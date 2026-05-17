import { create } from "zustand";
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
import { hasBridge } from "../services/apiClient";
import {
  askEvidenceOnly,
  compareEvidenceItems,
  createCitationAnnotation,
  deleteCitationAnnotation,
  getCitationAnnotations,
  getEvidencePack,
  previewRetrieval,
  updateCitationAnnotation
} from "../services/retrievalApi";

type ViewState = "loading" | "empty" | "degraded" | "recoverable_error" | "done";

type RetrievalState = {
  lastQuery: string;
  state: ViewState;
  previewState: ViewState;
  answerState: ViewState;
  detailState: ViewState;
  annotationState: ViewState;
  compareState: ViewState;
  errorCode?: string;
  previewErrorCode?: string;
  answerErrorCode?: string;
  detailErrorCode?: string;
  annotationErrorCode?: string;
  compareErrorCode?: string;
  preview?: RetrievalPreviewResponse;
  answer?: EvidenceOnlyResponse;
  detail?: EvidencePackDetail;
  annotations?: CitationAnnotationListResponse;
  comparison?: CitationCompareResponse;
  focusedEvidenceItemId?: string;
  previewQuery: (query: string) => Promise<void>;
  ask: (query: string) => Promise<void>;
  loadDetail: (evidencePackId: string, focusItemId?: string) => Promise<void>;
  refreshAnnotations: (evidencePackId: string) => Promise<void>;
  createAnnotation: (
    evidencePackId: string,
    payload: CitationAnnotationRequest
  ) => Promise<CitationAnnotationRecord | undefined>;
  updateAnnotation: (
    annotationId: string,
    payload: CitationAnnotationPatchRequest
  ) => Promise<CitationAnnotationRecord | undefined>;
  deleteAnnotation: (annotationId: string) => Promise<void>;
  compareItems: (evidencePackId: string, evidenceItemIds: string[]) => Promise<void>;
  clearComparison: () => void;
};

export const useRetrievalStore = create<RetrievalState>((set) => ({
  lastQuery: "",
  state: "empty",
  previewState: "empty",
  answerState: "empty",
  detailState: "empty",
  annotationState: "empty",
  compareState: "empty",
  async previewQuery(query: string) {
    if (!hasBridge()) {
      set({
        lastQuery: query,
        state: "degraded",
        previewState: "degraded",
        errorCode: "desktop_bridge_unavailable",
        previewErrorCode: "desktop_bridge_unavailable"
      });
      return;
    }
    set({
      lastQuery: query,
      state: "loading",
      previewState: "loading",
      errorCode: undefined,
      previewErrorCode: undefined
    });
    try {
      const preview = await previewRetrieval(query);
      const nextState = preview.evidence_item_ids.length ? "done" : "empty";
      set({
        preview,
        detail: undefined,
        annotations: undefined,
        comparison: undefined,
        focusedEvidenceItemId: undefined,
        detailState: "empty",
        annotationState: "empty",
        compareState: "empty",
        state: nextState,
        previewState: nextState,
        errorCode: undefined,
        previewErrorCode: undefined
      });
    } catch (error) {
      const errorCode = error instanceof Error ? error.message : "retrieval_preview_failed";
      set({
        state: "recoverable_error",
        previewState: "recoverable_error",
        errorCode,
        previewErrorCode: errorCode
      });
    }
  },
  async ask(query: string) {
    if (!hasBridge()) {
      set({
        lastQuery: query,
        state: "degraded",
        answerState: "degraded",
        errorCode: "desktop_bridge_unavailable",
        answerErrorCode: "desktop_bridge_unavailable"
      });
      return;
    }
    set({
      lastQuery: query,
      state: "loading",
      answerState: "loading",
      errorCode: undefined,
      answerErrorCode: undefined
    });
    try {
      const answer = await askEvidenceOnly(query);
      const nextState = answer.evidence_item_ids.length ? "done" : "empty";
      set({
        answer,
        detail: undefined,
        annotations: undefined,
        comparison: undefined,
        focusedEvidenceItemId: undefined,
        detailState: "empty",
        annotationState: "empty",
        compareState: "empty",
        state: nextState,
        answerState: nextState,
        errorCode: undefined,
        answerErrorCode: undefined
      });
    } catch (error) {
      const errorCode = error instanceof Error ? error.message : "evidence_only_answer_failed";
      set({
        state: "recoverable_error",
        answerState: "recoverable_error",
        errorCode,
        answerErrorCode: errorCode
      });
    }
  },
  async loadDetail(evidencePackId: string, focusItemId?: string) {
    if (!hasBridge()) {
      set({
        state: "degraded",
        detailState: "degraded",
        annotationState: "degraded",
        errorCode: "desktop_bridge_unavailable",
        detailErrorCode: "desktop_bridge_unavailable",
        annotationErrorCode: "desktop_bridge_unavailable"
      });
      return;
    }
    set({
      state: "loading",
      detailState: "loading",
      annotationState: "loading",
      detailErrorCode: undefined,
      annotationErrorCode: undefined
    });
    try {
      const detail = await getEvidencePack(evidencePackId, focusItemId);
      const annotations = await getCitationAnnotations(evidencePackId);
      set({
        detail,
        annotations,
        focusedEvidenceItemId: detail.detail_summary.focused_item_id ?? focusItemId,
        state: detail.items.length ? "done" : "empty",
        detailState: detail.items.length ? "done" : "empty",
        annotationState: annotations.total ? "done" : "empty",
        detailErrorCode: undefined,
        annotationErrorCode: undefined
      });
    } catch (error) {
      const errorCode = error instanceof Error ? error.message : "evidence_pack_detail_failed";
      set({
        state: "recoverable_error",
        detailState: "recoverable_error",
        annotationState: "recoverable_error",
        errorCode,
        detailErrorCode: errorCode,
        annotationErrorCode: errorCode
      });
    }
  },
  async refreshAnnotations(evidencePackId: string) {
    if (!hasBridge()) {
      set({
        annotationState: "degraded",
        annotationErrorCode: "desktop_bridge_unavailable"
      });
      return;
    }
    set({ annotationState: "loading", annotationErrorCode: undefined });
    try {
      const annotations = await getCitationAnnotations(evidencePackId);
      set({
        annotations,
        annotationState: annotations.total ? "done" : "empty",
        annotationErrorCode: undefined
      });
    } catch (error) {
      const errorCode = error instanceof Error ? error.message : "citation_annotations_failed";
      set({ annotationState: "recoverable_error", annotationErrorCode: errorCode });
    }
  },
  async createAnnotation(evidencePackId: string, payload: CitationAnnotationRequest) {
    if (!hasBridge()) {
      set({
        annotationState: "degraded",
        annotationErrorCode: "desktop_bridge_unavailable"
      });
      return undefined;
    }
    set({ annotationState: "loading", annotationErrorCode: undefined });
    try {
      const annotation = await createCitationAnnotation(evidencePackId, payload);
      const annotations = await getCitationAnnotations(evidencePackId);
      const detail = await getEvidencePack(evidencePackId, payload.evidence_item_id);
      set({
        annotationState: "done",
        annotationErrorCode: undefined,
        annotations,
        detail,
        focusedEvidenceItemId: payload.evidence_item_id
      });
      return annotation;
    } catch (error) {
      const errorCode = error instanceof Error ? error.message : "citation_annotation_create_failed";
      set({ annotationState: "recoverable_error", annotationErrorCode: errorCode });
      return undefined;
    }
  },
  async updateAnnotation(annotationId: string, payload: CitationAnnotationPatchRequest) {
    if (!hasBridge()) {
      set({
        annotationState: "degraded",
        annotationErrorCode: "desktop_bridge_unavailable"
      });
      return undefined;
    }
    set({ annotationState: "loading", annotationErrorCode: undefined });
    try {
      const annotation = await updateCitationAnnotation(annotationId, payload);
      const annotations = await getCitationAnnotations(annotation.evidence_pack_id);
      const detail = await getEvidencePack(annotation.evidence_pack_id, annotation.evidence_item_id);
      set({
        annotationState: "done",
        annotationErrorCode: undefined,
        annotations,
        detail,
        focusedEvidenceItemId: annotation.evidence_item_id
      });
      return annotation;
    } catch (error) {
      const errorCode = error instanceof Error ? error.message : "citation_annotation_update_failed";
      set({ annotationState: "recoverable_error", annotationErrorCode: errorCode });
      return undefined;
    }
  },
  async deleteAnnotation(annotationId: string) {
    if (!hasBridge()) {
      set({
        annotationState: "degraded",
        annotationErrorCode: "desktop_bridge_unavailable"
      });
      return;
    }
    const current = useRetrievalStore.getState();
    const currentAnnotation = current.annotations?.annotations.find(
      (annotation) => annotation.id === annotationId
    );
    set({ annotationState: "loading", annotationErrorCode: undefined });
    try {
      await deleteCitationAnnotation(annotationId);
      if (currentAnnotation) {
        const annotations = await getCitationAnnotations(currentAnnotation.evidence_pack_id);
        const detail = await getEvidencePack(
          currentAnnotation.evidence_pack_id,
          currentAnnotation.evidence_item_id
        );
        set({
          annotations,
          detail,
          focusedEvidenceItemId: currentAnnotation.evidence_item_id,
          annotationState: annotations.total ? "done" : "empty",
          annotationErrorCode: undefined
        });
      } else {
        set({ annotationState: "done", annotationErrorCode: undefined });
      }
    } catch (error) {
      const errorCode = error instanceof Error ? error.message : "citation_annotation_delete_failed";
      set({ annotationState: "recoverable_error", annotationErrorCode: errorCode });
    }
  },
  async compareItems(evidencePackId: string, evidenceItemIds: string[]) {
    if (!hasBridge()) {
      set({
        compareState: "degraded",
        compareErrorCode: "desktop_bridge_unavailable"
      });
      return;
    }
    set({ compareState: "loading", compareErrorCode: undefined });
    try {
      const comparison = await compareEvidenceItems(evidencePackId, evidenceItemIds);
      set({
        comparison,
        compareState: comparison.items.length ? "done" : "empty",
        compareErrorCode: undefined
      });
    } catch (error) {
      const errorCode = error instanceof Error ? error.message : "citation_compare_failed";
      set({ compareState: "recoverable_error", compareErrorCode: errorCode });
    }
  },
  clearComparison() {
    set({ comparison: undefined, compareState: "empty", compareErrorCode: undefined });
  }
}));
