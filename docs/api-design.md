# API 设计草案

版本：v0.27-draft
日期：2026-05-17  
状态：P0 API 边界草案——完整上传/文件处理/File Inspection/切片前准备层/切片执行 profile/AI 结构化整理 profile/D-079 structuring summary 子字段/结构化整理检查门/知识切片质量闭环/AI/RAG API + D-080 知识调用 profile / implicit_agent / D-081 Z0a-Z2 持久化边界 / D-082 InvocationProfileSchema / D-083 前端状态与反馈策略 / D-085 Z0a 调用锚点、feedback 与 citation 边界修正 + D-098 页面到现有 API 组映射 + D-105 Citation Detail / Evidence Pack replay 实现边界 + D-106 Settings language 持久化边界 + D-107 Feedback Events / Memory Draft Review Z0b-lite + D-108 Feedback Diagnostics / Event Replay Z0b-lite + D-110 Feedback Diagnostics Export Z0b-lite + D-111 Feedback Diagnostics Advanced Filters / Export History Z0b-lite + D-112 Citation Detail Focus / Evidence Trace Interaction Z0b-lite + 安全运维横切层 + 检查门映射单一来源 + 事件枚举单一来源 + P0-Z0a/ProcessingJob/sensitive grant 契约收紧

## 1. 文档目的

本文档定义 AI 个人知识资产系统 P0 的 API 边界。

它不是最终 OpenAPI 文件，也不是代码实现说明。它用于把 `docs/data-model.md` 的对象转化为可实现的服务边界，支撑后续原型开发。

P0 API 覆盖：

- 用户系统预埋：本地用户、auth status、disabled auth contract、role / access policy contract。
- 入库域：上传任务、分片/直传、完整性校验、文件保存、Source、Chunk。
- 文件处理域：File Inspection、Parser Router、解析任务、parse warning、chunk quality。
- AI 结构化域：Source Description、Knowledge Unit extraction、Embedding rebuild、Review。
- RAG 域：Hybrid Retrieval、Evidence Pack、Citation Preview、Query Explanation、RAG answer / evidence-only fallback。
- 回流域：Feedback、Memory Draft、Candidate Knowledge Unit。
- 知识调用域：Query Understanding、Retrieval Strategy、Ranking、Citation Trace、Feedback Signal 和 implicit_agent 响应契约；这些字段复用现有 Retrieval / Evidence / RAG API，不新增 endpoint。

---

## 2. API 设计原则

### 2.1 P0 先验证链路

P0 API 可以返回 mock / rule-based 结果，但必须保留稳定对象和可复盘记录。

### 2.2 写入必须显式

任何写入长期知识库的行为必须来自：

- 用户创建；
- 用户确认；
- Review 后提交。

调用系统不能绕过 Review 直接写入 Confirmed Knowledge Unit 或 Confirmed Memory。

### 2.3 调用默认只读

调用类 API 默认只读取：

```text
user_verified = true
available_for_agent = true
permission allowed
status not in archived / do_not_use
```

### 2.4 P0 开源优先与可恢复降级

P0 采用开源优先 ProviderRegistry。未配置 parser / OCR / ASR / embedding / reranker / LLM 时，不得丢失文件或伪装成功，必须返回可恢复状态或 fallback：

- Parser 缺失：`unsupported_parser` / `parser_unavailable`。
- OCR/ASR 缺失：`ocr_unavailable` / `asr_unavailable`。
- RAG Provider 缺失：返回 `evidence_only_answer`。
- Embedding provider 缺失：使用 fallback profile `mock_fixed_384`，并在 query explanation 中标注；384 维只属于该 fallback，不是全局默认。

---

## 3. API 分组

业务 API：

```text
/api/projects
/api/auth
/api/uploads
/api/files
/api/jobs
/api/folders
/api/tags
/api/sources
/api/parse-tasks
/api/chunks
/api/knowledge-units
/api/review-tasks
/api/relations
/api/embeddings
/api/retrieval
/api/invocations
/api/evidence-packs
/api/citations
/api/rag
/api/feedback
/api/memory-drafts
```

桌面系统 API（P0 必需，详见 §16）：

```text
/api/health
/api/system/info
/api/system/data-dir
/api/backups
/api/exports
/api/settings
/api/ai-providers
/api/onboarding
```

命名说明：

- 数据库表名使用 snake_case。
- API path 使用 kebab-case。
- 响应字段使用 snake_case，方便直接对齐数据库和 Text-to-SQL 视图。

### 3.1 D-098 页面到现有 API 组映射

D-098 不新增 endpoint，只规定 8 个 Renderer 内部页面如何消费既有 API 组。页面组件不得绕过 Main/preload 注入的 typed fetch wrapper，也不得在前端拼接 Evidence/Citation。

| 页面路由 | 页面 | 主要消费 API 组 | 响应必须能表达的页面状态 |
|---|---|---|---|
| `/dashboard` | 首页 / 总览 Dashboard | `/api/system/runtime`、`/api/system/status`、`/api/ai-providers/capabilities`、Sources / Retrieval / AIAnswer summary 查询 | 最近导入、知识库概览、文档数量、AI 摘要数量、最近搜索/问答、provider/fallback summary |
| `/import` | 资料导入 | `/api/uploads`、`/api/files`、`/api/jobs/{id}/events`、`/api/ai-providers/capabilities` | 上传进度、解析状态、格式能力状态、recoverable failure、P1/P2 导入入口 disabled reason |
| `/library` | 知识库 / 文件管理 | `/api/projects`、`/api/folders`、`/api/tags`、`/api/sources`、`/api/files`、`/api/chunks`、`/api/knowledge-units`、`/api/review-tasks` | 分类树、文档列表、标签/时间/项目筛选、自动分类结果、文件状态 |
| `/search` | 智能搜索 | `/api/retrieval/preview`、Evidence Pack / Citation 查询、`/api/feedback` | Query Explanation、Evidence Pack、Citation Trace、ranking summary、空结果/证据不足原因 |
| `/ask` | AI 问答 | Z0a 使用 `/api/retrieval/evidence-only`；Z2 再启用 `/api/rag/answers`、Evidence Pack / Citation 查询、`/api/feedback`、Memory Draft / KU from answer 可选回流 | evidence-only / provider answer、引用来源、相关文档卡片、追问状态、provider/fallback 状态 |
| `/graph` | 知识图谱 / 关系网络 | `/api/relations`、Tags / Sources / KUs summary、Evidence / Citation summary | confirmed relation / relation suggestion evidence、节点点击回源、无关系 disabled reason |
| `/outputs` | 生成结果 | `/api/rag/answers`、`/api/memory-drafts`、`/api/exports`、Review / Citation summary | 生成物绑定 Evidence/Citation、pending review、无 evidence 时 disabled reason |
| `/settings` | 设置 | `/api/auth/status`、`/api/system/runtime`、`/api/system/status`、`/api/settings`、`/api/ai-providers`、`/api/backups`、`/api/exports` | 账号预埋 disabled contract、存储状态、AI 模型/provider 状态、导入导出与备份状态 |

页面响应状态统一为：

```text
loading
empty
degraded
recoverable_error
done
```

API response summary 必须给前端足够信息区分：

- provider unavailable / disabled / fallback；
- no retrieval result / insufficient evidence；
- citation binding failed；
- upload 或 parse 可恢复失败；
- graph relation 不足；
- outputs 缺少 evidence；
- auth disabled in P0；
- runtime degraded / recovery required。

这些状态必须来自既有 API response、ProcessingJob snapshot、SSE event、Provider capability 或 runtime status，不得由页面临时猜测。

---

## 4. 通用响应约定

### 4.1 成功响应

```json
{
  "data": {},
  "meta": {
    "request_id": "uuid",
    "created_at": "2026-05-09T00:00:00Z"
  }
}
```

### 4.2 列表响应

```json
{
  "data": [],
  "meta": {
    "limit": 20,
    "offset": 0,
    "total": 0
  }
}
```

### 4.3 错误响应

错误响应 envelope 以 `docs/error-handling-and-observability.md` §3 为唯一标准，本文只保留摘要样例，避免双份维护。

```json
{
  "error": {
    "code": "validation_error",
    "message": "Invalid request",
    "details": {},
    "request_id": "req_uuid",
    "documentation_url": null
  }
}
```

### 4.4 P0 常见错误码

| code | 含义 |
|---|---|
| validation_error | 请求字段不合法 |
| not_found | 对象不存在 |
| permission_denied | 权限不足 |
| unsupported_source_origin | 不支持的 source_origin |
| review_required | 需要 Review 才能写入主库 |
| agent_call_not_allowed | 对象不可被 Agent 默认调用 |
| mock_only | P0 只支持 mock / rule-based 能力 |
| invalid_permission_value | permission 取值不在 P0 允许范围 |
| migration_in_progress | Schema 迁移进行中，暂不可写 |
| ai_provider_unavailable | AI Provider 未配置或不可达，已降级 mock |
| provider_capability_unavailable | 某项 provider capability 不可用，已记录 fallback 或可恢复失败 |
| provider_fallback_used | 请求成功但使用了 fallback，需要在响应中展示 |
| backup_in_progress | 备份/还原进行中，暂不可写 |
| agent_not_supported_in_p0 | P0 不支持显式 agent_id，必须传 null 或省略 |
| api_key_must_use_ipc | API Key 不允许通过此 endpoint 传输，请走 Electron IPC |
| data_dir_move_failed | 数据目录迁移失败，已回滚到原路径 |

### 4.5 permission 字段约定

所有接受或返回 `permission` 字段的接口，P0 取值范围统一为：

```text
normal        默认值，可被检索、可被 Agent 默认调用
sensitive     可被检索，但需要用户显式确认才能进入 Evidence Pack / Citation Preview
do_not_share  不进入任何 Agent 调用，仅用户手动查看
```

参见 `docs/data-model.md` §5.5。P1 进入多用户/多设备/团队场景时再扩展为 6 值并按用户上下文映射。请求中传入旧 6 值（`private/public/project_internal/restricted`）将返回 `invalid_permission_value`。

调用类 API 使用 `permission_mode` 控制 sensitive 进入方式：

| permission_mode | 行为 |
|---|---|
| `agent_default` | 只允许 `normal` 进入 Evidence Pack / Citation Preview |
| `user_preview` | 允许展示 `sensitive` 的检索预览摘要，但不进入 Evidence Pack |
| `explicit_sensitive_confirmed` | 需要未过期、未撤销且 scope 匹配的 `sensitive_access_grant_id`，只对当前 invocation / evidence pack 有效 |

P0 的 `sensitive_access_grant_id` 来自一次性 grant。它不改变 `access_policies`，也不让 sensitive 长期进入 Agent 默认调用范围。

---

## 4.6 新增 P0 错误码

除 §4.4 既有错误码外，完整 P0 还必须包含：

