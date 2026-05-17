# API Route-Level 实施计划

版本：v0.30-draft
日期：2026-05-17  
状态：P0 API 实施映射草案——四切片 + P0-Z0a/Z0b 竖切 + 切片前准备层 / 结构化整理检查门 / 知识切片质量闭环 / 安全运维横切层 / 检查门映射单一来源 / 事件枚举单一来源 / ProcessingJob / sensitive grant / evidence-only / 切片执行 profile / AI 结构化整理 profile / D-079 存储映射契约对齐 / D-080 知识调用 profile 与 implicit_agent / D-081-D085 调用边界、profile schema、Z0a 锚点与前端状态契约对齐 / D-092 OpenAPI 类型生成、trace chain 与 migration 波次命名 / D-093 桌面运行时 API 约束 / D-094 P0-Core 工程骨架 API 顺序 / D-098 页面到 API 组映射 / D-105 Citation Detail replay / D-106 Settings language config 持久化 / D-107 Feedback Events 与 Memory Draft Review / D-108 Feedback Diagnostics 只读复盘 / D-110 Feedback Diagnostics Export 脱敏导出 / D-111 Feedback Advanced Filters 与 Export History / D-112 Citation Detail Focus 与 Evidence Trace Interaction / D-113 Citation Annotation 与 Evidence Compare / D-114 OrganizationService 与 Folder-Tag metadata filters

## 1. 文档目的

`docs/api-design.md` 已定义 P0 API 边界，但它仍是 endpoint 草案。本文档把这些 endpoint 进一步映射为 route、DTO、service、repository、事务边界和实施阶段。

本文档不选择最终技术栈，也不编写代码。它的作用是让后续原型开发可以直接进入工程拆分，而不是重新解释 API 草案。

D-104 已把 Retrieval Preview / Search-Ask Integration Z0a 落地为当前实现边界：`POST /api/retrieval/preview`、`GET /api/evidence-packs/{evidence_pack_id}` 和 `POST /api/retrieval/evidence-only` 共用 confirmed KU → Evidence Pack → Citation Trace 链路，不新增数据库表，不接真实 LLM、reranker、Text-to-SQL provider、GraphRAG、feedback 或 Memory Draft。

D-105 已将 `GET /api/evidence-packs/{evidence_pack_id}` 从摘要复盘扩展为 Citation Detail / Evidence Pack replay：detail service 从 `retrieval_logs.filters_json` 还原 query explanation，并通过 `evidence_items → knowledge_units / chunks / sources` join 返回 KU / Chunk / Source / provider fallback / citation trace 字段；Renderer `/search` 与 `/ask` 只渲染后端 detail，不在前端拼接证据链。

D-106 已新增 `GET /api/settings` 与 `PATCH /api/settings`：SettingsService 只接受 `language=zh-CN | en-US`，默认返回 `zh-CN`，并由后端原子写入 app data 下的 `config.json`；Renderer 只消费 typed settings API，不把语言偏好写入 SQLite、长期 token、Node 文件系统或裸 `localhost`。

D-107 已新增 `POST /api/feedback`、`POST /api/memory-drafts`、`GET /api/memory-drafts` 和 `GET /api/memory-drafts/{id}`：FeedbackService 只写 append-only `feedback_events`，MemoryService 只创建 `memories.status=pending_review` 与 `review_tasks.target_type=memory`；Review confirm / ignore 支持 memory 状态变更，但不创建 confirmed KU，也不启用 `retrieval_feedback`。

D-108 已新增 `GET /api/feedback` 与 `GET /api/feedback/summary`：FeedbackService 只读 append-only `feedback_events`，按过滤条件返回事件列表，并通过既有 `ai_answers`、`evidence_packs`、`evidence_items`、`retrieval_logs` 补足 query / citation context；summary 返回类型/目标分布、正负向计数和 `feedback_policy`，不写 `retrieval_feedback`，不影响 ranking 或 confirmed knowledge。

D-110 已新增 `GET /api/feedback/export`：FeedbackService 复用 D-108 过滤和诊断 join，返回 JSON / CSV content、summary、filters、record_count 和脱敏标记；后端不写本地文件路径，Renderer 用 Blob download，不包含 source excerpt、answer text、local token、SQLite path 或完整本地路径。D-111 已将 list / summary / export 扩展为同一组高级 filters，并新增 `GET /api/feedback/export-history` 与 `DELETE /api/feedback/export-history/{id}`；history 只写 `config.json.feedback_export_history` metadata，不新增 SQLite 表。

D-112 已扩展 `GET /api/evidence-packs/{evidence_pack_id}`：EvidencePackService 支持可选 `focus_item_id`，返回 `detail_summary`、item-level `trace_path` 与 copy-safe citation payload；非法 focus 使用 `evidence_item_not_in_pack` error envelope。Renderer `/search` 与 `/ask` 只调用 typed detail API 聚焦 item，不自行 join KU / Chunk / Source，也不保存复制行为。

D-113 已新增 `citation_annotations` 与 annotation CRUD：CitationAnnotationService 校验 evidence item 必须属于目标 Evidence Pack；批注只作为本地 citation 复盘记录，不写 `feedback_events`。`POST /api/evidence-packs/{id}/compare` 只读组装同一 pack 内 2-3 条 evidence items 的 rank / source / chunk / KU / trace path / copy-safe summary，不保存 compare result。

D-114 已新增 OrganizationService：Project / Folder / Tag route 统一负责知识空间、Folder-Tag Mirroring、`source_tags` / `knowledge_unit_tags` 组织绑定；Source/KU list 与 Retrieval Preview / evidence-only answer 复用 `project_id`、`folder_id`、`tag_ids` filters。Renderer 通过 typed organization API/store 消费这些接口，不在前端拼接 SQLite 关系或硬编码本地路径。

目标：

- 明确每个 P0 route 属于哪个业务域；
- 明确 route 只负责请求校验和响应包装；
- 明确 service 承担业务流程；
- 明确 repository 只处理数据读写；
- 明确哪些能力 P0 使用 mock / rule-based；
- 明确每个实施切片的验收方式。

---

## 2. 技术栈映射

P0 技术栈已确定（D-029 / D-039 / D-040）：

```text
Desktop Framework: Electron
Frontend (Renderer): React + TypeScript + Vite
Backend (Sidecar):  Python + FastAPI
Database:           SQLite + sqlite-vec（P0 本地内嵌）
Migration:          Alembic
ORM:                SQLAlchemy（异步：sqlalchemy[asyncio] + aiosqlite）
Validation:         Pydantic（API schema）+ ruff（lint）+ pytest（test）
```

本文档术语映射为：

