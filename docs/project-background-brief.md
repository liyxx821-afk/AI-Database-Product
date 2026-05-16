# 项目背景说明书

版本：v0.4
日期：2026-05-17  
状态：供后续 Agent 快速接手使用的项目背景入口；已同步 D-090 技术栈执行优化口径、D-091 工程化验收门槛与 D-092 代码骨架前置契约；不替代 `README.md`、`docs/product-architecture.md`、`docs/data-model.md` 或 `docs/p0a-execution-plan.md`

## 1. 本说明书的用途

这份文档面向后续接手本仓库的 Agent，用来在几分钟内理解：

- 这个项目为什么存在；
- 它不是哪些产品；
- 当前文档已经冻结了哪些关键架构判断；
- 后续实现时应该优先读取哪些文档；
- 哪些旧口径已经过期，不能再作为实现依据。

本仓库当前仍是**产品与架构文档仓库**，尚未进入运行时代码实现阶段。任何后续 Agent 在创建工程代码、migration、OpenAPI 或运行时模块前，应先阅读本说明书、`README.md`、`docs/development-plan.md`、`docs/progress.md` 和对应领域主文档。

## 2. 一句话定位

本项目是一个面向专业内容创作者的 **AI 个人知识资产系统**。

它帮助用户把分散的材料、笔记、项目经验、对话、研究记录、文档、图像和创作过程，转化为结构化、可检索、可溯源、可复用、可被个人 Agent 长期调用的知识资产。

核心判断：

```text
未来每个人都会拥有自己的个人 Agent；
个人 Agent 的能力基础不是单次对话，而是个人数据库和个人知识库。
```

## 3. 目标用户与真实问题

目标用户是专业内容生产者，尤其包括：

- 技术开发者：管理代码、技术文档、项目决策、Debug 记录和长期工程记忆。
- 设计师：管理案例、灵感、项目 brief、材料工艺、视觉参考和设计叙事。
- 影视 / 媒体从业者：管理剧本、分镜、影像参考、制作笔记和风格系统。
- 自媒体 / 知识创作者：管理选题、脚本、账号策略、复盘记录和内容模板。

这些用户的问题不是“没有地方存文件”，而是：

1. 材料分散在不同格式和项目中；
2. 旧资料难以被重新理解和调用；
3. 文件夹和笔记只能保存材料，不能稳定生成可复用知识；
4. AI 回答容易失去来源、引用和项目上下文；
5. 有价值的回答、判断和创作经验没有沉淀为长期记忆；
6. 个人 Agent 缺少可以查询、过滤、引用和复盘的知识底座。

## 4. 这个项目不是什么

不要把本项目降级为：

- 普通 AI 聊天工具；
- 文件管理器或网盘；
- Obsidian 克隆；
- 纯笔记应用；
- 简单向量库 Demo；
- “上传文件然后聊天”的 RAG toy app；
- 企业文档归档系统；
- 全自动多 Agent 工作流平台。

本项目的重点是：

```text
资料收集
→ 知识整理
→ 关系建立
→ 选题 / 想法生成
→ 内容创作
→ 作品复盘
→ 资产沉淀
```

AI 在本项目中的角色是辅助建库和调用知识，而不是绕过用户确认自动决定知识结构。

## 5. 产品核心原则

### 5.1 知识库优先于数据库

数据库是底层存储和查询方式，产品真正构建的是个人知识库。后续实现不要只围绕表和文件建模，而要围绕知识如何形成、确认、组织、调用和更新建模。

### 5.2 Knowledge Unit 优先于文件

文件、PDF、图片、网页、对话记录只是 Source。系统真正要沉淀的是 Knowledge Unit。

Knowledge Unit 可以是：

- 概念；
- 事实；
- 观点；
- 方法；
- 原则；
- 案例；
- 证据；
- 决策；
- 偏好；
- 问题；
- 任务；
- 模板。

### 5.3 Review-first

AI 可以发现、推荐、摘要、分类、提取关系，但重要知识、标签、关系、长期记忆和可调用资产都应支持用户确认、修改、忽略、合并、拆分或归档。

默认流程：

```text
AI 发现
→ AI 推荐
→ 用户确认 / 修改
→ 系统固化
→ Agent 调用
```

