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
KnowledgeUnitExportFormat = Literal["markdown", "json"]
KnowledgeExportResponseFormat = Literal["markdown", "json", "zip"]
KnowledgeExportKind = Literal["knowledge_units", "project"]
FeedbackRankingEffect = Literal[
    "positive_weight_suggestion",
    "negative_weight_suggestion",
    "diagnostic_only",
]
FeedbackSortOrder = Literal["created_desc", "created_asc"]
MemoryType = Literal["preference", "decision", "style", "conclusion", "reusable_context"]
CitationAnnotationType = Literal["note", "question", "risk", "follow_up"]
KnowledgeRelationType = Literal[
    "supports",
    "contradicts",
    "derived_from",
    "example_of",
    "part_of",
    "depends_on",
    "similar_to",
    "used_for",
    "updates",
    "replaces",
]
KnowledgeRelationStatus = Literal["confirmed", "archived"]
TagNamespace = Literal["folder", "topic", "status", "use", "discipline", "system", "custom"]
TagType = Literal[
    "folder_tag",
    "topic_tag",
    "discipline_tag",
    "status_tag",
    "use_tag",
    "system_tag",
    "custom_tag",
]
KnowledgeBaseType = Literal[
    "project_kb",
    "reference_kb",
    "person_kb",
    "timeline_kb",
    "inspiration_kb",
    "method_kb",
    "custom",
]


class ProjectCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=160)
    description: Optional[str] = Field(default=None, max_length=1000)
    parent_id: Optional[str] = None
    kb_type: KnowledgeBaseType = "project_kb"


class ProjectRecord(BaseModel):
    id: str
    user_id: str
    parent_id: Optional[str]
    name: str
    description: Optional[str]
    kb_type: str
    status: str
    metadata: Dict[str, Any]
    created_at: str
    updated_at: str


class FolderCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: str = "default-space"
    parent_id: Optional[str] = None
    name: str = Field(min_length=1, max_length=160)


class FolderRecord(BaseModel):
    id: str
    project_id: str
    parent_id: Optional[str]
    name: str
    path: str
    mirror_tag_id: Optional[str]
    created_at: str
    updated_at: str


class TagCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: str = "default-space"
    name: str = Field(min_length=1, max_length=160)
    namespace: TagNamespace = "topic"
    tag_type: TagType = "topic_tag"
    description: Optional[str] = Field(default=None, max_length=1000)


class TagRecord(BaseModel):
    id: str
    project_id: str
    user_id: str
    name: str
    namespace: str
    tag_type: str
    description: Optional[str]
    created_by: str
    created_at: str
    updated_at: str


class OrganizationUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    folder_id: Optional[str] = None
    tag_ids: List[str] = Field(default_factory=list)


class OrganizationUpdateResponse(BaseModel):
    target_type: str
    target_id: str
    project_id: str
    folder_id: Optional[str]
    tags: List[TagRecord]
    synced_knowledge_unit_ids: List[str]
    updated_at: str


class SourceOrganizationBatchUpdateRequest(OrganizationUpdateRequest):
    source_ids: List[str] = Field(min_length=1, max_length=50)

    @model_validator(mode="after")
    def require_unique_sources(self) -> SourceOrganizationBatchUpdateRequest:
        if len(set(self.source_ids)) != len(self.source_ids):
            raise ValueError("source ids must be unique")
        return self


class KnowledgeUnitOrganizationBatchUpdateRequest(OrganizationUpdateRequest):
    knowledge_unit_ids: List[str] = Field(min_length=1, max_length=50)

    @model_validator(mode="after")
    def require_unique_knowledge_units(self) -> KnowledgeUnitOrganizationBatchUpdateRequest:
        if len(set(self.knowledge_unit_ids)) != len(self.knowledge_unit_ids):
            raise ValueError("knowledge unit ids must be unique")
        return self


class OrganizationBatchUpdateResponse(BaseModel):
    target_type: str
    project_id: str
    requested_ids: List[str]
    updated_ids: List[str]
    updated_count: int
    folder_id: Optional[str]
    tags: List[TagRecord]
    synced_knowledge_unit_ids: List[str]
    updated_at: str