```text
routes        → FastAPI routers（`apps/api/app/api/routes/*.py`）
schemas       → Pydantic models（`apps/api/app/api/schemas/*.py`）
services      → Python service classes / functions（`apps/api/app/modules/<domain>/services.py`）
repositories  → SQLAlchemy 异步 repositories（`apps/api/app/repositories/*.py`）
                通过 Repository 抽象层隔离 SQL 方言，详见 §11
```

历史"技术栈中立"约定已废除。任何技术栈对照（如 Node.js / Express 映射）作为 P1 评估远期替代方案的参考，不影响 P0 实施。

### 2.1 P0-Z0a / Z0b 实施竖切

进入代码时先实现 P0-Z0a，不把完整 P0 对象一次性压入 W1：

```text
local_user / project / folder / tag
→ upload 或 text_import
→ verify / inspect job
→ parse / chunk
→ candidate KU / review confirm
→ embed job（真实 provider 或 mock_fixed_384 fallback）
→ retrieval log / evidence pack / evidence-only answer（不调用 LLM）
```

P0-Z0a 的验收重点是端到端数据链路、ProcessingJob 可恢复、引用可追溯和错误可解释，并返回 D-080 的 `query_understanding_profile`、`retrieval_strategy_profile`、`ranking_profile`、`citation_trace_profile` 的最小摘要。D-081 后，P0-Z0a 不持久化 `invocation_requests` / `retrieval_plans` / `memories` / `retrieval_feedback`；这些对象在 P0-Z2 补齐。D-082 要求响应遵循 `InvocationProfileSchema v1`；D-083 要求返回 `feedback_policy` 和前端可消费的状态摘要；D-085 要求 Z0a 通过 `retrieval_log_id` / `evidence_pack_id` 串起 Evidence / Answer，citation 返回 evidence item / trace summary 而不是持久化 citation id。P0-Z0b 同周补齐账号预埋表、分片恢复、source description、citation 明细、sensitive grant、审计日志和前端状态契约；P0-Z1 再补齐关系、质量事件和增强 parser；P0-Z2 再补齐 invocation plan、memory draft、feedback、implicit_agent provider answer 和完整 RAG provider 复盘。

### 2.2 D-092：OpenAPI / TypeScript / Migration 前置契约

D-092 后，API 层还必须满足以下工程约束：

- FastAPI / Pydantic schema 是 OpenAPI 单一来源；前端 DTO 必须从 `openapi.json` 生成。
- 工程需提供 `scripts/export-openapi.py` 或等价脚本，并提供 `pnpm generate:api-types`。
- typed fetch wrapper 只能消费生成的 TypeScript API types，不允许页面组件手写长期 DTO。
- 所有请求进入 API 层时生成或继承 `trace_id`，并把 `trace_id` 传递给 ProcessingJob、SSE event、retrieval log、Evidence Pack 和 AIAnswer。
- Alembic migration 文件名必须携带 `z0a / z0b / z1 / z2` 波次；Z0a migration 不得创建 P0-Z1/Z2 后置对象。

### 2.3 D-093：桌面运行时 API 约束

D-093 后，API 层必须显式支持桌面软件运行形态：

- FastAPI sidecar 只绑定 `127.0.0.1`，并通过 middleware 校验 `X-Local-Session-Token`；
- `X-Trace-Id` 由 typed fetch wrapper 注入，API middleware 负责补齐缺失值并写入日志上下文；
- API response 不返回 local session token，不在 error `details` 暴露完整本地路径；
- `GET /api/health` 必须区分 `sidecar_starting / ready / degraded`，并包含 DB、worker、provider manifest 的摘要状态；
- migration / restore / backup 期间写接口返回 `migration_in_progress` 或 `backup_in_progress`，不得部分写入；
- `local_sqlite_worker` 失去 heartbeat 时，长任务接口返回 `worker_unavailable`，但 health endpoint 仍可说明 sidecar 存活；
- 诊断导出接口只导出脱敏后的 runtime summary、provider status、recent jobs 和日志，不包含 DB 文件、API Key、用户原文或完整私密路径。

### 2.4 D-094：P0-Core API Skeleton 顺序

D-094 后，首批 API skeleton 只证明桌面 runtime 可被 Main、Preload 和 Renderer 安全消费。上传、检索、RAG、Provider 调用等业务 route 可以注册占位或后续实现，但不得成为 `smoke:p0-core` 的前置依赖。

第一批 route 仅包含：

```text
GET  /api/health
GET  /api/system/runtime
GET  /api/system/status
POST /api/system/diagnostics:export
GET  /api/auth/status
```

`GET /api/system/runtime` 是 D-094 新增的 runtime state 单一读取入口，至少返回：

```yaml
runtime_state: booting | sidecar_starting | sidecar_ready | db_checking | migration_running | worker_starting | ready | degraded | recovery_required | shutting_down
sidecar_status:
  status:
  reason:
db_status:
  status:
  reason:
worker_status:
  status:
  reason:
provider_summary_status:
  status:
  unavailable_count:
  fallback_count:
vector_status:
  status: available | degraded | unavailable
  reason:
recovery_required:
  required: boolean
  reason:
trace_id:
request_id:
```

约束：

- `/api/health` 用于 Main 判断 sidecar 是否存活；`/api/system/runtime` 用于 Renderer 状态栏和诊断；
- runtime endpoint 必须通过 local session token middleware；
- upload / retrieval / RAG route 不得参与 `smoke:p0-core`；
- 如果 DB 处于 `migration_running` 或 `recovery_required`，写接口默认不可用，但 runtime endpoint 必须仍可返回状态；
- `POST /api/system/diagnostics:export` 可以先生成最小脱敏包或 stub，但接口形态必须固定。

### 2.5 D-098：页面到现有 API 组映射

D-098 不新增 route、DTO、migration 或 OpenAPI 文件，只约束 Renderer 页面如何消费既有 route group，以及后端 service response summary 必须能支撑页面状态。

| Renderer route | API / Service owner | 实施说明 |
|---|---|---|
| `/dashboard` | `SystemStatusService`、Source / Retrieval / Answer query services | 聚合 runtime/provider summary、最近导入、文档数量、最近搜索/问答和 AI 摘要数量；如果 summary 尚未实现，P0-Core 只显示 runtime 和可解释 empty state |
| `/import` | `UploadService`、`FileInspectionService`、`ProcessingEventService`、`ProviderCapabilityService` | 上传和解析状态走 ProcessingJob + SSE；格式能力展示来自 provider capability，不在 UI 写死“已支持所有格式” |
| `/library` | Project/Folder/Tag/Source/Chunk/KU/Review query services | 列表和筛选只消费 API；Renderer 不读本地文件系统，不直接拼接 chunk/source 状态 |
| `/search` | `RetrievalPreviewService`、`EvidencePackService`、`CitationService`、`FeedbackService` | response 必须返回 query understanding、strategy route、ranking summary、citation trace、evidence gaps 和 feedback actions |
| `/ask` | `RAGAnswerService`、`EvidencePackService`、`CitationService`、`FeedbackService` | Z0a 固定 evidence-only；Provider answer 只在能力可用时启用，且必须带 citation |
| `/graph` | `RelationService`、Tag/Source/KU query services、Evidence summary | P0 只读 confirmed relation 或 relation suggestion evidence；GraphRAG 和外部图数据库不进入 route 依赖 |
| `/outputs` | `RAGAnswerService`、`MemoryService`、`ReviewTaskService`、`ExportService` | 输出物为 derived artifact；无 evidence 时返回 disabled / pending review，不写 confirmed knowledge |
| `/settings` | `AuthStatusService`、`SystemStatusService`、`SettingsService`、`ProviderCapabilityService`、`BackupService`、`ExportService` | D-106 已接入语言设置；API Key 写入仍走 Electron IPC / Keychain；settings route 拒绝密钥字段、未知字段和非法语言 |

页面状态字段建议统一进入各 response 的 `meta.frontend_state` 或等价 summary：

```yaml
state: loading | empty | degraded | recoverable_error | done
reason:
capability_status:
fallback_reason:
next_action:
trace_id:
```

实现约束：

- 不为 D-098 生成新的 endpoint；如果某页面缺少 summary，先返回既有对象 + 空态解释。
- Search / Ask 页面不得依赖前端临时缓存拼 Evidence Pack；Evidence、Citation 和 Query Explanation 均以后端返回为准。
- Graph / Outputs 数据不足时返回 disabled reason；不得用 mock 图谱或无来源生成物填充 UI。
- Import 页面所有格式能力均来自 `GET /api/ai-providers/capabilities` 或系统状态摘要。

---

## 3. 推荐目录映射

后续进入代码阶段时，建议以领域组织，而不是按单个表堆文件。

```text
src/
├── api/
│   ├── routes/
│   │   ├── auth.*
│   │   ├── uploads.*
│   │   ├── files.*
│   │   ├── jobs.*
│   │   ├── projects.*
│   │   ├── folders.*
│   │   ├── tags.*
│   │   ├── sources.*
│   │   ├── knowledge-units.*
│   │   ├── review-tasks.*
│   │   ├── relations.*
│   │   ├── retrieval.*
│   │   ├── rag.*
│   │   ├── invocations.*
│   │   ├── evidence-packs.*
│   │   ├── feedback.*
│   │   └── memory-drafts.*
│   ├── schemas/
│   │   ├── common.*
│   │   ├── source.*
│   │   ├── job.*
│   │   ├── knowledge-unit.*
│   │   ├── review.*
│   │   ├── retrieval.*
│   │   └── invocation.*
│   └── response.*
├── modules/
│   ├── auth/
│   ├── uploads/
│   ├── files/
│   ├── parsing/
│   ├── projects/
│   ├── ingestion/
│   ├── source-description/
│   ├── chunking/
│   ├── knowledge-units/
│   ├── classification/
│   ├── review/
│   ├── relations/
│   ├── embeddings/
│   ├── retrieval/
│   ├── text-to-sql/
│   ├── invocation/
│   ├── evidence/
│   ├── rag/
│   ├── feedback/
│   └── audit/
├── repositories/
│   ├── auth.*
│   ├── uploads.*
│   ├── files.*
│   ├── parsing.*
│   ├── projects.*
│   ├── folders.*
│   ├── tags.*
│   ├── sources.*
│   ├── chunks.*
│   ├── knowledge-units.*
│   ├── review-tasks.*
│   ├── relations.*
│   ├── embeddings.*
│   ├── retrieval-logs.*
│   ├── invocations.*
│   ├── evidence-packs.*
│   ├── ai-answers.*
│   ├── memories.*
│   └── feedback.*
├── db/
│   ├── migrations/
│   ├── views/
│   └── seed/
└── tests/
    ├── contract/
    ├── integration/
    └── fixtures/
```

如果第一版原型更小，可以合并 `modules/` 和 `repositories/` 的部分文件，但 route、business service 和 data access 的边界不应混在同一个 handler 中。

---

## 4. 通用 Route 约定

### 4.1 Route 只做四件事

Route handler 只做：

1. 解析 path / query / body。
2. 调用 DTO 校验。
3. 调用 service。
4. 包装统一响应或错误。

Route 不做：

- 直接写 SQL；
- 直接生成 mock embedding；
- 直接创建多个表对象；
- 直接判断复杂 Review 状态流转；
- 直接拼接 SQL。

### 4.2 Service 职责

Service 负责：

- 编排业务流程；
- 控制事务边界；
- 调用 repository；
- 调用 rule / mock generator；
- 写入 audit log；
- 返回领域结果。

### 4.3 Repository 职责

Repository 负责：

- 参数化查询；
- 表和视图读写；
- 数据库错误映射；
- 不包含产品流程判断。

### 4.4 DTO 命名

建议命名：

```text
CreateProjectRequest
CreateFolderRequest
TextImportSourceRequest
CreateKnowledgeUnitRequest
UpdateKnowledgeUnitRequest
ReviewTaskActionRequest
CreateRelationRequest
RetrievalPreviewRequest
CreateInvocationRequest
CreateMockAnswerRequest
SubmitFeedbackRequest
CreateMemoryDraftRequest
```

响应 DTO：

```text
ProjectResponse
SourceImportResponse
KnowledgeUnitResponse
ReviewTaskResponse
RetrievalPreviewResponse
InvocationResponse
EvidencePackResponse
CitationPreviewResponse
QueryExplanationResponse
```

---

## 5. Route 到 Service 映射

### 5.1 Project / Folder / Tag

| Route | Service | Repository | P0 关键行为 |
|---|---|---|---|
| `POST /api/projects` | `ProjectService.createProject` | `ProjectRepository` | 创建知识空间 |
| `GET /api/projects` | `ProjectService.listProjects` | `ProjectRepository` | 列出项目 |
| `POST /api/folders` | `FolderService.createFolder` | `FolderRepository`, `TagRepository` | 创建 folder，并创建 / 复用 mirror tag |
| `GET /api/folders` | `FolderService.listFolders` | `FolderRepository` | 按 project 列出 folders，供 Library/Search 过滤 |
| `POST /api/tags` | `TagService.createTag` | `TagRepository` | 创建 user/custom tag；folder mirror tag 仍由 FolderService 创建或复用 |
| `GET /api/tags` | `TagService.listTags` | `TagRepository` | 支持 namespace / project filter |
| `PATCH /api/sources/{source_id}/organization` | `OrganizationService.updateSourceOrganization` | `SourceRepository`, `FolderRepository`, `TagRepository`, `SourceTagRepository`, `KnowledgeUnitTagRepository` | 绑定 Source folder/tags，并同步派生 KU 的 folder mirror 与 source-assignment tags |
| `PATCH /api/knowledge-units/{knowledge_unit_id}/organization` | `OrganizationService.updateKnowledgeUnitOrganization` | `KnowledgeUnitRepository`, `FolderRepository`, `TagRepository`, `KnowledgeUnitTagRepository` | 独立调整 KU folder/tags，不修改 Source 原始内容 |

事务边界：

```text
createFolder:
  create folders
  upsert folder mirror tag
  commit
```

### 5.1A Auth Preembed

| Route | Service | Repository | P0 关键行为 |
|---|---|---|---|
| `GET /api/auth/status` | `AuthStatusService.getStatus` | `AuthRepository` | 返回 local_user、auth disabled、role/access policy 摘要 |
| `POST /api/auth/login` | `AuthDisabledService.reject` | `AuthRepository` | 返回 `auth_not_enabled_in_p0` |

### 5.1B Upload / File Processing

| Route | Service | Repository | P0 关键行为 |
|---|---|---|---|
| `POST /api/uploads` | `UploadService.createTask` | `UploadRepository`, `AuditRepository` | 创建上传任务，决定 direct / multipart |
| `PUT /api/uploads/{id}/parts/{part_no}` | `UploadService.receivePart` | `UploadRepository`, `FileRepository` | 写入 `tmp/uploads/`，更新 received_bytes |
| `POST /api/uploads/{id}:complete` | `UploadService.complete` | `UploadRepository`, `FileRepository`, `IntegrityRepository`, `StatusEventRepository` | 合并、校验、保存 `sources/`、创建 file |
| `GET /api/uploads/{id}` | `UploadQueryService.getStatus` | `UploadRepository` | 返回进度和错误码 |
| `POST /api/files/{file_id}:verify` | `FileIntegrityService.verify` | `FileRepository`, `IntegrityRepository` | 校验 hash / signature |
| `POST /api/files/{file_id}:inspect` | `FileInspectionService.inspect` | `FileRepository`, `FileInspectionRepository`, `StatusEventRepository`, `ProviderCapabilityService` | 真实类型、编码、安全、结构和预览检查，写 inspection results |
| `GET /api/files/{file_id}/inspection` | `FileInspectionQueryService.getReport` | `FileRepository`, `FileInspectionRepository` | 返回完整 FileInspectionReport |
| `POST /api/files/{file_id}:preview` | `FilePreviewService.rebuild` | `FileRepository`, `FileInspectionRepository`, `StatusEventRepository` | 单独重建预览资产 |
| `GET /api/files/{file_id}/preview` | `FilePreviewQueryService.getPreview` | `FileRepository`, `FileInspectionRepository` | 返回预览状态和本地预览资产引用 |
| `POST /api/files/{file_id}:parse` | `ParsingService.createTask` | `FileRepository`, `FileInspectionRepository`, `ParseRepository`, `SourceRepository`, `StatusEventRepository` | Parser Router 消费 FileInspectionReport 后选择开源优先 parser，创建 parse task |
| `GET /api/parse-tasks/{id}` | `ParsingQueryService.getTask` | `ParseRepository` | 查询解析状态、warnings、source_id |

`complete` 建议事务：

```text
load upload_task
verify all required parts
merge or move temporary file
compute hash
create files
create file_integrity_checks
create inspect ingestion_job with target_type=file
create processing_status_events initial event
commit
```

`inspect` 建议流程：

```text
load file
run true type detection
run encoding detection / normalization hints
run static security scan
run structure detection
run preview generation when supported
write file_inspection_results
update files.metadata_json summary
update files.inspection_status / preview_status summary
write processing_status_events
return FileInspectionReport
```

`parse` 前置约束：

- 若 inspection 不存在，先同步触发最小 inspection，或返回 `file_detection_unavailable`。
- 若最新 `risk_level=blocked/quarantined`，返回 `file_blocked_by_risk_policy`，不得创建 parse task。
- Parser Router 以 `detected_mime_type`、`file_signature`、`risk_flags` 和 structure result 为优先输入；扩展名只作为弱信号。

### 5.2 Source / Ingestion

| Route | Service | Repository | P0 关键行为 |
|---|---|---|---|
| `POST /api/sources/text-import` | `IngestionService.importTextSource` | `SourceRepository`, `SourceDescriptionRepository`, `ChunkRepository`, `JobRepository`, `AuditLogRepository` | 创建 Source、Source Description、Chunk、embedding job、audit；embedding 由后台 `EmbeddingService` 处理 |
| `GET /api/sources/{source_id}` | `SourceQueryService.getSourceDetail` | `SourceRepository`, `ChunkRepository`, `KnowledgeUnitRepository`, `AuditLogRepository` | 获取来源详情 |
| `POST /api/sources/{source_id}/source-description:regenerate` | `SourceDescriptionService.regenerateRuleBased` | `SourceDescriptionRepository`, `AuditLogRepository` | 规则重生成，不静默覆盖用户编辑字段 |
| `POST /api/sources/{source_id}/chunks:build` | `ChunkBuildService.build` | `SourceRepository`, `ChunkRepository`, `QualityRepository`, `JobRepository`, `ProviderCapabilityService` | 执行切片前准备、strategy profile 匹配、结构恢复、chunks 重建、上下文补充、source metadata 绑定与质量检查 |

`importTextSource` 建议事务：

```text
validate project / folder
validate source_origin
create sources
create source_descriptions
split chunks
create chunks
create embed ingestion_job with target_type=source
create optional mock candidate KU if configured
write audit log
commit
```

`ChunkBuildService.build` 建议流程：

```text
load source and validate project / permission scope
create or reuse ProcessingJob(target_type=source, job_type=chunk)
write chunk_preparation_started event
load latest parse task + parse warnings
load latest FileInspectionReport when file_id exists
run input_integrity_check
consume OCR / layout / parser outputs
run ocr_layout_check and content_kind classification
select chunk_strategy_profile
write chunk_strategy_selected event
run strategy_match_check
restore document structure from parser output
write chunk_structure_recovered event
run structure_integrity_check
select chunk_execution_profile from content_kind + parser / inspection outputs
split text / structured table / multimodal transcript chunks through the selected execution profile
enrich context_summary and source_metadata
run source_binding_check and metadata_completeness_check
write chunks.metadata_json
write chunk_quality_checks
write chunk_preparation_warning / chunk_preparation_completed / chunk_context_enriched / chunk_quality_warning / chunk_quality_failed events
return job snapshot + chunk quality summary
```

D-076 执行 profile 不改变 job/event/quality check 主流程，只决定同一 `ChunkBuildService` 内部如何执行切片：

| chunk_execution_profile | chunk_type | P0 / P1 边界 | 执行要点 |
|---|---|---|---|
| `p0_rule_text_execution_v1` | `text_semantic` | P0-Z0a 默认 | 标题、段落、长度边界、tiktoken 或规则 token 估算；缺少高级语义模型时仍可运行 |
| `p0_structured_table_execution_v1` | `structured_table` | P0-Z0b 默认 / P1 增强 | PyMuPDF / pdfplumber / openpyxl 读取结构，pandas / Pandera 做表格清洗与质量检查 |
| `p0_image_ocr_execution_v1` | `image_ocr` | P0 optional / P1 增强 | PaddleOCR 可用时使用 OCR 文本；缺失时写 `fallback_reason=ocr_unavailable` 并进入待复核 |
| `p0_audio_transcript_execution_v1` | `audio_transcript` | P0 optional / P1 增强 | Whisper / transcript adapter 可用时切分转写文本；缺失时保留 Source 与 pending 状态 |
| `p0_video_scene_execution_v1` | `video_scene` | P0 optional / P1 增强 | FFmpeg 元数据和场景提示作为弱结构；不要求 Video-LLaVA 或商业多模态模型 |
| `p0_mixed_execution_v1` | `mixed` | P0-Z0b / P0-Z1 | 混合正文、表格、图片、代码或 transcript 时先拆成 typed child chunks；无法拆分时记录 warning |

LangChain Text Splitter、LlamaIndex Node Parser、sentence-transformers、CLIP / BLIP / Florence、Table Transformer、LLM semantic chunking 和 reranker quality review 只能作为 P1 / P2 adapter 挂入上述 profile，不能绕过 D-075 的 `ProcessingJob`、`processing_status_events`、`chunk_quality_checks` 和 `check_gate` 映射。

事务边界：

- 只有 source 不存在、项目/权限不匹配这类无法定位目标的同步校验可以在 job 创建前失败；其余 input / OCR / strategy / structure / source binding 检查必须在 ProcessingJob 创建后执行，并以 event 或 quality check 记录。
- strategy 选择、chunk 写入、quality check 写入和 event 写入应在同一 UnitOfWork 内提交，避免 Source Detail 看到 chunk 但看不到质量摘要。
- Embedding rebuild 不在 `chunks:build` 同步事务内执行；只创建 embed job 或标记旧 embedding stale。
- LLM / reranker 质量评估只在 P0-Z2 或 Provider 可用增强路径启用；缺失时写 `fallback_reason`，不得阻塞规则切片。

P0 mock 规则：

- Source Description 使用标题、首段、`source_origin`、`metadata_json` 生成。
- Chunking 使用段落 / heading / 字符长度规则。
- Embedding 不在 `text_import` 写事务内同步执行；事务只创建 `embed` job。后台 `EmbeddingService` 统一路由：优先 `bge_m3_local` 等开源 profile；缺失时使用 `mock_fixed_384` fallback，并记录 `dimension`、`capability_status` 和 `fallback_reason`。
- 文件来源由 Upload / File Processing 先创建 `files` 和 `sources`，`text_import` 是同一流程的无物理文件变体。

### 5.3 Knowledge Unit

| Route | Service | Repository | P0 关键行为 |
|---|---|---|---|
| `POST /api/knowledge-units` | `KnowledgeUnitService.createCandidate` | `KnowledgeUnitRepository`, `KnowledgeUnitChunkRepository`, `KnowledgeUnitTagRepository`, `ReviewTaskRepository`, `AuditLogRepository` | 创建 pending_review KU，并创建 Review Task |
| `POST /api/knowledge-units:extract` | `KnowledgeExtractionService.extractCandidates` | `SourceRepository`, `ChunkRepository`, `KnowledgeUnitRepository`, `ReviewTaskRepository`, `ProcessingStatusEventRepository`, `QualityRepository(Z1)` | 内容理解、摘要、关键概念、字段生成、知识卡片、分类标签、关系建议逐步检查；Z0a/Z0b 不依赖 `quality_events` / `knowledge_relations`，Provider 不可用时规则/mock 或 pending_review |
| `GET /api/knowledge-units/{knowledge_unit_id}` | `KnowledgeUnitQueryService.getDetail` | `KnowledgeUnitRepository`, `ChunkRepository`, `SourceRepository`, `RelationRepository(Z1)` | 获取 KU、来源、标签、关系、引用；Z0a/Z0b 未启用 `knowledge_relations` 时返回空关系列表和 relation capability status |
| `PATCH /api/knowledge-units/{knowledge_unit_id}` | `KnowledgeUnitService.updateDraft` | `KnowledgeUnitRepository`, `AuditLogRepository` | 更新字段，但确认必须走 Review |
| `POST /api/knowledge-units:from-answer` | `KnowledgeUnitService.createFromAnswer` | `AIAnswerRepository`, `EvidencePackRepository`, `KnowledgeUnitRepository`, `ReviewTaskRepository` | 从 mock answer / retrieval preview 回流为候选 KU |

`KnowledgeExtractionService.extractCandidates` 内部流程固定为：

```text
create/reuse ProcessingJob(target_type=source, job_type=extract)
→ load source / chunks / chunk quality / source metadata
→ content_understanding → topic_understanding
→ summary_generation → summary_quality
→ key_concept_extraction → concept_extraction
→ schema_mapping → schema_mapping
→ knowledge_card_generation → card_normalization
→ classification_tagging → tag_consistency
→ relation_suggestion → relation_suggestion
→ write knowledge_units.metadata_json.structured_organization
→ write processing_status_events warning / failed summary
→ create review_tasks for KU / tag_suggestion / knowledge_card / relation_suggestion payloads
→ P0-Z1 optional: write quality_events warning / failed
```

结构化整理执行 profile：

| profile | 默认工具 / adapter | 对应检查 | P0 边界 |
|---|---|---|---|
| `p0_rule_structuring_v1` | 规则 + source/chunk metadata | `topic_understanding` | LLM 缺失时仍能生成待复核候选 |
| `p0_summary_template_v1` | heading / first paragraph / evidence snippets | `summary_quality` | 摘要只能作为候选说明，不替代原文 |
| `p0_key_concept_rules_v1` | KeyBERT / YAKE / spaCy / HanLP optional | `concept_extraction` | 缺失时写 `fallback_reason=concept_provider_missing` |
| `p0_schema_mapping_v1` | Pydantic + JSON Schema | `schema_mapping` | 字段缺失进入 review，不直接丢弃候选 |
| `p0_knowledge_card_template_v1` | Jinja2 / Markdown / YAML frontmatter | `card_normalization` | 生成卡片必须保留 source / chunk pointer |
| `p0_classification_tagging_v1` | KeyBERT / HanLP / spaCy / rule tags | `tag_consistency` | 标签建议必须可编辑、可合并、可回滚 |
| `p0_relation_suggestion_stub_v1` | 规则关系候选；LLM/NetworkX/RDF optional | `relation_suggestion` | 只创建关系 review task，不写 confirmed relation |

约束：

- 结构化整理检查链固定为：内容理解 → 摘要生成 → 关键概念抽取 → 结构化字段生成 → 知识卡片生成 → 分类与标签管理 → 知识关系建议。
- D-079 的标签生成、分类整理、实体识别和三元组抽取不新增顶级 step：标签合并/去重/层级整理写入 `classification_tagging.tag_operations`；项目/知识库归属建议写入 `classification_tagging.classification_routing`；标题、作者、时间、摘要、标签、项目归属写入 `schema_mapping.field_mapping`；实体候选、三元组候选和关系候选写入 `relation_suggestion.result`。
- 每一步都必须记录 `provider_key`、`capability_status`、`fallback_reason` 和质量检查结果；任何一步缺失真实 Provider 时只能生成候选或 pending review，不得直接写入 confirmed KU。
- LlamaIndex、LangChain Structured Output、Instructor / Guardrails、BGE / Sentence-Transformers、BERTopic、Neo4j、NetworkX、RDFlib 只作为 P1/P2 adapter 或增强 profile，不成为 P0 必装依赖。
- Z0a/Z0b 的关系建议固定为 `review_tasks.target_type=relation_suggestion` + `payload_json.suggestion_type=relation_suggestion`，payload 必须包含候选关系两端、`relation_type`、`evidence_chunk_ids`、`confidence` 和 `reason`；分类、字段和知识卡片候选通过同一 `payload_json.suggestion_type` 区分，不能新增专用表；`knowledge_relations` 表到 P0-Z1 后才由 Review confirm 写入。
- Z0a/Z0b 的结构化质量异常先写 `processing_status_events` 和 `knowledge_units.metadata_json.structured_organization.quality_scores`；`quality_events` 只在 P0-Z1 之后作为质量治理事件写入。

- 新建 KU 默认 `pending_review`。
- `available_for_agent=true` 必须在 Review confirm 后才允许进入 agent_default。
- `chunk_ids` 必须存在且属于同一 project。
- folder mirror tag 必须自动继承。

### 5.4 Review

| Route | Service | Repository | P0 关键行为 |
|---|---|---|---|
| `GET /api/review-tasks` | `ReviewService.listQueue` | `ReviewTaskRepository` | 查询待确认对象 |
| `POST /api/review-tasks/{review_task_id}:act` | `ReviewService.applyAction` | `ReviewTaskRepository`, `KnowledgeUnitRepository`, `MemoryRepository`, `RelationRepository(Z1)`, `AuditLogRepository` | confirm / edit / ignore / merge / split / reject / do_not_use；Z0a/Z0b 的 relation suggestion confirm 只确认 review task，不写 confirmed relation |

`applyAction` 必须是事务：

```text
load review task
lock target object
validate action
apply patch
update target status
update review task status
write audit log
commit
```

关键约束：

- `confirm` 才能设置 `user_verified=true`。
- `do_not_use` 必须使 `available_for_agent=false`。
- `merge` / `split` P0 可以先记录状态和 audit，不要求复杂自动拆分。

### 5.5 Relation

| Route | Service | Repository | P0 关键行为 |
|---|---|---|---|
| `POST /api/relations` | `RelationService.createManualRelation` | `RelationRepository`, `KnowledgeUnitRepository`, `AuditLogRepository` | 创建用户确认关系 |

约束：

- P0 只做 manual relation。
- from / to KU 必须属于同一 project。
- relation_type 必须来自枚举。
- `confirmed_by_user=true`。

### 5.6 Retrieval Preview

| Route | Service | Repository / Module | P0 关键行为 |
|---|---|---|---|
| `POST /api/retrieval/preview` | `RetrievalPreviewService.preview` | `QueryUnderstandingService`, `RetrievalStrategyService`, `TextToSqlTemplateService`, `KnowledgeUnitRepository`, `EmbeddingRepository`, `VectorStoreService`, `ProviderCapabilityService`, `RetrievalLogRepository`, `KnowledgeUnitTagRepository` | 规则 query understanding、strategy route、project/folder/tag filters、keyword/vector/hybrid merge、ranking/citation trace 摘要、检索解释、写 retrieval log |
| `GET /api/evidence-packs/{evidence_pack_id}` | `EvidencePackService.getDetail` | `EvidencePackRepository`, `EvidenceItemRepository`, `KnowledgeUnitRepository`, `ChunkRepository`, `SourceRepository`, `RetrievalLogRepository`, `CitationAnnotationRepository` | D-113 Z0b-lite 已实现：按 ID 返回 Evidence Pack replay，支持 `focus_item_id`、`detail_summary`、annotation summary、KU/Chunk/Source trace path 和 copy-safe citation payload；非法 focus 返回 `evidence_item_not_in_pack` |
| `GET/POST /api/evidence-packs/{evidence_pack_id}/annotations` | `CitationAnnotationService` | `EvidencePackRepository`, `EvidenceItemRepository`, `CitationAnnotationRepository` | D-113：列出 / 创建本地 citation 批注；annotation item 必须属于 pack；不写 feedback、不改 ranking |
| `PATCH/DELETE /api/citation-annotations/{annotation_id}` | `CitationAnnotationService` | `CitationAnnotationRepository` | D-113：更新或物理删除批注；只允许 `annotation_type` 和 `content` |
| `POST /api/evidence-packs/{evidence_pack_id}/compare` | `EvidenceCompareService.compare` | `EvidenceItemRepository`, `KnowledgeUnitRepository`, `ChunkRepository`, `SourceRepository` | D-113：只读对比同一 pack 内 2-3 条 evidence items，返回 differences / copy-safe summary，不持久化 compare |
| `POST /api/retrieval/evidence-only` | `EvidenceOnlyAnswerService.answer` | `RetrievalPreviewService`, `AIAnswerRepository` | D-104 Z0a 已实现，D-114 扩展 project/folder/tag filters：复用 retrieval preview / evidence assembly，不调用 LLM；无证据只返回 no evidence reason，不生成伪答案 |

流程：

```text
validate scope and filters
build query_understanding_profile from rules/templates; optional LLM rewrite is provider-gated
set rewrite_status=not_needed when rewrite is not required; do not mark normal rule routing as fallback
classify query intent and question_type
select retrieval_strategy_profile
build read-only query plan
apply project / permission / status filters
run selected keyword / tag / metadata / source-file query
run vector ranking when profile/index available; otherwise use fallback score
add confirmed relation or relation_suggestion evidence when route allows it
merge results
compute ranking_profile
split source_reliability_score from source_reliability_label
build citation_trace_profile for returned evidence candidates
write retrieval_logs
return results + query_explanation
```

P0 输出必须包含：

- `retrieval_log_id`
- `evidence_pack_id`
- `query_explanation`
- `evidence_pack`
- `evidence_item_ids`
- `citation_labels`
- `citation_trace_summary`
- `provider_status`
- `fallback_reason`

D-104 后，feedback policy/actions、relation evidence、provider-backed vector ranking 和 Text-to-SQL provider 仍是 Z2 或后续增强，不属于当前实现验收。

D-105 后，`GET /api/evidence-packs/{id}` 是 Search / Ask citation detail 的单一后端入口；不得要求 Renderer 自行 join KU / Chunk / Source，也不得在 detail replay 中写 feedback、Memory Draft 或 confirmed knowledge。

D-112 后，Citation Detail focus 仍只读；不得修改 ranking、不得保存用户复制行为、不得让 `pending_review` KU 进入 Evidence Pack。

D-113 后，Citation Annotation 是 citation / evidence item 的本地复盘对象，不进入 feedback signal，不进入检索证据；Evidence Compare 是 response-only，只比较同一 Evidence Pack 内 evidence items。

D-114 后，Retrieval Preview 与 evidence-only answer 必须先应用 `project_id`、`folder_id`、`tag_ids` 范围过滤，再执行 token overlap / metadata fallback ranking；这些过滤只收窄候选集合，不改变 ranking 权重，也不得让 `pending_review` KU 进入 Evidence Pack。

D-106 后，`GET /api/settings` 与 `PATCH /api/settings` 是语言偏好持久化的单一后端入口；Renderer 普通浏览器 fallback 只能保留 session 语言，不得绕过 preload bridge 直接读写 `config.json`。

路由约束：

- `simple_fact` 默认走 FTS5 / BM25 + metadata filter。
- `concept_explanation` 默认走 sqlite-vec vector search + metadata filter。
- `timeline` 默认走 metadata filter 与时间字段。
- `file_lookup` 默认走 source / file index。
- `relationship_analysis` 只读 confirmed relation 或 relation_suggestion evidence；GraphRAG 运行时不进入 P0。
- `summary_synthesis` 和 `complex_hybrid` 走 hybrid search，reranker 不可用时回退 `ranking_profile.fallback_reason=reranker_unavailable`。

### 5.7 Invocation / Evidence

| Route | Service | Repository / Module | P0 关键行为 |
|---|---|---|---|
| `POST /api/invocations` | `InvocationService.createRequest` | `InvocationRepository` | P0-Z2 持久化调用请求；Z0a 不实现或返回 unsupported/optional |
| `POST /api/invocations/{request_id}/retrieval-plan` | `RetrievalPlanService.createPlan` | `RetrievalPlanRepository`, `TextToSqlTemplateService`, `QueryUnderstandingService`, `RetrievalStrategyService` | P0-Z2 创建 rule-based / mock plan，并写入 query_understanding / strategy / ranking / citation trace profile；Z0a 写 retrieval log summary |
| `POST /api/invocations/{request_id}/evidence-pack` | `EvidencePackService.buildPack` | `EvidencePackRepository`, `EvidenceItemRepository`, `KnowledgeUnitRepository`, `ChunkRepository` | P0-Z2 invocation-scoped 构建；Z0a 由 retrieval preview / RAG answer 内部构建 pack，并以 `retrieval_log_id` 为锚点 |
| `GET /api/evidence-packs/{evidence_pack_id}/citation-preview` | `CitationService.preview` | `EvidencePackRepository`, `EvidenceItemRepository`, `SourceRepository` | 还原引用预览 |
| `GET /api/evidence-packs/{evidence_pack_id}/query-explanation` | `QueryExplanationService.explain` | `RetrievalPlanRepository`, `EvidencePackRepository` | 解释 query understanding、strategy route、ranking、citation trace、scope、filter、vector profile/fallback、evidence gaps |
| `POST /api/invocations/{request_id}/mock-answer` | `MockAnswerService.create` | `AIAnswerRepository`, `EvidencePackRepository` | P0-Z2 调试接口候选；Z0a 只通过 `POST /api/rag/answers` 创建 `evidence_only_answer` |

Evidence Pack 构建事务：

```text
load retrieval_log_id, or load request + retrieval plan when P0-Z2 persisted invocation is enabled
run or reuse retrieval result
create evidence_packs with retrieval_log_id; request_id/retrieval_plan_id nullable in Z0a
create evidence_items
write query_trace, ranking_profile, citation_trace_profile and evidence_gaps
commit
```

关键约束：

- P0-Z0a 只实现 `evidence_only_answer`，不得调用 LLM；P0-Z2 才允许在 LLM Provider 可用时生成带引用的 `rag_answer`，不可用时仍生成 `evidence_only_answer`，不得伪装为模型回答。
- P0-Z0a 的 Evidence / Answer 以 `retrieval_log_id` 和 `evidence_pack_id` 为锚点；`request_id` / `retrieval_plan_id` 在 Z0a 可为空，P0-Z2 启用后再补齐持久化关联。
- P0-Z0a 的 RAG answer 响应返回 `evidence_item_ids`、`citation_labels` 和 `citation_trace_summary`；持久化 `answer_citation_id` 只在 P0-Z0b+ 返回。
- Evidence Pack 必须可持久化复盘。
- Citation Preview 不应依赖前端临时状态。
- 预览、摘要、知识卡片只能作为辅助视图；Citation Preview 必须回到 Source / Chunk / Knowledge Unit、file/page/paragraph/text span。
- `implicit_agent` 在 P0 只允许隐式单 Agent：对话上下文、意图理解、只读任务规划、内部检索、RAG 问答和草稿生成；多 Agent、自主执行、外部 API 工具调用和生产级任务编排不落地。

### 5.9 Provider Capability / Worker Events / Desktop Settings

| Route | Service | Repository / Module | P0 关键行为 |
|---|---|---|---|
| `GET /api/ai-providers/capabilities` | `ProviderCapabilityService.listCapabilities` | `ProviderRegistry`, `RuntimeProbeService` | 返回 parser/OCR/ASR/token_counting/structure_recovery/document_layout/table_structure/html_xml_structure/academic_paper_structure/chunk_strategy/semantic_chunking/context_enrichment/chunk_quality_eval/content_understanding/schema_mapping/knowledge_card_generation/classification_tagging/relation_suggestion/embedding/rerank/LLM 的 `status`、`fallback_profile`、`fallback_reason`、`next_action` |
| `GET /api/jobs/{id}/events` | `ProcessingEventService.streamJobEvents` | `ProcessingStatusEventRepository` | 通用 SSE 事件流；支持 `Last-Event-ID` 续读 |
| `GET /api/jobs/{id}` | `JobQueryService.getSnapshot` | `JobRepository`, `ProcessingStatusEventRepository` | 返回当前 ProcessingJob snapshot、last_event_id、可恢复状态和失败原因 |
| `GET /api/uploads/{id}/events` | `ProcessingEventService.streamUploadEventsAlias` | `UploadRepository`, `ProcessingStatusEventRepository` | 上传页兼容别名；内部解析到 job 后复用 `streamJobEvents` |
| `GET /api/system/status` | `SystemStatusService.getStatus` | `SystemLogRepository`, `JobRepository`, `ProviderCapabilityService` | 返回日志、异常监控、数据安全、性能成本和稳定性本地汇总 |
| `GET /api/settings` | `SettingsService.getUserSettings` | `ConfigFileStore` | D-106 已实现：读取 app data `config.json`，不存在时返回 `language=zh-CN`、`persistence=config_json` |
| `PATCH /api/settings` | `SettingsService.updateUserSettings` | `ConfigFileStore` | D-106 已实现：只允许 `language=zh-CN | en-US`，未知字段或非法语言返回 `validation_error`，写入时原子替换 `config.json` |

实现约束：

- FastAPI 必须先注册 `/api/ai-providers/capabilities`，再注册 `/api/ai-providers/{provider_id}`。
- `CapabilityStatus.status` 使用 `available / fallback / unavailable / disabled / error`，不再用 `available: bool` 作为跨模块契约。
- `local_sqlite_worker` 领取任务时写 `locked_by` / `locked_until`；每次状态变化写 `processing_status_events.event_seq`。
- SSE 的 `id:` 等于 `event_seq`；客户端断线后用 `Last-Event-ID` 补读，失败时回退 job snapshot。
- 所有长任务都先创建 ProcessingJob snapshot（物理表可为 `ingestion_jobs`），再异步执行；route 事务不得等待 preview / embedding / RAG answer 这类可恢复任务完成。
- Job 状态机固定为 `queued -> processing -> completed`、`queued/processing -> failed_recoverable -> queued`、`queued/processing -> failed_final`、`queued/processing -> cancelled`；终态不可被普通重试回写为 active。
- `chunk_preparation_started`、`chunk_preparation_warning`、`chunk_preparation_completed`、`chunk_strategy_selected`、`chunk_strategy_mismatch`、`chunk_structure_recovered`、`chunk_source_binding_failed`、`chunk_context_enriched`、`chunk_quality_warning`、`chunk_quality_failed`、`structured_organization_started`、`structured_organization_completed`、`structured_organization_warning`、`structured_organization_failed` 是 `processing_status_events.event_type` 的 P0 保留值；结构化整理具体失败步骤写入 `payload_json.step`，不再为每个子步骤新增事件名。
- `SystemStatusService` 只聚合本地状态，不上传遥测；必须支持 `window=1h/24h/all`，并为每个 module 返回 `status`、`status_reason` 和阈值说明；外部 APM、Sentry、Prometheus、Grafana 只能作为 P1 adapter。
- `inspect / preview / parse / embed / rag_answer` 写接口默认按 `(target_type, target_id, job_type)` 幂等复用 active job；`force=true` 只允许在无 active job 时新建。

### 5.8 Feedback / Memory Draft

| Route | Service | Repository | P0 关键行为 |
|---|---|---|---|
| `POST /api/feedback` | `FeedbackService.submit` | `FeedbackEventRepository`, `EvidencePackRepository`, `AIAnswerRepository`, `EvidenceItemRepository` | D-107 已实现：校验至少一个 evidence_pack / ai_answer / evidence_item 目标，写 append-only `feedback_events`，返回 `feedback_policy`；不写 `retrieval_feedback` |
| `GET /api/feedback` | `FeedbackService.listDiagnostics` | `FeedbackEventRepository`, `EvidencePackRepository`, `AIAnswerRepository`, `EvidenceItemRepository`, `RetrievalLogRepository` | D-111 已实现：按 `created_at` 排序返回反馈事件，支持 type / target / evidence ids / created_from / created_to / search / ranking_effect / has_comment / sort / limit 过滤，返回 query、citation_label 和 ranking_effect |
| `GET /api/feedback/summary` | `FeedbackService.summarizeDiagnostics` | `FeedbackEventRepository` | D-111 已实现：复用 diagnostics filters，返回 total、by_type、by_target_type、positive_count、negative_count、last_event_at 和 `feedback_policy` |
| `GET /api/feedback/export` | `FeedbackService.exportDiagnostics` | `FeedbackEventRepository`, `EvidencePackRepository`, `AIAnswerRepository`, `EvidenceItemRepository`, `RetrievalLogRepository`, `SettingsConfigRepository` | D-111 已实现：复用 diagnostics filters，支持 `format=json|csv`，返回 filename、mime_type、record_count、summary、content、`redacted=true` 和 `includes_source_text=false`；导出后向 `config.json.feedback_export_history` 写脱敏 metadata |
| `GET /api/feedback/export-history` | `FeedbackService.listExportHistory` | `SettingsConfigRepository` | D-111 已实现：返回最近 20 条导出历史 metadata；不返回 export content |
| `DELETE /api/feedback/export-history/{id}` | `FeedbackService.deleteExportHistory` | `SettingsConfigRepository` | D-111 已实现：删除单条 history metadata，不影响 `feedback_events` 或业务对象 |
| `POST /api/memory-drafts` | `MemoryService.createDraft` | `MemoryRepository`, `ReviewTaskRepository`, `AuditLogRepository`, `AIAnswerRepository` | D-107 已实现：从既有 `ai_answer_id` 创建 `memories.status=pending_review` 与 `review_tasks.target_type=memory` |
| `GET /api/memory-drafts` | `MemoryService.listDrafts` | `MemoryRepository`, `ReviewTaskRepository` | D-107 已实现：返回 memory draft / confirmed / archived 摘要，可按 status 过滤 |
| `GET /api/memory-drafts/{id}` | `MemoryService.getDraft` | `MemoryRepository`, `ReviewTaskRepository` | D-107 已实现：复盘单个 memory draft 与 review task 绑定 |

约束：

- Feedback 在 D-107 / D-108 / D-110 / D-111 只保存、读取、导出和复盘 `feedback_events`，并携带 / 还原 `feedback_policy`。Z2 才允许写 `retrieval_feedback` 并参与 ranking suggestion。
- `click / useful / not_useful / favorite / bad_citation / missing_source / downrank_source` 只影响后续排序建议、诊断和 UI 提示，不自动改写 confirmed knowledge。
- Feedback Diagnostics 是只读复盘入口；不得修改 `feedback_events`、`knowledge_units`、`sources`、`evidence_packs`、`ai_answers` 或 `memories`。
- Feedback Diagnostics Export 只导出当前筛选的诊断摘要和事件表，不包含 source excerpt、answer text、local token、DB path 或完整本地路径；不得创建长期导出文件。
- Export History 只持久化 `config.json` 中的脱敏 metadata、filters、summary totals 和 `content_sha256`；不得保存 export `content`，也不得新增 SQLite 表。
- Memory Draft 在 D-107 作为 Z0b-lite 能力提前实现，但仍必须进入 Review。
- Memory confirmed 后才可在后续阶段进入 agent_default；D-107 不把 Memory 加入 retrieval results。

---

## 6. P0 事务边界清单

必须使用事务的流程：

| 流程 | 原因 |
|---|---|
| `text_import` | 同时创建 Source、Source Description、Chunk、Embedding、Audit |
| 创建 Candidate KU | 同时创建 KU、KU-Chunk、KU-Tag、ReviewTask |
| Review Action | 同时更新目标对象、ReviewTask、Audit |
| 创建 Manual Relation | 校验两端 KU 并创建关系 |
| 构建 Evidence Pack | 同时创建 pack 和 item 级证据 |
| 保存 Memory Draft | 同时创建 Memory 和 ReviewTask |

可以非事务或短事务的流程：

- 查询 Source Detail；
- 查询 Knowledge Unit Detail；
- Retrieval Preview；
- Citation Preview；
- Query Explanation；
- Submit Feedback。

---

## 7. P0 Fallback / Rule-Based 模块

P0 需要显式封装 fallback、mock 和 rule-based 能力，避免散落在 route handler 中。真实 provider 可用时走 provider adapter；缺失时才走本节模块。

| 模块 | 函数候选 | 输出 |
|---|---|---|
| `SourceDescriptionRules` | `buildDescriptionFromText` | summary、key_terms、language、confidence |
| `ChunkingRules` | `splitTextIntoChunks` | chunks with index / excerpt |
| `EmbeddingService` | `embedOrFallback` | embedding record，profile=`bge_m3_local` 或 fallback `mock_fixed_384` |
| `MockEmbeddingFallback` | `createMockVector` | deterministic vector，profile=`mock_fixed_384`，dimension=384 |
| `MockKnowledgeUnitRules` | `suggestCandidateUnits` | optional pending_review KU |
| `TextToSqlTemplateService` | `planReadOnlyQuery` | intent、SQL template、query explanation |
| `EvidenceGapRules` | `detectEvidenceGaps` | gaps array |
| `MockAnswerService` | `renderRetrievalPreviewAnswer` | `retrieval_preview` / `mock_answer` |

这些模块必须在响应和日志中标记 `is_mock=true` 或 `strategy=rule_based`。

---

## 8. OpenAPI 生成路线

P0 不必先手写完整 `openapi.yaml`，但 route 实施前应按以下顺序推进：

1. 以 `docs/api-design.md` 作为语义接口草案。
2. 以本文档作为 route-level 分层契约。
3. 选择技术栈后，用 DTO/schema 生成或维护 OpenAPI。
4. 每个 route 至少补齐 request schema、response schema、error schema。
5. 合同测试以 OpenAPI schema 为准。

第一版 OpenAPI 分组：

```text
Projects
Folders
Tags
Sources
Knowledge Units
Review Tasks
Relations
Retrieval
Invocations
Evidence Packs
Feedback
Memory Drafts
```

OpenAPI 应包含 P0-RAG answer / evidence-only fallback 接口；真实 Text-to-SQL 模型接口仍需明确标记为 future / disabled。

---

## 9. 实施阶段

### 9.1 P0-0：工程骨架

目标：

- 建立 API server；
- 建立统一 response / error；
- 建立 DTO validation；
- 建立数据库连接和迁移框架；
- 建立 contract test 骨架。

验收：

- health check 可运行；
- route 注册可被列出；
- common error schema 生效。

### 9.2 P0-1：Project / Folder / Tag

目标：

- 实现 project 创建；
- 实现 folder 创建；
- 实现 folder-tag mirroring；
- 实现 tag 查询。

验收：

- 创建 folder 后能查到 mirror tag。
- tag namespace 可过滤。

### 9.3 P0-File：Upload / File / Parse / Source / Chunk

目标：

- 实现 upload task、分片/直传、complete；
- 实现 file integrity check；
- 实现 file parse task 和 Parser Router；
- 实现 `POST /api/sources/text-import`；
- 写入 Source、Source Description、Chunk、mock embedding、audit；
- 支持 Source Detail。

验收：

- 上传文件能产生 upload_task、file、integrity check 和 processing status。
- Parser 不可用时返回可恢复失败状态，不删除文件。
- 一次 text_import 产生 Source、Source Description、至少一个 Chunk。
- `source_origin` 不支持时返回 `unsupported_source_origin`。
- 用户编辑版本不会被 regenerate 静默覆盖。

D-101 已实现的 Z0a 子集：

- 已实现 Upload / File API：`POST /api/uploads`、`PUT /api/uploads/{id}/parts/{part_no}`、`POST /api/uploads/{id}:complete`、`GET /api/uploads/{id}`、`GET /api/files`、`GET /api/files/{file_id}`、`POST /api/files/{file_id}:verify`。
- 已实现 local_fs 上传存储、分片记录、sha256 完整性校验、`file_id`、File Inspection Z0a summary 和 `file_inspection` ProcessingJob events。
- 已实现 renderer `/import` 的 Uppy core 自定义低保真上传控件，以及 `/library` 的真实 file list。
- 未实现 preview、OCR/ASR、真实文件类型 provider 和完整 quarantine policy；这些保持在后续 P0-File/P0-AI 阶段。

D-102 已实现的 Z0a 子集：

- 已实现 `POST /api/files/{file_id}:parse`、`GET /api/parse-tasks/{id}`、`GET /api/sources`、`GET /api/sources/{source_id}`。
- 已实现内置 Parser Router：text / markdown / json / csv 类文件使用 `builtin_text_markdown` 生成 `Source(source_origin=parsed_file)`、`Chunk`、FTS 记录和最小 `chunk_quality_checks`。
- 已实现 `parse_tasks`、`parse_warnings`、`file_parse` ProcessingJob events 和 renderer `/library` Source 面板。
- D-102 不创建 Candidate KU、Review Task 或 Embedding；D-103 已通过显式 Knowledge extraction API 接入这些对象。

### 9.4 P0-AI：Knowledge Unit Extraction / Review / Embedding

目标：

- 实现 Candidate KU 创建；
- 实现 `POST /api/knowledge-units:extract`；
- 实现 KU 与 Chunk / Tag 关联；
- 实现 Review Queue 和 Review Action。
- 实现 Embedding rebuild。

D-103 已实现的 Z0a 子集：

- 已实现 `POST /api/knowledge-units:extract`、`GET /api/knowledge-units`、`GET /api/knowledge-units/{knowledge_unit_id}`。
- 已实现 parsed Source / Chunk → Candidate KU → Review Task → `mock_fixed_384` fallback embedding。
- 已实现 renderer `/library` 的 Source Extract 操作和 Review 队列 confirm / ignore。
- 未实现真实 LLM、标签合并、关系写入、Memory Draft、provider-backed RAG 或完整 embedding rebuild worker。

验收：

- 新 KU 默认 `pending_review`。
- Review confirm 后 `user_verified=true`。
- `do_not_use` 后不可被 agent_default 检索。

### 9.5 P0-RAG-0：Retrieval Preview / Text-to-SQL Template

目标：

- 实现 Retrieval Preview；
- 实现 rule-based `query_understanding_profile`；
- 实现 `retrieval_strategy_profile` 的问题类型路由；
- 使用 `docs/text-to-sql.md` 中的只读模板；
- 写入 RetrievalLog，并保存 `ranking_profile` / `citation_trace_profile` 摘要。

验收：

- 默认过滤未确认和不可调用 KU。
- 返回 query_explanation。
- 返回 query_understanding、strategy_route、ranking_summary、citation_trace_summary 和 feedback_actions。
- fallback vector 被标记为 fallback，不作为语义质量验收。
- 覆盖 simple_fact、concept_explanation、timeline、file_lookup、relationship_analysis、summary_synthesis、complex_hybrid 路由场景。

### 9.6 P0-RAG-1：Invocation / Evidence / Citation

目标：

- Z0a 返回 invocation / retrieval plan response summary；P0-Z2 再实现 `invocation_requests` / `retrieval_plans` 持久化；
- 实现 Evidence Pack + Evidence Items；
- 实现 Citation Preview 和 Query Explanation；
- P0-Z0a 可先跳过 Invocation / Retrieval Plan 表，用 retrieval log + evidence pack 跑通 evidence-only answer；Invocation / Retrieval Plan 在 P0-Z2 补齐。
- Evidence Item 写入 `citation_trace_profile`，Query Explanation 展示 route、ranking 和 fallback。

验收：

- Evidence Pack 刷新后仍可复盘。
- Citation Preview 能还原 Source / Chunk / Knowledge Unit。
- Citation Preview 能还原 file、page/section、paragraph/text span；预览资产不得替代 citation。
- Evidence Pack 可作为 RAG answer 和 evidence-only answer 输入。
- `permission_mode=user_preview` 不创建 Evidence Pack；`explicit_sensitive_confirmed` 必须验证 `sensitive_access_grant_id` 的过期、撤销、scope 和一次性使用状态。

### 9.7 P0-RAG-2：RAG Answer / Feedback / Memory Draft / 回流

前置条件：P0-RAG-1 已能持久化 Evidence Pack 和 Evidence Items。

目标：

- Z0a 先实现 `POST /api/rag/answers` 的 `evidence_only_answer` 路径，不调用 LLM；
- Z2 再实现 Provider 可用时的 `rag_answer`；
- 实现 Feedback；
- 实现 Memory Draft；
- 实现 from-answer Candidate KU。
- 返回 `implicit_agent` 边界和 `feedback_actions`，前端据此展示 AI 思考、证据、引用、反馈按钮和异常提示。

验收：

- Z0a 固定输出 `evidence_only_answer`；Z2 Provider 可用时输出 `rag_answer`，Provider 缺失时仍输出 `evidence_only_answer`。
- Feedback 不直接改变主知识库。
- `feedback_signal` 不直接改变 confirmed relation、confirmed KU 或 source truth。
- Memory Draft 进入 Review。
- from-answer KU 保留 evidence links。

---

## 10. 合同测试清单

P0 每个阶段至少需要以下合同测试：

1. 请求字段缺失返回 `validation_error`。
2. 不存在对象返回 `not_found`。
3. 权限或状态不允许返回 `permission_denied` 或 `agent_call_not_allowed`。
4. 不支持 `source_origin` 返回 `unsupported_source_origin`。
5. Review 之前不可进入 agent_default。
6. P0-Z0a `POST /api/rag/answers` 不调用 LLM，固定返回 `evidence_only_answer`；P0-Z2 才验证 Provider 可用时生成 `rag_answer`，Provider 缺失时返回 `evidence_only_answer` 和 `rag_provider_missing`。
7. Evidence Pack 创建后可通过 ID 读取。
8. Citation Preview 不依赖前端临时缓存。
9. Text-to-SQL 模板只执行 SELECT。
10. Feedback / Memory Draft 不绕过 Review。
11. `POST /api/files/{file_id}:inspect` 写入 `file_inspection_results`，并更新 `files.metadata_json` 摘要。
12. `blocked/quarantined` 文件调用 parse 返回 `file_blocked_by_risk_policy`，不创建 parse task。
13. `GET /api/files/{file_id}/preview` 在预览工具缺失时返回 `preview_unavailable`，文件仍保留。
14. `GET /api/jobs/{job_id}/events` 使用 `event_seq` 续读 upload / inspect / parse / embed 事件。
15. 同一 `(target_type, target_id, job_type)` 的 active ProcessingJob 只能存在一个；重复 `inspect / preview / parse / embed / rag_answer` 请求默认返回既有 job。
16. `permission_mode=user_preview` 不创建 Evidence Pack；`explicit_sensitive_confirmed` 缺少、过期、撤销、scope 不匹配或已使用的 `sensitive_access_grant_id` 返回 `validation_error` 或 `permission_denied`。
17. `POST /api/knowledge-units:extract` 返回 ProcessingJob 和 `structuring_summary`，每个结构化整理 step 都必须包含 `provider_key`、`capability_status`、`fallback_reason` 和 `status`。
18. 关系建议只创建 review task，不直接写 confirmed relation；Review 之前 KU / tag / relation 候选不可进入 agent_default。

---

## 11. Repository 抽象层接口契约

P0 数据库为 SQLite + sqlite-vec，P1 可能迁移 PostgreSQL + pgvector。为避免 P1 切换数据库时业务流程大面积返工，所有 SQL 访问必须通过 Repository 抽象层。本节定义 Repository 的接口契约。

### 11.1 契约目标

- 业务模块（service / route）只依赖 Repository 接口，不依赖 SQLAlchemy / 具体方言。
- 同一 Repository 接口可被 SQLite / PostgreSQL 两种实现满足，Service 层无感知。
- 事务边界由 Service 显式控制，不让 Repository 内部隐式开启事务。
- 测试可用 in-memory SQLite 或 fake Repository 替换真实实现。

### 11.2 命名与文件组织

```text
apps/api/app/repositories/
├── base.py                 (BaseRepository 协议 + UnitOfWork)
├── auth.py
├── uploads.py
├── files.py
├── parsing.py
├── projects.py             (ProjectRepository)
├── sources.py
├── knowledge_units.py
├── review.py
├── retrieval.py
├── embeddings.py
├── audit.py
└── system_logs.py
```

P0 默认按业务聚合组织 Repository，而不是每张表强制一个文件：

| Repository | 主要负责表 |
|---|---|
| `AuthRepository` | users, user_profiles, auth_identities, roles, access_policies |
| `UploadRepository` | upload_tasks, upload_parts |
| `FileRepository` | files, file_integrity_checks |
| `FileInspectionRepository` | file_inspection_results |
| `JobRepository` | processing_jobs（物理表可为 ingestion_jobs）, processing_status_events |
| `ParseRepository` | parse_tasks, parse_warnings, chunk_quality_checks, quality_events |
| `ProjectRepository` | projects, folders, tags |
| `SourceRepository` | sources, source_descriptions, chunks |
| `KnowledgeUnitRepository` | knowledge_units, knowledge_unit_chunks, knowledge_unit_tags, knowledge_relations |
| `ReviewRepository` | review_tasks |
| `RetrievalRepository` | retrieval_logs + 只读视图查询 |
| `EmbeddingRepository` | embeddings |
| `SensitiveAccessGrantRepository` | sensitive_access_grants |
| `AuditRepository` | audit_logs |
| `SystemLogRepository` | system_logs |

只有当某个表的查询复杂度明显独立增长时，才拆成单表 Repository。P0-RAG 同步创建 `InvocationRepository`、`EvidenceRepository`、`AnswerRepository`、`MemoryRepository`、`FeedbackRepository`。

### 11.3 接口签名约定

每个 Repository 至少提供以下方法（按需扩展，复杂查询单独命名）：

```python
class ProjectRepository(Protocol):
    async def get(self, project_id: UUID) -> Project | None: ...
    async def list(
        self,
        *,
        user_id: UUID,
        kb_type: str | None = None,
        status: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Project]: ...
    async def create(self, dto: ProjectCreate) -> Project: ...
    async def update(self, project_id: UUID, patch: ProjectPatch) -> Project: ...
    async def archive(self, project_id: UUID) -> None: ...
    async def exists(self, project_id: UUID) -> bool: ...
    async def count(self, *, user_id: UUID) -> int: ...
```

约定：

- 方法返回业务 dataclass / Pydantic model（**不返回** SQLAlchemy ORM 对象）。
- 查询过滤通过命名参数传递，**禁止接受原始 SQL 字符串**。
- `list` 方法必须支持 `limit + offset`，默认 limit ≤ 50（与 SQL 安全规则一致）。
- 复杂多表查询（如 v_knowledge_units_with_tags）封装为独立查询方法（如 `list_with_tags`），命名清晰表达 join 目的。
- Repository 方法**不抛出** `sqlalchemy.IntegrityError` 等底层异常，统一转化为业务异常（详见 §11.6）。

### 11.4 事务边界与 Unit of Work

P0 采用 **Service 层 Unit of Work** 模式控制事务边界：

```python
class UnitOfWork:
    projects: ProjectRepository
    folders: FolderRepository
    tags: TagRepository
    sources: SourceRepository
    # ... 其他 Repository

    async def __aenter__(self) -> "UnitOfWork": ...
    async def __aexit__(self, *args) -> None: ...
    async def commit(self) -> None: ...
    async def rollback(self) -> None: ...
```

使用方式：

```python
async def import_text_source(uow: UnitOfWork, dto: TextImportDTO) -> SourceImportResult:
    async with uow:
        source = await uow.sources.create(dto.to_source_create())
        description = await uow.source_descriptions.create(...)
        chunks = await uow.chunks.create_batch(...)
        await uow.audit_logs.create(action="create_source", target_id=source.id, ...)
        await uow.commit()
        return SourceImportResult(...)
```

约定：

- 一个 Service 方法 = 一个事务（Unit of Work），跨多个 Repository 操作必须共享同一 UoW。
- UoW 退出时默认 rollback，必须显式 commit 才持久化。
- 异常时自动 rollback。
- Repository 方法**不接受** session/connection 参数，从 UoW 隐式获取。

### 11.5 异步策略

P0 全异步：

- FastAPI 路由 `async def`
- SQLAlchemy 用 `AsyncSession`（`sqlalchemy.ext.asyncio`）
- 数据库驱动：`aiosqlite`（P0 SQLite）→ `asyncpg`（P1 PostgreSQL）
- Embedding / 文件 I/O / 备份等耗时操作必须 `await`，禁止 sync 阻塞 event loop

### 11.6 异常转化

Repository 层必须把数据库异常转化为业务异常：

| 数据库异常 | 业务异常 | HTTP code |
|---|---|---|
| `IntegrityError` (unique constraint) | `DuplicateError` | 409 Conflict |
| `IntegrityError` (foreign key) | `InvalidReferenceError` | 400 |
| `NoResultFound` | `NotFoundError` | 404 |
| `OperationalError` (locked) | `DatabaseBusyError` | 503 |
| `OperationalError` (schema migration) | `MigrationInProgressError` | 503 |
| `DatabaseError` (其他) | `RepositoryError` | 500 |

Service 层捕获业务异常并转化为 API 错误码（参见 `docs/api-design.md` §4.4）：

```text
DuplicateError → "validation_error" + details.duplicate_field
NotFoundError → "not_found"
DatabaseBusyError → "backup_in_progress" or "migration_in_progress"
```

### 11.7 SQL 方言适配点

P0 SQLite vs P1 PostgreSQL 差异统一在 Repository 实现内吸收，业务调用方无感：

| 差异点 | SQLite 实现 | PostgreSQL 实现 |
|---|---|---|
| boolean | `INTEGER 0/1` + 应用层转换 | 原生 `BOOLEAN` |
| timestamp | `TEXT ISO 8601` + `datetime.fromisoformat()` | 原生 `TIMESTAMPTZ` |
| JSON 数组 | `TEXT` + `json.dumps()` / `json.loads()` | 原生 `JSONB` / `ARRAY` |
| 数组查询 | `EXISTS (SELECT 1 FROM json_each(col) WHERE value = ?)` | `? = ANY(col)` |
| 全文检索 | `MATCH` (FTS5) | `to_tsvector` / `pg_trgm` |
| 向量检索 | `sqlite-vec MATCH` | `pgvector <=>` 操作符 |

P0 Repository 实现优先使用 SQLAlchemy ORM 表达式，避免手写 SQL；当确需方言特定写法时，把 SQL 片段隔离到 `apps/api/app/repositories/_dialects/sqlite.py` 模块。

### 11.8 测试约定

Repository 测试三档：

1. **单元（fake repository）**：Service 层测试时使用纯内存 fake Repository（Python dict / list），不依赖 SQLite。
2. **集成（in-memory SQLite）**：Repository 自身的 IT 使用 `sqlite+aiosqlite:///:memory:`，每个测试函数前 schema migrate。
3. **集成（临时文件 SQLite）**：跨 Repository 的事务测试使用临时文件（验证 WAL 模式下的真实行为）。

Fake Repository 示例：

```python
class FakeProjectRepository:
    def __init__(self):
        self._data: dict[UUID, Project] = {}

    async def get(self, project_id): return self._data.get(project_id)
    async def create(self, dto): ...
    # ...
```

Service 层测试时通过依赖注入替换：

```python
def test_create_project(fake_uow):
    fake_uow.projects = FakeProjectRepository()
    service = ProjectService(uow=fake_uow)
    result = await service.create(ProjectCreate(name="test"))
    assert result.id is not None
```

### 11.9 P1 迁移检查清单

P1 切换 PostgreSQL 时需逐 Repository 验证：

- [ ] 所有 SQL 方言适配点已在 PostgreSQL 实现内重写
- [ ] 异常转化映射在 PostgreSQL 异常基础上重新建立（`asyncpg.UniqueViolationError` 等）
- [ ] 事务隔离级别配置一致（默认 READ COMMITTED）
- [ ] 数据迁移脚本可重复执行（idempotent）
- [ ] 测试矩阵增加 PostgreSQL（用 testcontainers-python）

### 11.10 不在 Repository 处理的内容

- 业务规则（如"folder 创建时必须同时创建 mirror tag"）→ Service 层
- 默认调用过滤（permission/status/user_verified）→ Service 层（防止误调 Repository 时绕过过滤）
- 缓存（P0 不实现 Repository 级缓存，P1 评估）
- 数据校验（用 Pydantic 在 schema 层完成）

---

## 12. 实现前冻结项

进入代码前建议冻结：

- P0 技术栈；
- `source_origin` 枚举；
- Knowledge Unit 最小字段；
- Source Description Card P0 字段；
- Review Action 枚举；
- Relation Type 枚举；
- Embedding profile registry：默认开源 profile、fallback `mock_fixed_384`、每个 profile 的 dimension 和 sqlite-vec index 映射；
- `AIAnswer.output_type` P0 枚举；
- 三个只读视图字段；
- common response / error schema。

如果这些未冻结，也可以做原型，但必须把字段迁移风险写入实现计划。

---

## 13. 与其他文档的关系

- `docs/mvp-scope.md` 决定 P0 做什么和不做什么。
- `docs/data-model.md` 决定表、字段、关系和只读视图。
- `docs/api-design.md` 决定 endpoint 语义。
- `docs/text-to-sql.md` 决定 P0 查询契约和 SQL 安全边界。
- 本文档决定 route-level 实施拆分、Repository 抽象层契约和阶段验收。
- `docs/technical-stack-and-prototype-plan.md` 决定 P0 推荐技术栈、原型目录、实施切片和验证命令。
- `docs/p0a-execution-plan.md` 决定 P0-Core / P0-File / P0-AI / P0-RAG 6 周周计划和开工命令清单。
- `docs/desktop-architecture.md` 决定桌面框架、IPC、备份与迁移。
- `docs/ai-provider-architecture.md` 决定 AI Provider 抽象与 Key 管理。

后续进入代码阶段时，应先确认 `docs/technical-stack-and-prototype-plan.md` 与 `docs/p0a-execution-plan.md`，再根据本文档（含 §11 Repository 契约）创建开发任务、迁移和 route handler。
