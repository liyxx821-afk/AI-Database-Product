from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class HealthResponse(BaseModel):
    ok: bool
    app_name: str
    version: str
    request_id: str


class AuthStatusResponse(BaseModel):
    auth_enabled: bool
    disabled_reason: str
    local_user: Dict[str, str]


class RuntimeResponse(BaseModel):
    runtime_state: str
    status_reason: Optional[str]
    sidecar: Dict[str, Any]
    database: Dict[str, Any]
    worker: Dict[str, Any]
    vector: Dict[str, Any]


class SystemStatusResponse(BaseModel):
    app: Dict[str, Any]
    database: Dict[str, Any]
    provider: Dict[str, Any]
    vector: Dict[str, Any]


class DiagnosticsResponse(BaseModel):
    created_at: str
    redacted: bool
    includes_source_text: bool
    summary: Dict[str, Any]


LanguageCode = Literal["zh-CN", "en-US"]
FeedbackType = Literal[
    "click",
    "useful",
    "not_useful",
    "favorite",
    "bad_citation",
    "missing_source",
    "downrank_source",
]
FeedbackExportFormat = Literal["json", "csv"]
FeedbackRankingEffect = Literal[
    "positive_weight_suggestion",
    "negative_weight_suggestion",
    "diagnostic_only",
]
FeedbackSortOrder = Literal["created_desc", "created_asc"]
MemoryType = Literal["preference", "decision", "style", "conclusion", "reusable_context"]


class SettingsResponse(BaseModel):
    language: LanguageCode
    persistence: str
    updated_at: Optional[str]


class SettingsPatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    language: LanguageCode


class TextImportRequest(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    content: str = Field(min_length=1)
    project_id: str = "default-space"


class TextImportResponse(BaseModel):
    job_id: str
    source_id: str
    chunk_ids: List[str]
    candidate_knowledge_unit_ids: List[str]
    review_task_ids: List[str]


class UploadCreateRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=240)
    size_bytes: int = Field(gt=0)
    content_type: Optional[str] = None
    sha256: Optional[str] = Field(default=None, min_length=64, max_length=64)
    part_size: Optional[int] = Field(default=None, gt=0)
    project_id: str = "default-space"


class UploadPartResponse(BaseModel):
    upload_id: str
    part_no: int
    size_bytes: int
    sha256: str
    received_bytes: int
    status: str


class UploadPartSummary(BaseModel):
    part_no: int
    size_bytes: int
    sha256: str
    created_at: str


class FileIntegrityCheck(BaseModel):
    id: str
    upload_id: str
    file_id: Optional[str]
    expected_sha256: Optional[str]
    actual_sha256: str
    status: str
    message: str
    created_at: str


class FileInspectionSummary(BaseModel):
    id: str
    file_id: str
    job_id: str
    status: str
    extension: str
    mime_type: Optional[str]
    size_bytes: int
    sha256: str
    header_summary: str
    risk_level: str
    risk_summary: str
    recoverable: bool
    created_at: str
    updated_at: str


class UploadSnapshot(BaseModel):
    id: str
    project_id: str
    original_filename: str
    content_type: Optional[str]
    expected_size: int
    part_size: int
    part_count: int
    expected_sha256: Optional[str]
    received_bytes: int
    status: str
    file_id: Optional[str]
    job_id: Optional[str]
    recoverable: bool
    error_code: Optional[str]
    parts: List[UploadPartSummary]
    integrity_check: Optional[FileIntegrityCheck]
    inspection: Optional[FileInspectionSummary]
    created_at: str
    updated_at: str


class FileRecord(BaseModel):
    id: str
    project_id: str
    original_filename: str
    content_type: Optional[str]
    extension: str
    size_bytes: int
    sha256: str
    status: str
    inspection_status: str
    inspection: Optional[FileInspectionSummary]
    created_at: str
    updated_at: str