class SettingsResponse(BaseModel):
    language: LanguageCode
    persistence: str
    updated_at: Optional[str]


class SettingsPatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    language: LanguageCode


AIModelKeyStatus = Literal["configured", "missing"]
AIModelKeySource = Literal["environment", "encrypted_local", "none"]
AIModelStorageStatus = Literal["windows_dpapi", "unavailable"]
AIModelEndpoint = Literal["chat_completions", "responses"]


class AIModelLastTestRecord(BaseModel):
    tested_at: Optional[str] = None
    text_model_status: Optional[str] = None
    vision_model_status: Optional[str] = None
    ok: Optional[bool] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None


class AIModelSettingsResponse(BaseModel):
    provider: str
    provider_label: str
    base_url: str
    text_model: str
    vision_model: str
    endpoint: AIModelEndpoint
    key_status: AIModelKeyStatus
    key_source: AIModelKeySource
    storage_status: AIModelStorageStatus
    last_test: Optional[AIModelLastTestRecord] = None
    updated_at: Optional[str] = None


class AIModelSettingsPatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provider: Optional[str] = Field(default=None, min_length=1, max_length=80)
    base_url: Optional[str] = Field(default=None, min_length=1, max_length=240)
    text_model: Optional[str] = Field(default=None, min_length=1, max_length=120)
    vision_model: Optional[str] = Field(default=None, min_length=1, max_length=120)
    endpoint: Optional[AIModelEndpoint] = None
    api_key: Optional[str] = Field(default=None, max_length=400)


class AIModelTestResponse(BaseModel):
    tested_at: str
    provider: str
    base_url: str
    text_model: str
    vision_model: str
    endpoint: AIModelEndpoint
    text_model_status: str
    vision_model_status: str
    ok: bool
    error_code: Optional[str] = None
    error_message: Optional[str] = None


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


Demo1InputType = Literal["text", "file"]
Demo1ChunkType = Literal["very_short_chunk", "short_chunk", "normal_chunk", "long_chunk"]
Demo1ContentType = Literal["very_short_text", "short_note", "paragraph_note", "long_chunk"]
Demo1ModelStatus = Literal["available", "unconfigured", "error", "invalid_response"]
Demo1CommitStatus = Literal["preview_only", "committed"]
Demo1ChunkBasis = Literal["semantic_clean_text", "rule_clean_text"]
Demo1ParserKind = Literal[
    "text_input",
    "text_file",
    "html_text",
    "pdf_text",
    "pdf_ocr",
    "pdf_mixed",
    "image_ocr",
]


class Demo1ReceivedFileRecord(BaseModel):
    file_name: str
    input_type: Demo1InputType
    received_at: str
    raw_text_length: int
    process_status: str
    file_size_bytes: Optional[int] = None


class Demo1SourceRecord(BaseModel):
    source_id: str
    file_name: str
    input_type: Demo1InputType
    created_at: str
    status: str
    raw_text_length: int
    clean_text_length: int
    chunk_count: int
    candidate_ku_count: int


class Demo1MetadataRecord(BaseModel):
    raw_length: int
    cleaned_length: int
    chunk_count: int
    candidate_ku_count: int
    model_provider: str
    model_name: Optional[str]
    model_status: Demo1ModelStatus
    commit_status: Demo1CommitStatus
    parser_profile: str
    file_size_bytes: Optional[int] = None
    parser_kind: Demo1ParserKind = "text_input"
    parser_status: str = "parsed"
    parser_warnings: List[str] = Field(default_factory=list)
    page_count: Optional[int] = None
    image_count: Optional[int] = None
    ocr_model_name: Optional[str] = None
    parsed_page_count: Optional[int] = None
    ocr_page_count: Optional[int] = None
    skipped_page_count: Optional[int] = None


class Demo1ParsedTextRecord(BaseModel):
    content: str
    status: str
    note: str


