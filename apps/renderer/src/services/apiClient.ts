import type { ErrorEnvelope } from "@knowledgebase-dev/runtime-contracts";

type RuntimeConfig = {
  apiBaseUrl: string;
  localToken: string;
  appName: string;
  appVersion: string;
};

let runtimeConfigPromise: Promise<RuntimeConfig | null> | null = null;

export function hasBridge(): boolean {
  return Boolean(window.knowledgeBase);
}

export async function getRuntimeConfig(): Promise<RuntimeConfig | null> {
  if (!runtimeConfigPromise) {
    runtimeConfigPromise = window.knowledgeBase?.runtime.getRuntimeConfig() ?? Promise.resolve(null);
  }
  return runtimeConfigPromise;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const config = await getRuntimeConfig();
  if (!config) {
    throw new Error("desktop_bridge_unavailable");
  }
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-kb-local-token": config.localToken,
      ...(init?.headers ?? {})
    }
  });
  const payload = await response.json();
  if (!response.ok) {
    const envelope = payload as ErrorEnvelope;
    throw new Error(envelope.error?.code ?? "api_error");
  }
  return payload as T;
}

export async function apiBinaryFetch<T>(path: string, body: Blob | ArrayBuffer): Promise<T> {
  const config = await getRuntimeConfig();
  if (!config) {
    throw new Error("desktop_bridge_unavailable");
  }
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method: "PUT",
    headers: {
      "content-type": "application/octet-stream",
      "x-kb-local-token": config.localToken
    },
    body
  });
  const payload = await response.json();
  if (!response.ok) {
    const envelope = payload as ErrorEnvelope;
    throw new Error(envelope.error?.code ?? "api_error");
  }
  return payload as T;
}
