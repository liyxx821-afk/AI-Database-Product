import { create } from "zustand";
import type {
  EvidenceOnlyResponse,
  EvidencePackDetail,
  RetrievalPreviewResponse
} from "@knowledgebase-dev/api-types";
import { hasBridge } from "../services/apiClient";
import { askEvidenceOnly, getEvidencePack, previewRetrieval } from "../services/retrievalApi";

type ViewState = "loading" | "empty" | "degraded" | "recoverable_error" | "done";

type RetrievalState = {
  lastQuery: string;
  state: ViewState;
  previewState: ViewState;
  answerState: ViewState;
  detailState: ViewState;
  errorCode?: string;
  previewErrorCode?: string;
  answerErrorCode?: string;
  detailErrorCode?: string;
  preview?: RetrievalPreviewResponse;
  answer?: EvidenceOnlyResponse;
  detail?: EvidencePackDetail;
  previewQuery: (query: string) => Promise<void>;
  ask: (query: string) => Promise<void>;
  loadDetail: (evidencePackId: string) => Promise<void>;
};

export const useRetrievalStore = create<RetrievalState>((set) => ({
  lastQuery: "",
  state: "empty",
  previewState: "empty",
  answerState: "empty",
  detailState: "empty",
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
        detailState: "empty",
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
        detailState: "empty",
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
  async loadDetail(evidencePackId: string) {
    if (!hasBridge()) {
      set({
        state: "degraded",
        detailState: "degraded",
        errorCode: "desktop_bridge_unavailable",
        detailErrorCode: "desktop_bridge_unavailable"
      });
      return;
    }
    set({ state: "loading", detailState: "loading", detailErrorCode: undefined });
    try {
      const detail = await getEvidencePack(evidencePackId);
      set({
        detail,
        state: detail.items.length ? "done" : "empty",
        detailState: detail.items.length ? "done" : "empty",
        detailErrorCode: undefined
      });
    } catch (error) {
      const errorCode = error instanceof Error ? error.message : "evidence_pack_detail_failed";
      set({
        state: "recoverable_error",
        detailState: "recoverable_error",
        errorCode,
        detailErrorCode: errorCode
      });
    }
  }
}));