```text
auth_not_enabled_in_p0
unsupported_parser
parser_unavailable
integrity_check_failed
file_detection_unavailable
file_blocked_by_risk_policy
preview_unavailable
ocr_unavailable
asr_unavailable
rag_provider_missing
upload_part_missing
upload_hash_mismatch
file_quarantined
```

---

## 5A. Auth Preembed APIs

### 5A.1 查询账号能力状态

```text
GET /api/auth/status
```

响应：

```json
{
  "data": {
    "user_id": "local_user_id",
    "mode": "local",
    "auth_enabled": false,
    "current_role": "local_owner",
    "disabled_reason": "auth_not_enabled_in_p0"
  }
}
```

注册、登录、刷新 Token、角色写入等接口可以在 OpenAPI 中预埋，但 P0 返回 `auth_not_enabled_in_p0`。

---

## 5. Project / Folder / Tag APIs

### 5.1 创建 Project

```text
POST /api/projects
```

请求：

```json
{
  "name": "AI 个人知识库产品",
  "description": "产品原型知识空间",
  "parent_id": null,
  "kb_type": "project_kb"
}
```

`kb_type` 可选值：`project_kb`（默认）、`reference_kb`、`person_kb`、`timeline_kb`、`inspiration_kb`、`method_kb`、`custom`。详见 `docs/data-model.md` §5.10。

响应：

```json
{
  "data": {
    "id": "project_id",
    "name": "AI 个人知识库产品",
    "kb_type": "project_kb",
    "status": "active"
  }
}
```

### 5.2 创建 Folder

```text
POST /api/folders
```

请求：

```json
{
  "project_id": "project_id",
  "parent_id": null,
  "name": "产品定位"
}
```

P0 行为：

- 创建 Folder。
- 自动创建或复用 folder mirror tag。
- 返回 `mirror_tag_id`。

### 5.3 查询 Tags

```text
GET /api/tags?project_id=...&namespace=folder
```

用途：

- 支持 tag filter。
- 支持 Folder-Tag Mirroring 检查。

---

## 5B. Upload / File APIs

### 5B.1 创建上传任务

```text
POST /api/uploads
```

请求：

```json
{
  "project_id": "project_id",
  "folder_id": "folder_id",
  "original_filename": "research.pdf",
  "file_size": 1024000,
  "mime_type": "application/pdf",
  "expected_hash": "sha256...",
  "upload_mode": "direct"
}
```

响应：

```json
{
  "data": {
    "upload_task_id": "upload_id",
    "status": "waiting",
    "upload_mode": "direct",
    "part_size": null
  }
}
```

### 5B.2 上传分片或直传内容

```text
PUT /api/uploads/{upload_task_id}/parts/{part_no}
```

行为：

- 小文件可使用 `part_no=1` 直传。
- 大文件按 `upload_parts` 记录分片。
- 每个分片写入 `tmp/uploads/`，并更新进度。

### 5B.3 完成上传

```text
POST /api/uploads/{upload_task_id}:complete
```

行为：

- 合并分片或确认直传文件。
- 执行完整性校验。
- 保存到 `sources/`。
- 创建 `files` 记录。
- 返回 `file_id`。

### 5B.4 查询上传状态

```text
GET /api/uploads/{upload_task_id}
```

响应必须包含进度、接收状态、校验状态和错误码。

上传、inspection、parse、embedding 和 evidence-only / RAG answer 的长任务事件统一走 ProcessingJob API。`ProcessingJob` 是领域对象名；P0 物理表可暂用 `ingestion_jobs`：

```text
GET /api/jobs/{job_id}
GET /api/jobs/{job_id}/events
```

`GET /api/jobs/{job_id}/events` 是 SSE 事件流，使用 `processing_status_events.event_seq` 作为 SSE `id:`；客户端断线后通过 `Last-Event-ID` 续读。`GET /api/uploads/{upload_task_id}/events` 可作为上传页别名，但实现上必须复用同一个 `ProcessingEventService`。

ProcessingJob 状态机固定为 `queued -> processing -> completed`、`queued/processing -> failed_recoverable -> queued`、`queued/processing -> failed_final`、`queued/processing -> cancelled`。`inspect / preview / parse / embed / rag_answer` 类写接口默认幂等：同一 `(target_type, target_id, job_type)` 存在 active job 时返回既有 job；只有显式 `force=true` 且无 active job 时才创建新 job。

### 5B.5 文件校验与解析

```text
GET /api/files
GET /api/files/{file_id}
POST /api/files/{file_id}:verify
POST /api/files/{file_id}:inspect
GET /api/files/{file_id}/inspection
POST /api/files/{file_id}:preview
GET /api/files/{file_id}/preview
POST /api/files/{file_id}:parse
GET /api/parse-tasks/{parse_task_id}
```

`inspect` 会创建或复用 ProcessingJob，执行真实类型识别、编码检测、安全检查、结构识别和预览生成。

`parse` 会创建或复用 ProcessingJob，并创建 `parse_task`。Parser Router 必须优先消费最新 `FileInspectionReport`：`detected_mime_type`、`file_signature`、`risk_level`、`risk_flags`、结构识别结果和 preview 状态；扩展名只作为弱信号。

D-101 Z0a 实现边界：

- 已实现 `GET /api/files`、`GET /api/files/{file_id}` 和 `POST /api/files/{file_id}:verify`；`verify` 当前会重跑 Z0a inspection summary。
- `POST /api/uploads/{id}:complete` 已自动创建 `file_id`、完整性检查和 `file_inspection` ProcessingJob。
- Z0a inspection 只返回扩展名、MIME、文件大小、sha256、header summary、基础 risk summary 和 recoverable 状态；完整 `:inspect`、inspection detail、preview、parse task 和真实 provider adapter 仍后置。

D-102 Z0a 实现边界：

- 已实现 `POST /api/files/{file_id}:parse`、`GET /api/parse-tasks/{id}`、`GET /api/sources`、`GET /api/sources/{source_id}`。
- Parser Router 当前只支持 text / markdown / json / csv 类文件的 `builtin_text_markdown` adapter。
- Parse 成功创建 `Source(source_origin=parsed_file)`、`Chunk`、FTS 记录和最小 chunk quality checks；Candidate KU / Review / Embedding 已在 D-103 通过显式 extract API 接入，不由 parse 自动触发。

风险策略：

- `risk_level=safe / warning`：允许进入 parse，warning 必须写 parse warning 或 processing event。
- `risk_level=blocked / quarantined`：默认不进入 parse，返回 `file_blocked_by_risk_policy`，但保留文件、inspection report 和用户可恢复动作。
- `preview_unavailable` 不阻塞 parse；预览只作为 UI / Review 辅助资产，不进入 RAG citation。

`GET /api/files/{file_id}/inspection` 返回完整检查报告：

```json
{
  "data": {
    "file_id": "file_id",
    "detected_mime_type": "application/pdf",
    "detected_encoding": null,
    "file_signature": "%PDF",
    "risk_level": "warning",
    "risk_flags": ["encrypted_pdf"],
    "preview_status": "ready",
    "primary_preview_path": "previews/file_id/page-1.png",
    "results": [
      {
        "inspection_type": "security_scan",
        "provider_key": "qpdf",
        "capability_status": "available",
        "status": "warning",
        "risk_level": "warning",
        "fallback_reason": null
      }
    ]
  }
}
```

`GET /api/files/{file_id}/preview` 返回预览状态和本地预览资产引用；不得返回原始文件内容。

---

## 6. Source / Ingestion APIs

### 6.1 text_import 创建 Source

```text
POST /api/sources/text-import
```

请求：

```json
{
  "project_id": "project_id",
  "folder_id": "folder_id",
  "title": "项目想法记录",
  "source_origin": "manual_note",
  "raw_text": "这里是一段 500-2000 字的项目材料...",
  "permission": "normal",
  "metadata_json": {
    "author_note": "用户手动输入"
  }
}
```

响应：

```json
{
  "data": {
    "source_id": "source_id",
    "source_description_id": "source_description_id",
    "chunk_ids": ["chunk_id_1"],
    "status": "parsed",
    "next": "create_or_review_knowledge_units"
  }
}
```

P0 行为：

- 创建 `sources`。
- 规则生成 `source_descriptions`。
- 规则切分 `chunks`。
- 可选生成 mock Candidate Knowledge Unit。
- 记录 audit log。

`text_import` 走同一入库管线，但没有物理文件时 `file_id` 可为空。

### 6.1.1 从文件创建 Source / Chunk

```text
POST /api/files/{file_id}:parse
POST /api/sources/{source_id}/chunks:build
```

行为：

- `:parse` 负责从物理文件生成或更新 Source。
- `chunks:build` 负责基于解析文本、FileInspectionReport、OCR/版面结果和 Parser Router 输出重新切片。
- Parser/AI 不可用时返回可恢复状态，不删除文件。

`chunks:build` 请求：

```json
{
  "strategy_profile": "p0_structure_aware_v1",
  "quality_profile": "p0_source_traceable_v1",
  "provider_mode": "open_source_first",
  "force": false,
  "phase": "z0b"
}
```

字段约定：

- `strategy_profile` 可选；默认由 `ChunkBuildService` 根据 FileInspectionReport、Parser Router 输出、source type 和 parse warnings 判断。
- `quality_profile` 可选；P0 默认 `p0_source_traceable_v1`，必须检查 source metadata、长度边界、上下文可读性和噪声/重复。
- `provider_mode` 可选；P0-Z0a/Z0b 允许 `rule_only` 或 `open_source_first`，不得因为 LLM / reranker 缺失阻塞基础切片。
- `force=false` 时遵守 ProcessingJob 幂等规则；同一 `(target_type=source, target_id, job_type=chunk)` 存在 active job 时返回既有 job。
- `phase` 可选；默认由服务按当前实现波次决定。P0-Z0a 只保证 `source_location` / `quality_status`，P0-Z0b 才保证 `context_summary` / `source_metadata` 和完整 `chunk_quality_checks`。
- 切片前准备层不新增必填请求字段；输入完整性、OCR/版面检查、策略匹配、结构完整性和来源绑定检查由 `strategy_profile`、`quality_profile`、`provider_mode` 与服务默认 profile 派生。

响应：

