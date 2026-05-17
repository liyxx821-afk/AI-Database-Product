import { create } from "zustand";

export const useCitationStore = create(() => ({
  citationLabels: [] as string[],
  state: "empty" as "loading" | "empty" | "degraded" | "recoverable_error" | "done"
}));