class Demo1SemanticParsingRecord(BaseModel):
    status: str
    summary: str
    titles: List[str] = Field(default_factory=list)
    paragraph_notes: List[str] = Field(default_factory=list)
    possible_toc: List[str] = Field(default_factory=list)
    citations: List[str] = Field(default_factory=list)
    noise_blocks: List[str] = Field(default_factory=list)


class Demo1CleaningRecord(BaseModel):
    content: str
    status: str
    before_char_count: int
    after_char_count: int
    note: str


class Demo1RuleCleaningRecord(Demo1CleaningRecord):
    operations: List[str] = Field(default_factory=list)


class Demo1SemanticCleaningRecord(Demo1CleaningRecord):
    cleaning_report: str
    noise_findings: List[str] = Field(default_factory=list)
    quality_score: float
    fallback_reason: Optional[str] = None


class Demo1ChunkRecord(BaseModel):
    chunk_id: str
    source_id: str
    chunk_index: int
    content: str
    char_count: int
    chunk_type: Demo1ChunkType
    start_offset: int
    end_offset: int
    chunk_basis: Demo1ChunkBasis


class Demo1CandidateKnowledgeUnitRecord(BaseModel):
    ku_id: str
    source_id: str
    chunk_id: str
    title: str
    summary: str
    keywords: List[str]
    tags: List[str]
    status: Literal["pending"]
    confidence: float
    quality_note: str
    content_type: Demo1ContentType


class Demo1PipelineStatusRecord(BaseModel):
    key: str
    label: str
    state: Literal["done", "loading", "empty", "error"]


class Demo1IngestionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    file_name: str = Field(min_length=1, max_length=240)
    input_type: Demo1InputType = "text"
    raw_text: Optional[str] = Field(default=None, min_length=1)
    file_content_base64: Optional[str] = Field(default=None, min_length=1)
    content_type: Optional[str] = Field(default=None, max_length=160)
    project_id: str = "default-space"

    @model_validator(mode="after")
    def require_matching_input(self) -> Demo1IngestionRequest:
        if self.input_type == "text" and not self.raw_text:
            raise ValueError("raw_text is required for text input")
        if self.input_type == "file" and not self.file_content_base64:
            raise ValueError("file_content_base64 is required for file input")
        return self


class Demo1IngestionResult(BaseModel):
    received_file: Demo1ReceivedFileRecord
    source: Demo1SourceRecord
    metadata: Demo1MetadataRecord
    parsed: Demo1ParsedTextRecord
    semantic_parsing: Demo1SemanticParsingRecord
    rule_cleaning: Demo1RuleCleaningRecord
    semantic_cleaning: Demo1SemanticCleaningRecord
    cleaning: Demo1CleaningRecord
    chunk_basis: Demo1ChunkBasis
    chunks: List[Demo1ChunkRecord]
    candidate_knowledge_units: List[Demo1CandidateKnowledgeUnitRecord]
    candidate_ku_message: str
    pipeline_statuses: List[Demo1PipelineStatusRecord]
    model_error_code: Optional[str] = None
    model_error_message: Optional[str] = None
    persisted: bool = False
    job_id: Optional[str] = None
    review_task_ids: List[str] = Field(default_factory=list)


class Demo1IngestionCommitRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    preview_result: Optional[Demo1IngestionResult] = None
    file_name: Optional[str] = Field(default=None, min_length=1, max_length=240)
    input_type: Demo1InputType = "text"
    raw_text: Optional[str] = Field(default=None, min_length=1)
    file_content_base64: Optional[str] = Field(default=None, min_length=1)
    content_type: Optional[str] = Field(default=None, max_length=160)
    project_id: str = "default-space"

    @model_validator(mode="after")
    def require_commit_input(self) -> Demo1IngestionCommitRequest:
        if self.preview_result is not None:
            return self
        if not self.file_name:
            raise ValueError("file_name is required when preview_result is omitted")
        if self.input_type == "text" and not self.raw_text:
            raise ValueError("raw_text is required for text input")
        if self.input_type == "file" and not self.file_content_base64:
            raise ValueError("file_content_base64 is required for file input")
        return self


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
    primary_folder_id: Optional[str] = None
    title: str
    source_type: str
    source_origin: str
    content_hash: str
    metadata: Dict[str, Any]
    tags: List[TagRecord] = Field(default_factory=list)
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
    primary_folder_id: Optional[str] = None
    title: str
    type: str
    content: str
    status: str
    user_verified: bool
    metadata: Dict[str, Any]
    tags: List[TagRecord] = Field(default_factory=list)
    created_at: str
    updated_at: str