```json
{
  "data": {
    "job_id": "job_id",
    "status": "queued",
    "chunk_summary": {
      "preparation_profile": "p0_basic_preparation_v1",
      "strategy_profile": "p0_structure_aware_v1",
      "content_kinds": ["pdf_text"],
      "chunk_types": ["text_semantic", "structured_table"],
      "chunk_execution_profiles": [
        {
          "chunk_type": "text_semantic",
          "chunk_execution_profile": "p0_rule_text_execution_v1",
          "execution_path": "rule_text"
        },
        {
          "chunk_type": "structured_table",
          "chunk_execution_profile": "p0_structured_table_execution_v1",
          "execution_path": "structured_table"
        }
      ],
      "source_binding_status": "pending",
      "check_summary": [
        {
          "check_gate": "input_integrity_check",
          "check_type": "input_integrity",
          "chunk_type": "text_semantic",
          "chunk_execution_profile": "p0_rule_text_execution_v1",
          "status": "pending",
          "event_type": "chunk_preparation_started"
        }
      ],
      "capability_summary": [
        {
          "capability": "chunk_strategy",
          "provider_key": "rule_based_chunk_strategy",
          "status": "available",
          "fallback_reason": null
        }
      ],
      "fallback_reasons": [],
      "chunk_count": 0,
      "warning_count": 0,
      "failed_quality_count": 0
    }
  }
}
```

初始 queued 响应允许把检查项标记为 `pending`；执行中以 `GET /api/jobs/{job_id}/events` 和 `GET /api/sources/{source_id}` 读取最终检查结果。`check_summary.check_gate` 必须按 `docs/data-model.md` 的映射表写入，不能由 service 自行发明新名字。`chunk_type` 只允许 `text_semantic / structured_table / image_ocr / audio_transcript / video_scene / mixed`，其中 `source_binding_status` 只表达 Citation / Evidence 可用性，不表达 embedding 或全文索引状态。

`chunks:build` 必须写入以下 ProcessingJob event：

```text
chunk_preparation_started
chunk_preparation_warning
chunk_preparation_completed
chunk_strategy_selected
chunk_strategy_mismatch
chunk_structure_recovered
chunk_source_binding_failed
chunk_context_enriched
chunk_quality_warning
chunk_quality_failed
```

chunk 构建完成后，`GET /api/sources/{source_id}` 应能读取 chunk、`preparation_profile`、`content_kind`、`ocr_layout_status`、`structure_recovery_status`、`strategy_match_status`、`source_binding_status`、`chunk_quality_checks` 摘要、`context_summary` 和 `source_metadata`。预览资产不作为 RAG citation；citation 仍绑定 Source / Chunk / Knowledge Unit。

### 6.2 获取 Source Detail

```text
GET /api/sources/{source_id}
```

响应应包含：

```text
source
source_description
chunks
linked_knowledge_units
audit_summary
```

### 6.3 重新生成 Source Description

```text
POST /api/sources/{source_id}/source-description:regenerate
```

P0 允许规则 / 开源优先 Provider / mock 生成。用户编辑后的字段必须保留为用户版本，不能被静默覆盖。

### 6.4 触发 Knowledge Unit 抽取

```text
POST /api/knowledge-units:extract
```

请求：

```json
{
  "source_id": "source_id",
  "mode": "open_source_first",
  "structuring_profile": "p0_rule_structuring_v1"
}
```

行为：

- Provider 可用时调用开源优先结构化抽取。
- Provider 不可用时生成规则 / mock 候选，或返回 `provider_capability_unavailable` 但保留可手动创建入口。
- `structuring_profile` 为可选字段，不新增必填参数；未传时使用项目默认 profile。
- `knowledge-units:extract` 可创建或复用 `ProcessingJob(target_type=source, job_type=extract)`；同步失败只限 source 不存在或权限不匹配。

响应摘要必须能表达结构化整理检查链：

```json
{
  "data": {
    "job_id": "job_id",
    "status": "queued",
    "candidate_count": 0,
    "structuring_summary": {
      "profile": "p0_rule_structuring_v1",
      "step_summary": [
        {
          "step": "content_understanding",
          "quality_check": "topic_understanding",
          "provider_key": "system_rules",
          "capability_status": "fallback",
          "fallback_reason": "llm_provider_missing",
          "status": "warning"
        },
        {
          "step": "summary_generation",
          "quality_check": "summary_quality",
          "provider_key": "rule_summary",
          "capability_status": "fallback",
          "fallback_reason": "llm_provider_missing",
          "status": "pending"
        },
        {
          "step": "key_concept_extraction",
          "quality_check": "concept_extraction",
          "provider_key": "keybert_local",
          "capability_status": "available",
          "fallback_reason": null,
          "status": "pending"
        },
        {
          "step": "schema_mapping",
          "quality_check": "schema_mapping",
          "provider_key": "pydantic_schema_v1",
          "capability_status": "available",
          "fallback_reason": null,
          "status": "pending"
        },
        {
          "step": "knowledge_card_generation",
          "quality_check": "card_normalization",
          "provider_key": "markdown_template_v1",
          "capability_status": "available",
          "fallback_reason": null,
          "status": "pending"
        },
        {
          "step": "classification_tagging",
          "quality_check": "tag_consistency",
          "provider_key": "keybert_hanlp_rules",
          "capability_status": "fallback",
          "fallback_reason": "classifier_provider_missing",
          "status": "warning"
        },
        {
          "step": "relation_suggestion",
          "quality_check": "relation_suggestion",
          "provider_key": "relation_rules",
          "capability_status": "fallback",
          "fallback_reason": "graph_provider_not_required_in_p0",
          "status": "skipped"
        }
      ],
      "fallback_reasons": ["llm_provider_missing", "classifier_provider_missing", "graph_provider_not_required_in_p0"],
      "d079_subfield_summary": {
        "content_understanding": {
          "material_type": "article",
          "topic_count": 2,
          "core_claim_count": 1,
          "important_section_count": 3,
          "intended_use": "research"
        },
        "summary_generation": {
          "summary_types": ["paragraph_summary", "file_summary"],
          "replaces_source_text": false
        },
        "classification_tagging": {
          "suggested_tag_count": 4,
          "merge_candidate_count": 1,
          "dedupe_candidate_count": 1,
          "project_candidate_count": 1
        },
        "schema_mapping": {
          "fields": ["title", "author_or_source", "detected_time", "keywords", "summary", "tags", "project_affinity"],
          "missing_required_fields": []
        },
        "knowledge_card_generation": {
          "card_types": ["concept", "file"],
          "source_binding_status": "bound"
        },
        "relation_suggestion": {
          "entity_candidate_count": 3,
          "triple_candidate_count": 2,
          "relation_candidate_count": 0
        }
      },
      "review_task_count": 0,
      "relation_suggestion_count": 0
    }
  }
}
```

`step` 只允许 `content_understanding / summary_generation / key_concept_extraction / schema_mapping / knowledge_card_generation / classification_tagging / relation_suggestion`。D-079 新增的标签生成、分类整理、字段映射、知识卡片类型、实体候选和三元组候选都只能作为这些 step 的子字段返回，不新增 endpoint 或顶级 step。所有候选 KU、标签、分类、字段、知识卡片和关系建议都必须进入 Review；关系建议默认不写 confirmed relation。P0-Z0a/Z0b 的关系建议只作为 `review_tasks.target_type=relation_suggestion` + `payload_json.suggestion_type=relation_suggestion` 返回和保存，`knowledge_relations` 到 P0-Z1 后才允许由 Review confirm 写入。

---

## 7. Knowledge Unit APIs

### 7.1 创建 Candidate Knowledge Unit

```text
POST /api/knowledge-units
```

请求：

```json
{
  "project_id": "project_id",
  "primary_source_id": "source_id",
  "primary_folder_id": "folder_id",
  "title": "知识单元标题",
  "content": "知识内容",
  "knowledge_type": "claim",
  "permission": "normal",
  "chunk_ids": ["chunk_id_1"],
  "tag_ids": ["tag_id_1"],
  "created_by": "user"
}
```

响应：

```json
{
  "data": {
    "knowledge_unit_id": "ku_id",
    "status": "pending_review",
    "review_task_id": "review_task_id"
  }
}
```

P0 行为：

- 创建 `knowledge_units`，默认 `status=pending_review`。
- 创建 `knowledge_unit_chunks`。
- 创建 `knowledge_unit_tags`。
- 继承 folder mirror tag。
- 创建 review task。

D-103 Z0a 实现边界：

- 已实现 `POST /api/knowledge-units:extract`、`GET /api/knowledge-units`、`GET /api/knowledge-units/{knowledge_unit_id}`。
- `knowledge-units:extract` 以 parsed Source / Chunk 为输入，生成 `pending_review` Candidate KU、Review Task 和 `mock_fixed_384` fallback embedding；重复 extract 默认复用已有候选。
- Review confirm 后 KU 才进入 confirmed 检索范围；pending_review 不进入 evidence-only answer。
- D-103 不实现真实 LLM 抽取、标签合并、关系写入、Memory Draft 或 provider-backed RAG。

### 7.2 获取 Knowledge Unit

```text
GET /api/knowledge-units/{knowledge_unit_id}
```

响应应包含：

```text
knowledge_unit
chunks
source
tags
relations
review_status
citations
```

### 7.3 更新 Knowledge Unit

```text
PATCH /api/knowledge-units/{knowledge_unit_id}
```

允许更新：

```text
title
content
knowledge_type
importance
permission
use_for
metadata_json
status
available_for_agent
```

约束：

- 未确认对象更新后仍保持 `pending_review`，除非通过 Review API 确认。
- `available_for_agent=true` 必须要求 `user_verified=true` 和权限允许。

---

## 8. Review APIs

### 8.1 查询 Review Queue

```text
GET /api/review-tasks?project_id=...&status=pending
```

用途：

- 展示 Candidate Knowledge Unit。
- 展示 Memory Draft。
- 展示待确认 Relation / Tag。

### 8.2 执行 Review Action

```text
POST /api/review-tasks/{review_task_id}:act
```

请求：

```json
{
  "action": "confirm",
  "patch": {
    "title": "确认后的标题",
    "content": "确认后的内容",
    "available_for_agent": true
  },
  "validation_json": {
    "source_check": "passed",
    "citation_check": "passed",
    "permission_check": "passed"
  }
}
```

支持 action：

```text
confirm
edit
ignore
merge
split
reject
needs_source
do_not_use
```

P0 行为：

- `confirm` 将 Knowledge Unit 标记为 `confirmed`。
- `confirm` 同时设置 `user_verified=true`。
- `available_for_agent=true` 必须通过 permission check。
- 写入 audit log。

---

## 9. Relation APIs

### 9.1 创建 Manual Relation

```text
POST /api/relations
```

请求：

```json
{
  "from_knowledge_unit_id": "ku_1",
  "to_knowledge_unit_id": "ku_2",
  "relation_type": "supports",
  "reason": "两条知识表达同一产品判断的证据链",
  "created_by": "user"
}
```

P0 行为：

- 创建 manual relation。
- `confirmed_by_user=true`。
- 可进入 relation index。
- 不做自动实体关系抽取。

---

## 10. Retrieval Preview APIs

### 10.1 创建检索预览

```text
POST /api/retrieval/preview
```

请求：

```json
{
  "query": "Evidence Pack Source Chunk",
  "project_id": "default-space"
}
```