### 5.4 来源可追溯

任何声称来自用户知识库的回答、总结、建议或创作草稿，都必须尽量展示：

- 使用了哪些 Knowledge Unit；
- 来自哪些 Source / File；
- 对应哪些 Chunk；
- 页码、段落、text span 或其他位置；
- 哪些内容是证据，哪些是模型推理。

预览图、摘要和知识卡片只能作为辅助视图，不能替代 Source / Chunk / Knowledge Unit citation。

## 6. 当前产品架构

当前总架构已经收敛为：

```text
AI 个人知识资产系统
├── 前端体验层
├── 知识构建域
├── 知识组织层
├── 知识调用域
├── AI 能力栈
├── 共享底座
└── 横切支撑层
```

### 6.1 前端体验层

负责桌面工作台体验，包括：

- AI 工作台首页；
- 项目选择；
- 上传资料；
- 文件管理；
- 知识库；
- 对话 / RAG；
- 引用与查询解释；
- 数据可视化入口；
- 设置页。

P0 默认 Electron + React + Vite + TypeScript，配合 SSE、Toast、Error Boundary、Loading Skeleton、React Context 或 Zustand。

### 6.2 知识构建域

负责把用户输入材料变成可确认的知识资产。

主流程：

```text
Upload / Text Import
→ File Receiving / Status Feedback
→ File Inspection
→ Parser Router
→ Parse / Clean
→ Chunk Build
→ Chunk Quality Check
→ Knowledge Unit Extract
→ AI Structured Organization
→ Review
→ Confirmed Knowledge Unit
→ Embedding / Index
```

### 6.3 知识组织层

负责标签、分类、关系、MOC、Folder-Tag Mirroring 和知识库持续优化。

关键原则：

- Folder 表达主归属和默认上下文；
- Tag 表达多重归属和横向检索；
- Relation 表达知识之间的支持、反驳、派生、示例、依赖、替代等关系；
- MOC 用于主题级或项目级知识地图；
- 分类体系采用固定层 + 生长层。

### 6.4 知识调用域

负责让个人 Agent 使用已确认知识。

主流程：

```text
User Query / Creation Task
→ Query Understanding Profile
→ Retrieval Strategy Profile
→ Retrieval Log / Plan Summary
→ Keyword + Vector + Metadata + Relation Retrieval
→ Ranking Profile
→ Evidence Pack
→ Citation Trace Profile
→ Evidence-only Answer / RAG Answer
→ Feedback Signal
```

P0-Z0a 默认 evidence-only answer。配置 LLM 后，P0-Z2 或增强路径才生成 citation-bound RAG answer。

### 6.5 AI 能力栈

AI 能力通过 ProviderRegistry 和 profile 接入，不把单一供应商硬编码到业务逻辑。

P0 原则：

- 开源优先；
- 本地优先；
- Provider 可选；
- 能力缺失必须 graceful fallback；
- fallback 要记录 `capability_status` 和 `fallback_reason`。

### 6.6 共享底座

共享底座包括：

- SQLite 主库；
- sqlite-vec 向量索引；
- FTS5 全文检索；
- metadata JSON；
- 标签 / 文件夹 / 项目索引；
- ProcessingJob；
- processing status events；
- review tasks；
- audit logs / system logs。

### 6.7 横切支撑层

横切层覆盖：

- 账号预埋；
- 权限与敏感资料；
- 文件安全与风险检查；
- 日志；
- 错误处理；
- 诊断报告；
- 性能成本；
- 队列和任务恢复；
- 本地备份 / 恢复 / 删除 / 隐私设置 contract。

## 7. P0 四条实现切片

旧的 P0-A / P0-B 口径已经过期。当前 P0 使用四条切片：

```text
P0-Core：桌面骨架、本地用户、项目空间、ProcessingJob、状态事件、基础表
P0-File：上传、文件接收、File Inspection、解析、预览、Parser Router
P0-AI：切片、质量检查、KU 提取、AI 结构化整理、Review、Embedding
P0-RAG：检索、Evidence Pack、Citation Trace、evidence-only answer、feedback 边界
```

实现波次进一步拆成：

