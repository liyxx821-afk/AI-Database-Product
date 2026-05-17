import { create } from "zustand";
import type { WorkspaceSummaryResponse } from "@knowledgebase-dev/api-types";
import { apiFetch, hasBridge } from "../services/apiClient";
import { workspaceFixture } from "../services/__fixtures__/workspace";

type WorkspaceSummary = WorkspaceSummaryResponse;

type WorkspaceStore = {
  summary: WorkspaceSummary;
  state: "loading" | "empty" | "degraded" | "recoverable_error" | "done";
  refresh: () => Promise<void>;
};

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  summary: workspaceFixture,
  state: "empty",
  refresh: async () => {
    if (!hasBridge()) {
      set({ summary: workspaceFixture, state: "degraded" });
      return;
    }
    set({ state: "loading" });
    try {
      const summary = await apiFetch<WorkspaceSummary>("/workspace/summary");
      const hasData = summary.source_count > 0 || summary.knowledge_unit_count > 0;
      set({ summary, state: hasData ? "done" : "empty" });
    } catch {
      set({ state: "recoverable_error" });
    }
  }
}));
