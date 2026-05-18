# 开发计划

版本：v0.74
日期：2026-05-18
状态：已完成完整 P0 架构升级、技术选型细化、File Inspection 架构细化、切片前准备层、结构化整理检查门、知识切片质量闭环、安全运维横切层、实现前契约去重、检查门映射收敛、P0-Z0a/Z0b 竖切、ProcessingJob 契约收紧、切片执行 profile、AI 结构化整理 profile、D-077 实现边界收敛、D-079 结构化整理与存储映射收敛、D-080 知识调用 / AI 智能体 / 前端交互收敛、D-081/D-082/D-083 实现前边界修正、D-084 跨文档同步、D-085 Z0a 调用锚点与反馈 / citation 边界修正、D-086 后续 Agent 项目背景说明书、D-087 本地 Git 管理基础、D-088 README 对齐后的技术栈优化、D-089 GitHub private repo 上传、D-090 技术栈执行优化、D-091 技术栈工程化验收门槛、D-092 代码骨架前置契约优化、D-093 桌面运行时硬化、D-094 P0-Core 桌面工程骨架开工契约、D-095 架构审查实现验收强化、D-096 分布式开发计划、D-097 分布式开发计划优化、D-098 前端页面信息架构与工作台契约收敛、D-099 前后端交付边界与分布式开发计划强化、D-100 P0 代码阶段首轮实现、D-101 P0-File 上传与 File Inspection Z0a、D-102 Parser Router / Source / Chunk Z0a、D-103 Candidate KU / Review / fallback embedding Z0a、D-104 Retrieval Preview / Search-Ask Integration Z0a、D-105 Citation Detail / Evidence Pack Replay Z0b-lite、D-106 UI i18n / Bilingual Settings Z0b-lite、D-107 Feedback Events / Memory Draft Review Z0b-lite、D-108 Feedback Diagnostics / Event Replay Z0b-lite、D-109 Desktop Runtime Smoke / Pseudo-Packaged Sidecar Z0b-lite、D-110 Feedback Diagnostics Export Z0b-lite、D-111 Feedback Diagnostics Advanced Filters / Export History Z0b-lite、D-112 Citation Detail Focus / Evidence Trace Interaction Z0b-lite、D-113 Citation Annotation / Evidence Compare Z0b-lite、D-114 Knowledge Space / Folder-Tag / Metadata Filters Z0b-lite、D-115 Knowledge Unit / Project Export Z0b-lite、D-116 Knowledge Export History / Replay Z0b-lite、D-117 Packaged Runtime Static Renderer / Sidecar Artifact Spike Z0b-lite、D-118 Citation / Organization / Export Batch Actions Z0b-lite、D-119 Text-to-SQL Template / Structured Query Preview Z0b-lite，以及 D-120 UI Interaction Polish / Design-Ready Shell Z0b-lite（D-066 - D-120）

## 1. 当前阶段状态

本项目当前处于 **P0 UI Interaction Polish / Design-Ready Shell Z0b-lite 代码阶段**。D-100 已从文档-only 进入可运行 monorepo；D-101 已补齐文件上传和 File Inspection Z0a；D-102 已将已检查的文本类文件显式解析为 Source / Chunk；D-103 已将 parsed Source / Chunk 接入 Candidate KU、Review Task 和 `mock_fixed_384` fallback embedding；D-104 已将 confirmed KU 接入 Retrieval Preview、Evidence Pack detail、`/search`、`/ask` 和 `smoke:p0-search-ask`；D-105 已将 Evidence Pack detail 扩展为 Citation Detail replay，并在 `/search` 与 `/ask` 内嵌复盘面板和 `smoke:p0-citation-detail`；D-106 已将八页低保真工作台核心 UI 文案改为默认中文、可切换英文，并通过 `/api/settings` 将语言偏好持久化到 app data `config.json`；D-107 已补齐 append-only feedback events、pending-review Memory Draft、memory review confirm/ignore、`/ask` 反馈与保存入口、`/outputs` 草稿摘要和 `smoke:p0-feedback-memory`；D-108 已补齐反馈事件列表、诊断聚合摘要、query / citation 上下文 replay、`/outputs` Feedback Diagnostics 面板和 `smoke:p0-feedback-diagnostics`；D-109 已补齐 pseudo-packaged desktop runtime smoke，验证已 build Electron Main / Preload、renderer preview、FastAPI sidecar、preload bridge、local token、受保护 API 和 clean shutdown；D-110 已补齐反馈诊断 JSON / CSV 脱敏导出、`/outputs` 当前筛选导出控件和 `smoke:p0-feedback-export`；D-111 已补齐时间 / 关键词 / ranking effect / comment 状态 / 排序 / limit 高级过滤、`config.json.feedback_export_history` 最近导出历史、Export History 面板和 `smoke:p0-feedback-filters-history`；D-112 已补齐 Citation Detail focus、Evidence Trace path、copy-safe citation payload、`/search` `/ask` 聚焦交互和 `smoke:p0-citation-focus`；D-113 已补齐持久化 citation annotations、同 pack evidence compare API、Citation Detail 批注 / 对比面板和 `smoke:p0-citation-annotate-compare`；D-114 已补齐 Project / Folder / Tag API、Folder-Tag Mirroring、Source/KU organization 绑定、Library/Search/Ask 组织过滤和 `smoke:p0-space-tag-metadata`；D-115 已补齐 KU Markdown / JSON 导出、Project ZIP 导出、`/outputs` Knowledge Export 面板和 `smoke:p0-knowledge-export`；D-116 已补齐知识导出历史 metadata、`GET/DELETE /api/exports/history`、`/outputs` Knowledge Export History 面板和 `smoke:p0-knowledge-export-history`；D-117 已补齐静态 renderer dist 加载、preload / sidecar artifact 路径、app data sidecar 日志和 `smoke:p0-packaged-runtime`；D-118 已补齐批量 Source/KU organization、批量 citation annotation、KU 选择导出和 `smoke:p0-batch-actions`；D-119 已补齐规则模板版 `/api/text-to-sql/preview`、`/search` SQL Trace 面板和 `smoke:p0-text-to-sql`；D-120 已补齐八页工作台 route summary、bridge degraded 横幅、统一 state chip、响应式低保真布局和 `smoke:p0-ui-polish`。

已完成：