- **P0-Z0a**：首批 blocking 竖切，只跑通最小端到端链路。
- **P0-Z0b**：同周补齐账号预埋明细、分片恢复、source description、citation 明细、sensitive grant、审计日志和前端状态契约。
- **P0-Z1**：补增强 parser、质量事件、关系、结构化质量治理。
- **P0-Z2**：补 Invocation Request、Retrieval Plan、Memory Draft、provider RAG answer、retrieval feedback 和更完整调用复盘。

## 8. 当前冻结的关键技术选择

### 8.1 桌面本地优先

P0 产品形态是桌面软件，不是 SaaS Web。

默认技术：

- Electron；
- React + Vite + TypeScript；
- FastAPI sidecar；
- SQLite 本地数据库；
- 本地文件系统 + StorageAdapter；
- SSE 状态流。

### 8.2 SQLite + sqlite-vec + FTS5

P0 不引入独立向量数据库服务。

默认检索结构：

```text
SQLite 主库
├── 结构化表
├── metadata JSON
├── FTS5 全文检索
└── sqlite-vec 向量索引
```

P1 首选迁移目标是 PostgreSQL + pgvector。Qdrant、Milvus、Chroma、Weaviate 等独立向量服务不进入 P0 默认依赖。

### 8.3 RAG 不是数据库本身

RAG 是检索、证据组装、引用和生成流程。Embedding + Vector Index 才是向量层。后续实现不能把 RAG 当成“向量数据库”的同义词。

### 8.4 账号预埋，不阻塞 P0

P0 默认创建 `local_user`。注册、登录、Token、角色、访问策略等只做 disabled contract，相关写接口返回 `auth_not_enabled_in_p0`。

### 8.5 文件与来源分工

`files` 是物理文件对象，记录上传、存储路径、hash、MIME、风险、预览等。

`sources` 是语义来源对象，记录用户知识库中可被解析、切片、引用和组织的来源。

不要把二者混成一个概念。

### 8.6 File Inspection 在 Parser Router 前

上传完成后，必须先进入 File Inspection：

```text
true type detection
→ encoding detection / normalization
→ security scan / risk policy
→ structure detection
→ preview generation
→ Parser Router
```

Parser Router 不应只依赖扩展名或前端声明 MIME。

### 8.7 Chunk Build 是 job-first

`POST /api/sources/{source_id}/chunks:build` 应返回 ProcessingJob。除 source / 权限同步校验外，input、OCR、strategy、structure、source binding 等检查都通过 job event 和 quality check 表达。

### 8.8 Z0a 调用锚点

D-085 已修正调用域边界：

- P0-Z0a 的 Evidence / Answer 以 `retrieval_log_id` 和 `evidence_pack_id` 为锚点；
- `request_id` 和 `retrieval_plan_id` 在 Z0a 可为空；
- Z0a RAG response 返回 `evidence_item_ids`、`citation_labels`、`citation_trace_summary`；
- Z0a 不要求持久化 citation 明细 ID；
- `invocation_requests`、`retrieval_plans`、`memories`、`retrieval_feedback` 在 P0-Z2 补齐。

### 8.9 Feedback 不能污染知识真值

Z0a feedback 只能是 response-only summary 或 append-only `feedback_events`。

Z2 才写 `retrieval_feedback`，且必须携带 `feedback_policy`。用户反馈只影响排序建议和诊断，不自动修改 confirmed Knowledge Unit、confirmed relation 或 source truth。

## 9. 当前默认工具栈

P0 默认工具方向：