class ChunkRecord(BaseModel):
    id: str
    source_id: str
    project_id: str
    content: str
    chunk_index: int
    citation_label: str
    metadata: Dict[str, Any]
    created_at: str


class SourceRecord(BaseModel):
    id: str
    project_id: str
    title: str
    source_type: str
    source_origin: str
    content_hash: str
    metadata: Dict[str, Any]
    chunk_count: int
    created_at: str


class SourceDetail(SourceRecord):
    chunks: List[ChunkRecord]


class ParseWarningRecord(BaseModel):
    id: str
    parse_task_id: str
    warning_type: str
    severity: str
    message: str
    source_location: Optional[str]
    created_at: str


class ParseTaskRecord(BaseModel):
    id: str
    file_id: str
    source_id: Optional[str]
    job_id: str
    parser_key: str
    status: str
    capability_status: str
    fallback_reason: Optional[str]
    error_code: Optional[str]
    source: Optional[SourceRecord]
    chunk_ids: List[str]
    warnings: List[ParseWarningRecord]
    created_at: str
    updated_at: str


class KnowledgeExtractRequest(BaseModel):
    source_id: str = Field(min_length=1)
    project_id: str = "default-space"
    force: bool = False


class KnowledgeExtractResponse(BaseModel):
    job_id: Optional[str]
    source_id: str
    candidate_knowledge_unit_ids: List[str]
    review_task_ids: List[str]
    embedding_ids: List[str]
    status: str
    reused: bool
    fallback_reason: Optional[str]


class EmbeddingRecord(BaseModel):
    id: str
    owner_type: str
    owner_id: str
    embedding_profile: str
    dimension: int
    status: str
    created_at: str


class KnowledgeUnitRecord(BaseModel):
    id: str
    source_id: str
    chunk_id: str
    project_id: str
    title: str
    type: str
    content: str
    status: str
    user_verified: bool
    metadata: Dict[str, Any]
    created_at: str
    updated_at: str


class KnowledgeUnitDetail(KnowledgeUnitRecord):
    source: Optional[SourceRecord]
    chunk: Optional[ChunkRecord]
    embeddings: List[EmbeddingRecord]
    review_task: Optional[Dict[str, Any]]


class JobEvent(BaseModel):
    event_seq: int
    event_type: str
    message: str
    payload: Dict[str, Any]
    created_at: str


class JobSnapshot(BaseModel):
    id: str
    job_type: str
    status: str
    trace_id: str
    payload: Dict[str, Any]
    result: Dict[str, Any]
    events: List[JobEvent]


class ReviewTask(BaseModel):
    id: str
    target_type: str
    target_id: str
    status: str
    payload: Dict[str, Any]


class ReviewActionResponse(BaseModel):
    review_task_id: str
    target_id: str
    status: str


class EvidenceOnlyRequest(BaseModel):
    query: str = Field(min_length=1)
    project_id: str = "default-space"


class EvidenceOnlyResponse(BaseModel):
    retrieval_log_id: str
    evidence_pack_id: str
    answer_id: str
    output_type: str
    answer: str
    evidence_item_ids: List[str]
    citation_labels: List[str]
    citation_trace_summary: str
    provider_status: str
    fallback_reason: Optional[str]


class FeedbackRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    feedback_type: FeedbackType
    evidence_pack_id: Optional[str] = None
    ai_answer_id: Optional[str] = None
    evidence_item_id: Optional[str] = None
    comment: Optional[str] = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def require_target(self) -> FeedbackRequest:
        if not (self.evidence_pack_id or self.ai_answer_id or self.evidence_item_id):
            raise ValueError("feedback target is required")
        return self


class FeedbackResponse(BaseModel):
    id: str
    feedback_type: FeedbackType
    target_type: str
    target_id: str
    evidence_pack_id: Optional[str]
    ai_answer_id: Optional[str]
    evidence_item_id: Optional[str]
    feedback_policy: Dict[str, Any]
    created_at: str


