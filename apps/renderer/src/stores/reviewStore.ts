import { create } from "zustand";
import type { ReviewTask } from "@knowledgebase-dev/api-types";
import { hasBridge } from "../services/apiClient";
import { confirmReviewTask, ignoreReviewTask, listReviewTasks } from "../services/reviewApi";

type ReviewStore = {
  tasks: ReviewTask[];
  pendingCount: number;
  state: "loading" | "empty" | "degraded" | "recoverable_error" | "done";
  errorCode: string | null;
  refresh: () => Promise<void>;
  confirm: (taskId: string) => Promise<void>;
  ignore: (taskId: string) => Promise<void>;
};

export const useReviewStore = create<ReviewStore>((set) => ({
  tasks: [],
  pendingCount: 0,
  state: "empty",
  errorCode: null,
  refresh: async () => {
    if (!hasBridge()) {
      set({ tasks: [], pendingCount: 0, state: "degraded", errorCode: "desktop_bridge_unavailable" });
      return;
    }
    set({ state: "loading", errorCode: null });
    try {
      const tasks = await listReviewTasks();
      set({ tasks, pendingCount: tasks.length, state: tasks.length ? "done" : "empty", errorCode: null });
    } catch (error) {
      set({
        state: "recoverable_error",
        errorCode: error instanceof Error ? error.message : "review_list_failed"
      });
    }
  },
  confirm: async (taskId: string) => {
    await confirmReviewTask(taskId);
    const tasks = await listReviewTasks();
    set({ tasks, pendingCount: tasks.length, state: tasks.length ? "done" : "empty", errorCode: null });
  },
  ignore: async (taskId: string) => {
    await ignoreReviewTask(taskId);
    const tasks = await listReviewTasks();
    set({ tasks, pendingCount: tasks.length, state: tasks.length ? "done" : "empty", errorCode: null });
  }
}));