| 能力 | P0 默认 / 优先 | P1/P2 方向 |
|---|---|---|
| 上传 | Uppy + tus-style chunk upload | WebSocket 双向事件 |
| 状态反馈 | SSE + `event_seq` / `Last-Event-ID` | WebSocket |
| 存储 | local filesystem + StorageAdapter | MinIO / S3 / R2 |
| 队列 | `local_sqlite_worker` | Celery + Redis / Temporal |
| 类型识别 | libmagic / python-magic，fallback 文件头和扩展名 | 更强安全扫描 |
| 编码 | charset-normalizer，chardet 备选 | 更复杂清洗 |
| 安全 | qpdf / oletools / EXIF adapter，静态检查 | ClamAV / Docker Sandbox |
| PDF | PyMuPDF / pdfplumber | Unstructured / Docling / Tika |
| Office / 表格 | openpyxl / pdfplumber | Camelot / Tabula / Polars |
| OCR | PaddleOCR optional，Tesseract 兜底 | 商业视觉模型 |
| ASR | Whisper optional | FunASR / 云 ASR |
| 视频 | FFmpeg 元数据和封面 | PySceneDetect / Video-LLaVA |
| 清洗 | pandas + Pandera | Polars / DuckDB |
| 标签 | KeyBERT / HanLP / spaCy / YAKE | LLM tagging |
| Embedding | bge-m3 local optional | jina / OpenAI / VoyageAI provider |
| Rerank | bge-reranker-v2 optional | Jina / Cohere |
| RAG | 自研 Hybrid Retrieval + Evidence Pack + Citation | LlamaIndex / LangChain adapter |
| Text-to-SQL | 只读模板 / 受控 SQL 解释 | Vanna / DB-GPT adapter |

## 10. 数据对象速览

后续实现优先关注这些对象：

### 10.1 用户与权限

- `user_profiles`
- `auth_identities`
- `roles`
- `access_policies`

P0 只做账号预埋和 disabled behavior。

### 10.2 入库与文件

- `upload_tasks`
- `upload_parts`
- `files`
- `file_integrity_checks`
- `file_inspection_results`
- `processing_jobs`
- `processing_status_events`

### 10.3 Source / Chunk / KU

- `sources`
- `chunks`
- `chunk_quality_checks`
- `knowledge_units`
- `review_tasks`

### 10.4 标签、关系和结构化整理

- `tags`
- `knowledge_unit_tags`
- `knowledge_relations`（P0-Z1 后确认关系）
- `review_tasks.payload_json` 中的 `tag_suggestion`、`relation_suggestion`、`knowledge_card`
- `knowledge_units.metadata_json.structured_organization`

### 10.5 向量、检索和 RAG

- `embeddings`
- `retrieval_logs`
- `evidence_packs`
- `evidence_items`
- `ai_answers`
- `answer_citations`（Z0b+）
- `sensitive_access_grants`（Z0b+）
- `invocation_requests`（Z2）
- `retrieval_plans`（Z2）
- `retrieval_feedback`（Z2）
- `memories`（Z2）

### 10.6 安全运维

- `audit_logs`
- `system_logs`
- `feedback_events`
- `processing_status_events`

## 11. 后续 Agent 推荐阅读顺序

### 11.1 快速接手

1. `AGENTS.md`
2. `README.md`
3. `docs/project-background-brief.md`
4. `docs/development-plan.md`
5. `docs/progress.md`

### 11.2 做产品架构判断

1. `docs/product-architecture.md`
2. `docs/mvp-scope.md`
3. `docs/architecture-design-plan.md`
4. `docs/knowledge-invocation-system-design-plan.md`

### 11.3 做数据模型或 migration

1. `docs/data-model.md`
2. `docs/api-design.md`
3. `docs/api-implementation-plan.md`
4. `docs/testing-strategy.md`

### 11.4 做 RAG / Embedding / Text-to-SQL

1. `docs/rag-pipeline.md`
2. `docs/text-to-sql.md`
3. `docs/knowledge-invocation-system-design-plan.md`
4. `docs/ai-provider-architecture.md`

### 11.5 做桌面应用工程骨架

1. `docs/desktop-architecture.md`
2. `docs/technical-stack-and-prototype-plan.md`
3. `docs/p0a-execution-plan.md`
4. `docs/error-handling-and-observability.md`

### 11.6 做测试

1. `docs/testing-strategy.md`
2. `docs/api-implementation-plan.md`
3. `docs/data-model.md`
4. `docs/p0a-execution-plan.md`

## 12. 后续实现的第一条工程路线

当前推荐下一步不是继续扩文档，而是进入 P0-Z0a 工程骨架：

```text
Electron + React + Vite + TypeScript shell
→ FastAPI sidecar
→ SQLite schema migration
→ local_user / project / upload-or-text-import
→ File Inspection stub
→ parse / chunk / KU review
→ embedding job with fallback profile
→ retrieval log
→ Evidence Pack
→ evidence-only answer
```

