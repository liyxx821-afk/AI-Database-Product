export const runtimeStates = [
  "booting",
  "sidecar_starting",
  "sidecar_ready",
  "db_checking",
  "migration_running",
  "worker_starting",
  "ready",
  "degraded",
  "recovery_required",
  "shutting_down"
] as const;

export type RuntimeState = (typeof runtimeStates)[number];

export const capabilityStatuses = ["available", "degraded", "unavailable"] as const;
export type CapabilityStatus = (typeof capabilityStatuses)[number];

export const pageStates = [
  "loading",
  "empty",
  "degraded",
  "recoverable_error",
  "done"
] as const;
export type PageState = (typeof pageStates)[number];

export type RuntimeConfig = {
  apiBaseUrl: string;
  localToken: string;
  appName: string;
  appVersion: string;
};

export type RuntimeStatus = {
  runtime_state: RuntimeState;
  status_reason: string | null;
  sidecar: {
    pid: number | null;
    url: string | null;
    health: CapabilityStatus;
  };
  database: {
    path: string | null;
    quick_check: "ok" | "failed" | "unknown";
  };
  worker: {
    status: CapabilityStatus;
    heartbeat_at: string | null;
  };
  vector: {
    status: CapabilityStatus;
    provider: "sqlite_vec" | "fallback";
    fallback_reason: string | null;
  };
};

export type ErrorEnvelope = {
  request_id: string;
  error: {
    code: string;
    message: string;
    recoverable: boolean;
    fallback_reason?: string | null;
  };
};
