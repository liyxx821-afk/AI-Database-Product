import { create } from "zustand";
import type { TextToSqlPreviewResponse } from "@knowledgebase-dev/api-types";
import { hasBridge } from "../services/apiClient";
import type { OrganizationFilters } from "../services/organizationApi";
import { previewTextToSql } from "../services/textToSqlApi";
import type { UiState } from "../types/uiState";
import { resolveErrorCode } from "../utils/errors";

type TextToSqlState = {
  state: UiState;
  errorCode?: string;
  preview?: TextToSqlPreviewResponse;
  previewQuery: (query: string, filters?: OrganizationFilters, limit?: number) => Promise<void>;
};

export const useTextToSqlStore = create<TextToSqlState>((set) => ({
  state: "empty",
  async previewQuery(query: string, filters, limit = 50) {
    if (!hasBridge()) {
      set({
        state: "degraded",
        errorCode: "desktop_bridge_unavailable",
        preview: undefined
      });
      return;
    }
    set({ state: "loading", errorCode: undefined });
    try {
      const preview = await previewTextToSql(query, filters, limit);
      set({
        preview,
        state: preview.row_count > 0 ? "done" : "empty",
        errorCode: undefined
      });
    } catch (error) {
      set({
        state: "recoverable_error",
        errorCode: resolveErrorCode(error, "text_to_sql_preview_failed")
      });
    }
  }
}));