class KnowledgeUnitDetail(KnowledgeUnitRecord):
    source: Optional[SourceRecord]
    chunk: Optional[ChunkRecord]
    embeddings: List[EmbeddingRecord]
    review_task: Optional[Dict[str, Any]]


class KnowledgeRelationCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: str = "default-space"
    source_knowledge_unit_id: str = Field(min_length=1)
    target_knowledge_unit_id: str = Field(min_length=1)
    relation_type: KnowledgeRelationType
    description: Optional[str] = Field(default=None, max_length=1000)


class KnowledgeRelationPatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    relation_type: Optional[KnowledgeRelationType] = None
    description: Optional[str] = Field(default=None, max_length=1000)
    status: Optional[KnowledgeRelationStatus] = None

    @model_validator(mode="after")
    def require_change(self) -> KnowledgeRelationPatchRequest:
        if self.relation_type is None and self.description is None and self.status is None:
            raise ValueError("relation change is required")
        return self


class KnowledgeRelationRecord(BaseModel):
    id: str
    project_id: str
    source_knowledge_unit_id: str
    target_knowledge_unit_id: str
    relation_type: KnowledgeRelationType
    status: str
    description: Optional[str]
    source_title: str
    target_title: str
    created_by: str
    metadata: Dict[str, Any]
    created_at: str
    updated_at: str


class KnowledgeRelationDeleteResponse(BaseModel):
    id: str
    status: str
    updated_at: str


class GraphPreviewNode(BaseModel):
    id: str
    title: str
    type: str
    status: str
    project_id: str
    primary_folder_id: Optional[str]
    tags: List[TagRecord] = Field(default_factory=list)


class GraphPreviewEdge(BaseModel):
    id: str
    source_knowledge_unit_id: str
    target_knowledge_unit_id: str
    relation_type: KnowledgeRelationType
    status: str
    description: Optional[str]
    source_title: str
    target_title: str
    created_at: str
    updated_at: str


class GraphPreviewSummary(BaseModel):
    project_id: str
    node_count: int
    edge_count: int
    relation_type_counts: Dict[str, int]
    filters: Dict[str, Any]


class GraphPreviewResponse(BaseModel):
    project_id: str
    filters: Dict[str, Any]
    summary: GraphPreviewSummary
    nodes: List[GraphPreviewNode]
    edges: List[GraphPreviewEdge]
    provider_status: str
    fallback_reason: Optional[str]


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
    folder_id: Optional[str] = None
    tag_ids: List[str] = Field(default_factory=list)


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


class KnowledgeUnitExportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    format: KnowledgeUnitExportFormat = "markdown"
    project_id: str = "default-space"
    folder_id: Optional[str] = None
    tag_ids: List[str] = Field(default_factory=list)
    knowledge_unit_ids: List[str] = Field(default_factory=list)
    include_chunks: bool = False
    include_sources: bool = False
    include_pending_review: bool = False


class ProjectExportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: str = "default-space"
    include_pending_review: bool = False
    format: Literal["zip"] = "zip"


class KnowledgeExportResponse(BaseModel):
    export_id: str
    filename: str
    mime_type: str
    format: KnowledgeExportResponseFormat
    record_count: int
    generated_at: str
    filters: Dict[str, Any]
    content: Optional[str] = None
    content_base64: Optional[str] = None
    redacted: bool
    includes_source_text: bool