- **P0 代码阶段首轮实现（D-100）**：创建 Electron + React + Vite + TypeScript、FastAPI sidecar、SQLite、本地 runtime contracts、OpenAPI/generated TypeScript types 的 monorepo；实现 P0-Core API、local token middleware、SQLite 初始化、text import → Source / Chunk / Candidate KU / Review → fallback embedding → RetrievalLog / Evidence Pack / evidence-only answer；建立 Electron Main sidecar lifecycle、受限 preload bridge、typed fetch wrapper、Zustand store slices 和八页黑白灰低保真 Knowledge Workspace。验证已通过 `pnpm generate:api-types`、`pnpm typecheck`、`pnpm api:ruff`、`pnpm api:test`、`pnpm smoke:p0-core`、`pnpm smoke:p0-z0a`、renderer build、desktop preload/main build 和 `git diff --check`。
- **P0-File 上传与 File Inspection Z0a（D-101）**：新增 `upload_tasks`、`upload_parts`、`files`、`file_integrity_checks`、`file_inspection_results`，实现 Upload / File API、local_fs `tmp/uploads/` → `sources/` 存储、sha256 完整性校验、File Inspection Z0a header summary / risk summary / recoverable status 和 `file_inspection` ProcessingJob events；Renderer `/import` 接入 Uppy core + 自定义低保真上传控件，`/library` 接入真实 file list，`/dashboard` 显示 upload/file 计数；新增 `pnpm smoke:p0-file`。D-101 不自动创建 Source / Chunk / KU，Parser Router 保持下一阶段。
- **Parser Router / Source / Chunk Z0a（D-102）**：新增 `parse_tasks`、`parse_warnings`、`chunk_quality_checks`，实现 `POST /api/files/{file_id}:parse`、`GET /api/parse-tasks/{id}`、`GET /api/sources`、`GET /api/sources/{source_id}`；Z0a Parser Router 支持 text / markdown / json / csv 类文件生成 `Source(source_origin=parsed_file)` 与 `Chunk`，并写入 ProcessingJob events、FTS 和最小 chunk quality checks；unsupported / blocked 文件保持可恢复状态；Renderer `/library` 增加 Parse 操作和 Sources 面板；新增 `pnpm smoke:p0-parse`。D-102 不自动创建 Candidate KU、Review Task 或 Embedding。
- **Candidate KU / Review / fallback embedding Z0a（D-103）**：新增 `POST /api/knowledge-units:extract`、`GET /api/knowledge-units`、`GET /api/knowledge-units/{id}`，从 parsed Source / Chunk 生成 `pending_review` Candidate KU、Review Task 和 384 维 `mock_fixed_384` fallback embedding；重复 extract 默认复用已有候选；Review confirm 后 KU 才进入 confirmed 检索范围；Renderer `/library` 增加 Extract 操作和真实 Review 队列；新增 `pnpm smoke:p0-ku`。D-103 不接入真实 LLM、自动关系写入、标签合并、Memory Draft 或 provider-backed RAG。
- **Retrieval Preview / Search-Ask Integration Z0a（D-104）**：新增 `POST /api/retrieval/preview`、`GET /api/evidence-packs/{id}`，`POST /api/retrieval/evidence-only` 复用 Retrieval Preview / Evidence Pack 组装逻辑；检索只读 confirmed KU，pending_review 不进入 Evidence Pack；无证据返回 `no_retrieval_result` 并保留 no evidence reason；Renderer `/search` 接入真实 Query Explanation、Evidence Pack、Evidence Items、Citation Trace，`/ask` 接入 evidence-only answer；新增 `pnpm smoke:p0-search-ask`。D-104 不接入真实 LLM、reranker、Text-to-SQL provider、GraphRAG、feedback 或 Memory Draft。
- **Citation Detail / Evidence Pack Replay Z0b-lite（D-105）**：扩展 `GET /api/evidence-packs/{id}`，从 `retrieval_logs.filters_json` 与 `evidence_items → knowledge_units / chunks / sources` join 组装可直接渲染的 Citation Detail；返回 KU title/status/type、Chunk citation/content excerpt、Source title/origin/type、rank score、provider/fallback、query explanation summary 和 citation trace；Renderer `/search`、`/ask` 增加内嵌 detail replay 面板；新增 `pnpm smoke:p0-citation-detail`。D-105 不新增数据库表，不接真实 LLM、feedback、Memory Draft、Text-to-SQL provider、GraphRAG 或关系推理。
- **UI i18n / Bilingual Settings Z0b-lite（D-106）**：新增 `GET /api/settings` 与 `PATCH /api/settings`，默认 `language=zh-CN`，只允许 `zh-CN / en-US`，设置由后端原子写入 app data `config.json`；Renderer 新增 typed message keys、轻量 `t(key)`、settings store 和 `/settings` 语言切换控件，Electron bridge 可用时持久化，无 bridge 时 session fallback + degraded；八页 route shell 的导航、标题、按钮、状态、空态、runtime bar、Import/Library/Search/Ask/Citation Detail/Graph/Outputs/Settings 核心 UI 文案已中英双语化；新增 `pnpm smoke:p0-i18n-settings`。D-106 不翻译用户内容、文件名、KU、source excerpt、citation label 或 API enum/status code。
- **Feedback Events / Memory Draft Review Z0b-lite（D-107）**：新增 `feedback_events` 与 `memories` 最小表；`POST /api/feedback` 写 append-only local event 并返回 `feedback_policy`，不改写 confirmed KU、Source、Evidence Pack 或 AIAnswer；`POST /api/memory-drafts`、`GET /api/memory-drafts`、`GET /api/memory-drafts/{id}` 从 evidence-only answer 创建 `memories.status=pending_review` 和 `review_tasks.target_type=memory`；Review confirm / ignore 已支持 memory；Renderer `/ask` 增加反馈按钮与 Memory Draft 保存面板，`/library` Review 队列支持 memory，`/outputs` 显示 Memory Draft 摘要；新增 `pnpm smoke:p0-feedback-memory`。D-107 不接真实 LLM、provider-backed RAG、`retrieval_feedback`、Text-to-SQL provider、GraphRAG 或自动长期记忆。
- **Feedback Diagnostics / Event Replay Z0b-lite（D-108）**：新增 `GET /api/feedback` 与 `GET /api/feedback/summary`，从 append-only `feedback_events` 读取事件列表、过滤结果、正负向计数、类型 / 目标分布和 `feedback_policy`；诊断记录通过既有 `ai_answers`、`evidence_packs`、`evidence_items`、`retrieval_logs` 补足 query 与 citation label，不修改 confirmed KU、Source、Evidence Pack、AIAnswer、Memory，也不写 `retrieval_feedback`；Renderer `/outputs` 增加 Feedback Diagnostics 面板；新增 `pnpm smoke:p0-feedback-diagnostics`。D-108 不接真实 LLM、provider-backed RAG、反馈驱动排序、Text-to-SQL provider、GraphRAG 或自动长期记忆。
- **Desktop Runtime Smoke / Pseudo-Packaged Sidecar Z0b-lite（D-109）**：新增 `KB_DESKTOP_SMOKE=1` smoke-only Electron 启动模式和 `pnpm smoke:p0-desktop-runtime`；脚本使用已 build desktop main/preload、renderer preview 和普通 FastAPI sidecar，验证 preload bridge 注入 runtime config/local token、Renderer 经 typed fetch wrapper 访问 `/api/settings` 与 `/api/system/runtime`、无 token 请求被拒绝、页面非空、sidecar 只绑定 `127.0.0.1` 且退出后不残留；同步修正 preload build 产物路径和本地受限 CORS。D-109 不新增业务 API、数据库表、主路由、真实打包签名、PyInstaller、真实 Provider、OCR/ASR、provider-backed RAG 或 GraphRAG。
- **Feedback Diagnostics Export Z0b-lite（D-110）**：新增 `GET /api/feedback/export`，支持 `format=json|csv` 并复用 D-108 filters，返回 filename、mime_type、format、record_count、generated_at、filters、summary、content、`redacted=true`、`includes_source_text=false`；JSON content 包含 summary + events，CSV content 包含稳定事件表头和 query / citation_label / ranking_effect 上下文字段；Renderer `/outputs` Feedback Diagnostics 面板新增 JSON / CSV 格式选择与当前筛选导出按钮，使用 Blob download，不使用 Node fs、本地路径或 token；新增 `pnpm smoke:p0-feedback-export`。D-110 不新增数据库表，不写 `retrieval_feedback`，不影响 ranking，不修改 confirmed KU、Source、Evidence Pack、AIAnswer 或 Memory。
- **Feedback Diagnostics Advanced Filters / Export History Z0b-lite（D-111）**：扩展 `GET /api/feedback`、`GET /api/feedback/summary`、`GET /api/feedback/export` filters，支持 `created_from`、`created_to`、`search`、`ranking_effect`、`has_comment`、`sort` 与 `limit`；新增 `GET /api/feedback/export-history` 和 `DELETE /api/feedback/export-history/{id}`，每次导出只向 app data `config.json.feedback_export_history` 写入最近 20 条 metadata、summary totals、filters、content_sha256 和脱敏标记；Renderer `/outputs` 增加高级过滤控件和 Export History 面板；新增 `pnpm smoke:p0-feedback-filters-history`。D-111 不新增数据库表，不保存导出正文，不写 `retrieval_feedback`，不影响 ranking，不修改 confirmed KU、Source、Evidence Pack、AIAnswer 或 Memory。
- **Citation Detail Focus / Evidence Trace Interaction Z0b-lite（D-112）**：扩展 `GET /api/evidence-packs/{id}`，新增 `focus_item_id`、`detail_summary`、item-level `trace_path` 和 copy-safe citation payload；Renderer `/search` Evidence Items 与 `/ask` citation labels 可打开并聚焦同一个 Citation Detail 面板；面板新增关键词过滤、rank/source 排序、上一条/下一条、focused item summary、trace path 展示和复制按钮；新增 `pnpm smoke:p0-citation-focus`。D-112 不新增数据库表，不改 ranking，不保存复制行为，不接真实 LLM、provider-backed RAG、reranker、Text-to-SQL provider 或 GraphRAG。
- **Citation Annotation / Evidence Compare Z0b-lite（D-113）**：新增 `citation_annotations` 最小表和 annotation CRUD API；`GET /api/evidence-packs/{id}` 返回 annotation summary；`POST /api/evidence-packs/{id}/compare` 只读对比同一 Evidence Pack 内 2-3 条 evidence items；Renderer `/search` 与 `/ask` 的 Citation Detail 面板新增 focused item 批注、编辑 / 删除、compare 选择、对比结果和复制摘要；新增 `pnpm smoke:p0-citation-annotate-compare`。D-113 不写 `feedback_events`，不保存 compare result，不记录复制行为，不改 ranking，不接真实 LLM、provider-backed RAG、reranker、Text-to-SQL provider 或 GraphRAG。
- **Knowledge Space / Folder-Tag / Metadata Filters Z0b-lite（D-114）**：新增 Project / Folder / Tag API、Folder-Tag Mirroring、`source_tags` / `knowledge_unit_tags` join 表和 Source/KU organization patch；扩展 Source/KU list 与 Retrieval Preview / evidence-only answer 的 `project_id`、`folder_id`、`tag_ids` 过滤；Renderer `/library` 增加 Organization 面板，`/search` 与 `/ask` 增加组织过滤条，`/dashboard` 显示 folder/tag 计数；新增 `pnpm smoke:p0-space-tag-metadata`。D-114 不做任意 metadata JSON 编辑器，不新增主路由，不接真实 LLM、provider-backed RAG、reranker、Text-to-SQL provider 或 GraphRAG。
- **Knowledge Unit / Project Export Z0b-lite（D-115）**：新增 `POST /api/exports/knowledge-units` 与 `POST /api/exports/project`；KU 导出支持 Markdown / JSON、project / folder / tag / KU ID 过滤、include chunks / sources 和显式 pending review；Project 导出返回最小 ZIP envelope，包含 manifest、KU、tags、folders、sources、chunks 和 README；Renderer `/outputs` 增加 Knowledge Export 面板并复用 Organization filters；新增 `pnpm smoke:p0-knowledge-export`。D-115 不新增数据库表，不保存长期导出历史，不做云同步、备份/还原、系统级诊断包、Obsidian 双向同步、真实 LLM、provider-backed RAG 或 GraphRAG。
- **Knowledge Export History / Replay Z0b-lite（D-116）**：新增 `GET /api/exports/history` 与 `DELETE /api/exports/history/{id}`，每次知识资产导出后向 `config.json.knowledge_export_history` 写入最近 20 条脱敏 metadata；Renderer `/outputs` Knowledge Export 面板新增历史复盘、删除和套用 filters；新增 `pnpm smoke:p0-knowledge-export-history`。D-116 不新增 SQLite 表，不保存导出正文，不做云同步、备份/还原、Obsidian 双向同步、真实 LLM 或 GraphRAG。
- **Packaged Runtime Static Renderer / Sidecar Artifact Spike Z0b-lite（D-117）**：Electron Main 支持 `KB_RENDERER_DIST_DIR`、`KB_PRELOAD_PATH`、`KB_SIDECAR_APP_DIR` 与 `KB_SIDECAR_LOG_DIR`，可加载 build 后静态 Renderer、artifact preload 和 artifact sidecar；Renderer 支持 file/hash route，Sidecar 日志写入 app data logs；新增 `pnpm smoke:p0-packaged-runtime`。D-117 不新增业务 API、数据库表、OpenAPI schema、正式签名、自动更新、真实安装器、正式品牌资源或 PyInstaller 完整产物。
- **Citation / Organization / Export Batch Actions Z0b-lite（D-118）**：新增 `PATCH /api/sources/organization:batch`、`PATCH /api/knowledge-units/organization:batch` 和 `POST /api/evidence-packs/{id}/annotations:batch`；Renderer `/library` 支持 Source/KU 多选批量绑定，Citation Detail 支持 evidence item 批量批注选择，`/outputs` 支持当前过滤 KU 多选导出；新增 `pnpm smoke:p0-batch-actions`。D-118 不新增数据库表，不写 feedback/ranking signal，不保存 compare result，不改变 confirmed KU、Evidence Pack、AIAnswer 或 Memory。
- **Text-to-SQL Template / Structured Query Preview Z0b-lite（D-119）**：新增 `POST /api/text-to-sql/preview`，以 confirmed KU lookup、source inventory、evidence history 三类只读 SELECT 模板返回 generated_sql、parameters、rows、query explanation、degraded provider/fallback 状态，并写 `retrieval_logs.query_intent=structured_query_preview`；Renderer `/search` 新增 SQL Trace 面板和结构化查询按钮；新增 `pnpm smoke:p0-text-to-sql`。D-119 不接真实 Text-to-SQL provider，不开放 SQL 编辑器，不新增数据库表，不修改 retrieval ranking 或 Evidence Pack 组装。
- **UI Interaction Polish / Design-Ready Shell Z0b-lite（D-120）**：在不修改 API schema、主路由或业务语义的前提下，补齐八页低保真工作台 route summary、全局 bridge degraded 横幅、统一 state chip 文案、metric / panel / toolbar / query bar / list 的响应式布局约束，并新增 `pnpm smoke:p0-ui-polish` 检查 route config、i18n key、shell CSS marker 和 renderer build。D-120 不接正式设计稿、不新增产品能力、不伪造 Electron bridge 或真实 API 状态。
- **前后端交付边界与分布式开发计划强化（D-099）**：在 D-098 八页 Knowledge Workspace 已固定的基础上，将 `docs/distributed-development-plan.md` 升级为 **v0.4**；明确 Electron Main、Preload bridge、Renderer Frontend、typed API client、FastAPI sidecar、local_sqlite_worker 与 SQLite/sqlite-vec 的职责边界；新增前后端交付模板、禁止事项、D-099 G8 Frontend / Backend Boundary Gate、S1/S6 handoff 要求、前后端边界漂移风险和 preload 过宽风险。`docs/project-background-brief.md` 升级为 **v0.11**，README 与进度记录已同步。本轮仍为文档-only，不新增运行时代码、migration、OpenAPI、endpoint 或依赖。
- **前端页面信息架构与工作台契约收敛（D-098）**：将用户提供的 8 个核心页面收敛为 Knowledge Workspace 内部 route contract：`/dashboard`、`/import`、`/library`、`/search`、`/ask`、`/graph`、`/outputs`、`/settings`；`docs/product-architecture.md` 升级为 **v0.15**，`docs/knowledge-invocation-system-design-plan.md` 升级为 **v0.11**，`docs/technical-stack-and-prototype-plan.md` 升级为 **v0.25**，`docs/desktop-architecture.md` 升级为 **v0.7**，`docs/api-design.md` 升级为 **v0.19-draft**，`docs/api-implementation-plan.md` 升级为 **v0.21-draft**，`docs/testing-strategy.md` 升级为 **v0.22**，`docs/distributed-development-plan.md` 升级为 **v0.3**。本轮仍为文档-only，不新增运行时代码、migration、OpenAPI、endpoint 或依赖。
- **分布式开发计划优化（D-097）**：在当前技术栈与架构设计二次审查基础上，将 `docs/distributed-development-plan.md` 升级为 **v0.2**；确认主栈仍保持 Electron + React + Vite + TypeScript、FastAPI sidecar、SQLite + sqlite-vec、local_sqlite_worker、SSE、ProviderRegistry 与 OpenAPI/generated types；新增 runtime / API / data / evidence 四类共享契约锁、集成节奏、失败态优先实现顺序、关键路径与并行窗口、PR 准入 / 退出标准、冲突处理顺序、文档所有权、G6/G7 gate 和风险登记。`docs/project-background-brief.md` 升级为 **v0.9**，README 与进度记录已同步。本轮仍为文档-only，不新增运行时代码、migration、OpenAPI、endpoint 或依赖。
- **分布式开发计划（D-096）**：基于当前技术栈与架构设计审查，新增 `docs/distributed-development-plan.md` **v0.1**；确认 P0 继续沿用 Electron + React + Vite + TypeScript、FastAPI sidecar、SQLite + sqlite-vec、local_sqlite_worker、SSE、ProviderRegistry 与 OpenAPI/generated types 的本地桌面栈；将下一阶段代码实现拆成 S0-S7 工作流、依赖图、分支 / PR 计划、文件所有权矩阵和 G0-G5 验收门槛。`docs/project-background-brief.md` 升级为 **v0.8**，README 与进度记录已同步。本轮仍为文档-only，不新增运行时代码、migration、OpenAPI、endpoint 或依赖。
- **架构审查实现验收强化（D-095）**：将前序架构 review 中「打包态、向量降级证据一致性、SQLite 并发、OpenAPI 首日、日志隐私」压成可验收子条款：`docs/technical-stack-and-prototype-plan.md` 升级为 **v0.24**，新增 §2.8 与 §11.6；`docs/project-background-brief.md` 升级为 **v0.7**；README 同步引用；决策记录表新增 D-095。本轮仍为文档-only，不新增运行时代码、migration、OpenAPI、endpoint 或依赖。
- **P0-Core 桌面工程骨架开工契约（D-094）**：将下一轮真正创建代码前的第一批工程边界写入文档体系：`docs/technical-stack-and-prototype-plan.md` 升级为 v0.23，新增 monorepo 职责划分、第一批命令、`runtime_state` 枚举、实现顺序、业务功能禁入清单和 `smoke:p0-core` / `smoke:p0-z0a` 分层；`docs/desktop-architecture.md` 升级为 v0.6，补齐启动状态机和 preload API surface；`docs/p0a-execution-plan.md` 与 `docs/testing-strategy.md` 升级为 v0.21；`docs/api-implementation-plan.md` 升级为 v0.20-draft；`docs/error-handling-and-observability.md` 升级为 v0.9；`docs/project-background-brief.md` 升级为 v0.6；README 与进度记录已同步。本轮仍为文档-only，不新增运行时代码、migration、OpenAPI、endpoint 或依赖。
- **桌面运行时硬化（D-093）**：根据“这是电脑软件开发”的约束，将优化重点从选型转向真实桌面运行边界：`docs/technical-stack-and-prototype-plan.md` 升级为 v0.22，新增 sidecar 本地会话 token、`127.0.0.1` 绑定、SQLite 数据保护、Main 注入式 typed API、重任务隔离、桌面工作台 shell、Provider 能力面板和最小诊断包；`docs/desktop-architecture.md` 升级为 v0.5；`docs/p0a-execution-plan.md` 与 `docs/testing-strategy.md` 升级为 v0.20；`docs/api-implementation-plan.md` 升级为 v0.19-draft；`docs/error-handling-and-observability.md` 升级为 v0.8；`docs/ai-provider-architecture.md` 升级为 v0.14；`docs/project-background-brief.md` 升级为 v0.5。本轮仍为文档-only，不新增运行时代码、migration、OpenAPI、endpoint 或依赖。
- **代码骨架前置契约优化（D-092）**：将下一轮创建工程骨架前必须冻结的契约写入文档体系：`docs/technical-stack-and-prototype-plan.md` 升级为 v0.21，新增 OpenAPI → TypeScript 类型生成、sidecar 打包验证 spike、Provider manifest、trace chain、Alembic migration 波次命名、SQLite 1K/10K 性能基线、Zustand store slices 和 Evidence Pack 失败态；`docs/p0a-execution-plan.md` 与 `docs/testing-strategy.md` 升级为 v0.19；`docs/data-model.md` 升级为 v0.20-draft；`docs/api-implementation-plan.md` 升级为 v0.18-draft；`docs/desktop-architecture.md` 升级为 v0.4；`docs/ai-provider-architecture.md` 升级为 v0.13；`docs/error-handling-and-observability.md` 升级为 v0.7；`docs/rag-pipeline.md` 升级为 v0.8-draft；`docs/project-background-brief.md` 升级为 v0.4。本轮仍为文档-only，不新增运行时代码、migration、OpenAPI、endpoint 或依赖。
- **技术栈工程化验收门槛（D-091）**：将当前技术栈优化建议进一步压成首批工程 gate：`docs/technical-stack-and-prototype-plan.md` 升级为 v0.20，新增最小依赖 CI、Provider 延迟加载、Electron sidecar 生命周期、typed fetch + error envelope、sqlite-vec 三态一致性和 evidence-first 不变量；`docs/p0a-execution-plan.md` 升级为 v0.18，将这些门槛写入开工 Checklist、D-091 gate 和 W1 验收；`docs/testing-strategy.md` 升级为 v0.18，补充最小依赖、Provider 缺失、sidecar 生命周期、typed fetch、sqlite-vec 一致性和 evidence failure 测试；`docs/project-background-brief.md` 升级为 v0.3。本轮仍为文档-only，不新增运行时代码、migration、OpenAPI、endpoint 或依赖。
- **技术栈执行优化（D-090）**：将当前技术栈优化意见落到执行文档：`docs/technical-stack-and-prototype-plan.md` 升级为 v0.19，补齐 `uv + pyproject.toml` 依赖分组、`pnpm + Zustand` 前端状态、sqlite-vec capability probe、File Inspection Z0a/Z0b 分层、evidence-first RAG 执行顺序和统一开发命令；`docs/p0a-execution-plan.md` 升级为 v0.17，将上述约束写入开工 Checklist、W1-W3 任务和验收；`docs/testing-strategy.md` 升级为 v0.17，补充依赖分组、optional provider 缺失、sqlite-vec 三态、File Inspection 分层、Zustand SSE 状态和 evidence-first RAG 测试口径；`docs/project-background-brief.md` 升级为 v0.2，同步后续 Agent 实现前检查点。本轮仍为文档-only，不新增运行时代码、migration、OpenAPI、endpoint 或依赖。
- **GitHub private repo 上传（D-089）**：创建并绑定 GitHub private repo `ChenchenChen001/ai-database-product`，`origin` 指向 `https://github.com/ChenchenChen001/ai-database-product.git`；以 `main` 为首个远程分支完成项目文档基线提交与推送。仓库保持 private，本轮未公开。
- **README 对齐后的技术栈优化（D-088）**：根据 README 入口文档，把 `docs/technical-stack-and-prototype-plan.md` 升级为 v0.18，新增 P0-Z0a 最小可执行栈、完整 P0 扩展栈和 P1/P2 后置栈；明确首批工程只以 Electron + React + Vite + TypeScript、FastAPI sidecar、SQLite + sqlite-vec、local filesystem、local_sqlite_worker、SSE、Repository 抽象、Pydantic、Alembic、FTS5、embedding fallback、Evidence Pack 和 evidence-only answer 跑通闭环；PyMuPDF、pdfplumber、PaddleOCR、Whisper、bge-m3、bge-reranker-v2 等按波次接入，PostgreSQL、独立向量库、GraphRAG、Redis/Celery、WebSocket 必需通道、多 Agent 和外部工具执行继续后置。本轮仍为文档-only，不新增运行时代码、migration、OpenAPI 或 endpoint。
- **本地 Git 管理基础（D-087）**：初始化本地 Git 仓库，默认分支为 `main`；新增 `.gitignore`、`.gitattributes` 和 `docs/git-management.md`；忽略本地临时文件、密钥、数据库、上传资料、日志、构建产物和模型权重；设置 Markdown 文本行尾和 PDF / 图片二进制处理。本轮未创建 commit、未配置 remote、未推送。
- **后续 Agent 项目背景说明书（D-086）**：新增 `docs/project-background-brief.md`，作为 README 和领域主文档之间的快速接手入口，集中说明项目定位、目标用户、非目标、核心原则、当前架构、P0 切片、冻结技术选择、数据对象速览、推荐阅读顺序、过期口径和后续 Agent 工作原则。本轮仍为文档-only，不新增运行时代码、migration、OpenAPI 或 endpoint。
- **Z0a 调用锚点与反馈 / citation 边界修正（D-085）**：修复 D-081 后残留的实现冲突：P0-Z0a 的 Evidence / Answer 以 `retrieval_log_id` 和 `evidence_pack_id` 为锚点，`request_id` / `retrieval_plan_id` 可为空；Z0a RAG response 返回 `evidence_item_ids`、`citation_labels` 和 `citation_trace_summary`，不要求持久化 citation 明细 ID；Z0a feedback 只允许 response-only 或 append-only `feedback_events`，Z2 才写 `retrieval_feedback`。
- **D-081-D083 跨文档同步（D-084）**：将调用持久化边界、`InvocationProfileSchema v1`、`feedback_policy` 和 `FrontendStateContract` 从 API / data-model 主文档同步到 RAG、产品总架构、MVP、Provider、Text-to-SQL 和可观测性文档；修正 P0-Z0a summary / P0-Z2 persisted、`rewrite_status=not_needed`、`source_reliability_score/source_reliability_label`、feedback 反污染边界和 README 索引版本。本轮仍为文档-only，不新增运行时代码、migration、OpenAPI 或 endpoint。
- **知识调用、AI 智能体与前端交互收敛（D-080）**：根据新图中的知识库调用系统、AI 智能体系统和前端系统细节，将调用系统补齐为 `query_understanding_profile`、`retrieval_strategy_profile`、`ranking_profile`、`citation_trace_profile` 和 `feedback_signal`；将 P0 Agent 收敛为 `implicit_agent`，只允许对话上下文、只读任务规划、内部工具调用、RAG 问答和内容草稿；前端契约补齐 AI 工作台首页、项目选择、上传资料、文件管理、知识库、对话/RAG、引用与查询解释、数据可视化入口、设置页和 Toast / Error Boundary / Loading Skeleton / SSE 状态边界。本轮仍为文档-only，不新增运行时代码、migration、OpenAPI 或 endpoint。
- **结构化整理与存储映射收敛（D-079）**：根据本轮图中的 AI 结构化整理和数据库存储系统细节，保持 D-077 顶级链路不变，将摘要类型、标签操作、分类归属、字段映射、知识卡片类型、实体候选和三元组候选写入 `structured_organization` 子字段；补齐 `structured_organization_started/completed/warning/failed` 事件；将数据库存储系统解释为逻辑职责映射，P0 仍保持 local StorageAdapter + SQLite + sqlite-vec + FTS5。
- **D-077 实现边界收敛（D-078）**：根据本轮 review，将 AI 结构化整理的 Z0a/Z0b 写入路径收紧为 `knowledge_units.metadata_json.structured_organization` + `processing_status_events` + `review_tasks`；`quality_events` 和 `knowledge_relations` 保持 P0-Z1 对象，不阻塞首批 migration；`relation_suggestion` 明确归属 `system_rules` stub，关系候选以 `review_tasks.target_type=relation_suggestion` + `payload_json` 存储。
- **AI 结构化整理 Profile 与质量门细化（D-077）**：根据本轮图中的内容理解、摘要生成、关键概念抽取、结构化字段生成、知识卡片、分类标签和关系构建细节，将 Building AI 收敛为 `structured_organization` profile；P0 默认 Pydantic / JSON Schema、Jinja2 / Markdown / YAML Frontmatter、KeyBERT / YAKE、spaCy / HanLP 和规则模板；LLM、LlamaIndex、LangChain Structured Output、Instructor/Guardrails、BGE、BERTopic、Neo4j、NetworkX、RDFlib 只作为增强 adapter；关系建议进入 Review，不直接写 confirmed relation。
- **切片执行 Profile 与工具矩阵收敛（D-076）**：根据本轮计划，把 D-076 从“新增执行平台层”压窄为 `ChunkBuildService` 内部 `chunk_execution_profile` 与工具矩阵细化；`chunk_type` 收敛为 `text_semantic / structured_table / image_ocr / audio_transcript / video_scene / mixed`；LangChain、LlamaIndex、sentence-transformers、CLIP/BLIP/Florence、Table Transformer 只作为 P1/P2 adapter；`source_binding_status` 只表达 Citation/Evidence 可用性，不混入 embedding/index 状态。
- **切片检查门与 ProcessingJob 契约收敛（D-075）**：根据当前方案评审，把 `_check` 流程 gate 与 `chunk_quality_checks.check_type` 收敛成权威映射表；`chunks:build` 改为 job-first，除 source/权限同步校验外，所有 input/OCR/strategy/structure/source binding 检查都必须落入 ProcessingJob event 或 quality check；`chunk_summary` 补充 `check_summary`、`capability_summary`、`fallback_reasons`；Provider 列表新增 `provider_type=system/local_adapter/mock/commercial`，避免 mock 与系统规则能力混淆。
- **切片前准备层与结构化整理检查门（D-074）**：根据三张新架构细节图，把 chunk build 前置为输入完整性、OCR/版面、内容类型、策略匹配、结构恢复、结构完整性检查，再进入语义/结构化/多模态切片；Provider capability 补齐 token_counting、structure_recovery、document_layout、table_structure、html_xml_structure、academic_paper_structure；结构化整理链固定为内容理解、摘要、关键概念、字段、知识卡片、分类标签，每步写 provider/fallback/quality 记录。
- **实现前契约去重与单一来源收敛（D-073）**：根据当前方案评审，删除 `parse_warnings` / `chunk_quality_checks` 的重复字段定义，统一 `processing_status_events.event_type` 枚举来源，把 chunking capability 补入 Provider capability API，并将 `/api/system/status` 补齐 `window`、`status_reason` 和阈值说明；测试策略拆成 Z0a 最小 chunk 验收与 Z0b 完整 source metadata / chunk quality 验收。
- **知识切片质量闭环与安全运维横切层细化（D-072）**：根据两张新架构图，把 chunk build 从“文本切分”升级为输入接收、结构恢复、策略判断、语义/结构化/多模态切片、上下文补充、元数据标注、来源绑定和质量检查的完整闭环；补齐 `chunk_strategy_profile`、`context_summary`、`source_metadata`、`chunk_quality_checks` 维度；同时把日志、异常监控、数据安全、性能成本、系统稳定性明确为 P0 本地横切支撑，默认不依赖外部 APM 或云遥测。
- **P0-Z0a/Z0b 与 ProcessingJob 进一步收紧（D-071）**：把 P0-Z0 再拆成 blocking 的 P0-Z0a 和同周补齐的 P0-Z0b；将 `ingestion_jobs` 统一为领域对象 `ProcessingJob`（物理表可暂用旧名），补齐状态机、active job 幂等、sensitive access grant 的 scope/TTL/一次性规则，并规定 P0-Z0a RAG 只输出 evidence-only answer、不调用 LLM。
- **P0-Z0 实现竖切收紧（D-070）**：根据当前方案审查，把“完整 P0 架构范围”与“第一轮迁移/代码必须一次性完成”拆开；新增 P0-Z0 / P0-Z1 / P0-Z2 波次，泛化 `ingestion_jobs` 支持 Source 创建前的 inspect / preview，统一通用 Job Events API，收紧 sensitive evidence 授权和 error envelope 单一来源；当前执行口径已由 D-071 进一步细化为 P0-Z0a/Z0b。
- **File Inspection 架构细化（D-069）**：根据三张文件识别/安全/结构/预览图，在上传完成与 Parser Router 之间新增 File Inspection 层；P0 默认真实类型识别、编码检测、静态安全检查、结构识别和预览生成，新增 `file_inspection_results`、inspect/preview API、Provider capability 和 fixture。P0 不执行未知文件、不运行 Office 宏，不强制 ClamAV daemon、Docker Sandbox、Docling、LayoutParser、Detectron2、Video-LLaVA 或商业视觉模型。
- **实现前契约收紧（D-068）**：根据当前方案评审，统一 embedding profile / dimension、Provider capability status、local_sqlite_worker + SSE 可恢复状态流和 route-level 实施映射。`mock_fixed_384` 被明确为 fallback profile，384 维不再是 P0 全局默认；Provider 状态统一为 `available / fallback / unavailable / disabled / error`；SSE 使用 `event_seq` / `Last-Event-ID` 续读。
- **P0 技术选型细化（D-067）**：根据三张技术选型图，把上传、状态反馈、存储、队列、解析、OCR、ASR、数据清洗、Metadata/标签、Embedding、Rerank、RAG、Text-to-SQL、监控等能力落成 P0 默认栈 / P1 可选栈 / P2 暂缓栈；默认保持桌面本地优先、FastAPI、SQLite + sqlite-vec、开源优先和可恢复降级。
- **完整 P0 入库与知识处理平台升级（D-066）**：根据五张架构图，将原 P0-A / P0-B 轻量闭环升级为 P0-Core / P0-File / P0-AI / P0-RAG 四切片；账号预埋、文件上传、完整性校验、Parser Router、解析任务、切片质量、AI 结构化、Embedding、Hybrid Retrieval、Evidence Pack、Citation、RAG answer / evidence-only fallback 和用户记录均进入 P0。
- **文档同步完成**：已同步 `docs/git-management.md` v0.2、`docs/project-background-brief.md` v0.11、`docs/product-architecture.md` v0.15、`docs/mvp-scope.md` v0.13、`docs/architecture-design-plan.md` v1.3、`docs/data-model.md` v0.20-draft、`docs/api-design.md` v0.19-draft、`docs/api-implementation-plan.md` v0.21-draft、`docs/p0a-execution-plan.md` v0.21、`docs/technical-stack-and-prototype-plan.md` v0.25、`docs/desktop-architecture.md` v0.7、`docs/distributed-development-plan.md` v0.4、`docs/ai-provider-architecture.md` v0.14、`docs/testing-strategy.md` v0.22、`docs/rag-pipeline.md` v0.8-draft、`docs/knowledge-invocation-system-design-plan.md` v0.11、`docs/error-handling-and-observability.md` v0.9、`docs/text-to-sql.md` v0.4-draft、README 与进度记录。
- **RAG + Embedding 向量库执行口径（D-065）**：新增 `docs/rag-pipeline.md`，明确 RAG 不是数据库本身，Embedding + Vector Index 才是向量库层；P0-AI 必须包含 `embeddings` 表、`EmbeddingRepository` 和 `VectorStoreService` 抽象，sqlite-vec 运行时可以降级但不能绕开向量层；P0-RAG 做 Evidence Pack、Citation、RAG answer / evidence-only fallback。
- **向量存储与 RAG 路径（用户确认 + D-063）**：正式冻结为 **主库 SQLite + sqlite-vec + `embeddings` 表混合检索**；P0 **不**引入与主库分离的独立向量数据库（Milvus / Pinecone 等）；RAG 定义为检索 + 证据组装 + Provider answer/fallback 流水线。同步更新 `docs/data-model.md`、`docs/technical-stack-and-prototype-plan.md`、`docs/mvp-scope.md`、`docs/product-architecture.md`、`docs/ai-provider-architecture.md`。
- 完成第四轮架构优化 8 条建议落地：
  - 跨文档批量修复 `permission` 枚举不一致：`docs/api-design.md`、`docs/text-to-sql.md`、`docs/knowledge-invocation-system-design-plan.md`、`docs/data-model.md` 统一为 P0 3 值（normal / sensitive / do_not_share），并新增错误码 `invalid_permission_value`。
  - 修复 `docs/text-to-sql.md` §7 SQL 模板 SQLite 方言违反：`= true / = false` 改为 `= 1 / = 0`，`ANY(array)` 改为 `EXISTS (SELECT 1 FROM json_each(col) WHERE value = :param)`，并在 §3 默认调用条件清单标记逻辑层与方言层分离。
  - 清理"技术栈未确定"过时表述：README、`docs/api-implementation-plan.md` §2、`docs/product-architecture.md` 桌面注脚全部对齐已锁定的 Electron + FastAPI + SQLite + SQLAlchemy 栈。
  - 在 `docs/api-design.md` 升级为 v0.3-draft，新增 §16 桌面系统 API（10 节）：health、system info、data-dir、backups、exports、settings、ai-providers、onboarding 共 9 组 endpoint，§4.5 permission 字段约定，以及 7 个新错误码（包含 `api_key_must_use_ipc`、`backup_in_progress`、`migration_in_progress`、`ai_provider_unavailable`、`data_dir_move_failed`、`agent_not_supported_in_p0`、`invalid_permission_value`）。
  - 在 `docs/api-implementation-plan.md` 升级为 v0.3-draft，新增 §11 Repository 抽象层接口契约：命名约定、接口签名（Protocol + dataclass）、UnitOfWork 事务边界、异步策略（aiosqlite/asyncpg）、异常转化映射（IntegrityError → DuplicateError 等）、SQL 方言适配点矩阵、Fake Repository 测试约定、P1 PostgreSQL 迁移检查清单。
  - 统一冻结清单：`docs/mvp-scope.md` §10 升级 v0.4 + `docs/technical-stack-and-prototype-plan.md` §11 升级 v0.3，两份冻结项与 `docs/data-model.md` §11 同步同一份清单（技术栈 / 数据模型 / 权限与 Agent / API 契约 / 产品包装 5 个分类；D-063 后 technical-stack §11 增至 **27** 条）。
  - 定义 P0 Personal Agent 占位规则：`docs/knowledge-invocation-system-design-plan.md` §6.1 + `docs/mvp-scope.md` §3.3 + `docs/api-design.md` §11.1，明确 `agent_id` 在 P0 schema-only 预埋为 nullable、写入值固定 null、显式传 ID 返回 `agent_not_supported_in_p0`、业务代码通过 `current_agent_id_or_null()` 读取、P1 切换时 Alembic 批量回填主 Agent ID。
  - 新增 `docs/error-handling-and-observability.md` v0.1：错误响应 envelope（含 request_id）、错误码白名单 3 层分级、UI 消息映射规则（Toast/Banner/Modal/StatusBar + i18n 文案）、桌面诊断报告契约（用户主动导出 + 脱敏 + 不含原文 + 不自动上传）、日志策略（分层 + 日轮转 + 30 天保留 + 脱敏规则）、崩溃报告与遥测开关（P0 默认全 OFF）、P1 可观测性指标（Prometheus 文本格式）；后续已收敛为 P0-A Core 只强制 envelope / 核心错误码 / UI 映射 / 基础日志。
  - 在 `docs/p0a-execution-plan.md` 升级为 v0.2 并完成 Core 裁剪：W1 使用稳定开发期命名占位，正式品牌外部分发前冻结；W2 Onboarding 降级为最小 1 步；W4 将诊断报告、日志轮转、设置页、完整打包拆为 Shell / P0-A+，不阻塞 P0-A Core。