首批 migration 应按 `docs/data-model.md` v0.20-draft 冻结，不要把 Z0b / Z1 / Z2 对象全部拉进第一批 blocking 实现；D-092 的 `trace_id` 与 Evidence Pack `failure_type` 进入首批可追踪字段。

## 13. 常见误区和过期口径

### 13.1 P0-A / P0-B 是历史口径

当前已替换为：

```text
P0-Core / P0-File / P0-AI / P0-RAG
```

如果文档历史记录中出现 P0-A / P0-B，只能作为历史背景，不作为当前实现边界。

### 13.2 `text_import only` 已过期

`text_import` 现在只是统一入库管线的一种输入方式。文件上传、解析、OCR/ASR optional、AI 结构化、Embedding 和 RAG 都进入完整 P0 架构。

### 13.3 Mock 不是默认 AI 能力

P0 是 open-source-first adapter contract + graceful fallback。Mock / rule-based profile 用于链路验证和能力缺失 fallback，不能写成唯一实现目标。

### 13.4 GraphRAG 和图数据库不进入 P0 默认依赖

P0 可使用已确认关系或 relation suggestion 证据，但不引入 Neo4j、NebulaGraph、LightRAG、GraphRAG 作为默认依赖。

### 13.5 LLM 不阻塞 Z0a

P0-Z0a 必须在 LLM 缺失时仍能完成：

```text
规则切片
→ 来源绑定
→ 基础质量检查
→ hybrid retrieval
→ Evidence Pack
→ evidence-only answer
```

### 13.6 反馈不是事实修正

用户反馈可以影响排序建议、诊断和后续 Review，但不能自动修改 confirmed knowledge、confirmed relation 或 source truth。

## 14. 后续 Agent 工作原则

后续 Agent 在本仓库工作时应遵守：

1. 先确认当前任务是文档-only、架构评审，还是开始工程代码实现。
2. 不要在没读 `docs/development-plan.md` 和 `docs/progress.md` 前直接新增实现。
3. 中大型工作要同步更新 `docs/development-plan.md` 和 `docs/progress.md`。
4. 不要引入与 P0 默认技术栈冲突的新依赖。
5. 不要把 P1/P2 adapter 当作 P0 必装依赖。
6. 不要创建孤立文档；新增文档必须接入 README 和开发计划。
7. 任何回答、RAG、摘要、卡片和关系候选都必须绑定 Source / Chunk / Knowledge Unit 证据。
8. 任何重要 AI 生成知识都必须经过 Review，不能直接成为 confirmed。
9. 涉及权限、安全、文件处理、数据库写入和外部 Provider 时，必须保留降级、错误码和可恢复状态。
10. 完成后用 `rg` 做文档一致性检查，并在进度记录中写明验证结果。

## 15. 当前最重要的实现前检查点

进入代码阶段前，至少确认：

- `docs/data-model.md` v0.20-draft 的 P0-Z0a migration 对象、trace chain 和 Evidence Pack 失败态已冻结；
- `docs/api-design.md` v0.18-draft 的 Z0a / Z2 endpoint 边界没有扩大；
- `docs/api-implementation-plan.md` v0.18-draft 的 service / repository / transaction 边界、OpenAPI 类型生成、trace chain 和 migration 波次命名清楚；
- `docs/technical-stack-and-prototype-plan.md` v0.21 的 D-091 工程化验收门槛与 D-092 代码骨架前置契约已进入开工约束；
- `docs/testing-strategy.md` v0.19 的 Z0a fixture、D-090 技术栈执行优化测试口径、D-091 工程化 gate 和 D-092 前置契约测试已能转成合同测试；
- `docs/p0a-execution-plan.md` v0.19 的 W1 / W2 任务、依赖分组、Zustand 状态、typed fetch、sidecar lifecycle、sqlite-vec capability probe、Provider manifest / lazy-load、OpenAPI 类型生成、trace chain、migration 波次命名和 File Inspection 分层可被拆成实际工程任务；
- README、开发计划和进度记录与真实实现保持一致。