class FeedbackEventRecord(BaseModel):
    id: str
    feedback_type: FeedbackType
    target_type: str
    target_id: str
    evidence_pack_id: Optional[str]
    ai_answer_id: Optional[str]
    evidence_item_id: Optional[str]
    comment: Optional[str]
    ranking_effect: str
    query: Optional[str]
    citation_label: Optional[str]
    created_at: str


class FeedbackDiagnosticsSummary(BaseModel):
    total: int
    by_type: Dict[str, int]
    by_target_type: Dict[str, int]
    positive_count: int
    negative_count: int
    last_event_at: Optional[str]
    feedback_policy: Dict[str, Any]


class FeedbackDiagnosticsExportResponse(BaseModel):
    filename: str
    mime_type: str
    format: FeedbackExportFormat
    record_count: int
    generated_at: str
    filters: Dict[str, Any]
    summary: FeedbackDiagnosticsSummary
    content: str
    redacted: bool
    includes_source_text: bool


class FeedbackExportHistoryRecord(BaseModel):
    id: str
    filename: str
    format: FeedbackExportFormat
    record_count: int
    generated_at: str
    filters: Dict[str, Any]
    summary: FeedbackDiagnosticsSummary
    content_sha256: str
    redacted: bool
    includes_source_text: bool


class MemoryDraftRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_answer_id: str = Field(min_length=1)
    content: str = Field(min_length=1)
    memory_type: MemoryType
    permission: str = "normal"
    project_id: str = "default-space"


class MemoryDraftRecord(BaseModel):
    id: str
    project_id: str
    source_answer_id: str
    content: str
    memory_type: MemoryType
    status: str
    permission: str
    user_confirmed: bool
    review_task_id: Optional[str]
    created_at: str
    updated_at: str


class RetrievalPreviewRequest(BaseModel):
    query: str = Field(min_length=1)
    project_id: str = "default-space"


class EvidenceItemRecord(BaseModel):
    id: str
    evidence_pack_id: str
    knowledge_unit_id: Optional[str]
    chunk_id: Optional[str]
    source_id: Optional[str]
    citation_label: str
    excerpt: str
    rank_score: float
    knowledge_unit_title: Optional[str] = None
    knowledge_unit_status: Optional[str] = None
    knowledge_unit_type: Optional[str] = None
    chunk_citation_label: Optional[str] = None
    chunk_content_excerpt: str = ""
    source_title: Optional[str] = None
    source_origin: Optional[str] = None
    source_type: Optional[str] = None
    citation_trace: Dict[str, Any] = Field(default_factory=dict)
    created_at: str


class EvidencePackDetailSummary(BaseModel):
    item_count: int
    source_count: int
    knowledge_unit_count: int
    citation_labels: List[str]
    rank_score_min: Optional[float]
    rank_score_max: Optional[float]
    focused_item_id: Optional[str]
    no_evidence_reason: Optional[str]


class EvidencePackDetail(BaseModel):
    id: str
    retrieval_log_id: str
    query: str
    query_explanation: Dict[str, Any]
    provider_status: str
    fallback_reason: Optional[str]
    citation_trace_summary: str
    status: str
    failure_type: Optional[str]
    summary: str
    detail_summary: EvidencePackDetailSummary
    items: List[EvidenceItemRecord]
    created_at: str


class RetrievalPreviewResponse(BaseModel):
    retrieval_log_id: str
    evidence_pack_id: str
    query: str
    query_explanation: Dict[str, Any]
    evidence_pack: EvidencePackDetail
    evidence_item_ids: List[str]
    citation_labels: List[str]
    citation_trace_summary: str
    provider_status: str
    fallback_reason: Optional[str]


class WorkspaceSummaryResponse(BaseModel):
    project_count: int
    upload_count: int
    file_count: int
    pending_file_count: int
    source_count: int
    chunk_count: int
    knowledge_unit_count: int
    pending_review_count: int
    evidence_pack_count: int