- 完成第三轮架构优化 8 条建议落地：
  - 新增 `docs/p0a-execution-plan.md` v0.1：P0-A 4 周周计划、依赖图、Definition of Done、第一条开工命令清单、降级策略、量化验收指标。
  - 在 `docs/desktop-architecture.md` 升级为 v0.2：新增 §12 Schema 演进与数据迁移工具链、§13 Electron 安全实践、§14 产品包装规范、§15 用户首次体验（Onboarding）。
  - 新增 `docs/ai-provider-architecture.md` v0.1：LLM Provider 抽象接口、API Key 系统 Keychain 存储、网络降级策略、多 Provider 路由、P0 → P1 增量启用路径。
  - 新增 `docs/testing-strategy.md` v0.1：测试金字塔、P0 fixture 数据集、性能基线、SQLite 并发测试、Electron + Playwright E2E 方案、CI 集成预案、P1 AI 评估方案。
  - `docs/data-model.md` 升级为 v0.3-draft：新增桌面单用户假设、permission 简化为 3 值、Personal Agent 实体预埋（agents/agent_invocations/agent_memories）、事件分类决策树（5 类事件归属规则 + P1 统一事件总线评估）。
  - `docs/product-architecture.md` 升级为 v0.5：新增 §5.4.1 Personal Agent 的产品定位章节，明确多 Agent 模型和 P0/P1/P2 阶段路径。
- 完成第二轮架构优化 8 条建议落地：桌面框架 Electron、P0 SQLite + sqlite-vec、P0-A/P0-B 拆分、文档架构与代码架构分离、数据模型精简（embedding 冗余移除 + metadata_json 约束 + SQLite 类型映射）、桌面 UX 约束、数据可移植性、跨文档不一致修复。
- 新增 `docs/desktop-architecture.md`，定义桌面应用部署架构。
- 建立根目录 `AGENTS.md`。
- 明确产品可拆分为“知识库构建系统”和“知识调用系统 / Agent 调用系统”。
- 确认当前以“知识库构建系统”为工程 P0 基础，同时开始设计“知识调用系统”架构主线。
- 创建 `README.md` 项目入口。
- 创建 `docs/architecture-design-plan.md` 知识库构建系统架构设计计划。
- 创建 `docs/progress.md` 进度记录。
- 阅读并吸收 `/Users/achen/Downloads/codex_kb_system_prompt.md` 中的建库系统实现说明。
- 调研 LightRAG 与 GraphRAG 开源方案，并形成 `docs/open-source-rag-research.md`。
- 根据 review findings 收紧 P0 可实现方式：无 AI API 替代策略、embedding v0.1 存储决策、Text-to-SQL join 表、Relation P0 状态。
- 新增 `docs/knowledge-invocation-system-design-plan.md` 知识调用系统架构设计计划。
- 根据 review findings 收紧调用系统 P0：只做 Evidence Pack + Citation Preview + Query Explanation，不做最小 RAG answer，并在 data-model v0.1 中补齐调用系统预留对象。
- 根据 review findings 修正执行顺序和字段口径：先产出 data-model v0.1-draft，再定义 Text-to-SQL 示例；工程 P0 清单补充调用系统候选契约对象；MVP 验收统一为 `text_import`；结构化扩展字段统一命名为 `metadata_json`。
- 根据用户反馈完成文档定位校正：`docs/architecture-design-plan.md` 只表示知识库构建系统架构，完整产品架构需要同时参考知识调用系统文档、开发计划、数据模型和 API 边界。
- 根据用户要求执行优化：将“两个系统是否合并”的结论落地为“一个产品、两个工程域、一个共享数据底座”，并开始新增 `docs/product-architecture.md` 与 `docs/data-model.md`。
- 新增 `docs/product-architecture.md`，明确产品层合并、工程层分域、数据层共享、写入需 Review、调用需证据、输出需回流。
- 新增 `docs/data-model.md` v0.1-draft，补齐建库域对象、调用域候选契约对象、只读视图草案、`knowledge_unit_chunks` 多对多关系和 `evidence_items` 证据项。
- 已将 P0 MVP 范围和 API 边界从长文档中拆出，形成 `docs/mvp-scope.md` 与 `docs/api-design.md`，为后续原型实现提供更直接的执行入口。
- 已在 API 草案之后补齐 `docs/text-to-sql.md` 和 `docs/api-implementation-plan.md`，把可查询对象、典型 SQL、路由分层、服务边界和验证切片从概念推进到实施契约。
- 本轮新增优化方向：补齐 `docs/technical-stack-and-prototype-plan.md`，把技术栈选择、P0 原型边界、目录结构、实施切片、验证命令和暂不实现内容明确下来，为后续真正创建工程代码做准备。
- 本轮新增优化方向：吸收 `/Users/achen/Desktop/ai数据库产品/个人智能数据库.pdf` 的代码层模块清单，在不扩大 P0 的前提下优化双模块架构，补充横切支撑层、文件接收与状态反馈、格式校验 / 任务队列、内容清洗、切片质量控制、AI 结构化整理、质量事件、版本、日志、异常、安全和性能成本边界。
- 已完成双域架构优化 6 条建议落地：（1）知识组织提升为独立能力层；（2）AI 能力分为 Building AI 和 Invocation AI 两层；（3）引入知识库类型学 kb_type；（4）增加知识持续优化机制（触发条件 + 操作类型 + Review 约束）；（5）前端体验层显式定位；（6）数据维护域归属明确（写入型归建库域，记录型归横切层）。

本计划的作用是持续管理：

- 产品与架构讨论；
- 建库流程决策；
- 知识调用流程决策；
- 数据模型边界；
- 文档拆分；
- 后续原型开发节奏。

## 2. 新增学习结论

外部提示词文件、开源 RAG / GraphRAG 调研、review findings、知识调用系统讨论、产品合并判断和 PDF 代码层模块清单对当前计划形成了 13 个关键补充。

### 2.1 建库流程从 8 步升级为 9 步

原计划把 Source Registry 和 Source Description Card 合并在来源管理中。现在应明确新增：

```text
Source Description Card
```

它是资料级摘要和元数据卡，用于让 Agent 先判断资料是否值得深入读取，降低上下文成本。

### 2.2 建库系统需要三类 embedding

不应只给 chunk 建 embedding。

后续计划应区分：

- Source Description Embedding：资料级检索；
- Chunk Embedding：原文证据检索；
- Knowledge Unit Embedding：知识语义检索。

### 2.3 RAG 检索必须是多索引混合检索

最低检索结构应包含：

- 原文索引；
- 全文关键词索引；
- 向量索引；
- metadata 索引；
- tag / folder 索引；
- relation 索引。

### 2.4 Review 不只是用户确认，还包括质量验证

Human Review 应扩展为：

```text
Human Review + Validation
```

质量检查至少包括：

- source_check；
- citation_check；
- type_check；
- duplicate_check；
- conflict_check；
- permission_check；
- retrieval_check；
- agent_use_check。

### 2.5 历史口径：P0 曾分成产品 P0 和工程 P0

本节是 2026-05-14 前的历史口径，已被 §2.14 和 D-066 覆盖。提示词中的 MVP 支持格式较宽，包括 PDF 文本、网页文本、代码文档、OCR 结果等。

但工程优先级又强调不要一开始接太多格式。因此本项目采用两层定义：

```text
旧产品 P0 能力目标：支持多来源材料进入统一 Source 模型。
旧工程 P0 实现范围：只实现 text_import 输入，并用 source_origin 标记材料来源。
```

当前口径：Upload / File Processing 与 `text_import` 同属 P0 入库管线；PDF / Office / OCR / ASR 等以开源优先 Provider + 可恢复降级进入 P0。

### 2.6 计划需要预留 API 和数据模型拆分

外部文件已经提供了表结构和 API 建议。当前不直接实现，但应把它们转入后续文档路线：

- `docs/data-model.md`
- `docs/api-design.md`
- `docs/rag-pipeline.md`
- `docs/text-to-sql.md`
- `docs/mvp-scope.md`

### 2.7 LightRAG / GraphRAG 只作为分阶段参考，不进入工程 P0 依赖

LightRAG 与 GraphRAG 的共同启发是：单一 chunk 向量检索不足以支撑长期知识调用，系统需要关系、主题摘要、来源文本、实体 / 概念和多索引协同。

但这些开源方案主要是 RAG / GraphRAG 引擎，不是以用户确认 Knowledge Unit 为中心的个人建库系统。因此本项目采用以下边界：

- P0：只吸收对象边界和索引思想，保留 relation index、MOC 占位和 citation-ready retrieval。
- P1：再引入 AI 推荐关系、relation expansion retrieval、reranker 和带引用 RAG answer。
- P2：再评估 community summary、Global Search、DRIFT-like search、Neo4j 或 LightRAG 作为可替换检索后端。
- 不用 LightRAG / GraphRAG 替代 Human Review + Validation。

### 2.8 P0 必须先解决可实现性，而不是只定义理想能力

Review findings 暴露出一个关键问题：如果工程 P0 不接 AI API，却仍要求摘要、标签、候选 Knowledge Unit、embedding 和 Text-to-SQL，计划会在实现阶段自相矛盾。

因此 v0.6 明确：

- P0 使用手动 + 规则 + Mock 验证产品链路；
- 真实 AI API、真实自动抽取、真实 embedding 和真实 reranker 放入 P1；
- data-model v0.1 冻结前，必须先冻结 Embedding v0.1 存储决策；
- Text-to-SQL 第一版必须包含 join 表或只读视图，不能只列业务主表；
- P0 manual relation + MOC placeholder 已确认，待设计的是字段、交互和检索使用方式。

### 2.9 知识调用系统应独立成文档，但依赖建库数据质量

知识调用系统不是普通聊天框，而是个人 Agent 的上下文组装与证据调用系统。

当前已新增：

```text
docs/knowledge-invocation-system-design-plan.md
```

调用系统主线：

```text
Invocation Request（Z0a summary / Z2 persisted）
→ Retrieval Plan（Z0a summary / Z2 persisted）
→ Evidence Pack
→ Agent Context
→ Citation Preview / Query Explanation
→ Feedback / Memory Review
```

当前判断：

- Knowledge Unit 是 Agent 默认调用对象；
- Chunk 是证据片段，Source 是来源材料；
- Text-to-SQL 负责结构化导航，RAG 负责证据补全；
- 默认不允许未确认知识进入 Agent 长期调用；
- 调用结果需要保留引用、查询路径和反馈，并能回流为待审 Memory 或 Candidate Knowledge Unit；
- 历史口径曾要求调用系统 P0 只验证可解释检索、Evidence Pack 和 Citation Preview，不进入最小 RAG answer；该条已被 §2.14 和 D-066 覆盖。

### 2.10 历史口径：调用系统 P0 不做最小 RAG answer

本节是 2026-05-14 前的历史记录。当前口径以 P0-RAG 为准：P0-Z0a 只输出 `evidence_only_answer` 且不调用 LLM；P0-Z2 或显式 Provider 增强路径输出 `rag_answer`，Provider 缺失时继续输出 `evidence_only_answer`。

- 旧 P0 输出是 Evidence Pack、Citation Preview 和 Query Explanation；
- 旧 P0 不生成完整回答、创作稿或决策建议；
- 旧 `AIAnswer` 在 P0 只允许记录 `retrieval_preview` / `mock_answer` 类型，不代表真实 RAG answer；
- 旧真实 RAG answer with citations 放入 P1；
- 保存为 Memory / Candidate Knowledge Unit 时必须进入 Review，不允许绕过确认流程。

### 2.11 产品层合并，工程层分域

本轮判断确认：知识库构建系统与知识调用系统可以合并为一个产品，但不应揉成一个不分边界的大模块。

产品层表达：

```text
AI 个人知识资产系统
```

工程层继续分为：

```text
知识构建域：负责写入、提取、确认、索引和审计
知识调用域：负责只读检索、证据组装、引用解释和反馈回流
共享底座：负责用户、空间、来源、知识单元、标签、关系、embedding、日志和权限
```

这样可以同时解决两个问题：

- 面向用户时表达为一个连续产品，而不是两套割裂工具。
- 面向实现时保留读写隔离，避免调用系统绕过 Review 直接污染主知识库。

### 2.12 数据模型草案优先级上升

此前已经确认 data-model v0.1-draft 应先于 Text-to-SQL 示例和 API 细化。本轮进一步明确：

- `docs/data-model.md` 应成为建库域、调用域和共享底座的共同契约。
- P0 可以先以 schema / mock contract 形式预留调用系统对象。
- Evidence Pack、Citation Preview、AIAnswer、Memory Draft 必须有可复盘的持久化边界，不能只作为前端临时状态。
- data-model v0.1-draft 不代表 v0.1 stable；冻结仍需等待 Review、Embedding、Relation、Text-to-SQL 视图和调用系统最小对象确认。

### 2.13 PDF 代码层模块清单用于优化工程边界

`个人智能数据库.pdf` 提供了比现有文档更细的代码层树形架构。它不改变“一个产品、两个工程域、共享底座”的产品结论，但要求当前架构增加两类明确边界：

```text
知识构建域内部管线：
资料接入 → 文件接收与状态反馈 → 格式校验 / 任务队列 → 解析 / 清洗 / 切片 → AI 结构化整理 → Review / Validation → 存储 / 索引 / 审计

横切支撑层：
用户 / 权限 / 数据归属 / 反馈 / 数据维护 / 版本管理 / 日志 / 异常监控 / 安全 / 性能成本
```

