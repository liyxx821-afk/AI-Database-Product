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

export function resetRuntimeConfig(): void {
  runtimeConfigPromise = null;
}

export async function getRuntimeConfig(options: { forceRefresh?: boolean } = {}): Promise<RuntimeConfig | null> {
  if (options.forceRefresh) resetRuntimeConfig();
  if (!runtimeConfigPromise) {
    runtimeConfigPromise = window.knowledgeBase?.runtime.getRuntimeConfig() ?? Promise.resolve(null);
  }
  return runtimeConfigPromise;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return apiFetchWithRetry<T>(path, init, false);
}

async function apiFetchWithRetry<T>(
  path: string,
  init: RequestInit | undefined,
  retried: boolean
): Promise<T> {
  const config = await getRuntimeConfig({ forceRefresh: retried });
  if (!config) {
    throw new Error("desktop_bridge_unavailable");
  }
  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        "x-kb-local-token": config.localToken,
        ...(init?.headers ?? {})
      }
    });
  } catch (error) {
    if (!retried && isNetworkRetrySafe(init?.method)) {
      resetRuntimeConfig();
      return apiFetchWithRetry<T>(path, init, true);
    }
    throw error;
  }
  const payload = await response.json();
  if (!response.ok) {
    const envelope = payload as ErrorEnvelope;
    const errorCode = envelope.error?.code ?? "api_error";
    if (!retried && errorCode === "sidecar_auth_failed") {
      resetRuntimeConfig();
      return apiFetchWithRetry<T>(path, init, true);
    }
    throw new Error(errorCode);
  }
  return payload as T;
}

export async function apiBinaryFetch<T>(path: string, body: Blob | ArrayBuffer): Promise<T> {
  return apiBinaryFetchWithRetry<T>(path, body, false);
}

async function apiBinaryFetchWithRetry<T>(
  path: string,
  body: Blob | ArrayBuffer,
  retried: boolean
): Promise<T> {
  const config = await getRuntimeConfig({ forceRefresh: retried });
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
    const errorCode = envelope.error?.code ?? "api_error";
    if (!retried && errorCode === "sidecar_auth_failed") {
      resetRuntimeConfig();
      return apiBinaryFetchWithRetry<T>(path, body, true);
    }
    throw new Error(errorCode);
  }
  return payload as T;
}

function isNetworkRetrySafe(method: string | undefined): boolean {
  const normalized = method?.toUpperCase() ?? "GET";
  return normalized === "GET" || normalized === "HEAD";
}