class KnowledgeExportHistoryRecord(BaseModel):
    id: str
    export_id: str
    export_kind: KnowledgeExportKind
    filename: str
    format: KnowledgeExportResponseFormat
    record_count: int
    generated_at: str
    filters: Dict[str, Any]
    summary: Dict[str, Any]
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
    folder_id: Optional[str] = None
    tag_ids: List[str] = Field(default_factory=list)


class TextToSqlPreviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str = Field(min_length=1)
    project_id: str = "default-space"
    folder_id: Optional[str] = None
    tag_ids: List[str] = Field(default_factory=list)
    limit: int = Field(default=50, ge=1, le=50)


class TextToSqlPreviewResponse(BaseModel):
    retrieval_log_id: str
    template_id: str
    intent: str
    generated_sql: str
    parameters: Dict[str, Any]
    readonly: bool
    safety_status: str
    columns: List[str]
    rows: List[Dict[str, Any]]
    row_count: int
    query_explanation: Dict[str, Any]
    provider_status: str
    fallback_reason: Optional[str]


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
    chunk_content: str = ""
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
    annotation_count: int = 0
    annotation_counts: Dict[str, int] = Field(default_factory=dict)


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


class CitationAnnotationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    evidence_item_id: str = Field(min_length=1)
    annotation_type: CitationAnnotationType
    content: str = Field(min_length=1, max_length=2000)


class CitationAnnotationBatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    evidence_item_ids: List[str] = Field(min_length=1, max_length=20)
    annotation_type: CitationAnnotationType
    content: str = Field(min_length=1, max_length=2000)

    @model_validator(mode="after")
    def require_unique_items(self) -> CitationAnnotationBatchRequest:
        if len(set(self.evidence_item_ids)) != len(self.evidence_item_ids):
            raise ValueError("evidence item ids must be unique")
        return self


class CitationAnnotationPatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    annotation_type: Optional[CitationAnnotationType] = None
    content: Optional[str] = Field(default=None, min_length=1, max_length=2000)

    @model_validator(mode="after")
    def require_change(self) -> CitationAnnotationPatchRequest:
        if self.annotation_type is None and self.content is None:
            raise ValueError("annotation change is required")
        return self


class CitationAnnotationRecord(BaseModel):
    id: str
    evidence_pack_id: str
    evidence_item_id: str
    annotation_type: CitationAnnotationType
    content: str
    metadata: Dict[str, Any]
    created_at: str
    updated_at: str


class CitationAnnotationListResponse(BaseModel):
    evidence_pack_id: str
    annotations: List[CitationAnnotationRecord]
    counts_by_type: Dict[str, int]
    total: int


class CitationAnnotationBatchResponse(BaseModel):
    evidence_pack_id: str
    requested_item_ids: List[str]
    created_count: int
    annotations: List[CitationAnnotationRecord]


class CitationCompareRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    evidence_item_ids: List[str] = Field(min_length=2, max_length=3)

    @model_validator(mode="after")
    def require_unique_items(self) -> CitationCompareRequest:
        if len(set(self.evidence_item_ids)) != len(self.evidence_item_ids):
            raise ValueError("evidence items must be unique")
        return self


class CitationCompareItem(BaseModel):
    id: str
    citation_label: str
    rank_score: float
    knowledge_unit_id: Optional[str]
    knowledge_unit_title: Optional[str]
    knowledge_unit_status: Optional[str]
    knowledge_unit_type: Optional[str]
    chunk_id: Optional[str]
    chunk_citation_label: Optional[str]
    source_id: Optional[str]
    source_title: Optional[str]
    source_origin: Optional[str]
    source_type: Optional[str]
    trace_path: List[Dict[str, Any]]
    copy_payload: Dict[str, Any]


class CitationCompareResponse(BaseModel):
    evidence_pack_id: str
    item_count: int
    items: List[CitationCompareItem]
    differences: Dict[str, Any]
    copy_safe_summary: str


class WorkspaceSummaryResponse(BaseModel):
    project_count: int
    folder_count: int
    tag_count: int
    upload_count: int
    file_count: int
    pending_file_count: int
    source_count: int
    chunk_count: int
    knowledge_unit_count: int
    pending_review_count: int
    evidence_pack_count: int