本轮吸收策略：

- PDF 作为代码层模块 checklist，不作为 P0 范围扩张依据。
- PDF 模块对象已按新 P0 四切片重新分层：`processing_status_events`、`ingestion_jobs`、`parse_warnings`、`chunk_quality_checks`、`quality_events`、`feedback_events`、`system_logs` 进入 P0 相关切片；复杂 `version_snapshots` 可后置到 P1+。
- `Source.ingest_status` 扩展为 uploaded / received / validated / queued / processing / parsed / chunked / extracted / reviewing / indexed / failed / archived。
- Citation Preview / Query Explanation 需要能展示处理状态、parse warning、chunk quality、source version、权限过滤、retrieval path 和 evidence gaps。
- 2026-05-14 后，文件解析、OCR/ASR、多模态占位、Embedding 和 RAG answer 已进入 P0 架构，但必须通过开源优先 ProviderRegistry 与可恢复降级控制风险；真实 Text-to-SQL 模型、自动实体关系抽取、图数据库和多 Agent 执行仍不进入 P0。

### 2.14 五张架构图后的 P0 范围升级

2026-05-14 的架构图评估后，旧的 P0-A / P0-B 风险拆分被完整 P0 四切片取代：

```text
P0-Core：桌面骨架、本地 local_user、账号预埋 disabled contract、项目/文件夹/标签、权限、审计、错误 envelope
P0-File：上传任务、分片/直传、接收、完整性校验、文件保存、file_id、状态反馈、基础信息入库
P0-AI：Parser Router、解析任务、内容清洗、Chunk、chunk quality、KU 抽取、Review、Embedding、VectorStore
P0-RAG：Hybrid Retrieval、Evidence Pack、Citation、Query Explanation、RAG answer / evidence-only fallback、Feedback / Memory Draft
```

这次升级覆盖并取代以下旧口径：

- P0 不再只有 `text_import`；`text_import` 是统一入库管线的一种输入方式。
- PDF / Office / 图片 / 音频 / 视频 / 表格等文件进入 P0 架构，但以开源优先 Provider + 可恢复降级为边界，不承诺生产级解析质量。
- 账号系统进入 P0 数据模型和 API contract，但真实注册登录写接口返回 `auth_not_enabled_in_p0`。
- RAG answer 进入 P0-RAG，但分阶段启用：P0-Z0a 先输出 `evidence_only_answer` 且不调用 LLM；P0-Z2 或显式 Provider 增强路径输出 `rag_answer`，Provider 缺失时继续输出 `evidence_only_answer`。
- 独立向量数据库服务仍不进入 P0；向量能力由 SQLite + sqlite-vec + `embeddings` + FTS5 + 结构化索引组成主库混合检索。

历史章节中关于 P0-A / P0-B、`text_import` 单入口、RAG answer 延后的描述仅保留为历史记录；实施时以 D-066 / D-067 和最新各文档版本为准。

## 3. 产品拆分与当前焦点

产品整体拆分为：

```text
个人材料
→ 知识库构建系统
→ 个人知识数据库 / 个人知识库
→ 知识调用系统 / Agent 调用系统
→ 问答 / 创作 / 决策 / 复盘
```

当前焦点：**知识库构建系统优先，知识调用系统同步建立架构草案**。

工程 P0 仍不把完整 Agent 问答作为知识库构建系统必交付，但调用系统文档需要提前定义 Agent 如何使用构建后的知识库结果，避免建库 Schema 与未来调用需求脱节。

知识库构建系统负责：

- 接收用户材料；
- 保存 Source；
- 解析并标准化内容；
- 生成 Source Description Card；
- 切分 Chunk；
- 提取 Candidate Knowledge Unit；
- 推荐 type / tags / properties / relations；
- 执行 Human Review + Validation；
- 固化 Confirmed Knowledge Unit；
- 建立结构化存储、全文索引、向量索引、metadata 索引、tag/folder 索引、relation 索引和审计记录；
- 为未来 Text-to-SQL 和 Agent 调用提供清晰 Schema。

当前不做：

- 前端代码实现；
- 后端代码实现；
- 数据库迁移；
- AI API 接入；
- 完整文件解析器；
- Agent 调用系统代码实现；
- 多 Agent 自主执行。

### 3.1 P0 AI 能力替代策略

工程 P0 采用开源优先 ProviderRegistry；Provider 缺失时使用“手动 + 规则 + Mock / evidence-only fallback”的替代策略。

P0 能力边界：

```text
Source Description：规则生成 + 用户可编辑
Candidate Knowledge Unit：手动创建 + 规则 / Mock 候选
Tag / Type / Properties 推荐：规则 / Mock 推荐 + 用户确认
Embedding：open-source profile 优先；缺失时 `mock_fixed_384` fallback 验证索引与检索链路
Text-to-SQL：Schema + 示例查询 / mock 查询，不接真实模型
RAG Answer：P0-Z0a 生成 `evidence_only_answer`；P0-Z2 或显式 Provider 增强路径生成 `rag_answer`，不可用时继续生成 `evidence_only_answer`
```

P0 默认策略：

- 摘要：使用标题、首段、heading_path、source_origin 和用户输入说明拼装，不承诺真实 AI 摘要质量。
- 关键词：使用标题词、标签、重复词和用户手动补充，不承诺真实 AI 语义抽取质量。
- 候选 Knowledge Unit：用户手动创建为主；规则 / Mock 候选只用于验证 Review 工作流。
- embedding：优先使用 `bge_m3_local` 等开源 profile；未安装、禁用或 runtime probe 失败时使用 deterministic `mock_fixed_384` fallback（dimension=384）验证 SQLite / sqlite-vec / 索引 / 检索预览链路。
- AI API、商业 embedding、商业 reranker 均放入可选 Provider；本地 / 开源 provider 在 P0 以 adapter contract + graceful fallback 进入闭环。

## 4. 当前文档结构

```text
README.md
AGENTS.md
docs/
├── ai-provider-architecture.md
├── architecture-design-plan.md
├── api-implementation-plan.md
├── api-design.md
├── data-model.md
├── desktop-architecture.md
├── distributed-development-plan.md
├── development-plan.md
├── error-handling-and-observability.md
├── git-management.md
├── knowledge-invocation-system-design-plan.md
├── mvp-scope.md
├── open-source-rag-research.md
├── p0a-execution-plan.md
├── project-background-brief.md
├── product-architecture.md
├── progress.md
├── rag-pipeline.md
├── technical-stack-and-prototype-plan.md
├── testing-strategy.md
└── text-to-sql.md
```

当前文档职责：

- `README.md`：项目入口、当前阶段和文档索引。
- `AGENTS.md`：长期开发准则、产品定位、技术原则和 Codex 工作规则。
- `docs/project-background-brief.md`：后续 Agent 快速接手入口，集中说明项目背景、非目标、冻结技术选择、P0 切片、推荐阅读顺序和过期口径。
- `docs/architecture-design-plan.md`：知识库构建系统架构主文档，只覆盖材料入库、知识单元生成、确认、索引和可追溯。
- `docs/product-architecture.md`：统一产品总架构，说明一个产品如何由前端体验层、知识构建域、知识组织层、知识调用域、AI 能力栈、共享底座和横切支撑层组成，并记录 D-098 八页 Knowledge Workspace 页面契约。
- `docs/data-model.md`：数据模型 v0.20-draft，统一建库域、调用域、共享底座、只读视图、切片前准备层、切片执行 profile、AI 结构化整理 profile、D-079 存储映射、D-080 调用 profile、D-081-D085 实现前边界、D-092 trace chain 与 Evidence Pack 失败态、知识切片质量闭环、安全运维横切层、检查门映射单一来源、事件枚举单一来源、P0-Z0a/Z0b 波次和冻结门槛。
- `docs/mvp-scope.md`：P0 / P1 / P2 / 暂缓范围、P0 用户路径和验收标准。
- `docs/api-design.md`：P0 建库、检索预览、调用预览、反馈回流和 D-098 页面到 API 组映射 API 草案。
- `docs/text-to-sql.md`：Text-to-SQL P0 查询契约、可查询对象、SQL 模板、安全边界和 Query Explanation。
- `docs/api-implementation-plan.md`：API route-level 实施映射、DTO、service、repository、事务边界、D-098 页面 service owner 和合同测试清单。
- `docs/technical-stack-and-prototype-plan.md`：技术栈推荐、P0 原型目录、实施切片、数据库迁移顺序、验证命令和冻结清单。
- `docs/desktop-architecture.md`：Electron 桌面应用、FastAPI sidecar、本地数据库、IPC、安全、D-098 八页内部路由和打包分发架构。
- `docs/distributed-development-plan.md`：分布式开发计划 v0.4，定义 S0-S7 并行工作流、依赖图、分支 / PR 计划、文件所有权矩阵、共享契约锁、S6 八页页面所有权、前后端交付边界、PR 准入 / 退出标准、冲突预案、风险登记和 G0-G8 验收门槛；这里的分布式指开发协作分布，不改变 P0 本地桌面运行架构。
- `docs/ai-provider-architecture.md`：ProviderRegistry、能力注册、fallback、API Key 安全存储和开源优先适配边界。
- `docs/p0a-execution-plan.md`：P0-Core / P0-File / P0-AI / P0-RAG 的 6 周执行计划、Z0a/Z0b 竖切和验收指标。
- `docs/testing-strategy.md`：测试金字塔、fixture、D-098 页面契约测试、合同测试、性能基线和 Z0a/Z0b 验收策略。
- `docs/error-handling-and-observability.md`：错误 envelope、错误码、UI 提示、日志、诊断报告和本地可观测性边界。
- `docs/git-management.md`：本地 Git 初始化、忽略规则、行尾 / 二进制策略、提交类型、分支建议、首次提交建议、远程仓库前置检查和禁止事项。
- `docs/development-plan.md`：阶段计划、决策记录、验收清单和后续路线。
- `docs/knowledge-invocation-system-design-plan.md`：知识调用系统架构主文档。
- `docs/open-source-rag-research.md`：LightRAG / GraphRAG 调研记录与分阶段吸收边界。
- `docs/rag-pipeline.md`：Embedding、向量检索、Hybrid Retrieval、Evidence Pack、Citation 和 RAG fallback 管线。
- `docs/progress.md`：执行进度、验证记录和当前待办。

## 5. 建库系统 9 步基线

后续架构和原型开发以 9 步为主线。

```text
1. Source Ingestion：资料接入
2. Source Parsing：内容解析
3. Source Description Card：来源说明与元数据建档
4. Chunking + Candidate Knowledge Unit Extraction：切片与候选知识单元抽取
5. Classification Mapping + Semantic Grounding：分类映射与语义对齐
6. Embedding + Multi-indexing：Embedding 与多索引预入库
7. Relations + MOC：知识关系与 MOC 构建
8. Human Review + Validation：用户确认与质量验证
9. Commit + Retrieval + Feedback：正式入库、检索调用与反馈沉淀
```

当前核心链路仍然是：

```text
Source
→ Source Description
→ Chunk
→ Candidate Knowledge Unit
→ Classification
→ Embedding / Indexing
→ Relation / MOC
→ Review / Validation
→ Confirmed Knowledge Asset
→ Retrieval / Feedback
```

## 6. 下一阶段任务拆解

### 阶段 A：锁定 P0 输入类型

目标：

明确第一版建库系统处理哪些输入，避免架构讨论过早扩展到完整 PDF、OCR、网页爬取和 Obsidian 全量同步。

当前建议：

```text
工程 P0 输入类型:
- text_import

source_origin 可选值:
- markdown
- plain_text
- manual_note
- pasted_conversation
- extracted_pdf_text
- extracted_web_text
- extracted_code_doc
- extracted_ocr_text

P1:
- PDF 完整解析
- 图片 OCR + 图像理解
- 网页收藏 / 自动抓取
- DOCX / PPT
- Obsidian Vault 导入
```

需要输出：

- `docs/architecture-design-plan.md` 中的输入类型决策更新。
- 如内容变长，拆出 `docs/mvp-scope.md`。

验收标准：

- P0 输入类型统一为 `text_import`。
- `source_origin` 只作为来源元数据，不代表系统已经支持 PDF / OCR / URL / 代码解析器。
- `text_import` 有明确 Source 结构和解析策略。
- P1 输入不影响 P0 原型范围。

### 阶段 B：定义 Source Description Card

目标：

补齐资料级摘要和元数据层，让 Agent 可以先读来源说明，再决定是否深入读取全文、Chunk 或 Knowledge Unit。

字段候选：

```text
source_id
user_id
project_id
title
source_type
source_path
original_filename
content_hash
author
created_at
imported_at
updated_at
language
summary
key_terms
source_reliability
permission
status
available_for_agent
metadata_json
embedding_id
embedding_status
embedding_profile
```

需要输出：

- Source Description Card 的用途说明。
- 与 Source、Chunk、Knowledge Unit 的关系。
- 是否进入 P0 数据模型。
- Source Description Embedding 的生成策略。

验收标准：

- Agent 可先检索 Source Description，再决定是否读 chunk。
- Source 权限、可信度、摘要和版本信息可独立查询。
- Source Description 不替代 Source 原文，也不替代 Knowledge Unit。

### 阶段 C：定义 Knowledge Unit 最小字段集

目标：

确定第一版入库所需的最小字段，避免字段过多拖慢 MVP，也避免字段过少影响 Text-to-SQL。

当前候选最小集：

```text
id
user_id
project_id
title
content
knowledge_type
status
importance
source_id
source_excerpt
source_location
primary_folder
discipline_axis
topic_tags
folder_mirror_tags
use_for
permission
metadata_json
embedding_id
embedding_status
embedding_profile
ai_confidence
user_verified
created_at
updated_at
```

P1 可扩展：

```text
aliases
value_illustrations
domain_context
relations
version_history
```

需要输出：

- Knowledge Unit 最小字段说明。
- 字段是否结构化、JSONB 或关联表的初步判断。
- 字段与 Text-to-SQL、RAG、Review 的关系说明。

验收标准：

- 字段能支持来源追踪、用户确认、权限、状态、标签和未来查询。
- 明确哪些字段是 P0 必须，哪些是 P1 扩展。
- Knowledge Unit Embedding 的文本拼装策略明确。

### 阶段 D：设计 Classification Mapping + Semantic Grounding

目标：

把分类、标签、语义对齐从概念推进到可执行规则。

需要明确：

- folder_tag、topic_tag、discipline_tag、status_tag、use_tag、system_tag、custom_tag 的区别；
- Folder-Tag Mirroring 的 P0 规则；
- discipline_axis / use_for / importance / permission 的字段规则；
- Alias / Synonym 是否进入 P0；
- Value Illustration 和 Domain Context 是否作为 P1；
- AI 推荐标签和用户确认标签如何区分；
- 标签 namespace 是否必须在第一版实现。

验收标准：

- 标签和属性不混淆。
- Tag、Properties、Embedding、SQL 查询各自职责清楚。
- 第一版规则足以支持 metadata filter、tag filter、folder filter 和 Text-to-SQL。

### 阶段 E：设计 Embedding + Multi-indexing

目标：

将检索基础从“单一向量检索”升级为多索引体系。

需要明确：

- P0 embedding_profile：`mock_fixed_384`、本地模型，还是远程模型；
- 向量维度、模型标识、模型版本和重建策略；
- Chunk Embedding 的生成文本；
- Knowledge Unit Embedding 的生成文本；
- Source Description Embedding 的生成文本；
- 三类 embedding 是使用统一 `embeddings` 表，还是分别放在业务表 vector 列；
- `embedding_status`、`embedding_content_hash`、`embedding_error` 等字段；
- 原文索引、全文关键词索引、向量索引、metadata 索引、tag/folder 索引、relation 索引的职责；
- embedding 是确认前生成、确认后生成，还是两阶段生成；
- 默认过滤策略。

验收标准：

- 明确不做普通 `file → chunk → vector → answer`。
- 检索顺序优先考虑 metadata / status / folder / tag filter。
- Knowledge Unit 检索和 Chunk 证据检索分层清楚。
- LightRAG / GraphRAG 的混合检索思想只转化为阶段边界，不引入 P0 外部引擎依赖。
- 冻结数据模型前必须先完成 Embedding v0.1 存储决策。

### 阶段 F：设计 Relations + MOC

目标：

明确关系和知识地图在 P0/P1/P2 中的边界，并吸收 GraphRAG 的 Local / Global Search 思路。

关系类型候选：

```text
supports
contradicts
derived_from
example_of
part_of
depends_on
updates
replaces
used_for
similar_to
solves
```

已确认：

- P0 包含 manual relation；
- P0 保留 relation index placeholder；
- P0 保留 MOC placeholder；
- AI 推荐 relation 进入 P1；
- community summary / Global Search 进入 P2 评估。

需要继续明确：

- P0 manual relation 的字段、创建入口和编辑方式；
- 反向链接如何从 `knowledge_relations` 自动生成；
- P0 retrieval preview 是否使用 relation filter，还是只展示 relation evidence；
- MOC 在 P0 是字段、视图还是文档型导航；
- relation expansion retrieval 的 P1 具体范围；
- Neo4j 或独立图数据库的 P2 触发条件。

验收标准：

- Relation 不阻塞 P0 入库闭环。
- MOC 能服务主题导航，不变成复杂知识图谱先行。
- P0 relation 状态不再作为待确认问题；待设计的是字段、UI 操作和检索使用方式。
- 自动实体关系抽取、community detection 和 Global Search 不进入工程 P0。

### 阶段 G：设计 Human Review + Validation

目标：

明确 AI 推荐到用户确认之间的产品流程，并加入质量验证机制。

用户操作候选：

```text
confirm
edit
ignore
merge
split
mark_as_core
mark_as_outdated
mark_as_do_not_use
request_source
request_reclassify
```

质量检查候选：

```text
source_check
citation_check
type_check
duplicate_check
conflict_check
permission_check
retrieval_check
agent_use_check
```

验收标准：

- 明确 `pending_review → confirmed / ignored / merged / split / do_not_use` 等状态流转。
- 明确哪些知识默认可被 Agent 调用。
- 明确 `confirmed`、部分 `pending_review`、`outdated`、`do_not_use` 的检索边界。
- 明确用户如何回溯 AI 推荐理由和 Source。

### 阶段 H：设计数据模型 v0.1 草案并设置冻结门槛

目标：

在 Text-to-SQL、API 边界和工程实现计划前，先产出第一版数据模型草案，避免查询对象和服务接口建立在完全未定义的 Schema 上。

注意：

```text
docs/data-model.md 可以先作为 v0.1-draft 产出；
真正冻结 data-model v0.1 必须晚于 Review 状态流转、Embedding 存储、Relation 字段、Text-to-SQL 只读视图和调用系统最小对象定义。
```

需要明确：

- 核心表 / ORM model；
- 字段最小集；
- 外键关系；
- JSONB 字段边界；
- 状态枚举；
- 权限字段；
- 哪些字段必须可被 Text-to-SQL 查询；
- 哪些字段只作为展示或扩展 metadata。

数据模型 v0.1 候选对象分层：

P0 建库必需对象：

```text
users
projects
folders
tags
sources
source_descriptions
chunks
knowledge_units
knowledge_unit_chunks
knowledge_unit_tags
knowledge_relations
embeddings
review_tasks
retrieval_logs
audit_logs
```

P0 调用系统预留对象 / 只读视图：

```text
invocation_requests
retrieval_plans
evidence_packs
evidence_items
answer_citations
ai_answers
memories
retrieval_feedback
v_knowledge_units_with_tags
v_retrieval_evidence
v_invocation_evidence
```

P1 扩展对象：

```text
conversation_threads
rerank_logs
answer_versions
memory_review_tasks
agent_context_snapshots
```

需要输出：

