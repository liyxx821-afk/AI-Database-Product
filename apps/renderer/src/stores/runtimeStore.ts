import { create } from "zustand";
import type { RuntimeStatus } from "@knowledgebase-dev/runtime-contracts";
import { apiFetch, hasBridge } from "../services/apiClient";
import { resolveErrorCode } from "../utils/errors";

type RuntimeStore = {
  bridgeAvailable: boolean;
  status: RuntimeStatus | null;
  errorCode: string | null;
  refresh: () => Promise<void>;
};

export const useRuntimeStore = create<RuntimeStore>((set) => ({
  bridgeAvailable: hasBridge(),
  status: null,
  errorCode: null,
  refresh: async () => {
    if (!hasBridge()) {
      set({ bridgeAvailable: false, errorCode: "desktop_bridge_unavailable" });
      return;
    }
    try {
      const status = await apiFetch<RuntimeStatus>("/system/runtime");
      set({ bridgeAvailable: true, status, errorCode: null });
    } catch (error) {
      set({ errorCode: resolveErrorCode(error, "runtime_status_failed") });
    }
  }
}));