D-104 Z0a 实现口径：

- 只查询 `knowledge_units.status = confirmed`。
- `pending_review` 候选不得进入 Evidence Pack。
- 排序使用 token overlap / metadata fallback；真实 reranker、provider-backed vector search 和 Text-to-SQL provider 后置。
- sqlite-vec 不可用时返回 `provider_status=degraded` 与 `fallback_reason`，但 source/chunk/citation binding 不降级。
- 无证据时返回 `evidence_pack.status=empty`、`failure_type=no_retrieval_result` 和 no evidence reason，不生成伪答案。

响应：

```json
{
  "retrieval_log_id": "retrieval_xxx",
  "evidence_pack_id": "epack_xxx",
  "query": "Evidence Pack Source Chunk",
  "query_explanation": {
    "query_understanding_profile": "p0_query_understanding_rule_v1",
    "retrieval_strategy_profile": "p0_confirmed_ku_token_overlap_v1",
    "ranking_profile": "p0_token_overlap_metadata_fallback_v1",
    "citation_trace_profile": "p0_citation_trace_source_chunk_v1",
    "filters": {
      "project_id": "default-space",
      "knowledge_unit_status": "confirmed"
    }
  },
  "evidence_pack": {
    "id": "epack_xxx",
    "retrieval_log_id": "retrieval_xxx",
    "status": "ready",
    "failure_type": "vector_degraded",
    "summary": "Evidence Pack assembled from confirmed knowledge with vector fallback degraded.",
    "items": [
      {
        "id": "eitem_xxx",
        "knowledge_unit_id": "ku_xxx",
        "chunk_id": "chunk_xxx",
        "source_id": "source_xxx",
        "citation_label": "source title · chunk 1",
        "excerpt": "confirmed evidence excerpt",
        "rank_score": 1.0
      }
    ],
    "created_at": "2026-05-17T00:00:00+00:00"
  },
  "evidence_item_ids": ["eitem_xxx"],
  "citation_labels": ["source title · chunk 1"],
  "citation_trace_summary": "Evidence Pack uses source title · chunk 1",
  "provider_status": "degraded",
  "fallback_reason": "sqlite-vec extension unavailable"
}
```

### 10.2 获取 Evidence Pack Detail

```text
GET /api/evidence-packs/{evidence_pack_id}?focus_item_id={evidence_item_id}
```

响应返回持久化 Evidence Pack 与 item-level citation detail；Z0b-lite 不新增 citation 明细表，Citation Trace 仍通过现有 `retrieval_logs`、`evidence_packs`、`evidence_items`、`knowledge_units`、`chunks` 和 `sources` 组装。

D-105 Z0b-lite 实现口径：

- 后端从 `retrieval_logs.filters_json` 还原 `query_explanation`，Renderer 不拼接 query explanation。
- 后端通过 `evidence_items → knowledge_units / chunks / sources` join 返回可直接渲染的 KU、Chunk、Source 和 citation trace 字段。
- confirmed KU 的 detail 可返回 item-level KU title/status/type、chunk citation/content excerpt、source title/origin/type 和 rank score。
- `pending_review` KU 不进入 Evidence Pack，也不出现在 citation detail。
- 空证据包返回 `status=empty`、`failure_type=no_retrieval_result`、空 `items`、fallback reason 和 no evidence reason。
- sqlite-vec degraded 时仍必须保留 source/chunk/KU 绑定，且返回 `provider_status=degraded` 与 `fallback_reason`。

D-112 Z0b-lite 扩展口径：

- `focus_item_id` 可选；命中同一 Evidence Pack 时，response `detail_summary.focused_item_id` 回显该 item id。
- `focus_item_id` 不属于该 Evidence Pack 时，返回现有 error envelope，错误码为 `evidence_item_not_in_pack`。
- `detail_summary` 由后端返回，包含 item/source/KU 计数、citation labels、rank score min/max、focused item 和 no evidence reason。
- 每个 item 的 `citation_trace` 包含 `evidence_pack_id`、`evidence_item_id`、KU / Chunk / Source `trace_path` 和 copy-safe citation payload；Renderer 不自行 join KU / Chunk / Source。
- 复制 payload 不包含 source excerpt、answer text、local token、DB path 或完整本地路径。

响应：

```json
{
  "id": "epack_xxx",
  "retrieval_log_id": "retrieval_xxx",
  "status": "ready",
  "failure_type": "vector_degraded",
  "summary": "Evidence Pack assembled from confirmed knowledge with vector fallback degraded.",
  "query": "Evidence Pack Source Chunk",
  "query_explanation": {
    "query_understanding_profile": "p0_query_understanding_rule_v1",
    "retrieval_strategy_profile": "p0_confirmed_ku_token_overlap_v1",
    "ranking_profile": "p0_token_overlap_metadata_fallback_v1",
    "citation_trace_profile": "p0_citation_trace_source_chunk_v1",
    "filters": {
      "knowledge_unit_status": "confirmed"
    }
  },
  "provider_status": "degraded",
  "fallback_reason": "sqlite-vec extension unavailable",
  "citation_trace_summary": "Evidence Pack uses source title · chunk 1",
  "detail_summary": {
    "item_count": 1,
    "source_count": 1,
    "knowledge_unit_count": 1,
    "citation_labels": ["source title · chunk 1"],
    "rank_score_min": 1.0,
    "rank_score_max": 1.0,
    "focused_item_id": "eitem_xxx",
    "no_evidence_reason": null
  },
  "items": [
    {
      "id": "eitem_xxx",
      "knowledge_unit_id": "ku_xxx",
      "knowledge_unit_title": "Confirmed KU title",
      "knowledge_unit_status": "confirmed",
      "knowledge_unit_type": "claim",
      "chunk_id": "chunk_xxx",
      "chunk_citation_label": "source title · chunk 1",
      "chunk_content_excerpt": "confirmed evidence excerpt",
      "source_id": "source_xxx",
      "source_title": "source title",
      "source_origin": "parsed_file",
      "source_type": "text",
      "citation_label": "source title · chunk 1",
      "excerpt": "confirmed evidence excerpt",
      "rank_score": 1.0,
      "citation_trace": {
        "profile": "p0_citation_trace_source_chunk_v1",
        "evidence_pack_id": "epack_xxx",
        "evidence_item_id": "eitem_xxx",
        "knowledge_unit_id": "ku_xxx",
        "chunk_id": "chunk_xxx",
        "source_id": "source_xxx",
        "citation_label": "source title · chunk 1",
        "source_title": "source title",
        "source_origin": "parsed_file",
        "trace_path": [
          {"type": "evidence_pack", "id": "epack_xxx"},
          {"type": "evidence_item", "id": "eitem_xxx", "label": "source title · chunk 1"},
          {"type": "knowledge_unit", "id": "ku_xxx", "title": "Confirmed KU title", "status": "confirmed"},
          {"type": "chunk", "id": "chunk_xxx", "label": "source title · chunk 1"},
          {"type": "source", "id": "source_xxx", "title": "source title", "origin": "parsed_file"}
        ],
        "copy_payload": {
          "citation_label": "source title · chunk 1",
          "evidence_pack_id": "epack_xxx",
          "evidence_item_id": "eitem_xxx",
          "knowledge_unit_id": "ku_xxx",
          "chunk_id": "chunk_xxx",
          "source_id": "source_xxx"
        }
      }
    }
  ],
  "created_at": "2026-05-17T00:00:00+00:00"
}
```

P0 检索顺序：

```text
1. query_understanding_profile：规则 / 模板识别意图、关键词、范围、约束和输出格式；LLM query rewrite 只是可选 provider
2. retrieval_strategy_profile：按问题类型选择 FTS5/BM25、vector、metadata filter、source/file index、relation evidence 或 hybrid search
3. project / folder / permission / status filter
4. keyword / tag / metadata / vector / relation evidence retrieval
5. ranking_profile：hybrid score + metadata 权重 + source reliability + feedback weight；reranker 缺失时回退混合分数
6. citation_trace_profile：还原 chunk/source/file/page/paragraph/text span，不使用预览、摘要或知识卡片替代 citation
```

问题类型到检索路径的 P0 路由：

| question_type | P0 route | 说明 |
|---|---|---|
| `simple_fact` | FTS5 / BM25 + metadata filter | 明确事实、文件名、人名、项目名优先关键词检索 |
| `concept_explanation` | sqlite-vec vector search + metadata filter | 概念解释、相似语义和近义表达优先向量召回 |
| `timeline` | metadata filter + time fields | 时间线、版本、上传/更新时间问题优先结构化过滤 |
| `file_lookup` | source / file index | 文件定位、页码、路径、来源定位优先文件索引 |
| `relationship_analysis` | confirmed relation + relation_suggestion evidence | P0 不运行 GraphRAG，只展示已确认关系或待审关系证据 |
| `summary_synthesis` | hybrid search + Evidence Pack | 总结归纳需要多文档证据合并 |
| `complex_hybrid` | hybrid search + optional reranker fallback | 复杂综合问题合并关键词、向量、metadata 和关系证据 |

权限约束：

- `permission_mode=agent_default` 时只返回可进入 Agent 默认调用的 `normal` 结果。
- `permission_mode=user_preview` 可返回 `sensitive` 结果摘要，但响应必须标记 `requires_sensitive_confirm=true`，且不得生成 Evidence Pack / Citation Preview。
- `permission_mode=explicit_sensitive_confirmed` 必须带未过期、未撤销且 scope 匹配的 `sensitive_access_grant_id`；该授权只绑定当前 invocation / evidence pack，不写入长期权限策略。

---

## 11. Invocation / Evidence APIs

D-085 边界：本节中 `/api/invocations*` 路由是 P0-Z2 的持久化调用接口，或作为提前实现的可选增强；不属于 P0-Z0a blocking API。P0-Z0a 通过 `POST /api/retrieval/preview` 与 `POST /api/rag/answers` 跑通 retrieval log → Evidence Pack → `evidence_only_answer`，并以 `retrieval_log_id` / `evidence_pack_id` 作为 response 和持久化锚点。

### 11.1 创建 Invocation Request

```text
POST /api/invocations
```

D-081 / D-085 边界：这个 endpoint 不是 P0-Z0a blocking 接口。P0-Z0a 不创建 `invocation_requests`，等价的 query/task/profile summary 写入 `retrieval_logs.metadata_json` 和 API response summary；P0-Z2 再持久化完整 Invocation Request。

请求：

```json
{
  "project_id": "project_id",
  "raw_query": "请找出这个项目中已确认的核心判断，并展示来源。",
  "task_type": "question_answering",
  "preferred_output_type": "citation_preview",
  "agent_id": null
}
```