- `docs/data-model.md` v0.1-draft。（已输出，后续需要评审和冻结）
- 字段表和关系图。
- P0 建库必需对象、P0 调用系统预留对象与 P1 扩展对象分层。
- Embedding v0.1 存储决策，包括向量维度、模型标识、三类 embedding 的存储方式和重建字段。
- 历史 `AIAnswer` P0 / P1 类型边界曾写为 P0 仅 `retrieval_preview` / `mock_answer`；当前已由 D-071 / D-081 修正为 P0-Z0a `evidence_only_answer`，P0-Z2 或显式 Provider 增强路径允许 `rag_answer`。

冻结门槛：

- P0 输入模型已确认；
- Source Description Card P0 字段已确认；
- Knowledge Unit 最小字段已确认；
- Human Review + Validation 状态流转已确认；
- Embedding v0.1 存储决策已确认；
- P0 manual relation 字段和检索使用方式已确认；
- Text-to-SQL 只读视图边界已确认；
- InvocationRequest、RetrievalPlan、EvidencePack、AIAnswer、Memory 最小字段已确认。

验收标准：

- Text-to-SQL 阶段只能引用当前 `docs/data-model.md` 已定义过的对象和字段；Schema stable 后只能引用冻结版本。
- API 阶段只能围绕当前 `docs/data-model.md` 设计服务边界；Schema stable 后围绕冻结版本实施。
- Source、Source Description、Chunk、Knowledge Unit、ReviewTask、RetrievalLog 的关系清楚。
- data-model v0.1 不能早于 Embedding v0.1 存储决策冻结。
- 调用系统 P0 对象不能等到 P1 才补，否则 Evidence Pack、Citation Preview 和反馈链路无法持久化。

### 阶段 I：定义 Text-to-SQL 第一版可查询 Schema

目标：

将 Text-to-SQL 从技术方向推进到第一版可查询边界。

当前已输出：

```text
docs/text-to-sql.md
```

当前建议 P0 可查询对象：

```text
users
projects
folders
tags
sources
source_descriptions
chunks
knowledge_units
knowledge_unit_tags
knowledge_relations
review_tasks
retrieval_logs
v_knowledge_units_with_tags
v_retrieval_evidence
v_invocation_evidence
```

需要明确：

- 哪些表或对象可被自然语言查询；
- `knowledge_unit_tags` 是否直接暴露，还是通过只读视图暴露；
- `v_knowledge_units_with_tags` 与 `v_retrieval_evidence` 的字段范围；
- `v_invocation_evidence` 如何连接 InvocationRequest、EvidencePack、KnowledgeUnit、Chunk 和 Citation；
- `audit_logs` 默认是否仅供内部审计，不开放给普通 Text-to-SQL；
- 只读 SQL 边界；
- 权限过滤规则；
- SQL 解释面板需要展示什么；
- 查询日志保存哪些字段；
- SQL 结果如何和 RAG 证据链组合。

验收标准：

- 能列出 5-10 个典型自然语言问题及其查询意图。
- 明确第一版只允许 SELECT。
- 明确敏感权限字段必须参与过滤。
- 标签查询、来源证据查询和检索证据查询都能通过 join 表或只读视图稳定表达。

### 阶段 J：定义 API 与工程 P0 边界

目标：

把架构设计推进到可实现的服务边界，但暂不写代码。

当前已输出：

```text
docs/api-design.md
docs/api-implementation-plan.md
```

API 方向：

```text
Source APIs
Knowledge Unit APIs
Folder / Tag APIs
Relation APIs
Review APIs
Retrieval Preview APIs
Invocation APIs（P0-RAG）
Retrieval Plan APIs（P0-RAG）
Evidence Pack APIs（P0-RAG）
Citation Preview APIs（P0-RAG）
Query Explanation APIs（P0-RAG）
Feedback / Memory Draft APIs（P0-RAG）
RAG Answer APIs（P0-RAG；Provider 缺失时 evidence-only fallback）
```

工程 P0 倾向：

```text
1. P0-Core：SQLite 初始化 + sqlite-vec 能力探测 + local_user + 账号预埋 disabled contract
2. P0-File：upload_tasks / upload_parts / files / file_integrity_checks / ProcessingJob（物理表可暂用 ingestion_jobs）/ processing_status_events / sources
3. P0-AI：Parser Router / source_descriptions / parse_tasks / parse_warnings / chunks / chunk_quality_checks / knowledge_units / review_tasks / embeddings
4. P0-RAG：retrieval_logs / evidence_packs / evidence_items / ai_answers；Z0b 补 answer_citations / sensitive_access_grants；Z2 补 invocation_requests / retrieval_plans / memories / retrieval_feedback
5. Upload / text_import 同一入库管线
6. 开源优先 ProviderRegistry；不可用时规则 / Mock / evidence-only fallback
7. 检索链路验证（sqlite-vec 可用时走向量；不可用时走 deterministic score / keyword ranking 降级）
8. metadata_json / tag / status / permission filter
9. Evidence Pack / Citation / Query Explanation / RAG answer fallback
```

说明：

- P0-Z0a 的 retrieval log / Evidence Pack / Evidence Item / evidence-only answer 必须持久化，不能只放在前端临时状态；Invocation / Retrieval Plan / Memory / retrieval_feedback 按 D-085 顺延到 P0-Z2。
- Provider 缺失时不能伪装成功，必须返回可解释 fallback 或错误码。

工程 P0 明确不包含：

```text
1. 真实线上账号 / 多租户 / 团队权限
2. Text-to-SQL 真实模型执行
3. 多 Agent 工具执行
4. LightRAG / GraphRAG 外部引擎依赖
6. 自动实体关系抽取、community detection、Global Search
7. 真实 embedding provider 和真实 reranker
8. 原生 PDF 解析、OCR、生产级任务队列、完整版本回滚、生产级日志 / 安全 / 成本监控
```

注意：

外部提示词要求“先实现 P0”，但当前用户要求是阅读学习并优化计划。因此本阶段只把实现边界写入计划，不开始代码开发。

验收标准：

- API 边界能支撑 P0-A 建库闭环和检索预览。
- API 边界能支撑 P0-B 的 Invocation、Evidence Pack、Citation Preview、Query Explanation 和 Feedback / Memory Draft。
- 工程 P0 不过度设计 UI。
- 实现前已有数据模型、检索策略、Review 状态和验收标准。
- 刷新页面或重新打开项目后，Evidence Pack 与 Citation Preview 仍可复盘，而不是只在前端临时展示。

### 阶段 K：定义知识调用系统 P0 架构

目标：

将 Agent 调用系统从概念推进到可持续优化的架构文档，并明确它与建库系统、数据模型、Text-to-SQL 和 RAG 的关系。

当前已输出：

```text
docs/knowledge-invocation-system-design-plan.md
```

调用系统基线：

```text
1. Task Intake：任务接入
2. Intent + Scope Planning：意图与范围规划
3. Permission + Policy Gate：权限与调用策略检查
4. Query Planning：查询规划
5. Retrieval Orchestration：检索编排
6. Evidence Pack Building：证据包构建
7. Context Composition：Agent 上下文组装
8. Citation Preview / Query Explanation：引用预览与查询解释
9. Citation + Explanation Display：引用展示与调用路径展示
10. Feedback + Memory Loop：反馈与再沉淀
```

需要继续定义：

- `InvocationRequest` 最小字段集；
- `RetrievalPlan` 最小字段集和典型计划模板；
- `EvidencePack` 结构和引用展示规则；
- `AIAnswer` 与 `Memory` 的边界；
- 调用系统 P0 的 Citation Preview 和 `AIAnswer.output_type` 规则；
- 调用系统对象如何进入 `docs/data-model.md`；
- 调用系统 API 如何进入 `docs/api-design.md`。

验收标准：

- 调用系统不退化成普通聊天框；
- 默认调用对象是已确认、可调用、权限允许的 Knowledge Unit；
- Chunk / Source 作为证据和引用，不替代 Knowledge Unit；
- Text-to-SQL 与 RAG 分工清楚；
- Evidence Pack 能解释 Agent 使用了什么知识、证据和查询路径；
- 调用系统 P0 不生成真实 RAG answer；
- AIAnswer / Memory 不能绕过 Review 直接写入长期知识库。

### 阶段 L：吸收 PDF 代码层模块清单优化双模块架构

目标：

在不改变双模块产品结论、不扩大工程 P0 的前提下，将 PDF 中的代码层模块清单转化为文档体系中的架构边界、候选契约和验证项。

本轮输出：

```text
docs/product-architecture.md
docs/architecture-design-plan.md
docs/knowledge-invocation-system-design-plan.md
docs/data-model.md
docs/mvp-scope.md
README.md
docs/progress.md
```

优化重点：

- 在产品总架构中增加横切支撑层。
- 将建库域细化为文件接收、格式校验 / 任务队列、解析、内容清洗、切片质量控制、AI 结构化整理、Review、存储 / 索引 / 审计。
- 将调用域输入扩展为已确认知识、Chunk、Source Description、metadata、tags、relations、retrieval logs、feedback events、quality events 和 version state。
- 将 PDF 里的日志、异常、安全、性能成本、数据维护、版本管理放入横切支撑层，而不是建成第三个业务系统。
- 将新增对象标注为 P0-A optional event、P0-B create_later 或 contract-only，避免误变成第一轮必做代码。

验收标准：

- README、产品总架构、建库架构、调用架构、MVP 范围、数据模型、开发计划和进度记录对 P0 边界说法一致。
- `文件接收与状态反馈`、`文件格式校验`、`任务队列`、`内容清洗`、`切片质量控制`、`AI结构化整理`、`数据维护`、`版本管理`、`日志`、`异常监控`、`安全`、`性能成本` 已进入正确文档。
- 历史验收口径中的“P0 不做 PDF/OCR/真实 embedding/完整 RAG answer”已被 D-066 至 D-072 覆盖；当前 P0 采用开源优先 + 可恢复降级，P0-Z0a 先做 evidence-only answer，P0-Z0b 补齐 chunk quality/source metadata，P0-Z2 再启用 Provider 型 RAG answer。

## 7. 决策记录 Decision Log

此处记录已形成或待确认的关键决策。后续每次产品讨论产生新判断，应更新本节。

