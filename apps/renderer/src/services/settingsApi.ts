import type {
  AIModelSettingsPatchRequest,
  AIModelSettingsResponse,
  AIModelTestResponse,
  SettingsPatchRequest,
  SettingsResponse
} from "@knowledgebase-dev/api-types";
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

export async function getAIModelSettings(): Promise<AIModelSettingsResponse> {
  return apiFetch<AIModelSettingsResponse>("/settings/ai-model");
}

export async function patchAIModelSettings(
  payload: AIModelSettingsPatchRequest
): Promise<AIModelSettingsResponse> {
  return apiFetch<AIModelSettingsResponse>("/settings/ai-model", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function testAIModelSettings(): Promise<AIModelTestResponse> {
  return apiFetch<AIModelTestResponse>("/settings/ai-model:test", {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function deleteAIModelKey(): Promise<AIModelSettingsResponse> {
  return apiFetch<AIModelSettingsResponse>("/settings/ai-model/key", {
    method: "DELETE"
  });
}