> **Agent 占位规则（P0）**：`agent_id` 字段已在 schema 中预埋为 nullable。P0 请求中允许显式传 `null` 或省略；如果传入非 null 值，sidecar 返回 `agent_not_supported_in_p0`。P1 多 Agent 上线后，该字段成为非空必填。业务侧通过 `current_agent_id_or_null()` 读取，避免硬编码。详见 `docs/mvp-scope.md` §3.3 和 `docs/product-architecture.md` §5.4.1。

响应：

```json
{
  "data": {
    "request_id": "request_id",
    "status": "pending",
    "agent_id": null
  }
}
```

### 11.2 生成 Retrieval Plan

```text
POST /api/invocations/{request_id}/retrieval-plan
```

D-081 / D-085 边界：这个 endpoint 是 P0-Z2 持久化接口候选，不是 P0-Z0a blocking 接口。P0-Z0a 的 Retrieval Preview / RAG answer 只需要在 response summary 与 `retrieval_logs` 中返回等价的 plan 摘要，并以 `retrieval_log_id` / `evidence_pack_id` 锚定 Evidence Pack。

D-082 / D-083：所有 Retrieval / RAG 响应中的 profile 字段遵循 `InvocationProfileSchema v1`，并返回 `feedback_policy` / `FrontendStateContract` 可消费的状态摘要。

P0 行为：

- 生成 rule-based / mock plan。
- 不调用真实 Text-to-SQL 模型。
- 只允许 SELECT 形态的 mock SQL 或 query summary。
- `retrieval_plans.metadata_json` 必须能保存 `query_understanding_profile`、`retrieval_strategy_profile`、`ranking_profile` 和 `citation_trace_profile`；P0-Z0a 可先在 retrieval log 中保存这些字段，P0-Z2 再持久化完整 Invocation / Retrieval Plan。

### 11.3 创建 Sensitive Access Grant

```text
POST /api/sensitive-access-grants
```

请求：

```json
{
  "request_id": "request_id",
  "permission_mode": "explicit_sensitive_confirmed",
  "scope_hash": "sha256(query+filters+candidate_sensitive_ids)",
  "granted_item_ids": [
    {"item_type": "knowledge_unit", "item_id": "ku_sensitive_id"}
  ],
  "expires_in_seconds": 900
}
```

响应：

```json
{
  "data": {
    "sensitive_access_grant_id": "grant_id",
    "expires_at": "2026-05-14T10:15:00Z",
    "scope_hash": "sha256(query+filters+candidate_sensitive_ids)"
  }
}
```

约束：

- 只允许在用户看过 `user_preview` sensitive 摘要并显式确认后创建。
- Grant 只能绑定当前 request / evidence pack 范围；过期、撤销、scope 不匹配或二次复用返回 `permission_denied` 或 `validation_error`。
- Grant 不写长期权限，不修改 `access_policies`。

### 11.4 构建 Evidence Pack

```text
POST /api/invocations/{request_id}/evidence-pack
```

D-085 边界：这个 invocation-scoped endpoint 是 P0-Z2 持久化接口候选。P0-Z0a 可以由 `RetrievalPreviewService` 或 `RAGAnswerService` 内部创建 Evidence Pack，并写入 `retrieval_log_id`；`request_id` / `retrieval_plan_id` 在 Z0a response 和存储中可为空。

响应：

```json
{
  "data": {
    "evidence_pack_id": "evidence_pack_id",
    "evidence_items": [
      {
        "item_type": "knowledge_unit",
        "item_id": "ku_id",
        "evidence_role": "direct_support",
        "rank": 1,
        "citation_label": "K1",
        "citation_trace": {
          "citation_trace_profile": "p0_chunk_source_trace_v1",
          "source_id": "source_id",
          "chunk_id": "chunk_id",
          "file_id": "file_id",
          "page_number": 3,
          "paragraph_index": 4,
          "text_span": {"start": 128, "end": 260},
          "citation_confidence": 0.82,
          "source_reliability_label": "user_confirmed"
        },
        "ranking_profile": {
          "hybrid_score": 0.83,
          "metadata_weight": 0.1,
          "source_reliability_score": 0.8,
          "feedback_weight": 0.0
        }
      }
    ],
    "query_trace": {
      "query_understanding_profile": "p0_rule_query_understanding_v1",
      "retrieval_strategy_profile": "p0_route_simple_fact_bm25_v1",
      "ranking_profile": "p0_hybrid_score_v1"
    },
    "evidence_gaps": []
  }
}
```

### 11.5 获取 Citation Preview

```text
GET /api/evidence-packs/{evidence_pack_id}/citation-preview
```

响应应包含：

```text
used_knowledge_units
supporting_chunks
sources
source_locations
relations
evidence_gaps
query_trace
ranking_summary
citation_trace_summary
```

### 11.6 获取 Query Explanation

```text
GET /api/evidence-packs/{evidence_pack_id}/query-explanation
```

响应应解释：

- 查询范围；
- 权限过滤；
- 状态过滤；
- 使用了哪些 tag / folder / metadata；
- 使用了哪个 vector profile，是否为 fallback；
- query_understanding 如何判断 intent / rewrite / keyword / constraints；
- retrieval_strategy_profile 为什么选择 BM25、vector、metadata、file index、relation evidence 或 hybrid；
- ranking_profile 如何合并 hybrid score、metadata、source reliability、feedback weight 和 reranker fallback；
- citation_trace_profile 是否能还原 chunk/source/file/text span；
- 是否展示 relation；
- 未找到哪些证据。

---

## 12. AIAnswer / RAG Answer APIs

### 12.1 创建 P0 RAG Answer / Evidence-only Answer

```text
POST /api/rag/answers
```

P0 约束：

- P0-Z0a 默认只允许 `evidence_only_answer`，不得调用 LLM；回答内容来自 Evidence Pack、Citation label、Query Explanation 和 evidence gaps 的模板化组装。
- `rag_answer` 是 P0-Z2 或 Provider 可用后的增强路径，必须绑定 Evidence Pack，并展示 citation。
- 开源优先 LLM Provider 不可用时返回 `evidence_only_answer`，并在 `fallback_reason` 中写明 `rag_provider_missing`。
- `output_type` 枚举仍保留 `rag_answer`、`evidence_only_answer`、`retrieval_preview`、`mock_answer`，但实现阶段必须按 P0-Z0a/Z2 限制启用。
- 不能绕过 Review 写入 confirmed Memory 或 Knowledge Unit。

请求：

```json
{
  "evidence_pack_id": "evidence_pack_id",
  "preferred_output_type": "rag_answer",
  "provider_mode": "open_source_first"
}
```

响应：

```json
{
  "data": {
    "ai_answer_id": "answer_id",
    "output_type": "evidence_only_answer",
    "answer": "基于已检索证据的回答或证据摘要...",
    "evidence_item_ids": ["evidence_item_id"],
    "citation_labels": ["K1"],
    "fallback_reason": "rag_provider_missing",
    "implicit_agent": {
      "agent_mode": "implicit_single_agent",
      "allowed_actions": ["query_understanding", "read_only_planning", "internal_retrieval", "rag_answer", "draft_generation"],
      "blocked_actions": ["autonomous_execution", "external_api_tool_call", "multi_agent_delegation"],
      "tool_call_scope": "internal_read_only"
    },
    "query_understanding": {
      "query_understanding_profile": "p0_rule_query_understanding_v1",
      "intent": "simple_fact"
    },
    "strategy_route": {
      "retrieval_strategy_profile": "p0_route_simple_fact_bm25_v1",
      "selected_routes": ["metadata_filter", "fts5_bm25"]
    },
    "ranking_summary": {
      "ranking_profile": "p0_hybrid_score_v1",
      "reranker_status": "fallback"
    },
    "citation_trace_summary": {
      "citation_trace_profile": "p0_chunk_source_trace_v1",
      "traceable_citation_count": 1,
      "preview_used_as_citation": false,
      "persistent_answer_citations": []
    },
    "feedback_actions": ["useful", "not_useful", "bad_citation", "missing_source", "favorite"],
    "provider_status": {
      "capability": "chat",
      "provider_key": "local_llm",
      "profile": "evidence_only",
      "status": "fallback",
      "fallback_profile": "evidence_only",
      "fallback_reason": "rag_provider_missing",
      "next_action": "configure_local_llm_or_keep_evidence_only"
    }
  }
}
```

---

## 13. Feedback / Memory Draft APIs

### 13.1 提交反馈

```text
POST /api/feedback
```

D-107 边界：当前实现只写 append-only `feedback_events` 作为 UI/诊断事件，并返回 `feedback_policy`。它不是 `retrieval_feedback`，不会参与真实 ranking mutation，也不得自动改写 confirmed knowledge、confirmed relation、source truth、Evidence Pack 或 AIAnswer。

请求：

```json
{
  "feedback_type": "useful",
  "evidence_pack_id": "evidence_pack_id",
  "ai_answer_id": "ai_answer_id",
  "evidence_item_id": "evidence_item_id",
  "comment": "这组证据可以作为产品定位材料。"
}
```

约束：

- `feedback_type` 只允许 `click / useful / not_useful / favorite / bad_citation / missing_source / downrank_source`。
- `evidence_pack_id`、`ai_answer_id`、`evidence_item_id` 至少提供一个，并且必须指向已存在对象。
- 当前写入 `feedback_events.metadata_json.feedback_signal` 和 `feedback_policy`；Z2 才写 `retrieval_feedback` 并关联 Invocation / Evidence / Answer。
- 反馈只用于后续排序建议和诊断；不得自动修改 confirmed Knowledge Unit、confirmed relation、source truth、Evidence Pack 或 AIAnswer。

### 13.2 反馈诊断读取

```text
GET /api/feedback
GET /api/feedback/summary
GET /api/feedback/export
```

D-108 边界：当前实现只读取 append-only `feedback_events`，用于 `/outputs` 内的 Feedback Diagnostics 面板复盘事件、目标绑定、query / citation 上下文和聚合摘要。它不写 `retrieval_feedback`，不影响 ranking，也不得修改 confirmed KU、Source、Evidence Pack、AIAnswer 或 Memory。

`GET /api/feedback` query 参数：

```text
feedback_type?: click | useful | not_useful | favorite | bad_citation | missing_source | downrank_source
target_type?: evidence_pack | ai_answer | evidence_item
evidence_pack_id?: string
ai_answer_id?: string
evidence_item_id?: string
created_from?: ISO datetime
created_to?: ISO datetime
search?: string // feedback id、target/evidence id、query、citation label、comment
ranking_effect?: positive_weight_suggestion | negative_weight_suggestion | diagnostic_only
has_comment?: boolean
sort?: created_desc | created_asc // 默认 created_desc
limit?: number // 默认 50，最大 100
```

返回记录至少包含：

