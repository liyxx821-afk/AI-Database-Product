import type {
  AIModelSettingsPatchRequest,
  AIModelSettingsResponse,
  AIModelTestResponse,
  SettingsPatchRequest,
  SettingsResponse
} from "@knowledgebase-dev/api-types";
import { getRuntimeConfig, hasBridge } from "./apiClient";

export async function getSettings(): Promise<SettingsResponse> {
  return settingsFetch<SettingsResponse>("/settings");
}

export async function patchSettings(payload: SettingsPatchRequest): Promise<SettingsResponse> {
  return settingsFetch<SettingsResponse>("/settings", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function getAIModelSettings(): Promise<AIModelSettingsResponse> {
  return settingsFetch<AIModelSettingsResponse>("/settings/ai-model");
}

export async function patchAIModelSettings(
  payload: AIModelSettingsPatchRequest
): Promise<AIModelSettingsResponse> {
  return settingsFetch<AIModelSettingsResponse>("/settings/ai-model", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function testAIModelSettings(): Promise<AIModelTestResponse> {
  return settingsFetch<AIModelTestResponse>("/settings/ai-model:test", {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function deleteAIModelKey(): Promise<AIModelSettingsResponse> {
  return settingsFetch<AIModelSettingsResponse>("/settings/ai-model/key", {
    method: "DELETE"
  });
}

export function hasSettingsApiRuntime(): boolean {
  return hasBridge() || Boolean(import.meta.env.VITE_KB_API_BASE_URL);
}

async function settingsFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const runtimeConfig = hasBridge() ? await getRuntimeConfig() : null;
  const apiBaseUrl = runtimeConfig?.apiBaseUrl ?? import.meta.env.VITE_KB_API_BASE_URL;
  const localToken = runtimeConfig?.localToken ?? import.meta.env.VITE_KB_LOCAL_TOKEN;
  if (!apiBaseUrl) {
    throw new Error("settings_api_runtime_unavailable");
  }
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(localToken ? { "x-kb-local-token": localToken } : {}),
      ...(init?.headers ?? {})
    }
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error?.code ?? "settings_api_error");
  }
  return body as T;
}