| 编号 | 决策问题 | 当前倾向 | 判断依据 | 状态 |
|---|---|---|---|---|
| D-001 | 产品是否拆分为知识库构建系统和知识调用系统 / Agent 调用系统 | 是 | 知识构建与知识调用职责不同，先保证知识资产质量，再做 Agent 使用 | 已确认 |
| D-002 | 当前优先设计哪一部分 | 知识库构建系统工程 P0 优先，知识调用系统架构并行 | 构建质量决定调用质量，但调用系统对象需要提前进入 data-model 草案，避免后续 Evidence Pack、Citation 和 Memory 链路返工 | 已确认 |
| D-003 | 第一版输入类型 | 已更新为 Upload / File Processing + `text_import` 同一入库管线；`text_import` 只是无物理文件输入变体 | 五张架构图确认文件上传、接收、校验、解析是 P0 主流程 | 已更新（D-066 覆盖） |
| D-004 | PDF 是否进入工程 P0 | PDF / Office / 图片 / 音频 / 视频 / 表格进入 P0 架构；通过 Parser Router、开源优先 Provider 和可恢复降级控制风险 | 用户选择“全部进 P0”，但不承诺生产级解析质量 | 已更新（D-066 覆盖） |
| D-005 | Text-to-SQL 第一版是否接真实模型 | 暂不确定，倾向先定义 Schema 和 mock 查询 | 需要先确认可查询对象和安全边界 | 待确认 |
| D-006 | 第一版数据库是否直接使用 PostgreSQL + pgvector | **已调整为 P0 SQLite + sqlite-vec**（参见 D-040） | 桌面应用零安装成本优先；P1 通过 Repository 抽象层迁移 PostgreSQL | 已更新 |
| D-007 | 未确认 Knowledge Unit 是否可被 Agent 默认调用 | 否 | 防止 AI 自动污染长期知识库 | 已确认 |
| D-008 | 是否增加 Source Description Card | 是，作为建库 9 步基线和工程 P0 必备对象 | 可降低 Agent 读取成本，并提供资料级摘要、可信度、权限和 embedding | 已确认 |
| D-009 | 是否区分三类 embedding | 是 | Source Description、Chunk、Knowledge Unit 服务不同检索粒度 | 待确认 |
| D-010 | Review 是否包含质量验证 | 是 | 仅人工确认不足以保证来源、权限、重复、冲突和可检索性 | 待确认 |
| D-011 | AI 自动抽取 Knowledge Unit 是否进入工程 P0 | 进入 P0-AI；优先本地 / 开源 Provider，未配置时规则 / mock 候选抽取；所有输出必须走 Review | P0 需要 AI 结构化整理闭环，但不能绕过用户确认 | 已更新（D-066 覆盖） |
| D-012 | 完整 RAG answer 是否进入工程 P0 | 进入 P0-RAG，但按 D-071 / D-072 分阶段启用：P0-Z0a 只生成 `evidence_only_answer`；P0-Z0b 起展示 chunk quality/source metadata 风险；P0-Z2 或显式 Provider 增强路径生成 `rag_answer`，缺失时继续 `evidence_only_answer` | 用户要求 RAG 和 embedding 进入向量数据库与 P0 闭环；引用和 fallback 是风险边界 | 已更新（D-072 覆盖） |
| D-013 | 数据模型是否先于 Text-to-SQL / API 冻结 | 不直接冻结；先产出 `docs/data-model.md` v0.1-draft，待 Review、Embedding、Relation、Text-to-SQL 只读视图和调用系统最小对象确认后再冻结 v0.1 stable | Text-to-SQL 与 API 都依赖稳定 Schema，但过早冻结会导致调用系统和证据链返工 | 已确认 |
| D-014 | 是否在 P0 引入 LightRAG / GraphRAG 作为依赖 | 否；只吸收多索引、关系扩展和全局 / 局部检索思想 | 开源方案是 RAG / GraphRAG 引擎，不等于本项目的用户确认建库系统 | 已确认 |
| D-015 | 图谱能力分期 | P0 保留 relation / MOC 占位；P1 做 relation expansion；P2 再评估 community summary / Global Search / Neo4j | 避免复杂知识图谱提前压垮建库 MVP，同时保留演进路径 | 已确认 |
| D-016 | P0 不接 AI API 时如何生成摘要、标签、候选 KU 和 embedding | 采用手动 + 规则 + Mock fallback；embedding mock 仅作为 `mock_fixed_384` fallback（dimension=384） | 先验证建库、Review、索引和检索预览链路；当前默认 embedding 口径已被 D-068 更新为 open-source-first profile | 已被 D-068 覆盖 |
| D-017 | data-model v0.1 是否必须晚于 Embedding v0.1 存储决策 | 是；先锁定 embedding_profile、dimension、统一 embeddings 表和重建策略 | 向量维度和 profile 会影响 SQLite BLOB / sqlite-vec 与 P1 pgvector 迁移 | 已确认 |
| D-018 | Text-to-SQL 是否纳入 `knowledge_unit_tags` 和只读视图 | 是；纳入 `knowledge_unit_tags`，并规划 `v_knowledge_units_with_tags`、`v_retrieval_evidence` | 标签类问题和来源证据问题需要稳定 join 边界 | 已确认 |
| D-019 | 知识调用系统是否独立成文档 | 是；新增 `docs/knowledge-invocation-system-design-plan.md` | 知识库构建系统解决知识形成，知识调用系统解决 Agent 如何使用知识，二者职责不同 | 已确认 |
| D-020 | Agent 默认调用对象 | 已确认、可调用、权限允许的 Knowledge Unit | 防止未确认 AI 提取内容污染长期回答，同时让 Chunk / Source 保持证据职责 | 已确认 |
| D-021 | 调用系统 P0 是否直接做最小 RAG answer | 是；P0-Z0a 直接做 `evidence_only_answer`，`rag_answer` 保留为 P0-Z2 / Provider 增强路径；`AIAnswer.output_type` 允许 `rag_answer` / `evidence_only_answer` / `retrieval_preview` / `mock_answer`；D-072 要求 Citation/Query Explanation 展示 chunk quality 和 source metadata 风险 | 新计划选择“全部进 P0”，同时保留 evidence-only fallback 控制模型缺失风险 | 已更新（D-072 覆盖） |
| D-022 | 两个系统是否合并成一个产品 | 是，产品层合并；工程层保留知识构建域和知识调用域；数据层共享 | 两者是同一知识资产闭环的上下游，但读写职责和风险边界不同 | 已确认 |
| D-023 | 是否新增统一产品总架构文档 | 是，新增 `docs/product-architecture.md` | 原有两个架构文档分别覆盖建库和调用，缺少上位产品合并视角 | 已确认 |
| D-024 | Evidence Pack 是否需要证据项级对象 | 倾向是，data-model draft 增加 `evidence_items` | Citation Preview、Query Explanation 和复盘需要保存每条证据的类型、角色、排名和引用关系 | 草案待确认 |
| D-025 | Knowledge Unit 与 Chunk 是否需要显式多对多关系 | 是，data-model draft 增加 `knowledge_unit_chunks` | 一个 KU 可来自多个 Chunk，一个 Chunk 也可支撑多个 KU，显式 join 表更利于引用和 Text-to-SQL | 草案待确认 |
| D-026 | 是否拆出 MVP 范围文档 | 是，新增 `docs/mvp-scope.md` | P0 / P1 / P2 / 暂缓功能需要独立冻结，避免后续实现继续扩大范围 | 已确认 |
| D-027 | 是否拆出 API 设计草案 | 是，新增 `docs/api-design.md` | 数据模型已经成型，后续实现需要 route-level API 边界和 P0 mock 约束 | 已确认 |
| D-028 | 是否拆出 Text-to-SQL 查询契约 | 是，新增 `docs/text-to-sql.md` | data-model draft 已经存在，P0 需要把可查询对象、只读视图、典型 SQL 模板和安全边界固化，避免后续模型或模板实现越权 | 已确认 |
| D-029 | 是否拆出 API route-level 实施计划 | 是，新增 `docs/api-implementation-plan.md` | API 草案需要映射到 route、DTO、service、repository、事务边界和合同测试，后续才能进入技术栈选择与原型开发 | 已确认 |
| D-030 | P0 原型推荐技术栈 | **Electron + React + Vite + TypeScript、FastAPI (sidecar)、SQLite + sqlite-vec**；AI 层使用开源优先 ProviderRegistry，未配置时规则 / mock / evidence-only fallback | 桌面本地优先、零安装数据库和可替换 AI Provider 是当前实现底线 | 已更新 |
| D-031 | PDF 代码层模块清单如何进入双模块架构 | 作为模块 checklist 吸收；新增横切支撑层和候选契约，但不扩大 P0 | PDF 细化了入库、文件处理、AI 结构化整理、维护、日志、安全和性能成本，但其中大量能力属于 P1/P2 或横切治理 | 已确认 |
| D-032 | 知识组织是否作为独立能力层 | 是，提升为知识组织层，位于共享底座之上、两个工程域之间 | PDF 的知识组织系统跨越建库和调用两个域，不应只是建库域的内部步骤 | 已确认 |
| D-033 | AI 能力是否按职责分层 | 是，分为 Building AI（建库侧）和 Invocation AI（调用侧） | PDF 区分了 AI 结构化整理和 AI 智能体，两层上线节奏和评估标准不同 | 已确认 |
| D-034 | 是否引入知识库类型学 | 是，在 projects 表增加 kb_type 字段 | PDF 提出 5 种知识库组织视角，kb_type 可支撑 Text-to-SQL 按知识库类型查询 | 已确认 |
| D-035 | 是否增加知识持续优化机制 | 是，定义触发条件和操作类型，所有优化必须走 Review | 当前 Review 是一次性确认，缺少已确认知识的后续优化设计 | 已确认 |
| D-036 | 前端是否在产品架构中显式定位 | 是，增加前端体验层作为最上层 | PDF 把前端作为一级系统，当前架构缺少前端定位 | 已确认 |
| D-037 | 数据维护如何归属 | 写入型归建库域，记录型归横切支撑层 | 横切支撑层如果能直接修改知识库会违反读写隔离 | 已确认 |
| D-038 | 产品形态 | 桌面软件（非网页应用、非移动 App），面向 macOS / Windows | 用户对数据有完整本地控制权；后续通过 Electron 或 Tauri 封装 | 已确认 |
| D-039 | 桌面框架选型 | **Electron**（P0 推荐），Tauri 作为 P2 评估备选 | Electron 社区成熟、Node.js + Python sidecar 方案可靠、对标 Obsidian / VS Code；Tauri 的 Rust + Python 集成复杂度较高 | 已确认 |
| D-040 | P0 数据库选型 | **SQLite + sqlite-vec**，通过 Repository 抽象层支持 P1 迁移 PostgreSQL + pgvector | 桌面应用零安装成本；P0 可用真实开源 profile 或 mock fallback 验证向量通道，单用户场景并发写入无压力 | 已更新 |
| D-041 | P0 是否拆分子阶段 | 已更新为 P0-Core / P0-File / P0-AI / P0-RAG 四切片 | 五张架构图把上传、文件处理、AI 结构化和 RAG 全部纳入 P0 | 已更新（D-066 覆盖） |
| D-042 | 文档架构与代码架构是否分离 | 是，文档 7 层 ≠ P0 代码 4 层 | 避免文档架构的完整性要求导致代码过度膨胀 | 已确认 |
| D-043 | Embedding 冗余字段是否移除 | 是，source_descriptions/chunks/knowledge_units 的 embedding_id/status/profile 移除，统一通过 embeddings 表的 owner_type + owner_id 查询 | 避免多处维护不一致 | 已确认 |
| D-044 | metadata_json 是否约束用途 | 是，每张表的 metadata_json 必须注明 P0 预期用途；重复出现 3 次以上的属性应提取为独立字段 | 防止 metadata_json 成为逃避 Schema 设计的万能字段 | 已确认 |
| D-045 | retrieval_logs 与 retrieval_plans 关系 | 两者均进入 P0-RAG：`retrieval_logs` 记录实际检索，`retrieval_plans` 记录查询计划和可解释路径 | P0-RAG 要求 Evidence Pack、Citation 和回答可复盘 | 已更新（D-066 覆盖） |
| D-046 | P0-A 是否需要可执行的周计划 | 是，新增 `docs/p0a-execution-plan.md`，定义 4 周周计划、依赖图、Definition of Done、第一条开工命令清单、降级策略 | 文档体系已完整，但缺少"今天先做哪个、下周交付什么"的工程行动指南 | 已确认 |
| D-047 | Schema 演进与数据迁移工具链 | 采用 Alembic（SQLAlchemy 官方迁移工具），支持 SQLite/PostgreSQL 双后端；应用启动时检测 schema 版本并自动备份 + 迁移 + 失败回滚；与 Electron 自动更新协同 | 桌面应用最大风险是用户从 v0.1 升级到 v0.5 时本地数据库 schema 变更必须无损 | 已确认 |
| D-048 | Electron 安全基线 | contextIsolation=true、nodeIntegration=false、sandbox=true、CSP 限制 connect-src 仅本地 sidecar、IPC 输入校验、preload 收敛暴露面、日志脱敏（不含 API Key 和用户原文） | Electron 默认配置下 Renderer 可访问 Node.js，安全基线必须前置 | 已确认 |
| D-049 | API Key 存储方案 | 系统级 Keychain（macOS Keychain / Windows Credential Manager / Linux Secret Service），通过 keytar 或 keyring 库；不允许存储在 SQLite/配置文件/日志；不允许通过 IPC 明文传递到 Renderer | API Key 是用户最敏感的凭据，必须使用操作系统级密钥管理服务 | 已确认 |
| D-050 | AI Provider 抽象层 | P0 采用开源优先 ProviderRegistry；即使运行在 mock/fallback 模式也必须通过 ProviderRegistry 抽象隔离；按能力（embedding/chat/summarization/tag_suggestion/text_to_sql/rerank/OCR/ASR/parser）独立接口；用户可按能力配置不同 provider；支持 fallback 链和网络降级 | P0 不预埋抽象，后续切换本地/开源/商业 Provider 时必然返工 | 已更新 |
| D-051 | 桌面单用户简化 | P0 users 表只有一行（默认 local user，启动时自动创建）；所有业务表的 user_id 字段保留为 P1 多设备 / 云账号预埋；permission 枚举从 6 值简化为 3 值（normal / sensitive / do_not_share），P1 兼容映射回 6 值 | 桌面单用户场景下 6 值权限语义弱化；过早实现多用户增加复杂度 | 已确认 |
| D-052 | Personal Agent 实体预埋 | P0 不实现 agents 表（隐式默认主 Agent），但 data-model §3.6 草案 P1 schema（agents / agent_invocations / agent_memories）；invocation_requests 和 memories 在 P1 通过 Alembic 迁移补充 agent_id 字段 | AGENTS.md 强调本项目是"个人 Agent 的能力底座"，P0 不实现但需预埋 P1 多 Agent 能力 | 已确认 |
| D-053 | 事件类对象分类与统一总线评估 | 保留方案 A：5 张独立事件表（audit_logs / processing_status_events / quality_events / feedback_events / system_logs），通过 §3.7 决策树明确归属；P1 视实际数据量评估方案 B（统一 events 表 + 多态字段） | 5 张表归属边界已经模糊，必须明确决策树；P0 不做合并避免类型安全弱化 | 已确认 |
| D-054 | 测试金字塔与 P0 fixture | P0 必备测试套件扩展为 Upload/File/Parse/AI/RAG 端到端；Contract Test 覆盖 auth disabled、upload part missing、hash mismatch、unsupported parser、OCR/ASR unavailable、RAG provider missing；E2E 覆盖入库到 answer/fallback | 完整 P0 不能再只验 text_import 建库链路 | 已更新（D-066 覆盖） |
| D-055 | permission 跨文档统一为 P0 3 值 | api-design / text-to-sql / knowledge-invocation / data-model 统一为 `normal / sensitive / do_not_share`；旧 6 值请求返回 `invalid_permission_value`；P1 进入多用户场景再扩展回 6 值 | 桌面单用户假设下 6 值权限语义冗余；多文档残留旧枚举会导致实施时分歧 | 已确认 |
| D-056 | SQLite 方言统一适配 | text-to-sql §7 SQL 模板：`= true / = false` → `= 1 / = 0`；`ANY(array)` → `EXISTS (SELECT 1 FROM json_each(col) WHERE value = :param)`；模板内显式标注方言注释 | P0 数据库已锁定 SQLite，PostgreSQL 方言会导致实施失败 | 已确认 |
| D-057 | 桌面系统 API 契约（api-design §16） | 9 组 endpoint：health / system info / data-dir / backups / exports / settings / ai-providers / onboarding；破坏性操作需 confirmation_token；API Key 走 IPC 不走 HTTP；新增 7 个系统层错误码 | 没有桌面系统 API，Renderer 无法完成健康检查 / 备份 / 设置 / Onboarding 等关键操作 | 已确认 |
| D-058 | Repository 抽象层接口契约（api-implementation-plan §11） | 命名约定 + 接口签名（Protocol + dataclass）+ UnitOfWork 事务边界 + 异步策略（aiosqlite/asyncpg）+ 异常转化映射 + SQL 方言适配点矩阵 + Fake Repository 测试约定 + P1 PostgreSQL 迁移检查清单 | P0 SQLite 与 P1 PostgreSQL 双后端必须共享同一组接口，否则 P1 迁移大面积返工 | 已确认 |
| D-059 | 冻结清单统一 | mvp-scope §10 / technical-stack §11 / data-model §11 三处冻结项同步同一份清单，按"技术栈/数据模型/权限与 Agent/API 契约/产品包装"5 个分类；清单条数随决策递增（当前 technical-stack §11 为 **27** 条，含 D-063） | 三处冻结清单出现版本不一致会让冻结失去意义 | 已确认 |
| D-060 | P0 Personal Agent 占位规则 | invocation_requests / memories 字段 `agent_id` 在 P0 schema-only 预埋为 nullable，写入值固定 null；显式传 ID 返回 `agent_not_supported_in_p0`；业务代码统一通过 `current_agent_id_or_null()` 读取；P1 切换时 Alembic 批量回填主 Agent ID | D-052 已预埋 P1 schema，但 P0 业务侧需要明确占位规则避免硬编码 null | 已确认 |
| D-061 | 错误处理与可观测性策略 | P0-Core 必须有错误 envelope（含 request_id）+ 核心错误码 + UI 消息映射 + 基础日志；P0-File/P0-AI/P0-RAG 追加上传、解析、Provider 和 RAG fallback 错误码 | 完整 P0 必须让失败可恢复、可解释、可复盘 | 已更新 |
| D-062 | 产品命名与品牌冻结时机 | P0-Core W1 前至少敲定开发期应用名 / Bundle ID / Product ID / 数据目录名 / Keychain service 名占位；正式品牌、正式 Bundle ID、正式图标在外部分发前冻结 | Bundle ID 一旦发布不可更改；数据目录名涉及未来迁移；Keychain service 名涉及历史 Key 访问；但正式命名不应阻塞工程骨架 | 已更新 |
| D-063 | Embedding / RAG / 向量存储形态 | **主库混合**：向量写入 `embeddings` 表，SQLite **BLOB** + **sqlite-vec** 做相似度检索，与 FTS5、Text-to-SQL、元数据过滤等组合为 **混合检索**；P0 **不**引入独立向量数据库；P0-RAG 生成 RAG answer / evidence-only fallback。P1 优先 **PostgreSQL + pgvector** 一库迁移；独立向量引擎仅在有强需求时再评估 | 用户确认采用 hybrid_sqlite；与 AGENTS.md「MVP 不过早引入独立向量库」一致 | 已更新 |
| D-064 | P0-Core / P0-File / P0-AI / P0-RAG 切片 | P0-Core 保证骨架和账号预埋；P0-File 保证上传与文件状态；P0-AI 保证解析、KU、Embedding；P0-RAG 保证证据、回答/fallback 和回流 | 四切片取代 P0-A Core / Shell 裁剪，成为第一轮工程节奏 | 已更新（D-066 覆盖） |
| D-065 | RAG + Embedding 向量库执行口径 | `docs/rag-pipeline.md` 明确 P0-AI 必须建设 `embeddings` 表、`EmbeddingRepository`、向量序列化和 `VectorStoreService` 抽象；sqlite-vec 只允许运行时降级，不能取消向量层；P0-RAG 进入 Evidence Pack、Citation、RAG answer / evidence-only fallback | 用户明确需要用 RAG 和 embedding 做向量数据库；必须把“向量层必须存在”和“独立向量服务暂不引入”区分开 | 已更新 |
| D-066 | 五张架构图后的完整 P0 升级 | 将用户系统预埋、入库系统、文件处理系统、AI 结构化、Embedding、向量检索、RAG 和用户记录全部纳入 P0；旧 P0-A / P0-B 口径仅保留为历史记录 | 用户明确要求“根据这些优化架构”并确认“全部进 P0 / 账号预埋 / 开源优先 / 桌面本地优先” | 已确认 |
| D-067 | 三张技术选型图后的 P0 默认工具栈 | P0 默认 Uppy + tus-style upload、SSE、local filesystem + S3-compatible adapter、local_sqlite_worker、PyMuPDF/pdfplumber、PaddleOCR/Whisper optional、pandas/Pandera、KeyBERT/HanLP/spaCy、bge-m3、bge-reranker-v2；ProviderRegistry 扩展为 capability registry，所有 provider 缺失必须记录 capability_status 与 fallback_reason | 三张图提供上传、队列、解析、多模态、清洗、Embedding、Rerank、RAG、Text-to-SQL 技术矩阵；需要落成可执行默认栈而不是抽象能力名称 | 已确认 |
| D-068 | 实现前契约收紧 | `mock_fixed_384` 改为 fallback profile；384 维只属于该 fallback；Provider capability status 统一为 `available / fallback / unavailable / disabled / error`；`local_sqlite_worker` 和 SSE 补齐 lock、heartbeat、retry、`event_seq`、`Last-Event-ID`；`api-implementation-plan` 不再指向 mock-only embedding | 评审发现 embedding profile/dimension、provider status、SSE/worker 状态机和旧实施计划存在分叉；进入代码前必须先统一 | 已确认 |
| D-069 | File Inspection 层 | 上传完成后、Parser Router 前新增 File Inspection：真实类型识别、编码检测、静态安全检查、结构识别和预览生成；新增 `file_inspection_results` 和 inspect/preview API；blocked/quarantined 文件默认不进入 parse；预览不参与 RAG citation | 三张图补充了 libmagic/python-magic、charset-normalizer、qpdf、oletools、exiftool、Pillow、openpyxl、FFmpeg、ClamAV、Docker Sandbox、Docling/LayoutParser 等文件处理细节；必须落成 P0 可恢复、安全优先的检查层 | 已确认 |
| D-070 | P0-Z0 实现竖切收紧 | 完整 P0 保留为架构范围，但代码实现按 P0-Z0 / P0-Z1 / P0-Z2 波次推进；P0-Z0 只要求 local_user → upload/text_import → inspect/parse/chunk → KU Review → embed job → evidence-only answer；`ingestion_jobs` 泛化为 `target_type/target_id + file_id/source_id nullable`；通用 Job Events API 统一为 `/api/jobs/{id}/events`；sensitive evidence 必须有一次性授权；当前执行口径由 D-071 细化为 P0-Z0a/Z0b | 当前方案 P0 对象过多，若第一批 migration 全建会拖慢工程骨架；inspect/preview 发生在 Source 之前，旧 job 模型不够；API 状态流和 sensitive 授权也需实现前冻结 | 已确认；D-071 细化 |
| D-071 | P0-Z0a/Z0b 与 ProcessingJob 收紧 | P0-Z0 拆为 P0-Z0a blocking 骨架和 P0-Z0b 同周补齐；`ProcessingJob` 成为领域名，物理表可暂用 `ingestion_jobs`；固定 job 状态机、active job 幂等和 `force=true` 规则；新增 `sensitive_access_grants` 的 scope_hash、TTL、一次性使用和撤销约束；P0-Z0a 的 `POST /api/rag/answers` 只返回 `evidence_only_answer`，不调用 LLM | 评审发现 P0-Z0 对象仍偏重、`ingestion_jobs` 命名承载过多职责、敏感授权只有 ID 没有契约、RAG 容易过早进入 LLM；需在实现前切薄第一刀 | 已确认 |
| D-072 | 知识切片质量闭环与安全运维横切层 | chunk build 固定为输入接收 → FileInspection/Parser 输出消费 → 切片策略判断 → 结构恢复 → 文本语义/结构化/多模态切片 → 上下文补充 → 元数据标注 → 来源绑定 → 质量检查；Z0b 补 `chunk_strategy_profile`、`context_summary`、`source_metadata`、`chunk_quality_checks`；日志、异常监控、数据安全、性能成本、系统稳定性进入 P0 本地横切支撑，默认不依赖外部 APM | 新图明确 chunk 质量不只是“切一段文本”，还要解决长文本、主题混杂、语义断裂、上下文缺失和来源不可追溯；同时 P0 需要本地可恢复、可诊断、可审计的安全运维闭环 | 已确认 |
| D-073 | 实现前契约去重与单一来源收敛 | `parse_warnings` 和 `chunk_quality_checks` 字段只保留一个权威定义；`processing_status_events.event_type` 以 data-model 为唯一枚举来源；Provider capability API 增加 chunk_strategy / semantic_chunking / context_enrichment / chunk_quality_eval；`/api/system/status` 增加 window、status_reason 和阈值；测试拆成 Z0a/Z0b 两级验收 | D-072 后评审发现同一对象多处重复定义、event_type 泛化枚举与具体事件冲突、Z0a 测试误要求 Z0b 字段、capability API 漏掉 chunking 能力、system status 缺统计口径 | 已确认 |
| D-074 | 切片前准备层与结构化整理检查门 | chunk build 前新增输入完整性、OCR/版面、内容类型、策略匹配、结构恢复、结构完整性、metadata/source binding 检查；`chunks.metadata_json` 记录 preparation/profile/status 摘要；`chunk_quality_checks` 扩展 input/ocr/strategy/structure/binding 维度；Provider capability 增加 token_counting、structure_recovery、document_layout、table_structure、html_xml_structure、academic_paper_structure；结构化整理每步写 provider/fallback/quality 记录 | 新图把“切片”前的准备和检查门拆细，如果不提前写入契约，代码实现会直接从 parse text 跳到 split text，导致 OCR、版面、结构、来源绑定和结构化整理质量无法诊断 | 已确认 |
| D-075 | 切片检查门与 ProcessingJob 契约收敛 | `check_gate` 与 `chunk_quality_checks.check_type` 建立权威映射；`chunks:build` 调整为 job-first；`chunk_summary` 补 `check_summary` / `capability_summary` / `fallback_reasons`；Provider 家族增加 `provider_type=system/local_adapter/mock/commercial`，mock 不再承担真实 `chunk_quality_eval`；测试策略要求早期失败也可通过 job/event 恢复 | D-074 后评审发现检查门命名双轨、ProcessingJob 创建过晚、API 摘要过薄、mock 与系统规则能力混淆、Z0a 检查可见性不足；进入代码前必须收敛 | 已确认 |
| D-076 | 切片执行 Profile 与工具矩阵收敛 | `chunk_type` 固定为 `text_semantic / structured_table / image_ocr / audio_transcript / video_scene / mixed`；`chunk_execution_profile` 只作为 `ChunkBuildService` 内部执行 profile；LangChain、LlamaIndex、sentence-transformers、CLIP/BLIP/Florence、Table Transformer 只作为 P1/P2 adapter；`source_binding_status` 不表达索引状态 | D-075 后如果继续把每个切片工具升级为平台层或 capability，会引入过早复杂度；本轮需要在不新增表、endpoint、migration、OpenAPI 的前提下收敛执行口径 | 已确认 |
| D-077 | AI 结构化整理 Profile 与质量门 | `structured_organization` profile 固定为内容理解、摘要生成、关键概念抽取、结构化字段生成、知识卡片生成、分类标签和关系建议；质量门固定为 `topic_understanding / summary_quality / concept_extraction / schema_mapping / card_normalization / tag_consistency / relation_suggestion`；P0 默认 Pydantic、JSON Schema、Jinja2、Markdown、YAML Frontmatter、KeyBERT、YAKE、spaCy/HanLP 和规则模板；LLM/LlamaIndex/LangChain/Instructor/BGE/BERTopic/Neo4j/NetworkX/RDFlib 仅为增强 adapter | 新图把 AI 结构化整理从“抽取 KU”拆成可诊断的多步质量链；若不收敛 profile 和质量门，代码实现会把摘要、标签、关系建议混在一起，无法解释 provider 缺失、字段失败或关系误判 | 已确认 |
| D-078 | D-077 实现边界收敛 | Z0a/Z0b 的结构化整理质量异常先写 `processing_status_events` 和 `knowledge_units.metadata_json.structured_organization.quality_scores`；`quality_events` 和 `knowledge_relations` 保持 P0-Z1 对象；关系候选只写 `review_tasks.target_type=relation_suggestion` + `payload_json`；`system_rules` provider family 显式包含 `relation_suggestion` | Review 发现 D-077 文档会让 W4 依赖 Z1 表，且 relation suggestion 缺少候选存储模型；需要在实现前把首批 migration 与候选关系写入边界压实 | 已确认 |
| D-079 | 结构化整理与存储映射收敛 | D-077 顶级链路不变；标签生成、分类整理、字段映射、卡片类型、实体候选和三元组候选写入 `structured_organization` 子字段；`review_tasks.target_type` 补齐 `tag_suggestion / relation_suggestion / knowledge_card`；结构化整理事件收敛为 `structured_organization_started/completed/warning/failed`；数据库存储系统按逻辑职责映射到 `files`、`sources/chunks`、metadata_json/tags、`embeddings`、`review_tasks`、`feedback_events/audit_logs`、`processing_jobs/events` | 新图提供了更细的 AI 结构化整理和数据库存储模块，但如果直接新增 step、表或独立数据库会破坏 D-077/D-078 边界；因此本轮只补子字段、事件和存储映射，不改变 P0 技术栈 | 已确认 |
| D-080 | 知识库调用、AI 智能体与前端交互收敛 | 调用系统补齐 `query_understanding_profile / retrieval_strategy_profile / ranking_profile / citation_trace_profile / feedback_signal`；问题类型路由到 FTS5/BM25、向量、metadata、source/file index 或 hybrid search；关系分析只用 confirmed relation 或 relation suggestion 证据；P0 Agent 固定为 `implicit_agent`；前端固定 Electron + React + Vite + TypeScript + SSE + Toast/Error Boundary/Loading Skeleton | 新图把知识调用、结果排序、引用溯源、反馈闭环、AI 智能体和前端页面拆细；如果直接新增 Agent 执行平台、GraphRAG、Learning-to-Rank、WebSocket 或新 endpoint，会扩大 P0，因此本轮只收敛 profile、响应示例和 UI 状态契约 | 已确认 |
| D-081 | P0-Z0a / P0-Z2 调用持久化边界修正 | P0-Z0a 只必须持久化 `retrieval_logs`、`evidence_packs`、`evidence_items`、`ai_answers(output_type=evidence_only_answer)`；`invocation_requests`、`retrieval_plans`、`memories`、`retrieval_feedback` 进入 P0-Z2 或作为提前实现的可选增强 | 评审发现 D-080 后 API 验收和 W5 计划仍把 Invocation / Retrieval Plan 拉回 Z0a，会扩大首批 migration 和实现面 | 已确认 |
| D-082 | InvocationProfileSchema v1 | 固定 `profile_envelope`、`rewrite_status`、`relation_evidence` route、`source_reliability_score` / `source_reliability_label` 区分，以及 query / strategy / ranking / citation / feedback 的最小字段 | 评审发现 profile 过度依赖散落 JSON，且来源可信度同时作为数值和枚举出现，容易导致 DTO、测试和前端漂移 | 已确认 |
| D-083 | FrontendStateContract 与 feedback_policy | 前端状态统一为 upload / file_processing / chunking / extraction / embedding / retrieval / rag_answer / citation / feedback 的状态矩阵；反馈默认 local_only + current_project scope，权重有上限，不能自动改写 confirmed knowledge | 评审发现前端契约偏页面清单，反馈闭环缺少隐私、作用域和反污染边界 | 已确认 |
| D-084 | D-081-D083 跨文档同步 | 将调用持久化边界、`InvocationProfileSchema v1`、`feedback_policy` 和前端状态契约同步到 RAG、产品总架构、MVP、Provider、Text-to-SQL、可观测性和 README；不新增表、endpoint、OpenAPI 或运行时代码 | 二轮检查发现部分入口文档仍停留在 D-080 口径，容易让后续实现误把 Invocation / Retrieval Plan 持久化拉回 Z0a | 已确认 |
| D-085 | Z0a 调用锚点与反馈 / citation 边界修正 | Z0a 的 Evidence / Answer 以 `retrieval_log_id` 和 `evidence_pack_id` 为锚点，`request_id` / `retrieval_plan_id` 可为空；Z0a RAG response 返回 `evidence_item_ids`、`citation_labels` 和 `citation_trace_summary`，不要求持久化 citation 明细 ID；Z0a feedback 只允许 response-only 或 append-only `feedback_events`，Z2 才写 `retrieval_feedback` | Review 发现 D-081 调用边界与 `evidence_packs.request_id` / `retrieval_plan_id`、`ai_answers.request_id`、Z0a 持久化 citation 明细和 feedback 双口径之间仍存在实现冲突；需要在首批 migration 前修正 | 已确认 |
| D-086 | 后续 Agent 项目背景说明书 | 新增 `docs/project-background-brief.md`，作为 README 和领域主文档之间的接手说明，汇总项目定位、用户、非目标、核心原则、当前架构、P0 切片、冻结技术选择、数据对象速览、推荐阅读顺序、过期口径和后续 Agent 工作原则 | 文档体系已经很大，后续 Agent 容易只读单一细节文档而误解项目背景或拉回过期 P0-A / text_import-only / 独立向量库口径 | 已确认 |
| D-087 | 本地 Git 管理基础 | 初始化本地 Git 仓库，默认分支 `main`；新增 `.gitignore`、`.gitattributes` 和 `docs/git-management.md`；忽略本地临时文件、密钥、数据库、上传资料、日志、构建产物和模型权重；本轮不创建 commit、不配置 remote、不推送 | 项目即将从文档架构进入工程实现，需要在首个代码骨架前建立版本基线、敏感文件排除策略和后续协作规则 | 已确认 |
| D-088 | README 对齐后的技术栈优化 | `docs/technical-stack-and-prototype-plan.md` 升级为 v0.18；根据 README 入口口径新增 P0-Z0a 最小可执行栈、完整 P0 扩展栈、P1/P2 后置栈；明确首批工程以 Electron / React / FastAPI / SQLite / local worker / SSE / Evidence Pack / evidence-only answer 跑通闭环，Provider 和高级检索能力按波次接入 | README 已成为后续 Agent 的主要入口，如果技术栈文档只保留完整工具矩阵，后续实现容易把 OCR/ASR/reranker/GraphRAG/独立向量库等可选或后置能力误认为首批必装依赖 | 已确认 |
| D-089 | GitHub private repo 上传 | 创建 GitHub private repo `ChenchenChen001/ai-database-product`，绑定为 `origin`，并推送 `main` 首个文档基线提交；仓库保持 private，不公开 | 用户要求上传到 GitHub 且不公开；当前文件体量可直接 Git 推送，PDF 约 5MB，暂不需要 Git LFS | 已确认 |
| D-090 | 技术栈执行优化 | `docs/technical-stack-and-prototype-plan.md` 升级为 v0.19，`docs/p0a-execution-plan.md` 与 `docs/testing-strategy.md` 升级为 v0.17，`docs/project-background-brief.md` 升级为 v0.2；工程开工口径固定为 `uv + pyproject.toml` 依赖分组、`pnpm + Zustand` 前端状态、sqlite-vec capability probe、File Inspection Z0a/Z0b 分层、optional Provider 后置和 evidence-first RAG | 用户要求“执行优化”；需要把前一轮技术栈优化意见转成后续代码工程可直接照做的依赖、状态、能力探测、测试和命令约束，而不是停留在建议层 | 已确认 |
| D-091 | 技术栈工程化验收门槛 | `docs/technical-stack-and-prototype-plan.md` 升级为 v0.20，`docs/p0a-execution-plan.md` 与 `docs/testing-strategy.md` 升级为 v0.18，`docs/project-background-brief.md` 升级为 v0.3；首批工程必须通过最小依赖 CI gate、Provider lazy-load、Electron sidecar 生命周期、typed fetch/error envelope、sqlite-vec 三态一致性和 evidence-first 不变量 | 当前技术栈已经确定，下一步风险不在选型，而在实现时把可选依赖、sidecar 崩溃、错误处理和无来源回答漏成隐性缺陷；需要在开工前把这些风险变成可测试 gate | 已确认 |
| D-092 | 代码骨架前置契约优化 | `docs/technical-stack-and-prototype-plan.md` 升级为 v0.21，`docs/p0a-execution-plan.md` 与 `docs/testing-strategy.md` 升级为 v0.19，`docs/data-model.md` 升级为 v0.20-draft，并同步 API、桌面、Provider、可观测性、RAG 和项目背景文档；首批工程骨架前必须冻结 OpenAPI → TypeScript 类型生成、sidecar 打包验证 spike、Provider manifest、trace chain、migration 波次命名、SQLite 1K/10K 性能基线、Zustand store slices 和 Evidence Pack 失败态 | 下一步若直接创建代码，很容易把 DTO、provider import、trace、migration、前端状态和失败态散落实现；需要在写骨架前先把这些跨模块契约变成单一执行口径和测试口径 | 已确认 |
| D-093 | 桌面运行时硬化 | `docs/technical-stack-and-prototype-plan.md` 升级为 v0.22，`docs/desktop-architecture.md` 升级为 v0.5，`docs/p0a-execution-plan.md` 与 `docs/testing-strategy.md` 升级为 v0.20，`docs/api-implementation-plan.md` 升级为 v0.19-draft，`docs/error-handling-and-observability.md` 升级为 v0.8，`docs/ai-provider-architecture.md` 升级为 v0.14；W1/W2 必须验证 sidecar local auth、Main 注入式 typed API、SQLite 数据保护、worker 隔离、runtime status bar、Provider 设置面板和最小诊断包 | 用户明确强调这是电脑软件开发；当前技术栈无需更换，但必须把 localhost 安全、数据目录、数据库保护、后台任务、打包态路径和本地诊断前置，否则容易做成只能开发态运行的 Web+API 原型 | 已确认 |
| D-094 | P0-Core 桌面工程骨架开工契约 | `docs/technical-stack-and-prototype-plan.md` 升级为 v0.23，`docs/desktop-architecture.md` 升级为 v0.6，`docs/p0a-execution-plan.md` 与 `docs/testing-strategy.md` 升级为 v0.21，`docs/api-implementation-plan.md` 升级为 v0.20-draft，`docs/error-handling-and-observability.md` 升级为 v0.9，`docs/project-background-brief.md` 升级为 v0.6；下一轮代码阶段必须先建立 desktop-main / desktop-preload / renderer / api 职责边界、runtime_state、preload API surface、P0-Core API skeleton 和 `smoke:p0-core` | D-093 已说明运行时风险，但还需要把第一批目录、命令、状态机、API 顺序和禁止先做的业务功能压成开工契约，防止下一轮直接做上传、RAG 或聊天 UI 而缺少可验证桌面骨架 | 已确认 |
| D-095 | 架构审查实现验收强化 | `docs/technical-stack-and-prototype-plan.md` 升级为 v0.24，新增 §2.8 / §11.6：`docs/project-background-brief.md` 升级为 v0.7；README 同步引用 | 前序 review 识别开发态全绿但打包失败、向量降级导致无来源回答、SQLite 锁争用、DTO 漂移与日志撑盘等实现期风险；需在文档层与 D-090～D-094 并列冻结为验收子条款 | 已确认 |
| D-096 | 分布式开发计划 | 新增 `docs/distributed-development-plan.md` v0.1；`docs/project-background-brief.md` 升级为 v0.8；README、`docs/development-plan.md` 和 `docs/progress.md` 同步引用；将下一阶段代码实现拆成 S0 Runtime Desktop Core、S1 API Contract、S2 Data and Migration、S3 Worker and Job Events、S4 Ingestion and Knowledge Build、S5 Retrieval and Evidence、S6 Renderer Workspace、S7 Verification and Release，并固定依赖图、分支 / PR 计划、文件所有权和 G0-G5 gate | 当前架构和技术栈已经足够进入 P0 代码阶段，下一步风险来自多人 / 多 Agent / 多工作流并行时的契约漂移、文件冲突和验收顺序错位；需要把分工计划写成可执行文档，同时明确 P0 不改成分布式运行时 | 已确认 |
| D-097 | 分布式开发计划优化 | `docs/distributed-development-plan.md` 升级为 v0.2；`docs/project-background-brief.md` 升级为 v0.9；README、`docs/development-plan.md` 和 `docs/progress.md` 同步引用；新增二次技术栈 / 架构审查结论、runtime / API / data / evidence 四类共享契约锁、集成节奏、失败态优先实现顺序、关键路径与并行窗口、PR 准入 / 退出标准、冲突处理顺序、文档所有权、G6/G7 gate 和风险登记 | D-096 已完成工作流拆分，但仍偏静态分工；并行开发真正的风险在共享契约、集成节奏和 PR 退出标准，需要把“谁能改什么、什么时候合并、失败时先修哪里”写成可执行规则 | 已确认 |
| D-098 | 前端页面信息架构与工作台契约收敛 | `docs/product-architecture.md` 升级为 v0.15；固定 Knowledge Workspace 八个内部路由 `/dashboard`、`/import`、`/library`、`/search`、`/ask`、`/graph`、`/outputs`、`/settings`；同步调用系统、技术栈、桌面架构、API、测试策略、分布式开发计划、项目背景说明书、README 和进度记录 | 用户提供 8 个核心页面信息架构图；需要在开写 Renderer 前把页面职责、后端域映射、状态边界、Graph/Outputs P0 占位和 evidence-first 约束冻结，避免后续做成 landing page、普通 ChatGPT clone 或无来源装饰图谱 | 已确认 |
| D-099 | 前后端交付边界与分布式开发计划强化 | `docs/distributed-development-plan.md` 升级为 v0.4；`docs/project-background-brief.md` 升级为 v0.11；README、`docs/development-plan.md` 和 `docs/progress.md` 同步引用；明确 Electron Main / Preload bridge / Renderer / typed API client / FastAPI sidecar / worker / SQLite 的职责边界，新增 D-099 前后端交付模板、禁止事项、S1/S6 handoff、G8 Frontend / Backend Boundary Gate 和边界漂移风险 | 用户要求再次审查技术栈和架构并优化分布式开发计划；D-098 已固定页面，但仍需要把“前端怎么接后端、哪些东西不能在 Renderer 做、mock 如何不漂移”写成可验收协作规则 | 已确认 |
| D-100 | P0 代码阶段首轮实现 | 新增 monorepo 工程骨架、FastAPI sidecar、SQLite 初始化、P0-Core API、OpenAPI/generated TS types、Electron Main / preload、Renderer 八页低保真 shell、typed fetch、Zustand store slices、P0-Z0a text import / review / evidence-only smoke 和验证脚本；`docs/progress.md`、README 与本文档同步 | 用户要求根据开发计划执行开发并分阶段验收；当前文档已足够进入代码阶段，应优先跑通 P0-Core 和 Z0a，而不是继续停留在文档-only 状态 | 已完成 |
| D-101 | P0-File 上传与 File Inspection Z0a | 新增 Upload / File API、上传分片记录、local_fs 临时与 sources 存储、sha256 完整性校验、File Inspection Z0a、`smoke:p0-file` 和 `/import` `/library` 真实 file 状态接入 | D-100 已通过 P0-Core / Z0a smoke，下一阶段应先保证文件接收、状态与检查可恢复，再进入 Parser Router 和 Source/Chunk | 已完成 |
| D-102 | Parser Router / Source / Chunk Z0a | 新增 parse task、parse warning、chunk quality check、file parse API、source list/detail API、`smoke:p0-parse` 和 Library Source 面板；低风险文本类文件可解析成 Source / Chunk | D-101 已能接收和检查文件，下一步必须把文件对象显式转换为可引用 Source / Chunk，同时保持 KU/Embedding 后置 | 已完成 |
| D-103 | Candidate KU / Review / fallback embedding Z0a | 新增 knowledge extract API、KU list/detail API、384 维 `mock_fixed_384` fallback embedding、Review 队列接入、`smoke:p0-ku` 和 Library Extract / Review 面板；parsed Source / Chunk 可进入 pending_review 候选链路 | D-102 已生成 Source / Chunk，下一步必须进入“AI 推荐 → 用户确认”闭环，但仍不能绕过 Review 写 confirmed knowledge | 已完成 |
| D-104 | Retrieval Preview / Search-Ask Integration Z0a | 新增 `POST /api/retrieval/preview`、`GET /api/evidence-packs/{id}`、`smoke:p0-search-ask`，并把 Renderer `/search` `/ask` 接入真实 confirmed KU / Evidence Pack / evidence-only answer 状态；无证据返回 `no_retrieval_result` | D-103 已能产出 confirmed KU，下一步必须把调用侧接到真实证据包，但仍不接 provider-backed RAG、Memory Draft、feedback、Text-to-SQL provider 或 GraphRAG | 已完成 |
| D-105 | Citation Detail / Evidence Pack Replay Z0b-lite | 扩展 `GET /api/evidence-packs/{id}` detail response，返回 KU / Chunk / Source / query explanation / provider fallback 的可渲染 citation detail；Renderer `/search` `/ask` 增加内嵌 Open detail / replay 面板；新增 `smoke:p0-citation-detail` | D-104 已有 Evidence Pack 摘要和 Search / Ask 真实接入，下一步必须让用户能复盘“答案用了哪些证据、证据来自哪里”，但仍不进入 feedback、Memory Draft、真实 LLM 或新表 | 已完成 |
| D-106 | UI i18n / Bilingual Settings Z0b-lite | 新增 `GET /api/settings`、`PATCH /api/settings`、`smoke:p0-i18n-settings`，后端用 app data `config.json` 持久化 `language`；Renderer 八页低保真 shell 改为默认中文、可切换英文，并保留普通浏览器无 bridge 的 session fallback | 当前工作台已有真实 Search / Ask / Citation Detail，但 UI 文案仍是硬编码英文；需要先用轻量 i18n 隔离文案，为后续 UI 设计稿替换保留空间，同时不扩张到真实 LLM 或新路由 | 已完成 |
| D-107 | Feedback Events / Memory Draft Review Z0b-lite | 新增 `POST /api/feedback`、`POST /api/memory-drafts`、`GET /api/memory-drafts`、`GET /api/memory-drafts/{id}`、`smoke:p0-feedback-memory`；Renderer `/ask` 提交反馈和保存 Memory Draft，`/library` 审核 memory，`/outputs` 复盘草稿 | D-106 已完成双语界面和 settings 持久化，下一步补齐证据回答的最小回流闭环，但 feedback 只 append-only，Memory 必须经过 Review | 已完成 |
| D-108 | Feedback Diagnostics / Event Replay Z0b-lite | 新增 `GET /api/feedback`、`GET /api/feedback/summary`、`smoke:p0-feedback-diagnostics`；Renderer `/outputs` 内嵌 Feedback Diagnostics 面板，展示事件列表、过滤、聚合摘要、query 和 citation 上下文 | D-107 已能记录 append-only feedback，但用户还需要复盘事件和目标绑定；本阶段只读诊断，不写 `retrieval_feedback`，不影响 ranking，不改 confirmed knowledge | 已完成 |
| D-109 | Desktop Runtime Smoke / Pseudo-Packaged Sidecar Z0b-lite | 新增 `KB_DESKTOP_SMOKE=1` 与 `smoke:p0-desktop-runtime`；验证已 build Electron Main / Preload、renderer preview、FastAPI sidecar、preload bridge、local token、受保护 API、非空 Renderer 和 clean shutdown | D-108 后业务 smoke 已覆盖 API 链路，但桌面应用仍缺少真实 Electron bridge / sidecar 生命周期验收；需要把 D-092/D-095 的 pseudo-packaged sidecar spike 落成可重复 smoke | 已完成 |
| D-110 | Feedback Diagnostics Export Z0b-lite | 新增 `GET /api/feedback/export`、`smoke:p0-feedback-export`；Renderer `/outputs` Feedback Diagnostics 面板支持 JSON / CSV 当前筛选导出，后端返回脱敏 content、summary、filters、record_count 和导出元数据 | D-108 已能查看反馈诊断，下一步需要本地导出事件与摘要用于复盘；本阶段只读导出，不写 `retrieval_feedback`，不影响 ranking，不泄露 source text / answer text / token / path | 已完成 |
| D-111 | Feedback Diagnostics Advanced Filters / Export History Z0b-lite | 扩展 feedback list / summary / export filters；新增 `GET /api/feedback/export-history`、`DELETE /api/feedback/export-history/{id}`、`smoke:p0-feedback-filters-history`；Renderer `/outputs` 支持高级过滤和导出历史 metadata 复盘 | D-110 已能导出当前筛选诊断，但用户还需要按时间、关键词、ranking effect、comment 状态复盘，并查看最近导出记录；本阶段只保存脱敏 metadata，不保存导出正文，不写 `retrieval_feedback` | 已完成 |
| D-112 | Citation Detail Focus / Evidence Trace Interaction Z0b-lite | 扩展 Evidence Pack detail focus、`detail_summary`、trace path、copy-safe payload；Renderer `/search` `/ask` 支持 citation detail 聚焦、过滤、排序、上一条/下一条和复制；新增 `smoke:p0-citation-focus` | D-105 已能复盘证据详情，但用户还需要在 Search/Ask 中聚焦单条证据、查看 trace path 并复制可检查引用轨迹；本阶段只增强复盘交互，不改 ranking、不新增表、不接真实 LLM | 已完成 |
| D-113 | Citation Annotation / Evidence Compare Z0b-lite | 新增 `citation_annotations`、annotation CRUD API、同 pack evidence compare API、Citation Detail 批注 / 对比面板和 `smoke:p0-citation-annotate-compare` | D-112 已能聚焦和复制引用轨迹，下一步补齐用户对 evidence item 的本地复盘批注与同 pack 证据对比；批注持久化但不写 feedback，compare 只读不持久化 | 已完成 |
| D-114 | Knowledge Space / Folder-Tag / Metadata Filters Z0b-lite | 新增 Project / Folder / Tag API、Folder-Tag Mirroring、`source_tags` / `knowledge_unit_tags` join 表、Source/KU organization patch、Source/KU list 与 Retrieval Preview / evidence-only 的 `project_id` / `folder_id` / `tag_ids` 过滤、Library Organization 面板、Search/Ask 组织过滤条和 `smoke:p0-space-tag-metadata` | D-113 后 citation replay 已可复盘，但知识资产仍缺少项目 / 文件夹 / 标签组织与真实过滤；本阶段补齐组织 metadata，不做任意 metadata JSON 编辑器、关系图谱、真实 LLM、provider-backed RAG、reranker 或 GraphRAG | 已完成 |
| D-115 | Knowledge Unit / Project Export Z0b-lite | 新增 KU Markdown/JSON 导出、Project ZIP envelope、`/outputs` Knowledge Export 面板、`smoke:p0-knowledge-export` 和 OpenAPI/generated types | D-114 后已有 project/folder/tag 组织过滤，下一步需要把 confirmed KU 和项目知识资产以本地下载形式带出；本阶段只生成脱敏导出内容，不保存导出历史，不做备份/还原或云同步 | 已完成 |
| D-116 | Knowledge Export History / Replay Z0b-lite | 新增 `GET /api/exports/history`、`DELETE /api/exports/history/{id}`、`config.json.knowledge_export_history`、`/outputs` Knowledge Export History 面板和 `smoke:p0-knowledge-export-history` | D-115 已能生成知识资产下载内容，下一步需要复盘最近导出 metadata 并复用过滤条件；本阶段只保存脱敏 metadata，不保存导出正文，不新增 SQLite 表 | 已完成 |
| D-117 | Packaged Runtime Static Renderer / Sidecar Artifact Spike Z0b-lite | 新增静态 renderer dist 加载、preload / sidecar artifact path override、app data sidecar log、file/hash route 兼容和 `smoke:p0-packaged-runtime` | D-109 仍依赖 Vite preview；D-117 将桌面运行时验收推进到安装器前 artifact 形态，但仍不做真实签名、自动更新、正式安装器或 PyInstaller 完整产物 | 已完成 |
| D-118 | Citation / Organization / Export Batch Actions Z0b-lite | 新增批量 Source/KU organization API、批量 citation annotation API、Library 批量绑定、Citation Detail 批量批注、Knowledge Export KU 多选导出和 `smoke:p0-batch-actions` | D-114/D-115/D-113 已具备单条组织、导出和批注能力；下一步补齐低保真批量操作体验，但不新增表、不改 ranking、不写 feedback signal | 已完成 |
| D-119 | Text-to-SQL Template / Structured Query Preview Z0b-lite | 新增规则模板版 `/api/text-to-sql/preview`、`/search` SQL Trace 面板和 `smoke:p0-text-to-sql` | D-114 组织过滤和 D-104 retrieval 已可用，下一步补齐只读结构化查询预览；本阶段不接真实 Text-to-SQL provider、不开放 SQL 编辑器、不改 retrieval ranking | 已完成 |
| D-120 | UI Interaction Polish / Design-Ready Shell Z0b-lite | 新增 route summary、bridge degraded 横幅、统一 state chip 文案、响应式低保真 shell CSS 和 `smoke:p0-ui-polish` | D-119 后 P0 功能面板密度已高，进入正式设计稿前需要先整理可替换交互壳层；本阶段不改 API schema、主路由或业务语义 | 已完成 |

