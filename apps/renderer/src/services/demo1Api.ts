import { getRuntimeConfig, hasBridge } from "./apiClient";

export type Demo1ChunkRecord = {
  chunk_id: string;
  source_id: string;
  chunk_index: number;
  content: string;
  char_count: number;
  chunk_type: "very_short_chunk" | "short_chunk" | "normal_chunk" | "long_chunk";
  start_offset: number;
  end_offset: number;
  chunk_basis: "semantic_clean_text" | "rule_clean_text";
};

export type Demo1CandidateKnowledgeUnitRecord = {
  ku_id: string;
  source_id: string;
  chunk_id: string;
  title: string;
  summary: string;
  keywords: string[];
  tags: string[];
  status: "pending";
  confidence: number;
  quality_note: string;
  content_type: "very_short_text" | "short_note" | "paragraph_note" | "long_chunk";
};

export type Demo1IngestionResult = {
  received_file: {
    file_name: string;
    input_type: "text" | "file";
    received_at: string;
    raw_text_length: number;
    process_status: string;
    file_size_bytes: number | null;
  };
  source: {
    source_id: string;
    file_name: string;
    input_type: "text" | "file";
    created_at: string;
    status: string;
    raw_text_length: number;
    clean_text_length: number;
    chunk_count: number;
    candidate_ku_count: number;
  };
  metadata: {
    raw_length: number;
    cleaned_length: number;
    chunk_count: number;
    candidate_ku_count: number;
    model_provider: string;
    model_name: string | null;
    model_status: "available" | "unconfigured" | "error" | "invalid_response";
    commit_status: "preview_only" | "committed";
    parser_profile: string;
    file_size_bytes: number | null;
  };
  parsed: {
    content: string;
    status: string;
    note: string;
  };
  semantic_parsing: {
    status: string;
    summary: string;
    titles: string[];
    paragraph_notes: string[];
    possible_toc: string[];
    citations: string[];
    noise_blocks: string[];
  };
  rule_cleaning: {
    content: string;
    status: string;
    before_char_count: number;
    after_char_count: number;
    note: string;
    operations: string[];
  };
  semantic_cleaning: {
    content: string;
    status: string;
    before_char_count: number;
    after_char_count: number;
    note: string;
    cleaning_report: string;
    noise_findings: string[];
    quality_score: number;
    fallback_reason: string | null;
  };
  cleaning: {
    content: string;
    status: string;
    before_char_count: number;
    after_char_count: number;
    note: string;
  };
  chunk_basis: "semantic_clean_text" | "rule_clean_text";
  chunks: Demo1ChunkRecord[];
  candidate_knowledge_units: Demo1CandidateKnowledgeUnitRecord[];
  candidate_ku_message: string;
  pipeline_statuses: Array<{
    key: string;
    label: string;
    state: "done" | "loading" | "empty" | "error";
  }>;
  model_error_code: string | null;
  model_error_message: string | null;
  persisted: boolean;
  job_id: string | null;
  review_task_ids: string[];
};

export type Demo1IngestionRequest = {
  file_name: string;
  input_type: "text" | "file";
  raw_text?: string;
  file_content_base64?: string;
  content_type?: string;
  project_id?: string;
};

export async function previewDemo1Ingestion(
  payload: Demo1IngestionRequest
): Promise<Demo1IngestionResult> {
  return demo1Fetch("/demo1/ingestion:preview", payload);
}

export async function commitDemo1Ingestion(
  previewResult: Demo1IngestionResult
): Promise<Demo1IngestionResult> {
  return demo1Fetch("/demo1/ingestion:commit", { preview_result: previewResult });
}

async function demo1Fetch<T>(path: string, payload: unknown): Promise<T> {
  const runtimeConfig = hasBridge() ? await getRuntimeConfig() : null;
  const apiBaseUrl = runtimeConfig?.apiBaseUrl ?? import.meta.env.VITE_KB_API_BASE_URL;
  const localToken = runtimeConfig?.localToken ?? import.meta.env.VITE_KB_LOCAL_TOKEN;
  if (!apiBaseUrl) {
    throw new Error("demo1_api_runtime_unavailable");
  }
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(localToken ? { "x-kb-local-token": localToken } : {})
    },
    body: JSON.stringify(payload)
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error?.code ?? "demo1_api_error");
  }
  return body as T;
}
