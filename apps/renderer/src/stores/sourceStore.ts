import { create } from "zustand";
import type { SourceRecord } from "@knowledgebase-dev/api-types";
import { hasBridge } from "../services/apiClient";
import type { OrganizationFilters } from "../services/organizationApi";
import { extractKnowledgeFromSource, listSources } from "../services/sourceApi";

type SourceStore = {
  sources: SourceRecord[];
  state: "loading" | "empty" | "degraded" | "recoverable_error" | "done";
  errorCode: string | null;
  refresh: (filters?: OrganizationFilters) => Promise<void>;
  extract: (sourceId: string, filters?: OrganizationFilters) => Promise<void>;
};

export const useSourceStore = create<SourceStore>((set) => ({
  sources: [],
  state: "empty",
  errorCode: null,
  refresh: async (filters) => {
    if (!hasBridge()) {
      set({ state: "degraded", errorCode: "desktop_bridge_unavailable" });
      return;
    }
    set({ state: "loading", errorCode: null });
    try {
      const sources = await listSources(filters);
      set({ sources, state: sources.length ? "done" : "empty", errorCode: null });
    } catch (error) {
      set({
        state: "recoverable_error",
        errorCode: error instanceof Error ? error.message : "source_list_failed"
      });
    }
  },
  extract: async (sourceId: string, filters) => {
    if (!hasBridge()) {
      set({ state: "degraded", errorCode: "desktop_bridge_unavailable" });
      return;
    }
    set({ state: "loading", errorCode: null });
    try {
      await extractKnowledgeFromSource(sourceId);
      const sources = await listSources(filters);
      set({ sources, state: sources.length ? "done" : "empty", errorCode: null });
    } catch (error) {
      set({
        state: "recoverable_error",
        errorCode: error instanceof Error ? error.message : "knowledge_extract_failed"
      });
    }
  }
}));