## 8. 架构验收清单

后续每次更新 `docs/architecture-design-plan.md`，应检查以下内容。

### 8.1 对象边界

- 是否清楚区分 Source、Source Description、Chunk、Knowledge Unit？
- 是否说明 Source Description 是资料级摘要，不替代原文和知识单元？
- 是否说明一个 Knowledge Unit 可来自一个或多个 Chunk？
- 是否说明 Chunk 服务证据检索，Knowledge Unit 服务知识调用？
- 是否说明 Source 是来源证据，不等同于知识资产？

### 8.2 建库流程

- 是否覆盖 9 步：接入、解析、来源说明、切分/抽取、分类映射、多索引、关系/MOC、确认/验证、入库/反馈？
- 是否明确失败状态和重试入口？
- 是否明确 AI 推荐与用户确认的边界？
- 是否明确确认后的知识何时可被 Agent 调用？

### 8.3 来源与审计

- 是否能从 Knowledge Unit 回溯到 Source / Chunk？
- 是否保留 Source Description？
- 是否保留 AI 推荐理由？
- 是否保留用户确认状态？
- 是否记录关键修改历史？
- 是否考虑权限和敏感内容？

### 8.4 多索引与 RAG

- 是否区分 Source Description Embedding、Chunk Embedding、Knowledge Unit Embedding？
- 是否实现或规划 metadata / status / folder / tag filter？
- 是否避免只做 vector search？
- 是否说明 Chunk 证据检索和 Knowledge Unit 知识检索的关系？
- 是否规划 relation expansion 和 rerank 的阶段边界？
- 是否说明 LightRAG / GraphRAG 只是参考，不是 P0 依赖？
- 是否把 community summary / Global Search 放在 P2 而不是 P0？
- 是否先完成 Embedding v0.1 存储决策，再冻结 data-model v0.1？
- 是否明确 P0 mock embedding 只验证链路，不承诺真实语义质量？