```json
{
  "id": "feedback_id",
  "feedback_type": "bad_citation",
  "target_type": "evidence_item",
  "target_id": "evidence_item_id",
  "evidence_pack_id": "evidence_pack_id",
  "ai_answer_id": "ai_answer_id",
  "evidence_item_id": "evidence_item_id",
  "comment": "引用不够准确",
  "ranking_effect": "negative_weight_suggestion",
  "query": "用户问题",
  "citation_label": "[S1:C1]",
  "created_at": "2026-05-17T00:00:00Z"
}
```

`GET /api/feedback/summary` 复用同一组 filters，summary 反映当前 filter 匹配集合；list / export 仍受 `limit` 控制。返回：

```json
{
  "total": 3,
  "by_type": { "useful": 1, "bad_citation": 1, "missing_source": 1 },
  "by_target_type": { "evidence_item": 3 },
  "positive_count": 1,
  "negative_count": 2,
  "last_event_at": "2026-05-17T00:00:00Z",
  "feedback_policy": {
    "storage_mode": "local_only",
    "ranking_effect": "suggestion_only",
    "mutates_confirmed_knowledge": false
  }
}
```

后端从 `feedback_events.metadata_json.feedback_signal` / `feedback_policy` 还原诊断字段，并通过既有 `ai_answers`、`evidence_packs`、`evidence_items`、`retrieval_logs` join 补足 query 与 citation label。Renderer 不自行拼接证据链。

`GET /api/feedback/export` 为 D-110 / D-111 Feedback Diagnostics Export Z0b-lite，只导出当前筛选后的反馈诊断内容。它复用 `GET /api/feedback` 的 filters，并额外支持：

```text
format?: json | csv // 默认 json
```

返回：

```json
{
  "filename": "feedback-diagnostics-20260517T120000Z.json",
  "mime_type": "application/json",
  "format": "json",
  "record_count": 3,
  "generated_at": "2026-05-17T12:00:00Z",
  "filters": {
    "feedback_type": "bad_citation",
    "limit": 50
  },
  "summary": {
    "total": 1,
    "by_type": { "bad_citation": 1 },
    "by_target_type": { "evidence_item": 1 },
    "positive_count": 0,
    "negative_count": 1,
    "last_event_at": "2026-05-17T00:00:00Z",
    "feedback_policy": {
      "storage_mode": "local_only",
      "ranking_effect": "suggestion_only",
      "mutates_confirmed_knowledge": false
    }
  },
  "content": "...json-or-csv-string...",
  "redacted": true,
  "includes_source_text": false
}
```

导出约束：

- JSON `content` 包含 `summary`、`events`、`filters`、`generated_at` 和脱敏标记。
- CSV `content` 包含稳定表头：`id,feedback_type,target_type,target_id,evidence_pack_id,ai_answer_id,evidence_item_id,ranking_effect,query,citation_label,comment,created_at`。
- 导出不得包含 source excerpt、answer text、local token、SQLite path、app data path 或完整本地文件路径。
- 后端不写本地文件路径；Renderer 使用 Blob download 触发用户侧下载。
- Export 只读 `feedback_events` 与 D-108 join 上下文，不写 `retrieval_feedback`，不影响 ranking，不修改 confirmed KU、Source、Evidence Pack、AIAnswer 或 Memory。
- 每次成功导出后，后端向 app data `config.json.feedback_export_history` 追加最近 20 条 metadata：`id`、`filename`、`format`、`record_count`、`generated_at`、`filters`、`summary`、`content_sha256`、`redacted`、`includes_source_text`。历史记录不保存 export `content`，不支持重新下载旧 content。

`GET /api/feedback/export-history` 返回最近 20 条导出历史 metadata：

```json
[
  {
    "id": "feedback_export_id",
    "filename": "feedback-diagnostics-20260517T120000Z.json",
    "format": "json",
    "record_count": 3,
    "generated_at": "2026-05-17T12:00:00Z",
    "filters": { "search": "citation", "limit": 50 },
    "summary": {
      "total": 3,
      "by_type": { "bad_citation": 1 },
      "by_target_type": { "evidence_item": 3 },
      "positive_count": 1,
      "negative_count": 2,
      "last_event_at": "2026-05-17T00:00:00Z",
      "feedback_policy": { "storage_mode": "local_only" }
    },
    "content_sha256": "sha256",
    "redacted": true,
    "includes_source_text": false
  }
]
```

`DELETE /api/feedback/export-history/{id}` 只删除单条 `config.json` history metadata，不影响 `feedback_events` 或任何业务对象。

### 13.3 保存为 Memory Draft

```text
POST /api/memory-drafts
```

D-107 边界：当前实现为 Z0b-lite 回流闭环，只从既有 `ai_answer_id` 创建 `memories.status=pending_review` 和 `review_tasks.target_type=memory`。确认前不进入检索；confirm / ignore 只改变 memory 状态，不创建 confirmed KU。

请求：

```json
{
  "project_id": "project_id",
  "source_answer_id": "ai_answer_id",
  "content": "用户确认过的长期偏好或判断",
  "memory_type": "decision",
  "permission": "normal"
}
```

D-107 行为：

- 创建 `memories`，状态为 `pending_review`。
- 创建 `review_tasks.target_type=memory`。
- `GET /api/memory-drafts` 与 `GET /api/memory-drafts/{id}` 可复盘 draft 状态。
- Review confirm 后 memory 标记为 `confirmed / user_confirmed=true`；Review ignore 后标记为 `archived`。
- 不直接成为 Confirmed Memory，也不自动创建 confirmed Knowledge Unit。

### 13.4 保存为 Candidate Knowledge Unit

```text
POST /api/knowledge-units:from-answer
```

请求：

```json
{
  "project_id": "project_id",
  "source_answer_id": "ai_answer_id",
  "evidence_pack_id": "evidence_pack_id",
  "title": "可沉淀判断",
  "content": "从回答中提炼的候选知识",
  "knowledge_type": "claim"
}
```

P0 行为：

- 创建 `knowledge_units`，状态为 `pending_review`。
- 复制 citations / evidence links。
- 创建 review task。

---

## 14. P0 API 不做

P0 API 不提供：

- 生产级线上账号注册登录。
- 云同步 / 云备份 API。
- 自动网页爬取 API。
- Agent tool execution API。
- 多 Agent 自主规划、外部 API 工具执行或生产级工作流编排 API。
- 团队权限管理 API。
- 图数据库查询 API。
- GraphRAG / Learning-to-Rank 运行时 API。
- 独立向量数据库管理 API。
- WebSocket 必需通道；P0 状态反馈默认 SSE。
- 商业闭源模型强绑定 API。

---

## 15. API 验收标准

P0 API 草案可进入实现前，应满足：

1. 每个 P0 数据对象至少有创建或读取路径。
2. 上传和 `text_import` 都能进入统一入库管线。
3. Knowledge Unit 创建后默认进入 Review。
4. Review confirm 后才能进入默认 Agent 调用范围。
5. Retrieval Preview 能生成 retrieval log。
6. P0-Z0a 能用 retrieval log + Evidence Pack 跑通 evidence-only answer；Invocation Request / Retrieval Plan 的持久化是 P0-Z2 对象，Z0a 只需返回 response summary 或写入 retrieval log。
7. Evidence Pack 同时支持 pack 级和 item 级持久化。
8. Citation Preview 能从 Evidence Pack 还原来源。
9. Feedback 和 Memory Draft 不绕过 Review。
10. P0-Z0a 的 RAG 输出默认为 `evidence_only_answer`，不调用 LLM；P0-Z2 或 Provider 可用后才启用 `rag_answer`。
11. `explicit_sensitive_confirmed` 必须校验一次性 `sensitive_access_grant_id` 的过期、撤销、scope 和复用状态。
12. 所有长任务可通过 `GET /api/jobs/{job_id}` 和 `GET /api/jobs/{job_id}/events` 查询快照与续读事件，并符合 ProcessingJob 状态机与幂等规则。
13. Retrieval / Evidence / RAG 响应必须能返回 `query_understanding_profile`、`retrieval_strategy_profile`、`ranking_profile`、`citation_trace_profile` 和可用的 `feedback_actions`。
14. `feedback_signal` 只能影响后续排序建议和诊断，不能自动改写 confirmed knowledge。
15. `implicit_agent` 只能表达 P0 隐式单 Agent 的只读规划、内部检索和回答/草稿生成边界；不能暴露自主执行或外部工具调用。
16. 前端必须能根据响应区分上传进度、AI 思考、检索失败、无权限、网络异常、空结果、citation 展示和用户反馈按钮状态。

---

## 16. 桌面系统 API

业务 API 之外，P0 桌面应用还必须暴露以下系统 API，否则 Renderer 进程无法完成健康检查、备份、导出、设置、AI Provider 配置和 Onboarding 等关键操作。本章是 `docs/desktop-architecture.md` §15 设置页面、§10 数据可移植性、§12 Schema 迁移、§13 安全实践和 `docs/ai-provider-architecture.md` §5 Key 管理在 API 层的契约。

### 16.1 通用约定

- 系统 API 仍走 sidecar localhost；涉及原生 UI 的操作（文件对话框、Keychain 写入）通过 Electron IPC 桥接，详见 `docs/desktop-architecture.md` §5.2。
- 系统 API 不写普通业务 `audit_logs`，但权限变更、隐私设置、备份/恢复/删除等用户可追责动作必须写 `audit_logs` 摘要；系统健康、性能、限流和告警写 `system_logs`。
- 涉及破坏性操作（清除数据、还原备份、修改数据目录）必须返回 `confirmation_token`，二次确认后才执行。
- P0 不依赖云监控或外部 APM；日志、异常监控、性能成本和稳定性状态都从本地 `system_logs`、`processing_status_events` 和 provider capability 状态派生。

### 16.2 健康检查与系统信息

```text
GET /api/health
```

响应：

```json
{
  "data": {
    "status": "ok",
    "api_version": "0.1.0",
    "schema_version": "abc123",
    "db_ready": true,
    "vec_extension_ready": true,
    "migration_in_progress": false,
    "queue": {
      "active_jobs": 1,
      "failed_recoverable_jobs": 0,
      "stalled_jobs": 0
    },
    "alerts": []
  }
}
```

```text
GET /api/system/info
```

响应：

```json
{
  "data": {
    "app_version": "0.1.0-alpha",
    "schema_version": "abc123",
    "platform": "darwin-arm64",
    "data_dir": "/Users/.../KnowledgeBase",
    "db_size_bytes": 12345678,
    "kb_object_counts": {
      "projects": 3,
      "sources": 42,
      "knowledge_units": 187
    },
    "ai_providers": {
      "embedding": {
        "active_profile": "mock_fixed_384",
        "capability_status": "fallback",
        "fallback_reason": "provider_capability_unavailable"
      },
      "chat": {
        "active_profile": "evidence_only",
        "capability_status": "fallback",
        "fallback_reason": "rag_provider_missing"
      }
    },
    "operations": {
      "storage_bytes": 12345678,
      "recent_error_count": 0,
      "rate_limited_count": 0,
      "high_resource_task_count": 0,
      "last_backup_at": "2026-05-14T10:00:00Z"
    }
  }
}
```

