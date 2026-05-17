import { create } from "zustand";

export const useJobStore = create(() => ({
  activeJobId: null as string | null,
  state: "empty" as "loading" | "empty" | "degraded" | "recoverable_error" | "done"
}));