### 8.5 Text-to-SQL 适配

- 是否明确哪些字段必须结构化？
- 是否避免把关键字段只放进自然语言文本？
- 是否定义可查询对象？
- 是否包含 `knowledge_unit_tags` 或等价只读视图？
- 是否说明 `audit_logs` 默认仅内部审计，不开放给普通 Text-to-SQL？
- 是否说明 SQL 安全边界？
- 是否考虑查询日志和查询解释？

### 8.6 Review 与质量验证

- 是否覆盖 source_check、citation_check、type_check、duplicate_check、conflict_check、permission_check、retrieval_check、agent_use_check？
- 是否明确 `confirmed`、`pending_review`、`outdated`、`do_not_use` 的检索边界？
- 是否说明用户如何请求重新分类或补充来源？

### 8.7 MVP 控制

- 是否把完整 P0 明确切成 P0-Core / P0-File / P0-AI / P0-RAG？
- 是否把工程 P0 聚焦在 `Upload / text_import → File → Source → Parse → Chunk → KU → Review → Embedding → Retrieval → Evidence → Answer/Fallback`？
- 是否避免把生产级云账号、团队协作、复杂图数据库、多 Agent 工具执行提前放进工程 P0？
- 是否明确 AI 抽取、OCR/ASR、Embedding、RAG answer 均通过开源优先 ProviderRegistry 与 fallback 控制风险？
- 是否明确 Provider 缺失时的 `auth_not_enabled_in_p0`、`unsupported_parser`、`ocr_unavailable`、`asr_unavailable`、`rag_provider_missing` 等错误和可恢复状态？
- 是否为后续 P1 留出扩展口？

### 8.8 知识调用系统

- 是否清楚区分 InvocationRequest、RetrievalPlan、EvidencePack、AgentContext、AIAnswer 和 Memory？
- 是否说明 Text-to-SQL 与 RAG 的分工？
- 是否避免把全库向量 top-k 作为默认调用路径？
- 是否说明权限、状态和用户确认对调用范围的影响？
- 是否说明 Evidence Pack 如何组织 Knowledge Unit、Chunk、Source 和 Relation？
- 是否说明调用结果如何带引用、带查询解释，并回流到 Review？
- 是否明确调用系统 P0-RAG 会输出 RAG answer 或 evidence-only fallback？
- 是否按 D-081 区分 P0-Z0a 必建对象（retrieval_logs / evidence_packs / evidence_items / ai_answers evidence-only）与 P0-Z2 补齐对象（invocation_requests / retrieval_plans / memories / retrieval_feedback）？

## 9. 文档拆分路线

当前 `docs/architecture-design-plan.md` 是知识库构建系统主架构文档，不是完整产品总架构文档。随着内容增长，按以下条件拆分。

| 触发条件 | 拆分文档 | 内容 |
|---|---|---|
| 两个系统需要合并为一个产品表达 | `docs/product-architecture.md` | 产品总架构、工程域边界、共享底座、读写隔离、P0 闭环 |
| MVP 范围出现 P0 / P1 / 暂缓功能细节 | `docs/mvp-scope.md` | 输入类型、功能优先级、工程 P0 / 产品 P0 / P1 边界 |
| 进入 Text-to-SQL 或 API 设计前 | `docs/data-model.md` | 知识库构建对象、调用系统 P0 预留对象、embeddings、retrieval_logs、audit_logs、只读视图 |
| Text-to-SQL 示例和安全边界变复杂 | `docs/text-to-sql.md` | 可查询 Schema、示例问题、SQL 安全、查询解释 |
| API 边界开始细化 | `docs/api-design.md` | Source、Knowledge Unit、Folder/Tag、Relation、Review、RAG APIs |
| API 进入 route-level 实施映射 | `docs/api-implementation-plan.md` | route、DTO、service、repository、事务边界、mock 模块和合同测试 |
| 技术栈和原型启动边界需要明确 | `docs/technical-stack-and-prototype-plan.md` | P0 推荐技术栈、目录结构、实施切片、数据库迁移顺序、验证命令 |
| 页面和用户流程开始细化 | `docs/information-architecture.md` | 页面结构、导航、Review Queue 工作流 |
| RAG 与检索策略单独展开 | `docs/rag-pipeline.md` | chunk、embedding、multi-index、hybrid retrieval、citation、feedback |
| 开源 RAG / GraphRAG 调研需要沉淀 | `docs/open-source-rag-research.md` | LightRAG、GraphRAG、Neo4j、LlamaIndex 的可借鉴机制、风险和分期边界 |
| Agent 调用系统需要独立主线 | `docs/knowledge-invocation-system-design-plan.md` | Invocation Request、Retrieval Plan、Evidence Pack、Agent Context、Citation Preview、Memory Loop |

拆分原则：

- README 只保留入口和高层状态。
- `product-architecture.md` 保留产品总架构，不替代建库系统和调用系统细节文档。
- `architecture-design-plan.md` 保留知识库构建系统主线。
- 完整产品架构由知识库构建系统文档、知识调用系统文档、开发计划、数据模型和 API 文档共同表达。
- 细节文档拆出后，需要在 README 和本计划中补索引。

## 10. 验证方式

### 10.1 当前文档验证

使用：

- `rg --files`
- `rg` 检查关键术语
- `sed` 或 `tail` 抽查文档内容

当前验证重点：

- `README.md`、`docs/project-background-brief.md`、`docs/git-management.md`、`docs/development-plan.md`、`docs/progress.md`、`docs/architecture-design-plan.md` 是否存在；
- `.gitignore` 是否忽略本地临时文件、密钥、数据库、上传资料、日志、构建产物和模型权重；`.gitattributes` 是否固定 Markdown 行尾与 PDF / 图片二进制处理；
- `docs/product-architecture.md` 是否存在并表达一个产品、两个工程域和共享底座；
- `docs/data-model.md` 是否存在并包含 v0.1-draft 字段表、关系图、只读视图和冻结门槛；
- `docs/mvp-scope.md` 是否存在并锁定 P0 / P1 / P2 / 不做范围和验收标准；
- `docs/api-design.md` 是否存在并定义 P0 建库、Review、Retrieval Preview、Invocation、Evidence Pack、Citation Preview 和 Feedback API；
- `docs/text-to-sql.md` 是否存在并定义 P0 查询契约、白名单对象、典型 SQL 模板和 SQL 安全边界；
- `docs/api-implementation-plan.md` 是否存在并定义 route-level 实施映射、事务边界和合同测试清单；
- `docs/technical-stack-and-prototype-plan.md` 是否存在并定义 P0 推荐技术栈、原型目录、实施切片和验证命令；
- `docs/knowledge-invocation-system-design-plan.md` 是否存在并记录知识调用系统主线；
- `docs/open-source-rag-research.md` 是否存在并记录引用来源；
- `Source Description Card`、`Multi-indexing`、`Review Queue`、`Validation`、`source_descriptions`、`embeddings`、`retrieval_logs` 是否纳入计划；
- `LightRAG`、`GraphRAG`、`community summary`、`relation expansion`、`Global Search` 是否被明确放入正确阶段；
- `P0 AI 能力替代策略`、`mock embedding`、`knowledge_unit_tags`、只读视图是否被明确纳入计划；
- `Invocation Request`、`Retrieval Plan`、`Evidence Pack`、`Agent Context`、`AIAnswer`、`Memory` 是否纳入调用系统文档；
- `Citation Preview`、`Query Explanation`、`AIAnswer.output_type`、`v_invocation_evidence` 是否纳入调用系统 P0 与 data-model v0.1 计划；
- `knowledge_unit_chunks` 和 `evidence_items` 是否进入 data-model 草案并解释其必要性；
- README、开发计划、进度记录、架构文档是否状态一致。

### 10.2 后续代码阶段验证

进入代码实现后，应按技术栈补充：

- lint；
- typecheck；
- unit tests；
- build；
- smoke test；
- 数据库迁移验证；
- 基础端到端建库链路验证。

### 10.3 MVP 验收闭环

后续 MVP 至少应能验证：

```text
1. 用户创建项目
2. 用户创建文件夹
3. 系统自动生成 folder mirror tag
4. 用户通过 text_import 输入 / 粘贴 Markdown 或 Plain Text，并设置 source_origin
5. 系统解析 source
6. 系统生成 source description
7. 系统生成 chunks
8. 系统生成 embeddings（open-source profile 或 fallback profile）
9. 用户手动或系统创建 knowledge unit
10. knowledge unit 继承 folder mirror tags
11. 用户确认 knowledge unit
12. 用户提问
13. 系统用 tag + metadata_json + vector profile / fallback ranking 检索验证管线
14. 系统返回 Evidence Pack + Citation Preview / RAG answer 或 evidence-only answer，并展示来源、知识单元和可引用证据
15. 用户可将检索结果或回答沉淀为新的候选 knowledge unit
```

注意：

```text
`mock_fixed_384` fallback 只验证写入、查询、排序和引用链路；
不能作为语义相关性或召回质量验收。
真实语义召回质量必须在 `bge_m3_local` 或其他真实 provider 可用后单独评估。
```

## 11. 风险与待确认

### 11.1 产品风险

- 建库系统和 Agent 调用系统边界可能继续调整。
- 如果产品层合并后工程边界消失，调用系统可能绕过 Review 直接写入主知识库。
- 如果 P0 输入范围过大，会拖慢核心链路验证。
- 如果用户确认流程过重，会降低产品可用性。
- 如果 AI 推荐缺少解释，用户难以信任建库结果。
- Source Description Card 如果写得过重，可能变成重复摘要负担。
- PDF 代码层模块如果不分期，会把 P0 扩大成完整文件处理、AI 自动整理和运维平台。

### 11.2 技术风险

- Text-to-SQL 是核心技术主线，但过早接真实模型会增加安全和调试复杂度。
- 数据库表设计过早固化，会限制后续产品理解演进。
- 字段过多会拖慢 MVP，字段过少会削弱结构化查询。
- 未确认知识进入默认检索范围，会污染 Agent 回答。
- 三类 embedding 会增加实现复杂度，需要明确生成时机和缓存策略。
- 如果未在 data-model 前冻结 embedding 维度和存储方式，后续 sqlite-vec 存储和 P1 pgvector 迁移都容易返工。
- mock embedding 只能验证链路，不能代表真实语义召回质量。
- 过早引入 GraphRAG / 图数据库会把 P0 从建库系统拖成复杂检索引擎。
- 知识调用系统如果过早变成普通聊天框，会弱化 Knowledge Unit、证据包和引用解释。
- 知识调用系统 P0 如果混入最小 RAG answer，会重新扩大为生成系统，导致 Evidence Pack 和引用预览没有先被验证。
- data-model v0.1 如果不预留调用系统对象，后续 Invocation、Evidence Pack、Citation 和 Feedback 链路会再次返工。
- Memory 如果绕过 Review 直接写入，会形成长期记忆噪音。
- 任务队列、版本、日志、安全和性能成本如果直接进入第一轮运行时实现，会推迟核心知识资产闭环验证。

### 11.3 进入代码前仍需冻结的问题

以下问题不再影响 P0 范围判断，但会影响首版迁移和 OpenAPI schema 的最终形态：

- Knowledge Unit 最小字段是否在首版迁移中加入 `aliases`、`value_illustrations`、`domain_context`，还是继续放入 `metadata_json`。
- P0 manual relation 的 UI 操作入口和 retrieval preview 中的 relation evidence 展示粒度。
- Text-to-SQL P0 模板清单是否固定为 3-5 个高频只读查询，真实模型继续作为 P1 provider eval。
- Citation Preview / Query Explanation 首版展示哪些 provider capability、quality warning 和 fallback reason。
- 开发期应用名、Bundle ID、Product ID、数据目录名和 Keychain service 占位值。

## 12. 当前推荐的下一步

下一步建议优先完成：

1. 保持 `smoke:p0-core` → `smoke:p0-desktop-runtime` → `smoke:p0-packaged-runtime` → `smoke:p0-i18n-settings` → `smoke:p0-ui-polish` → `smoke:p0-file` → `smoke:p0-parse` → `smoke:p0-ku` → `smoke:p0-space-tag-metadata` → `smoke:p0-text-to-sql` → `smoke:p0-knowledge-export` → `smoke:p0-knowledge-export-history` → `smoke:p0-search-ask` → `smoke:p0-citation-detail` → `smoke:p0-citation-focus` → `smoke:p0-citation-annotate-compare` → `smoke:p0-batch-actions` → `smoke:p0-feedback-memory` → `smoke:p0-feedback-diagnostics` → `smoke:p0-feedback-export` → `smoke:p0-feedback-filters-history` → `smoke:p0-z0a` 的本地 gate，避免后续 UI shell、settings、AI / Retrieval / Feedback / Organization / Text-to-SQL / Export 改动破坏 runtime、Electron bridge、packaged artifact、OpenAPI、SQLite、upload、parse、KU/Review、space/tag metadata、structured query preview、knowledge export、knowledge export history、evidence contract、citation detail replay、citation focus、citation annotation/compare、batch actions、memory review、feedback replay、导出脱敏和 export history 边界。
2. 下一阶段可继续收敛真实安装器 / PyInstaller sidecar binary spike，或进入正式 UI 设计稿替换 / 组件拆分前的第二轮交互 polish；Memory 仍不得绕过 Review 进入 confirmed。
3. 若继续桌面打包方向，下一步应验证 electron-builder 最小配置、PyInstaller sidecar artifact 或安装器前资源清单，但仍不引入真实签名、自动更新或正式品牌资源。
4. 若进入第二轮 UI 优化，保持当前 design tokens / route shell / feature 边界不变，用设计稿替换视觉层而不改后端契约。