### 16.2.1 系统状态与本地监控摘要

```text
GET /api/system/status
```

查询参数：

```text
window=1h | 24h | all   # 默认 24h
include_logs=false      # true 时返回最近脱敏日志摘要
```

响应：

```json
{
  "data": {
    "window": "24h",
    "health": "ok",
    "modules": {
      "logs": {
        "status": "ok",
        "status_reason": null,
        "threshold": "error_count < 1"
      },
      "exception_monitoring": {
        "status": "ok",
        "status_reason": null,
        "threshold": "failed_final_count == 0"
      },
      "data_security": {
        "status": "warning",
        "status_reason": "pii_provider_unavailable",
        "threshold": "security_error_count == 0"
      },
      "performance_cost": {
        "status": "ok",
        "status_reason": null,
        "threshold": "p95_api_duration_ms < 500"
      },
      "stability": {
        "status": "ok",
        "status_reason": null,
        "threshold": "queue_stalled == 0"
      }
    },
    "monitors": {
      "upload_failure": 0,
      "parse_failure": 1,
      "retrieval_failure": 0,
      "rag_answer_fallback": 2,
      "system_error": 0,
      "queue_stalled": 0,
      "high_resource_task": 0
    },
    "security": {
      "sensitive_detection": {
        "capability_status": "fallback",
        "fallback_reason": "pii_provider_unavailable"
      },
      "keychain_ready": true,
      "privacy_mode": "local_only"
    },
    "performance": {
      "p95_api_duration_ms": 120,
      "slow_query_count": 0,
      "estimated_ai_cost": 0,
      "storage_bytes": 12345678
    }
  }
}
```

该 API 只返回本地汇总，不上传遥测。`modules.*.status=warning/error` 必须填写 `status_reason`，并能追溯到 `system_logs` 或 `processing_status_events`。阈值是 P0 默认口径，P1 可在设置页调整但必须写入本地 settings。

### 16.3 数据目录

```text
GET /api/system/data-dir
POST /api/system/data-dir:move
```

`POST /api/system/data-dir:move` 请求：

```json
{
  "target_path": "/path/to/new/dir",
  "confirmation_token": "tok_xxx"
}
```

P0 行为：

- 必须先 `GET /api/system/data-dir?dry-run-target=...` 获取 `confirmation_token` 和迁移预估。
- sidecar 暂停业务 API，迁移数据库文件 + sources/ + exports/ + logs/ 到新目录。
- 成功后回调 Main Process 更新启动时使用的数据目录配置。
- 失败时回滚到原路径，返回 `data_dir_move_failed`。

### 16.4 备份与还原

```text
POST /api/backups
GET /api/backups
GET /api/backups/{backup_id}
POST /api/backups/{backup_id}:restore
DELETE /api/backups/{backup_id}
```

`POST /api/backups` 创建备份：

```json
{
  "trigger": "manual" | "auto_before_migration" | "auto_scheduled",
  "include_sources": true,
  "include_exports": false,
  "note": "P0 完成节点备份"
}
```

响应：

```json
{
  "data": {
    "backup_id": "backup_id",
    "filename": "knowledge-2026-05-12-1530.zip",
    "size_bytes": 12345678,
    "created_at": "2026-05-12T15:30:00Z",
    "trigger": "manual"
  }
}
```

`POST /api/backups/{backup_id}:restore` 请求：

```json
{
  "confirmation_token": "tok_xxx",
  "backup_current_first": true
}
```

P0 行为：

- 还原前必须先创建当前数据库快照（`before-restore-{timestamp}.db`），除非用户显式 `backup_current_first=false`。
- 还原期间 `GET /api/health.migration_in_progress = true`，业务 API 返回 `backup_in_progress`。
- 还原完成后 sidecar 自动重启。

### 16.5 导出

```text
POST /api/exports/knowledge-units
POST /api/exports/project
```

`POST /api/exports/knowledge-units` 导出 KU 为 Markdown / JSON：

```json
{
  "knowledge_unit_ids": ["ku_id_1", "ku_id_2"],
  "format": "markdown" | "json",
  "include_chunks": true,
  "include_sources": false,
  "target_path": "/path/to/export/dir"
}
```

响应：

```json
{
  "data": {
    "export_id": "export_id",
    "files": [
      "/path/to/export/dir/ku-001.md",
      "/path/to/export/dir/ku-002.md"
    ],
    "format": "markdown",
    "count": 2
  }
}
```

`POST /api/exports/project` 导出整个项目为 .zip（包含 KU、Sources、Chunks、Tags）：

```json
{
  "project_id": "project_id",
  "format": "zip",
  "include_pending_review": false,
  "target_path": "/path/to/export/file.zip"
}
```

### 16.6 设置（Settings）

```text
GET /api/settings
PATCH /api/settings
```

D-106 代码阶段只实现语言偏好，默认语言固定为 `zh-CN`，不跟随浏览器语言。设置由后端管理；配置文件不存在时返回默认值，写入时原子更新 app data 下的 `config.json`，不新增 SQLite 表。

响应：

```json
{
  "data": {
    "language": "zh-CN",
    "persistence": "config_json",
    "updated_at": "2026-05-17T12:00:00Z"
  }
}
```

`PATCH /api/settings` 请求：

```json
{
  "language": "en-US"
}
```

`PATCH /api/settings` 仅接受白名单字段 `language`，且只允许 `zh-CN / en-US`。未知字段或非法语言返回现有 error envelope 的 `validation_error`；无本地 token 仍按 sidecar local auth 规则拒绝。API Key、Provider 密钥、主题、备份策略、数据目录迁移和遥测开关仍不属于 D-106 实现范围。

### 16.7 AI Provider 配置

```text
GET /api/ai-providers
GET /api/ai-providers/capabilities
GET /api/ai-providers/{provider_id}
PATCH /api/ai-providers/{provider_id}
POST /api/ai-providers/{provider_id}:test
POST /api/ai-providers/{provider_id}:reload-key
DELETE /api/ai-providers/{provider_id}/key
```

实现注意：`/api/ai-providers/capabilities` 是静态路由，FastAPI 注册时必须先于 `/api/ai-providers/{provider_id}`，或在实现中改用等价静态路径，避免 `capabilities` 被当成 `provider_id`。

`GET /api/ai-providers` 响应：

```json
{
  "data": [
    {
      "provider_id": "system_rules",
      "name": "System Rule Providers",
      "provider_type": "system",
      "capabilities": ["token_counting", "chunk_strategy", "context_enrichment", "chunk_quality_eval", "content_understanding", "schema_mapping", "knowledge_card_generation", "classification_tagging", "relation_suggestion"],
      "key_required": false,
      "key_configured": true,
      "health": "ok",
      "is_default": true,
      "is_user_configurable": false
    },
    {
      "provider_id": "mock",
      "name": "Mock Provider (test/fallback only)",
      "provider_type": "mock",
      "capabilities": ["embedding", "chat", "summarization", "tag_suggestion", "text_to_sql", "rerank", "ku_extraction", "content_understanding", "knowledge_card_generation", "classification_tagging"],
      "key_required": false,
      "key_configured": true,
      "health": "ok",
      "is_default": false,
      "is_user_configurable": false
    },
    {
      "provider_id": "local_parsing",
      "name": "Local Parsing Adapters",
      "provider_type": "local_adapter",
      "capabilities": ["file_detection", "encoding_detection", "security_scan", "structure_detection", "preview_generation", "table_parse", "media_probe", "parser", "ocr", "asr", "vision", "video", "cleaning", "pii", "token_counting", "structure_recovery", "document_layout", "table_structure", "html_xml_structure", "academic_paper_structure"],
      "key_required": false,
      "key_configured": true,
      "health": "partial",
      "is_default": true,
      "is_user_configurable": false
    },
    {
      "provider_id": "openai",
      "name": "OpenAI",
      "provider_type": "commercial",
      "capabilities": ["embedding", "chat", "summarization", "tag_suggestion", "ku_extraction", "content_understanding", "schema_mapping", "knowledge_card_generation", "classification_tagging", "relation_suggestion"],
      "key_required": true,
      "key_configured": false,
      "health": "not_configured",
      "is_default": false,
      "is_user_configurable": true
    }
  ]
}
```

`GET /api/ai-providers` 只返回 provider 家族和配置状态；真实路由以 `GET /api/ai-providers/capabilities` 为准。`provider_type` 固定为 `system / local_adapter / mock / commercial`，其中 `system` 表示无需用户配置的规则能力，`mock` 只用于测试或 fallback profile，不应被 UI 当成真实模型能力。

`GET /api/ai-providers/capabilities` 返回所有能力的可用性。它不是密钥管理接口，用于 Upload / Parse / Embedding / RAG 页面展示当前能走真实 provider 还是 fallback。

