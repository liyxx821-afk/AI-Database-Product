import type { SettingsPatchRequest, SettingsResponse } from "@knowledgebase-dev/api-types";
import { apiFetch } from "./apiClient";

export async function getSettings(): Promise<SettingsResponse> {
  return apiFetch<SettingsResponse>("/settings");
}

export async function patchSettings(payload: SettingsPatchRequest): Promise<SettingsResponse> {
  return apiFetch<SettingsResponse>("/settings", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}