```json
{
  "data": [
    {
      "capability": "file_detection",
      "provider_key": "libmagic",
      "provider_version": "runtime_probe",
      "profile": "mime_probe",
      "status": "available",
      "blocking": false,
      "recoverable": true,
      "fallback_profile": "header_signature_probe",
      "fallback_reason": null,
      "next_action": null
    },
    {
      "capability": "token_counting",
      "provider_key": "tiktoken",
      "provider_version": "runtime_probe",
      "profile": "chunk_budget",
      "status": "available",
      "blocking": false,
      "recoverable": true,
      "fallback_profile": "rule_estimator",
      "fallback_reason": null,
      "next_action": null
    },
    {
      "capability": "structure_recovery",
      "provider_key": "pymupdf_pdfplumber_openpyxl",
      "provider_version": "runtime_probe",
      "profile": "p0_structure_recovery",
      "status": "fallback",
      "blocking": false,
      "recoverable": true,
      "fallback_profile": "heading_paragraph_rules",
      "fallback_reason": "optional_structure_adapters_missing",
      "next_action": "install_unstructured_tika_grobid_optional"
    },
    {
      "capability": "document_layout",
      "provider_key": "pymupdf",
      "provider_version": "runtime_probe",
      "profile": "basic_layout",
      "status": "available",
      "blocking": false,
      "recoverable": true,
      "fallback_profile": "parser_structure_only",
      "fallback_reason": null,
      "next_action": null
    },
    {
      "capability": "table_structure",
      "provider_key": "pdfplumber_openpyxl",
      "provider_version": "runtime_probe",
      "profile": "table_blocks",
      "status": "fallback",
      "blocking": false,
      "recoverable": true,
      "fallback_profile": "table_text_summary",
      "fallback_reason": "camelot_tabula_not_required_in_p0",
      "next_action": null
    },
    {
      "capability": "html_xml_structure",
      "provider_key": "beautifulsoup_lxml",
      "provider_version": "runtime_probe",
      "profile": "html_xml_recovery",
      "status": "disabled",
      "blocking": false,
      "recoverable": true,
      "fallback_profile": "plain_text_parser",
      "fallback_reason": "p1_adapter",
      "next_action": "enable_html_xml_adapter_when_needed"
    },
    {
      "capability": "academic_paper_structure",
      "provider_key": "grobid",
      "provider_version": null,
      "profile": "paper_structure",
      "status": "disabled",
      "blocking": false,
      "recoverable": true,
      "fallback_profile": "pdf_heading_rules",
      "fallback_reason": "p1_adapter",
      "next_action": "enable_grobid_for_academic_papers"
    },
    {
      "capability": "chunk_strategy",
      "provider_key": "rule_based_chunk_strategy",
      "provider_version": "runtime_probe",
      "profile": "p0_structure_aware_v1",
      "status": "available",
      "blocking": false,
      "recoverable": true,
      "fallback_profile": "p0_rule_text_v1",
      "fallback_reason": null,
      "next_action": null
    },
    {
      "capability": "semantic_chunking",
      "provider_key": "embedding_semantic_chunker",
      "provider_version": null,
      "profile": "p1_semantic_embedding_v1",
      "status": "fallback",
      "blocking": false,
      "recoverable": true,
      "fallback_profile": "p0_structure_aware_v1",
      "fallback_reason": "embedding_provider_missing",
      "next_action": "install_embedding_provider_or_keep_rule_chunking"
    },
    {
      "capability": "context_enrichment",
      "provider_key": "rule_context_enrichment",
      "provider_version": "runtime_probe",
      "profile": "heading_source_metadata",
      "status": "available",
      "blocking": false,
      "recoverable": true,
      "fallback_profile": null,
      "fallback_reason": null,
      "next_action": null
    },
    {
      "capability": "chunk_quality_eval",
      "provider_key": "rule_chunk_quality",
      "provider_version": "runtime_probe",
      "profile": "p0_quality_rules",
      "status": "available",
      "blocking": false,
      "recoverable": true,
      "fallback_profile": "basic_quality_status",
      "fallback_reason": null,
      "next_action": null
    },
    {
      "capability": "content_understanding",
      "provider_key": "system_rules",
      "provider_version": "runtime_probe",
      "profile": "p0_topic_rules",
      "status": "fallback",
      "blocking": false,
      "recoverable": true,
      "fallback_profile": "manual_review_required",
      "fallback_reason": "llm_provider_missing",
      "next_action": "configure_local_llm_or_keep_review_flow"
    },
    {
      "capability": "schema_mapping",
      "provider_key": "pydantic_json_schema",
      "provider_version": "runtime_probe",
      "profile": "ku_schema_v1",
      "status": "available",
      "blocking": false,
      "recoverable": true,
      "fallback_profile": "pending_review",
      "fallback_reason": null,
      "next_action": null
    },
    {
      "capability": "knowledge_card_generation",
      "provider_key": "markdown_jinja2_template",
      "provider_version": "runtime_probe",
      "profile": "p0_ku_card_template_v1",
      "status": "available",
      "blocking": false,
      "recoverable": true,
      "fallback_profile": "raw_candidate_card",
      "fallback_reason": null,
      "next_action": null
    },
    {
      "capability": "classification_tagging",
      "provider_key": "keybert_hanlp_rules",
      "provider_version": "runtime_probe",
      "profile": "p0_tagging_v1",
      "status": "fallback",
      "blocking": false,
      "recoverable": true,
      "fallback_profile": "manual_tagging",
      "fallback_reason": "classifier_provider_missing",
      "next_action": "install_keybert_hanlp_or_keep_manual_tags"
    },
    {
      "capability": "relation_suggestion",
      "provider_key": "relation_rules",
      "provider_version": "runtime_probe",
      "profile": "p0_relation_suggestion_stub_v1",
      "status": "fallback",
      "blocking": false,
      "recoverable": true,
      "fallback_profile": "review_only_relation_candidates",
      "fallback_reason": "graph_provider_not_required_in_p0",
      "next_action": "configure_llm_or_graph_adapter_optional"
    },
    {
      "capability": "security_scan",
      "provider_key": "qpdf_oletools",
      "provider_version": "runtime_probe",
      "profile": "static_risk_scan",
      "status": "fallback",
      "blocking": false,
      "recoverable": true,
      "fallback_profile": "static_basic_scan",
      "fallback_reason": "clamav_disabled",
      "next_action": "install_clamav_optional"
    },
    {
      "capability": "preview_generation",
      "provider_key": "pillow_pymupdf_openpyxl_ffmpeg",
      "provider_version": "runtime_probe",
      "profile": "primary_preview",
      "status": "fallback",
      "blocking": false,
      "recoverable": true,
      "fallback_profile": null,
      "fallback_reason": "preview_unavailable_for_some_types",
      "next_action": "install_optional_preview_tools"
    },
    {
      "capability": "parser",
      "provider_key": "pymupdf",
      "provider_version": "runtime_probe",
      "profile": "pdf_text",
      "status": "available",
      "blocking": false,
      "recoverable": true,
      "fallback_profile": null,
      "fallback_reason": null,
      "next_action": null
    },
    {
      "capability": "ocr",
      "provider_key": "paddleocr",
      "provider_version": null,
      "profile": "default",
      "status": "unavailable",
      "blocking": false,
      "recoverable": true,
      "fallback_profile": null,
      "fallback_reason": "ocr_unavailable",
      "next_action": "install_paddleocr_or_disable_ocr"
    },
    {
      "capability": "embedding",
      "provider_key": "bge-m3",
      "provider_version": null,
      "profile": "bge_m3_local",
      "status": "fallback",
      "blocking": false,
      "recoverable": true,
      "fallback_profile": "mock_fixed_384",
      "fallback_reason": "provider_capability_unavailable",
      "next_action": "install_bge_m3_or_keep_mock_fallback"
    },
    {
      "capability": "rag_answer",
      "provider_key": "local_llm",
      "provider_version": null,
      "profile": "evidence_only",
      "status": "fallback",
      "blocking": false,
      "recoverable": true,
      "fallback_profile": "evidence_only",
      "fallback_reason": "rag_provider_missing",
      "next_action": "configure_local_llm_or_keep_evidence_only"
    }
  ]
}
```

`PATCH /api/ai-providers/{provider_id}` 仅接受非密钥字段（默认模型、是否启用、capability 路由）：

```json
{
  "enabled": true,
  "default_capabilities": ["embedding"],
  "default_model": "bge-m3",
  "fallback_model": "mock_fixed_384"
}
```

> API Key **绝不**通过此 endpoint 传输。Key 配置走 Electron IPC：Renderer 收集 Key → Main Process → 写入系统 Keychain → 通过环境变量重启 sidecar。请求体如带 `api_key` 字段，sidecar 返回 `api_key_must_use_ipc`（详见 `docs/ai-provider-architecture.md` §5.4）。

`POST /api/ai-providers/{provider_id}:test` 用当前 Key 测试连通性，返回 `ok` / `key_invalid` / `network_unreachable` / `rate_limited`。

`POST /api/ai-providers/{provider_id}:reload-key` 由 Main Process 在 Key 更新后调用，触发 sidecar 重新加载环境变量。

### 16.8 Onboarding

```text
GET /api/onboarding/state
POST /api/onboarding/state
GET /api/onboarding/sample-materials
POST /api/onboarding/sample-materials:import
```

`GET /api/onboarding/state` 响应：

```json
{
  "data": {
    "completed": false,
    "current_step": 2,
    "total_steps": 5,
    "completed_steps": ["welcome", "data_dir"],
    "next_action": "create_first_project"
  }
}
```

`POST /api/onboarding/state` 推进步骤：

```json
{
  "advance_to_step": 3,
  "step_payload": {
    "project_id": "proj_xxx"
  }
}
```

`GET /api/onboarding/sample-materials` 返回 5 段示例材料（详见 `docs/desktop-architecture.md` §15.3）：

```json
{
  "data": [
    {
      "sample_id": "product_idea_500",
      "title": "产品想法示例（500 字）",
      "source_origin": "manual_note",
      "expected_chunk_count": 3,
      "expected_ku_count": 3,
      "preview": "..."
    }
  ]
}
```

`POST /api/onboarding/sample-materials:import` 一键导入选择的示例材料到指定项目，复用 `POST /api/sources/text-import` 的内部 service。

### 16.9 P0 不在系统 API 中提供

- 自动更新检查（P1 由 Main Process 通过 electron-updater 实现，不走 sidecar API）
- 远程崩溃报告上报（P1）
- 云备份（P2）
- 多账号 / 设备同步（P1+）

### 16.10 验收

桌面系统 API 进入实施前必须满足：

1. `/api/health` 能在 sidecar 启动 2 秒内返回 200。
2. `/api/system/info` 能返回 db_size 和 KB 对象计数。
3. `POST /api/backups` 能产出 .zip 备份文件，含 schema_version。
4. `POST /api/backups/{id}:restore` 还原前自动创建当前快照。
5. `POST /api/exports/knowledge-units` 能输出 Markdown + YAML frontmatter（含 type/tags/status）。
6. `GET /api/settings` 与 `PATCH /api/settings` 字段白名单一致。
7. `PATCH /api/ai-providers/{id}` 拒绝带 `api_key` 字段的请求。
8. `GET /api/ai-providers/capabilities` 返回 parser / OCR / ASR / token_counting / structure_recovery / document_layout / table_structure / html_xml_structure / academic_paper_structure / chunk_strategy / semantic_chunking / context_enrichment / chunk_quality_eval / content_understanding / schema_mapping / knowledge_card_generation / classification_tagging / relation_suggestion / embedding / rerank / LLM 的 `status`、`fallback_profile`、`fallback_reason` 和 `next_action`。
9. `POST /api/onboarding/state` 推进步骤幂等。
10. 所有破坏性操作返回 `confirmation_token` 二次确认。
11. 系统 API 不写业务 audit_logs，避免污染知识审计轨迹。

---

## 17. 后续扩展

P1 再补充或增强：

- `POST /api/text-to-sql/plan` 的真实模型 provider 和 schema-grounded eval
- `POST /api/embeddings/rebuild` 的批量调度、多 profile 对比和成本/延迟统计
- `POST /api/rerank` 的多 reranker A/B 测试
- Memory Management APIs
- Answer Version APIs
- `POST /api/system/updates:check` 自动更新检查
- `POST /api/system/diagnostics:export` 诊断报告导出
- `POST /api/agents` Personal Agent 多实例管理

P2 再评估：

- GraphRAG / Global Search APIs。
- Agent tool execution APIs。
- Cross-project knowledge migration APIs。
