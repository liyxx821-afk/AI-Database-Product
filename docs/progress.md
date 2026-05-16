# 进度记录

## 2026-05-17（D-092 代码骨架前置契约优化）

### 已完成

- `docs/technical-stack-and-prototype-plan.md` 升级为 v0.21，新增 D-092 代码骨架前置契约。
- `docs/p0a-execution-plan.md` 升级为 v0.19，将 OpenAPI → TypeScript 类型生成、Provider manifest、trace chain、migration 波次命名、SQLite 1K/10K 性能基线、Zustand store slices 和 Evidence Pack 失败态写入开工 Checklist、W1/W5 任务与验收。
- `docs/testing-strategy.md` 升级为 v0.19，补充 D-092 对类型生成、sidecar 打包 spike、Provider manifest、trace chain、migration 命名、SQLite baseline、Zustand slices 和 evidence failure 的测试口径。
- `docs/data-model.md` 升级为 v0.20-draft，补齐 `trace_id` 字段映射、ProcessingJob / event / retrieval / Evidence Pack / AIAnswer 链路和 Evidence Pack `failure_type` 约束。
- `docs/api-implementation-plan.md` 升级为 v0.18-draft，补充 OpenAPI 生成、TypeScript 类型生成、trace chain 和 Alembic migration 波次命名。
- `docs/desktop-architecture.md` 升级为 v0.4，补充 FastAPI sidecar packaged / pseudo-packaged 验证 spike。
- `docs/ai-provider-architecture.md` 升级为 v0.13，补充 Provider manifest 字段与 lazy-load 约束。
- `docs/error-handling-and-observability.md` 升级为 v0.7，补充 `trace_id → request_id → job_id → event_seq → retrieval_log_id → evidence_pack_id → ai_answer_id` 诊断链。
- `docs/rag-pipeline.md` 升级为 v0.8-draft，补充 Evidence Pack 失败态：`no_retrieval_result / insufficient_evidence / permission_blocked / citation_binding_failed / vector_degraded`。
- `docs/project-background-brief.md` 升级为 v0.4；README 与 `docs/development-plan.md` 已同步 D-092。

### 验收

- 本轮仍为文档-only：未新增运行时代码、migration、OpenAPI 文件、endpoint 或依赖。
- D-092 不改变当前技术栈选择：仍为 Electron + React + Vite + TypeScript、FastAPI sidecar、SQLite + sqlite-vec、local filesystem、local_sqlite_worker、SSE、ProviderRegistry 和 evidence-only fallback。
- 新增契约用于后续真正创建代码骨架时固定 DTO 生成、Provider 装载、trace 诊断、migration 命名、前端状态拆分、性能基线和不可回答失败态，避免跨模块实现漂移。

## 2026-05-17（D-091 技术栈工程化验收门槛）

### 已完成

- `docs/technical-stack-and-prototype-plan.md` 升级为 v0.20，新增 D-091 技术栈工程化验收门槛。
- `docs/p0a-execution-plan.md` 升级为 v0.18，将最小依赖 CI gate、Provider lazy-load、Electron sidecar 生命周期、typed fetch/error envelope、sqlite-vec 三态一致性和 evidence-first 不变量写入开工 Checklist、D-091 gate、W1 任务与验收。
- `docs/testing-strategy.md` 升级为 v0.18，补充 D-091 对最小依赖、Provider 缺失、sidecar 生命周期、typed fetch、sqlite-vec 一致性和 evidence failure 的测试口径。
- `docs/project-background-brief.md` 升级为 v0.3，同步后续 Agent 实现前检查点。
- README 已同步 D-091 Done 记录与相关文档版本。
- `docs/development-plan.md` 升级为 v0.45，新增 D-091 决策记录。

### 验收

- 本轮仍为文档-only：未新增运行时代码、migration、OpenAPI 文件、endpoint 或依赖。
- D-091 不改变当前技术栈选择：仍为 Electron + React + Vite + TypeScript、FastAPI sidecar、SQLite + sqlite-vec、local filesystem、local_sqlite_worker、SSE、ProviderRegistry 和 evidence-only fallback。
- 新增门槛用于后续真正开工时防止 optional provider、sidecar 崩溃、裸 fetch、sqlite-vec 降级和无来源回答成为隐性缺陷。

## 2026-05-17（D-090 技术栈执行优化）

### 已完成

- `docs/technical-stack-and-prototype-plan.md` 升级为 v0.19，新增 D-090 执行优化口径。
- `docs/p0a-execution-plan.md` 升级为 v0.17，将 `uv + pyproject.toml` 依赖分组、`pnpm + Zustand`、sqlite-vec capability probe、File Inspection Z0a/Z0b 分层、optional Provider 后置和 evidence-first RAG 写入开工 Checklist、W1-W3 任务与验收。
- `docs/testing-strategy.md` 升级为 v0.17，补充依赖分组、optional provider 缺失、sqlite-vec 三态、File Inspection 分层、Zustand SSE 状态和 evidence-first RAG 测试口径。
- `docs/project-background-brief.md` 升级为 v0.2，同步后续 Agent 实现前检查点。
- README 已同步 D-090 Done 记录与相关文档版本。
- `docs/development-plan.md` 升级为 v0.44，新增 D-090 决策记录，并保留 D-089 GitHub private repo 上传记录。

### 验收

- 本轮仍为文档-only：未新增运行时代码、migration、OpenAPI 文件、endpoint 或依赖。
- P0-Z0a 首批实现口径已收敛为先验证 Source → Chunk → Knowledge Unit → Review → embedding fallback → Retrieval → Evidence Pack → evidence-only answer。
- OCR、ASR、reranker、外部 LLM 质量、PostgreSQL、独立向量库、GraphRAG、多 Agent 和外部工具执行继续作为后置能力，不阻塞首批工程骨架。

## 2026-05-17（D-089 GitHub private repo 上传）

### 已完成

- 创建 GitHub private repo：`ChenchenChen001/ai-database-product`。
- 本地 `origin` 已绑定到 `https://github.com/ChenchenChen001/ai-database-product.git`。
- `docs/git-management.md` 升级到 v0.2，记录 private remote、远程用途和后续公开 / LFS 前置检查。
- README 与 `docs/development-plan.md` 已同步 D-089。
- 以 `main` 分支推送首个项目文档基线提交。

### 验收

- GitHub 返回仓库可见性为 `PRIVATE`。
- 当前 PDF 约 5MB，未触发 GitHub 普通文件限制；本机未安装 Git LFS，后续大型资产需要先单独处理。
- 本轮远程目标是私有备份与后续工程基线，不创建公开仓库。

## 2026-05-17（D-088 README 对齐后的技术栈优化）

### 已完成

- 根据 README 当前入口口径优化 `docs/technical-stack-and-prototype-plan.md`，版本升级为 v0.18。
- 新增 D-088 技术栈优化章节，将技术栈拆成：
  - P0-Z0a 最小可执行栈；
  - 完整 P0 扩展栈；
  - P1/P2 后置栈。
- 明确 P0-Z0a 首批工程只阻塞 Electron + React + Vite + TypeScript、FastAPI sidecar、SQLite + sqlite-vec、Repository 抽象、Alembic、Pydantic、local filesystem、local_sqlite_worker、SSE、FTS5、embedding fallback、Evidence Pack 和 evidence-only answer。
- 明确 PyMuPDF、pdfplumber、PaddleOCR、Whisper、KeyBERT / HanLP / spaCy、bge-m3、bge-reranker-v2 等按 Z0b/Z1/Z2 波次接入，不作为首批骨架阻塞项。
- 明确 PostgreSQL + pgvector、Redis/Celery/Temporal、MinIO/S3、独立向量数据库、Neo4j/LightRAG/GraphRAG runtime、WebSocket 必需通道、多 Agent 和外部工具执行继续作为 P1/P2 后置项。
- README 已同步 `docs/technical-stack-and-prototype-plan.md` v0.18 描述，并新增本轮 Done 记录。
- `docs/development-plan.md` 升级到 v0.42，并新增 D-088 决策记录。

### 验收

- 本轮仍为文档-only：未新增运行时代码、migration、OpenAPI 文件、endpoint 或依赖。
- 技术栈优化不改变 README 已冻结的 P0 默认路线：Electron + React + Vite + TypeScript、FastAPI sidecar、SQLite + sqlite-vec + FTS5、本地优先、开源优先 ProviderRegistry 和 graceful fallback。
- 优化目标是降低首批工程误扩范围风险：完整工具矩阵继续保留，但不再等同于 P0-Z0a blocking 依赖。

## 2026-05-17（D-087 本地 Git 管理基础）

### 已完成

- 初始化本地 Git 仓库，默认分支为 `main`。
- 设置本地 Git 显示策略：`core.quotepath=false`，中文路径在状态输出中不转义。
- 新增 `.gitignore`，覆盖 macOS / 编辑器临时文件、密钥、数据库、本地上传资料、日志、构建产物、缓存和模型权重。
- 新增 `.gitattributes`，固定 Markdown / 文本文档 LF 行尾，并将 PDF、图片和数据库文件标记为二进制。
- 新增 `docs/git-management.md` v0.1，记录提交类型、分支建议、首次提交建议、远程仓库前置检查和禁止事项。
- README 与 `docs/development-plan.md` 已同步 D-087。

### 验收

- 本轮只建立本地 Git 管理基础：未创建 commit、未配置 remote、未推送。
- `.DS_Store` 已进入 ignored 状态，文档、PDF、README 和 AGENTS 仍保持可跟踪候选状态。
- 后续若需要创建首个提交，应先确认 PDF 是否纳入仓库、是否需要 Git LFS、以及是否允许配置远程仓库。

## 2026-05-17（D-086 后续 Agent 项目背景说明书）

### 已完成

- 新增 `docs/project-background-brief.md` v0.1，作为后续 Agent 快速接手入口。
- 背景说明书集中说明项目定位、目标用户、非目标、核心原则、当前架构、P0 四切片、P0-Z0a/Z0b/Z1/Z2 边界、冻结技术选择、数据对象速览、推荐阅读顺序、过期口径和后续 Agent 工作原则。
- README 已加入背景说明书索引和 Done 记录。
- `docs/development-plan.md` 升级到 v0.40，并新增 D-086 决策记录。

### 验收

- 本轮仍为文档-only：未新增运行时代码、migration、OpenAPI 文件、endpoint 或新的数据表。
- 背景说明书定位为 README 与领域主文档之间的接手说明，不替代 `product-architecture`、`data-model`、`api-design` 或 `p0a-execution-plan`。
- 已明确旧口径：P0-A/P0-B、`text_import only`、Mock-only、独立向量数据库和 GraphRAG 默认依赖均不能作为当前 P0 实现依据。

## 2026-05-17（D-085 Z0a 调用锚点与反馈 / citation 边界修正）

### 已完成

- `docs/data-model.md` 升级到 v0.19-draft：`evidence_packs` / `ai_answers` 增加 Z0a 可实现锚点 `retrieval_log_id`，`request_id` / `retrieval_plan_id` 在 Z0a 可为空，P0-Z2 再补齐持久化 Invocation / Retrieval Plan。
- `docs/api-design.md` 升级到 v0.18-draft：`/api/invocations*` 明确为 P0-Z2 持久化接口或可选提前实现；Z0a RAG response 改为返回 `evidence_item_ids`、`citation_labels` 和 `citation_trace_summary`，不要求持久化 citation 明细 ID。
- `docs/api-implementation-plan.md` 升级到 v0.17-draft：Evidence Pack 构建事务改为优先使用 `retrieval_log_id`，feedback / memory draft 明确不属于 Z0a blocking 写接口。
- `docs/p0a-execution-plan.md`、`docs/testing-strategy.md`、`docs/technical-stack-and-prototype-plan.md`、`docs/text-to-sql.md` 和 README 已同步 D-085。

### 验收

- 本轮仍为文档-only 收敛：未新增运行时代码、migration、OpenAPI 文件、endpoint 或新的平级数据表。
- D-085 修复了 Z0a “必须写 Evidence / Answer 但又不能写 Invocation / Retrieval Plan”的契约冲突。
- 反馈边界固定为：Z0a response-only 或 append-only `feedback_events`；Z2 才写 `retrieval_feedback`，且必须携带 `feedback_policy`。

## 2026-05-17（D-084 D-081-D083 跨文档同步）

### 已完成

- 将 D-081-D083 的调用持久化边界、`InvocationProfileSchema v1`、`feedback_policy` 和 `FrontendStateContract` 补齐到 `docs/rag-pipeline.md`、`docs/product-architecture.md`、`docs/mvp-scope.md`、`docs/ai-provider-architecture.md`、`docs/text-to-sql.md` 和 `docs/error-handling-and-observability.md`。
- `docs/rag-pipeline.md` 升级到 v0.7-draft：明确 P0-Z0a 只保留 Invocation / Retrieval Plan 的 response/log summary，P0-Z2 才持久化，并补齐 `rewrite_status`、`relation_evidence`、`source_reliability_score/source_reliability_label` 和 `feedback_policy`。
- `docs/product-architecture.md` 升级到 v0.14，`docs/mvp-scope.md` 升级到 v0.13：P0-Z0a evidence-only、P0-Z2 provider answer、feedback 反污染边界和前端状态契约已同步到入口级产品文档。
- `docs/ai-provider-architecture.md` 升级到 v0.12：明确 ProviderRegistry 只登记影响路由/降级的能力，`rewrite_status=not_needed` 不是 Provider fallback。
- `docs/text-to-sql.md` 升级到 v0.3-draft，`docs/error-handling-and-observability.md` 升级到 v0.6；README 和 `docs/development-plan.md` 已同步版本与 D-084 决策记录。

### 验收

- 本轮仍为文档-only 收敛：未新增运行时代码、migration、OpenAPI 文件、endpoint 或新的平级数据表。
- D-084 不改变 P0 技术栈：仍为 Electron + React + Vite + TypeScript、FastAPI sidecar、SQLite + sqlite-vec + FTS5、本地优先和 Provider 可选降级。
- 已将容易误导后续实现的 D-080-only 口径补齐为 D-081-D083 当前边界。

## 2026-05-17（D-081/D-082/D-083 D-080 实现前收敛修正）

### 已完成

- 根据 D-080 评审结果补齐三条实现前收敛决策：D-081 固定 P0-Z0a / P0-Z2 调用持久化边界；D-082 固定 `InvocationProfileSchema v1`；D-083 固定 `FrontendStateContract` 与 `feedback_policy`。
- `docs/data-model.md` 已明确 P0-Z0a 只必须持久化 `retrieval_logs`、`evidence_packs`、`evidence_items` 和 `ai_answers(output_type=evidence_only_answer)`；`invocation_requests`、`retrieval_plans`、`memories`、`retrieval_feedback` 顺延到 P0-Z2 或作为提前实现的可选增强。
- `docs/api-design.md` 已修正 Retrieval Preview 示例：简单事实查询使用 `rewrite_status=not_needed`，不再把 LLM rewrite 未用标成 fallback；来源可信度拆为 `source_reliability_score` 与 `source_reliability_label`。
- `docs/p0a-execution-plan.md` 已把 W5 收窄为 retrieval log + Evidence Pack + citation trace，Invocation Request / Retrieval Plan 持久化移到 W6/P0-Z2。
- `docs/knowledge-invocation-system-design-plan.md` 已修正 P0 / P1 answer 边界：P0-Z0a 只做 `evidence_only_answer`，P0-Z2 或显式 Provider 增强路径才做 citation-bound `rag_answer`，生产级创作稿与项目复盘进入 P1/P2。

### 验收

- 本轮仍为文档-only 收敛：未新增运行时代码、migration、OpenAPI 文件、endpoint 或新的平级数据表。
- `feedback_signal` 增加 `feedback_policy`，默认 local_only + current_project scope，反馈不能自动改写 confirmed knowledge。
- 前端状态契约从页面清单收敛为 job / retrieval / answer / citation / feedback 状态矩阵，便于后续 UI 统一处理 loading、empty、fallback、blocked 和 recoverable error。

## 2026-05-16（D-080 知识库调用、AI 智能体与前端交互收敛）

### 已完成

- `docs/knowledge-invocation-system-design-plan.md` 升级到 v0.9：补齐 `query_understanding_profile`、`retrieval_strategy_profile`、`ranking_profile`、`citation_trace_profile` 和 `feedback_signal`，并把简单事实、概念解释、关系分析、总结归纳、时间线、文件定位和复杂综合问题映射到对应检索策略。
- `docs/rag-pipeline.md` 升级到 v0.6：P0-RAG 明确先做 query understanding、strategy route、hybrid retrieval、ranking、citation trace 和 evidence-only / provider answer；GraphRAG、Learning-to-Rank、外部图数据库和 WebSocket 必需依赖继续作为 P1/P2。
- `docs/data-model.md` 升级到 v0.17-draft：不新增大表，扩展 `retrieval_plans`、`retrieval_logs`、`evidence_items`、`ai_answers`、`feedback_events` 的 metadata 字段约定，用于保存调用 profile、citation trace、feedback signal 和 `implicit_agent`。
- `docs/api-design.md` 与 `docs/api-implementation-plan.md` 补齐 retrieval / RAG answer 响应示例、Query Explanation、Evidence Pack、Citation Preview、Feedback request 和 service 映射；本轮没有新增 endpoint。
- `docs/technical-stack-and-prototype-plan.md` 升级到 v0.15：新增“知识库调用 / Agent / 前端系统”P0/P1/P2 技术矩阵，P0 前端固定 Electron + React + Vite + TypeScript、SSE、Toast、Error Boundary、Loading Skeleton、React Context 或 Zustand。
- `docs/product-architecture.md`、`docs/mvp-scope.md`、`docs/testing-strategy.md`、`docs/p0a-execution-plan.md`、README 和 `docs/development-plan.md` 已同步 D-080 边界。

### 验收

- D-080 保持文档-only 边界：未新增运行时代码、migration、OpenAPI 文件、endpoint 或新的平级数据表。
- P0 Agent 明确为 `implicit_agent`：允许对话上下文、只读任务规划、内部工具调用、RAG 问答和内容草稿；不允许多 Agent、自主执行或外部 API 工具调用。
- 用户反馈只进入 `feedback_events` / 检索反馈记录并影响后续排序建议，不直接修改 confirmed knowledge。
- 预览、摘要、知识卡片只能作为辅助视图；citation 仍绑定 Source / Chunk / Knowledge Unit 和 text span。

## 2026-05-16（D-079 结构化整理与存储映射收敛）

### 已完成

- `docs/data-model.md` 补齐 D-079：`structured_organization` 子字段覆盖内容理解、摘要类型、标签操作、分类归属、字段映射、知识卡片类型、实体候选、三元组候选和关系候选；`review_tasks.target_type` 修正为支持 `tag_suggestion / relation_suggestion / knowledge_card`。
- `processing_status_events.event_type` 增加 `structured_organization_started / structured_organization_completed / structured_organization_warning / structured_organization_failed`，具体步骤统一写 `payload_json.step`，没有为每个子步骤膨胀事件枚举。
- `docs/data-model.md` 与 `docs/technical-stack-and-prototype-plan.md` 增加数据库存储系统映射：原文件、文本、元数据、向量、关系候选、反馈和任务状态分别落到既有 P0 对象；PostgreSQL、Qdrant、Neo4j 等仍为 P1/P2 adapter 或迁移选项。
- `docs/product-architecture.md` 修正旧口径：P0 不是完全不做摘要和实体关系，而是不做自动确认；只生成模板摘要、候选摘要、实体/三元组/关系候选和 Review payload。
- `docs/api-design.md`、`docs/api-implementation-plan.md`、`docs/ai-provider-architecture.md`、`docs/mvp-scope.md`、`docs/p0a-execution-plan.md`、`docs/testing-strategy.md`、`README.md`、`docs/development-plan.md` 已同步 D-079 边界。

### 验收

- D-079 保持文档-only 边界：未新增运行时代码、migration、OpenAPI 文件、endpoint 或新的平级数据表。
- D-077/D-078 仍是实现边界：Z0a/Z0b 不依赖 `quality_events` 或 `knowledge_relations`，关系候选不写 confirmed relation。

## 2026-05-16（D-077 实现边界收敛）

### 已完成

- 根据本轮 review 修正 D-077 与 P0-Z0a/Z0b 迁移边界的冲突：Z0a/Z0b 不再要求 `quality_events` 或 `knowledge_relations` 参与 `knowledge-units:extract` 的首批实现。
- `docs/data-model.md` 明确 AI 结构化整理执行痕迹在 Z0a/Z0b 写入 `knowledge_units.metadata_json.structured_organization`、`processing_status_events` 和 `review_tasks`；`quality_events` 保持 P0-Z1 质量治理事件。
- `docs/api-implementation-plan.md` 将 `KnowledgeExtractionService.extractCandidates` 的 Z0a/Z0b repository 依赖从 `QualityRepository` / `RelationRepository` 收紧为 `ProcessingStatusEventRepository` + `ReviewTaskRepository`，并把关系候选固定为 `review_tasks.target_type=relation_suggestion` + `payload_json`。
- `docs/api-design.md` 与 `docs/ai-provider-architecture.md` 将 `relation_suggestion` 明确归入 `system_rules` stub；增强 LLM / graph provider 仍为 optional adapter。
- `README.md` 已把旧 P0-A / P0-B 条目移入更明确的历史记录说明，并把 Mock 表述改为 fallback/mock profile（仅链路验证）。

### 验收

- D-078 保持文档-only 边界：未新增运行时代码、migration、OpenAPI 文件、endpoint 或新的平级数据表。
- `quality_events` / `knowledge_relations` 不再作为 P0-Z0a/Z0b blocking 对象出现；关系建议不写 confirmed relation。

## 2026-05-16（AI 结构化整理 Profile 与质量门细化）

### 已完成

- `docs/data-model.md` 升级到 v0.16-draft：在 `knowledge_units.metadata_json` 中新增 `structured_organization` 子结构，固定 `content_understanding / summary_generation / key_concept_extraction / schema_mapping / knowledge_card_generation / classification_tagging / relation_suggestion` 执行链。
- `docs/api-design.md` 升级到 v0.15-draft：`POST /api/knowledge-units:extract` 增加可选 `structuring_profile` 和 `structuring_summary` 响应摘要；Provider capability API 补齐 content understanding、schema mapping、knowledge card、classification tagging 与 relation suggestion。
- `docs/api-implementation-plan.md` 升级到 v0.14-draft：`KnowledgeExtractionService.extractCandidates` 明确 job-first 执行、profile 表、结构化质量摘要和 Review task 写入边界。
- `docs/technical-stack-and-prototype-plan.md` 升级到 v0.14：新增 AI 结构化整理 Profile 工具矩阵，P0 默认 Pydantic / JSON Schema、Jinja2 / Markdown / YAML Frontmatter、KeyBERT / YAKE、spaCy / HanLP 和规则模板。
- `docs/ai-provider-architecture.md` 升级到 v0.11：D-077 明确工具名进入 adapter/profile，只有影响路由和降级的能力进入 Provider capability。
- `docs/testing-strategy.md` 升级到 v0.13：新增结构化整理合同测试与 fixture，覆盖主题偏移、摘要质量、概念重复、schema 缺失、卡片缺 citation、标签冲突、无效关系和 LLM 不可用。
- `docs/product-architecture.md`、`docs/mvp-scope.md`、`docs/architecture-design-plan.md`、`docs/p0a-execution-plan.md`、README 与 `docs/development-plan.md` 已同步 D-077 决策记录。

### 验收

- D-077 保持文档-only 边界：未新增运行时代码、migration、OpenAPI 文件、endpoint 或新的平级数据表。
- 关系建议只进入 Review，不直接写 confirmed relation。
- 所有 KU / tag / relation 候选默认 pending review；Review action 才能写 `confirmed`、`confirmed_by_user=true` 或 `available_for_agent=true`。

### 待完成

- 进入代码实现时，把 `structured_organization`、`structuring_summary`、质量门枚举和 fixture 转成 Pydantic schema、contract tests 和 `KnowledgeExtractionService` profile 配置。

## 2026-05-15（切片执行 Profile 与工具矩阵收敛）

### 已完成

- `docs/data-model.md` 升级到 v0.15-draft：在 `chunks.metadata_json` 中细化 `chunk_execution_profile`、`chunk_type`、`semantic_boundary`、`source_metadata` 和 `quality_scores` 子结构；`chunk_type` 固定为 `text_semantic / structured_table / image_ocr / audio_transcript / video_scene / mixed`。
- `docs/api-design.md` 升级到 v0.14-draft：只扩展 `chunks:build.chunk_summary.check_summary` 和 `chunk_execution_profiles` 示例，不新增 endpoint、必填参数或 OpenAPI 文件。
- `docs/api-implementation-plan.md` 升级到 v0.13-draft：`ChunkBuildService.build` 增加内部 execution profile 选择，文本语义、结构化表格、OCR 图片、音频 transcript、视频场景和 mixed 路径继续使用同一个 ProcessingJob / event / quality check 流程。
- `docs/technical-stack-and-prototype-plan.md` 升级到 v0.13：新增切片执行工具矩阵；P0 使用规则切片、tiktoken/规则 token 估算、PyMuPDF/pdfplumber/openpyxl、pandas/Pandera、KeyBERT/HanLP/spaCy；LangChain、LlamaIndex、sentence-transformers、CLIP/BLIP/Florence、Table Transformer 保持 P1/P2 adapter。
- `docs/ai-provider-architecture.md` 升级到 v0.10：明确工具名写入 adapter/profile，不把每个工具升级为 Provider capability；只保留会影响路由和降级的 capability。
- `docs/testing-strategy.md` 升级到 v0.12：新增长文本、表格、图文混排、OCR 图片、代码块、对话 transcript、视频场景和无法 citation 绑定 chunk 的 fixture 期望。
- `docs/p0a-execution-plan.md` 升级到 v0.12；README 与 `docs/development-plan.md` 已同步 D-076 决策记录。

### 验收

- D-076 保持文档收敛边界：未新增运行时代码、migration、OpenAPI、endpoint 或新的平级数据表。
- `source_binding_status` 继续只表达 Citation/Evidence 可用性；embedding、FTS5、sqlite-vec 和 metadata filter 的索引状态归 embedding/index job。
- P0 仍以 SQLite + sqlite-vec + FTS5 + metadata filter 为默认检索底座；Elasticsearch/OpenSearch、FAISS/Chroma/Milvus、Neo4j 不进入 P0 默认依赖。

### 待完成

- 进入代码实现时，把 D-076 的 `chunk_execution_profile`、`chunk_type` 枚举和 fixture 转成 Pydantic schema、contract tests 和 `ChunkBuildService` 内部 profile 配置。

## 2026-05-15（切片检查门与 ProcessingJob 契约收敛）

### 已完成

- `docs/data-model.md` 升级到 v0.14-draft：新增 `check_gate` → `chunk_quality_checks.check_type` 权威映射表，明确 `source_traceability` 与 `source_binding` 分工，并把 `chunk_preparation_completed` 纳入事件枚举。
- `docs/api-design.md` 升级到 v0.13-draft：`chunks:build` 响应补齐 `check_summary`、`capability_summary`、`fallback_reasons` 和 `source_binding_status`；Provider 列表新增 `provider_type=system/local_adapter/mock/commercial`，mock 只作为测试或 fallback，不再承载真实 `chunk_quality_eval`。
- `docs/api-implementation-plan.md` 升级到 v0.12-draft：`ChunkBuildService.build` 改为 job-first，除 source 不存在、项目/权限不匹配外，input/OCR/strategy/structure/source binding 检查都必须落入 ProcessingJob event 或 quality check。
- `docs/ai-provider-architecture.md` 升级到 v0.9，`docs/testing-strategy.md` 升级到 v0.11，`docs/p0a-execution-plan.md` 升级到 v0.11；README 与 `docs/development-plan.md` 已同步 D-075。

### 验收

- D-075 已处理当前评审的 5 个问题：ProcessingJob 创建过晚、检查门命名双轨、`chunks:build` 摘要过薄、mock 与系统规则 provider 混淆、Z0a 检查可见性不足。
- 进入代码实现时，`chunks:build` 合同测试必须先覆盖 job-first、检查门映射和 Provider 类型，再实现实际切片逻辑。

### 待完成

- 进入代码实现时，把 D-075 的检查门映射转成 Pydantic schema、ProcessingJob event、fixture 和 contract tests。

## 2026-05-15（切片前准备层与结构化整理检查门细化）

### 已完成

- `docs/data-model.md` 升级到 v0.13-draft：`chunks.metadata_json` 补齐 `preparation_profile`、`content_kind`、`ocr_layout_status`、`structure_recovery_status`、`strategy_match_status`、`source_binding_status`，并新增切片前准备检查门。
- `chunk_quality_checks.check_type` 扩展为 input / OCR layout / strategy match / structure integrity / structured binding / metadata completeness / source binding 等维度，继续保持字段单一来源。
- `processing_status_events.event_type` 补齐 `chunk_preparation_started`、`chunk_preparation_warning`、`chunk_strategy_mismatch`、`chunk_structure_recovered`、`chunk_source_binding_failed`。
- `docs/api-design.md` 升级到 v0.12-draft：`chunks:build` 明确消费 OCR/版面和 Parser 输出，不新增必填请求字段；Provider capability API 补齐 token counting、structure recovery、document layout、table/html/xml/academic paper structure。
- `docs/api-implementation-plan.md` 升级到 v0.11-draft：`ChunkBuildService.build` 流程补齐输入完整性、OCR/版面、内容类型、策略匹配、结构恢复、metadata/source binding 检查；`KnowledgeExtractionService` 补齐结构化整理检查链。
- `docs/technical-stack-and-prototype-plan.md` 升级到 v0.12，`docs/ai-provider-architecture.md` 升级到 v0.8，`docs/testing-strategy.md` 升级到 v0.10，`docs/p0a-execution-plan.md` 升级到 v0.10；README 与 `docs/development-plan.md` 已同步 D-074。

### 验收

- D-074 已明确：P0-Z0a 仍只要求可恢复状态、最小 source binding 和规则切片；P0-Z0b 才补齐完整 preparation/source metadata/chunk quality 摘要。
- LangChain、LlamaIndex、GROBID、BeautifulSoup/lxml、Unstructured、Tika、Celery/Redis、MinIO/S3 均保持 P1 adapter 或增强路径，不成为 P0 必装依赖。

### 待完成

- 进入代码实现时，把 D-074 的检查门转成 Pydantic schema、ProcessingJob event、fixture 和 contract tests。

## 2026-05-14（实现前契约去重与单一来源收敛）

### 已完成

- `docs/data-model.md` 升级到 v0.12-draft：`parse_warnings` 和 `chunk_quality_checks` 只保留 §6.6.1 / §6.7.1 一个权威字段定义，治理对象段改为引用，避免 migration 和 repository 选择旧字段。
- `processing_status_events.event_type` 在 `docs/data-model.md` 中成为唯一枚举来源，并补齐 `chunk_strategy_selected`、`chunk_context_enriched`、`chunk_quality_warning`、`chunk_quality_failed`、`queue_stalled`、`high_resource_task` 等 P0 保留事件。
- `docs/api-design.md` 升级到 v0.11-draft：`chunks:build` 请求增加 `phase`，明确 P0-Z0a 只保证 `source_location / quality_status`，P0-Z0b 才保证 `context_summary / source_metadata / chunk_quality_checks`；`/api/system/status` 增加 `window`、`status_reason` 和阈值说明。
- `docs/api-implementation-plan.md` 升级到 v0.10-draft：`GET /api/ai-providers/capabilities` 补齐 chunk_strategy、semantic_chunking、context_enrichment、chunk_quality_eval 四类能力；`SystemStatusService` 明确 window 和状态推导字段。
- `docs/testing-strategy.md` 升级到 v0.9：合同测试拆分 Z0a 最小 chunk 验收与 Z0b 完整 source metadata / chunk quality 验收，避免首批实现被后置字段误伤。
- `docs/ai-provider-architecture.md` 升级到 v0.7，`docs/error-handling-and-observability.md` 升级到 v0.5；README 与 `docs/development-plan.md` 已同步 D-073。

### 验收

- 评审中发现的 5 个问题已收敛为明确文档改动：重复定义、事件枚举冲突、Z0a/Z0b 测试误伤、capability API 漏项、system status 统计口径不清。
- 当前实现入口应以 data-model 作为事件与字段单一来源，API/observability/testing 不再重复定义旧版字段。

### 待完成

- 进入代码实现时，先按 D-073 的单一来源契约生成 migration / DTO / contract tests，再实现 service。

## 2026-05-14（知识切片质量闭环与安全运维横切层细化）

### 已完成

- `docs/data-model.md` 升级到 v0.11-draft：补齐 `chunk_strategy_profile`、`chunk_type`、`semantic_boundary`、`context_summary`、`source_metadata`、`quality_scores`、`provider_key`、`capability_status`、`fallback_reason` 等 chunk metadata 契约。
- `chunk_quality_checks` 从“过短/过长”扩展为 `length_bounds`、`semantic_integrity`、`topic_mix`、`context_sufficient`、`source_traceability`、`noise_duplicate`、`readability`、`searchability`、`structured_boundary`、`multimodal_transcript_available`。
- `docs/api-design.md` 升级到 v0.10-draft：`POST /api/sources/{source_id}/chunks:build` 新增 `strategy_profile`、`quality_profile`、`provider_mode`、`force` 请求字段，响应返回 ProcessingJob 和 chunk quality summary。
- `docs/api-design.md` 新增 `/api/system/status`，把日志、异常监控、数据安全、性能成本、系统稳定性作为 P0 本地状态汇总，不依赖外部 APM 或云遥测。
- `docs/api-implementation-plan.md` 升级到 v0.9-draft：补齐 `ChunkBuildService.build` 流程、事务边界、chunk build SSE 事件和 `SystemStatusService` / `SystemLogRepository`。
- `docs/technical-stack-and-prototype-plan.md` 升级到 v0.11：新增切片策略、Chunk Quality、日志、异常监控、数据安全、性能成本、系统稳定性 P0/P1/P2 矩阵。
- `docs/p0a-execution-plan.md` 升级到 v0.9：W3 绑定切片策略判断、上下文补充、来源绑定、质量检查；W5/W6 增加 chunk quality 风险展示和系统状态验收。
- `docs/error-handling-and-observability.md` 升级到 v0.4：新增安全运维横切层、P0 保留事件类型、日志类型和本地模块状态边界。
- `docs/testing-strategy.md` 升级到 v0.8：新增 chunk quality fixture、安全运维 fixture、`/api/system/status` 合同测试和系统状态性能基线。
- 同步 `docs/product-architecture.md` v0.11、`docs/mvp-scope.md` v0.10、`docs/architecture-design-plan.md` v1.2、`docs/ai-provider-architecture.md` v0.6、`docs/rag-pipeline.md` v0.5-draft、README 与 `docs/development-plan.md`，新增 D-072 决策记录。

### 验收

- 知识切片已从单纯 `Chunking` 收敛为“策略判断 → 结构恢复 → 语义/结构化/多模态切片 → 上下文补充 → 元数据标注 → 来源绑定 → 质量检查”的闭环。
- P0-Z0a / Z0b / Z1 / Z2 的切片能力边界已明确：Z0a 规则可运行，Z0b 补 source metadata 和质量记录，Z1 做语义/结构化/多模态增强，Z2 才启用 LLM 质量评估。
- 安全与运维不再分散在日志或错误处理里，已收敛为本地横切支撑层：日志、异常监控、数据安全、性能成本和系统稳定性。

### 待完成

- 进入代码实现时，优先把 `chunks:build`、`chunk_quality_checks`、`processing_status_events` 和 `/api/system/status` 做成合同测试，避免后续 UI 与 service 口径分叉。

## 2026-05-14（P0-Z0a/Z0b 与 ProcessingJob 契约再收紧）

### 已完成

- `docs/data-model.md` 升级到 v0.10-draft：把 P0-Z0 拆成 P0-Z0a blocking 骨架与 P0-Z0b 同周补齐，避免首批 migration 继续背负账号预埋明细、完整分片、citation、grant 和审计日志。
- `docs/data-model.md` 与 `docs/api-design.md` 将 `ingestion_jobs` 收敛为领域对象 `ProcessingJob`：物理表可暂用旧名，但 service/repository/API 叙述按 ProcessingJob 设计。
- 补齐 ProcessingJob 状态机和幂等规则：`queued / processing / completed / failed_recoverable / failed_final / cancelled`，同一 `(target_type, target_id, job_type)` 只允许一个 active job，重复 inspect / preview / parse / embed 默认复用。
- 新增 `sensitive_access_grants` 契约：记录 `scope_hash`、`granted_item_ids`、`expires_at`、`used_at`、`revoked_at`，并明确 grant 不写长期权限、不改 `access_policies`。
- 收紧 P0-Z0a RAG 输出：`POST /api/rag/answers` 在 Z0a 只生成 `evidence_only_answer`，不调用 LLM；Provider 型 `rag_answer` 进入 P0-Z2 或增强路径。
- 同步 `docs/api-implementation-plan.md`、`docs/mvp-scope.md`、`docs/p0a-execution-plan.md`、`docs/technical-stack-and-prototype-plan.md`、`docs/product-architecture.md`、`docs/architecture-design-plan.md`、`docs/knowledge-invocation-system-design-plan.md`、`docs/testing-strategy.md`、`docs/rag-pipeline.md`、README 与 `docs/development-plan.md`。

### 验收

- P0-Z0a 对象清单已从完整 P0 对象中切薄，第一批 migration 可按最小闭环实施。
- Job 命名、状态机、SSE 事件和幂等规则在数据模型、API 和实施计划中对齐。
- sensitive evidence 进入 Evidence Pack 具备可实现的临时授权契约，而不只是一个 ID 字段。
- evidence-only answer 与 Provider 型 RAG answer 的 P0-Z0a / P0-Z2 边界已明确。

### 待完成

- 进入代码实现时，按 P0-Z0a migration、ProcessingJob/ProcessingEventService、sensitive grant repository 和 evidence-only answer 合同测试启动。

## 2026-05-14（P0-Z0 实现竖切与 job/event 契约收紧）

### 已完成

- `docs/data-model.md` 升级到 v0.9-draft：新增 P0-Z0 / P0-Z1 / P0-Z2 迁移波次，避免把完整 P0 架构范围误解为第一批 migration 必须全建。
- `docs/data-model.md` 修正 `ingestion_jobs`：新增 `target_type`、`target_id`、`file_id nullable`、`source_id nullable`，`job_type` 扩展为 upload / verify / inspect / preview / ingest / parse / chunk / extract / embed / rag_answer。
- `docs/data-model.md` 补齐 File Inspection 状态汇总规则：`quarantined` 进入 `files.inspection_status`，并明确 blocked 与 quarantined 的恢复差异。
- `docs/api-design.md` 升级到 v0.8-draft：错误响应 envelope 改为引用 `docs/error-handling-and-observability.md`，新增通用 `GET /api/jobs/{job_id}` 与 `GET /api/jobs/{job_id}/events` 契约。
- `docs/api-design.md` 与 `docs/data-model.md` 增加 sensitive 调用授权：`permission_mode=explicit_sensitive_confirmed` 必须带一次性 `sensitive_access_grant_id`。
- `docs/api-implementation-plan.md` 升级到 v0.7-draft：新增 P0-Z0 实施竖切，`text_import` 不再同步执行 embedding，而是创建 `embed` job。
- `docs/product-architecture.md`、`docs/mvp-scope.md`、`docs/p0a-execution-plan.md`、`docs/technical-stack-and-prototype-plan.md`、`docs/testing-strategy.md`、`docs/error-handling-and-observability.md`、README 与 `docs/development-plan.md` 已同步 D-070。

### 验收

- 完整 P0 仍是架构范围；代码初始化先按 P0-Z0 跑通最小可演示链路。
- inspect / preview 可在 `source_id` 为空时以 `file_id + target_type=file` 创建 job。
- 所有长任务事件统一通过 `/api/jobs/{job_id}/events` 续读，上传 events 仅作为兼容别名。
- sensitive 只可在 preview 中摘要展示；进入 Evidence Pack / Citation Preview 必须记录一次性授权。

### 待完成

- 进入代码实现时，将 P0-Z0 migration、JobRepository、ProcessingEventService 和 sensitive access grant DTO 写成首批 contract tests。

## 2026-05-14（文件识别、安全、结构识别与预览架构细化）

### 已完成

- `docs/technical-stack-and-prototype-plan.md` 升级到 v0.8：新增 File Inspection 工具矩阵和默认流水线，覆盖 libmagic/python-magic、charset-normalizer、qpdf、oletools、EXIF adapter、Pillow、PyMuPDF、openpyxl、FFmpeg、ClamAV/Docker optional、Docling/LayoutParser optional。
- `docs/data-model.md` 升级到 v0.8-draft：新增 `file_inspection_results`，扩展 `files.inspection_status`、`files.preview_status` 和 `files.metadata_json` 检查摘要字段。
- `docs/api-design.md` 升级到 v0.7-draft：新增 `POST /api/files/{file_id}:inspect`、`GET /api/files/{file_id}/inspection`、`POST /api/files/{file_id}:preview`、`GET /api/files/{file_id}/preview`，并定义风险阻断和预览降级行为。
- `docs/api-implementation-plan.md` 升级到 v0.6-draft：补齐 `FileInspectionService`、`FileInspectionRepository`、`FilePreviewService`、Parser Router 前置约束和合同测试。
- `docs/ai-provider-architecture.md` 升级到 v0.5：ProviderRegistry 新增 file_detection / encoding_detection / security_scan / structure_detection / preview_generation / table_parse / media_probe 能力。
- `docs/product-architecture.md` 升级到 v0.8：端到端闭环和 P0-File 切片加入 File Inspection / Risk Policy / Preview。
- `docs/mvp-scope.md` 升级到 v0.7：P0 文件处理链路加入 `file_inspection_results` 和 File Inspection 前置阶段。
- `docs/p0a-execution-plan.md` 升级到 v0.6：W2/W3 增加 File Inspection job，Parser Router 明确依赖 FileInspectionReport。
- `docs/testing-strategy.md` 升级到 v0.5：新增伪装扩展名、乱码文本、Office 宏、加密 PDF、EXIF 图片、视频封面、预览工具缺失、ClamAV disabled 等 fixture。
- `docs/error-handling-and-observability.md` 升级到 v0.2；README 与 `docs/development-plan.md` 已同步 D-069 与新增错误码。

### 验收

- 上传完成后的默认处理流已更新为：真实类型识别 → 编码检测 → 安全检查 → 结构识别 → 预览生成 → Parser Router。
- P0 默认只做本地静态风险检查，不执行未知文件，不运行 Office 宏；ClamAV、Docker Sandbox、Docling、LayoutParser、Detectron2、Video-LLaVA 不作为 P0 必装依赖。
- `blocked/quarantined` 文件默认不进入 parse，但保留原文件、inspection report、状态事件和可恢复动作。
- 文件预览明确为 UI / Review 辅助资产，不替代 Source / Chunk / Knowledge Unit，也不进入 RAG citation。

### 待完成

- 进入代码实现时，把 `file_inspection_results`、inspect/preview API 和 inspection fixture 转成 migration、Pydantic schema、service contract 和 contract tests。

## 2026-05-14（当前方案评审后的实现前契约收紧）

### 已完成

- `docs/technical-stack-and-prototype-plan.md` 升级到 v0.7：新增 embedding profile/dimension 契约和 `local_sqlite_worker + SSE` 可恢复状态契约；`mock_fixed_384` 改为 fallback profile，不再作为 P0 默认语义向量。
- `docs/data-model.md` 升级到 v0.7-draft：补充 embedding profile registry 字段、`vector_index_name`、provider capability 五态枚举，以及 `processing_status_events.event_seq` / `payload_json` / `Last-Event-ID` 续读字段。
- `docs/ai-provider-architecture.md` 升级到 v0.4：`CapabilityStatus` 从 `available: bool` 改为 `status` 枚举，并补齐 `blocking`、`recoverable`、`fallback_profile`、`next_action`。
- `docs/api-design.md` 升级到 v0.6-draft：`/api/ai-providers/capabilities` 返回统一 capability status；系统信息中的 embedding/chat 状态改为结构化对象；标注静态路由注册顺序。
- `docs/api-implementation-plan.md` 升级到 v0.5-draft：Source/Ingestion、Retrieval、Provider Capability、Worker Events 和 fallback 模块全部对齐 open-source-first + fallback，不再以 `MockEmbeddingService` 作为主路径。
- `docs/rag-pipeline.md`、`docs/p0a-execution-plan.md`、`docs/testing-strategy.md`、`docs/architecture-design-plan.md`、README 与 `docs/development-plan.md` 已同步 D-068。

### 验收

- 当前结论：P0 默认 embedding 候选为 `bge_m3_local`；`mock_fixed_384` 仅是 fallback，384 维不再是全局默认。
- Provider capability 当前结论统一为 `available / fallback / unavailable / disabled / error`，不再使用布尔 `available` 作为跨模块契约。
- 上传/解析/embedding/RAG 长任务已有可恢复事件流契约：job lock、heartbeat、retry、`event_seq`、SSE `Last-Event-ID` 和轮询快照。

### 待完成

- 进入代码实现时，把 D-068 转成首版 Pydantic schema、Alembic migration draft 和 contract tests。

## 2026-05-14（三张技术选型图后的 P0 架构细化）

### 已完成

- `docs/technical-stack-and-prototype-plan.md` 升级到 v0.6：新增 P0 默认栈 / P1 可选栈 / P2 暂缓栈矩阵，覆盖 Uppy、tus-style upload、SSE、local filesystem、StorageAdapter、local_sqlite_worker、PyMuPDF、pdfplumber、PaddleOCR、Whisper、pandas、Pandera、KeyBERT、HanLP/spaCy、bge-m3、bge-reranker-v2、SQLite + sqlite-vec、LlamaIndex/LangChain adapter 边界和 Text-to-SQL 工具评估边界。
- `docs/ai-provider-architecture.md` 升级到 v0.3：ProviderRegistry 扩展为 capability registry，包含 parser / OCR / ASR / vision / video / cleaning / PII / embedding / chat / tag / text_to_sql / rerank，并清理只保留 Mock/RuleBased 的旧口径。
- `docs/p0a-execution-plan.md` 升级到 v0.4：W2-W5 绑定具体默认工具，明确 Uppy/tus/SSE、local queue、PyMuPDF/pdfplumber、PaddleOCR/Whisper、pandas/Pandera、KeyBERT/HanLP/spaCy、bge-m3、bge-reranker-v2 和 fallback 验收。
- `docs/api-design.md` 升级到 v0.5：扩展 `/api/ai-providers/capabilities`，返回 parser/OCR/ASR/embedding/rerank/LLM capability status；RAG answer 响应增加 provider status。
- `docs/data-model.md` 升级到 v0.6-draft：不新增 provider 表，在 upload/files/jobs/parse/embedding/answer 等现有对象中记录 `provider_key`、`provider_version`、`profile`、`capability_status` 和 `fallback_reason`。
- `docs/testing-strategy.md` 升级到 v0.3：新增 provider/fallback fixture 矩阵，覆盖 PyMuPDF/pdfplumber/PaddleOCR/Whisper/bge-m3/bge-reranker-v2/local LLM 缺失和 fallback reason。
- `docs/error-handling-and-observability.md` 已同步 provider capability、parser、OCR/ASR、upload 和 RAG fallback 错误码白名单。
- README 与 `docs/development-plan.md` 已同步 D-067 技术选型细化。

### 验收

- P0 默认技术栈不再停留在“支持上传/解析/Embedding/RAG”的抽象表述，而是有明确默认工具、可选增强和暂缓依赖。
- 桌面本地优先不变：P0 不强制 Redis、MinIO、PostgreSQL、Qdrant、云存储或商业模型。
- Provider 缺失行为被统一为 capability status + fallback reason，供 Query Explanation、Citation Preview、状态条和测试 fixture 使用。

### 待完成

- 进入代码实现前，把 D-067 的 capability status 字段映射进首版 OpenAPI schema 和 migration draft。
- P0-Core 开工时优先实现 `/api/ai-providers/capabilities` 的 mock/runtime probe，以便后续上传、解析、Embedding 和 RAG 页面共用。

## 2026-05-14（五张架构图后的完整 P0 架构升级）

### 已完成

- 将原 P0-A / P0-B 口径升级为 **P0-Core / P0-File / P0-AI / P0-RAG** 四切片。
- `docs/mvp-scope.md` 升级到 v0.6：明确 P0 不再只是 `text_import` 建库闭环，而是覆盖账号预埋、上传、文件接收、完整性校验、解析、切片、AI 结构化、Embedding、Hybrid Retrieval、RAG answer / evidence-only fallback 和用户记录。
- `docs/data-model.md` 升级到 v0.5-draft：新增 / 升级 `user_profiles`、`auth_identities`、`roles`、`access_policies`、`upload_tasks`、`upload_parts`、`files`、`file_integrity_checks`、`ingestion_jobs`、`processing_status_events`、`parse_tasks`、`parse_warnings`、`chunk_quality_checks` 等 P0 对象，并明确 `files` 与 `sources` 分工。
- `docs/product-architecture.md` 升级到 v0.7：把上传、文件处理、AI 结构化、Embedding、P0-RAG 与回流纳入产品总闭环。
- `docs/api-design.md` 升级到 v0.4：新增 Auth preembed、Upload、File processing、Knowledge pipeline、Embedding rebuild、RAG answers/fallback API 组和相关错误码。
- `docs/api-implementation-plan.md` 升级到 v0.4：补齐 auth/uploads/files/parsing/rag route、service、repository、transaction 和 contract test 映射。
- `docs/p0a-execution-plan.md` 重写为 P0 6 周执行计划：W1 P0-Core、W2 P0-File、W3 Parser/Chunk、W4 KU/Embedding、W5 Evidence/Citation、W6 RAG Answer/Fallback/E2E。
- `docs/rag-pipeline.md` 升级到 v0.2：明确 SQLite + sqlite-vec + `embeddings` 主库混合策略不变，P0-RAG 生成 RAG answer 或 evidence-only answer。
- `docs/technical-stack-and-prototype-plan.md`、`docs/desktop-architecture.md`、`docs/testing-strategy.md`、README 和本开发计划已同步到新口径。

### 验收

- P0 输入已从 `text_import` 单入口升级为 Upload / File Processing + `text_import` 同一入库管线。
- RAG answer 不再只标 P1；P0-RAG 支持 Provider answer 与 evidence-only fallback。
- 账号系统进入 P0 disabled contract：默认 `local_user` 自动创建，真实登录写接口返回 `auth_not_enabled_in_p0`。
- AI 能力采用开源优先 ProviderRegistry；商业 Provider 只作为可选适配。

### 待完成

- 进入代码实现前冻结 P0 第一批迁移表、状态枚举和 OpenAPI schema。
- 创建 P0-Core 工程骨架并补充合同测试、端到端 smoke test 和本地数据目录占位。

---

## 2026-05-12（RAG + Embedding 向量库口径补强）

### 已完成

- 新增 `docs/rag-pipeline.md`，明确 RAG、Embedding、向量索引、Hybrid Retrieval、Evidence Pack 和真实 RAG Answer 的阶段边界。
- 将用户“需要用 RAG 和 embedding 做向量数据库”的要求转译为工程口径：P0-A Core 必须建设 `embeddings` 表、`EmbeddingRepository` 和 `VectorStoreService` 抽象。
- 修正降级边界：sqlite-vec 运行时可以降级到 deterministic score / keyword ranking，但不能移除向量存储 Schema 和向量检索接口。
- 同步 `docs/data-model.md` §2.8、`docs/technical-stack-and-prototype-plan.md` §2.1、`docs/p0a-execution-plan.md`、`docs/mvp-scope.md`、`docs/development-plan.md`、`README.md`。

### 验收

- 已区分“RAG 是流水线”与“Embedding + Vector Index 是向量库层”。
- 已保持 D-063 主库混合策略：P0 不引入独立向量数据库服务，P1 优先 PostgreSQL + pgvector。

---

## 2026-05-12（P0-A Core 裁剪优化）

### 已完成

- `docs/p0a-execution-plan.md`：
  - 新增 P0-A Core / Shell / P0-A+ 分层，明确建库闭环是 Core，诊断报告、完整备份、日志 30 天轮转、正式打包和完整 Onboarding 不阻塞 Core。
  - 产品命名从“W1 前必须正式冻结”调整为“W1 前使用稳定开发期占位名，正式外部分发前冻结”。
  - W1 sqlite-vec 改为能力探测，失败时进入 degraded vector mode，不阻塞工程骨架。
  - W2 只创建 P0-A 两个只读视图，Onboarding 降级为最小 1 步。
  - W4 任务表按 Core / Shell / P0-A+ 分层，检索模板收缩为 3-5 个 P0-A 核心模板。
  - 性能验收改为 1K KU < 1 秒 must，10K KU < 1 秒 pressure target。
- `docs/api-implementation-plan.md`：
  - 将 P0-5 / P0-6 改为 P0-B-1 / P0-B-2，避免调用域误进入 P0-A。
  - Repository 组织从“每表一个文件”调整为按业务聚合：Project / Source / KnowledgeUnit / Review / Retrieval / Embedding / Audit。
- `docs/error-handling-and-observability.md`：
  - 明确 P0-A Core 只强制错误 envelope、核心错误码、UI 消息映射和基础日志；诊断报告、完整脱敏导出和日志 30 天轮转进入 Shell / P0-A+。
- `docs/technical-stack-and-prototype-plan.md` 与 `docs/mvp-scope.md`：
  - 冻结清单拆分为 blocking / non-blocking，只有技术栈、P0-A schema、核心 API、权限枚举、错误 envelope、smoke test 和开发期命名占位阻塞 W1。
- `docs/desktop-architecture.md`：
  - 明确 P0-A W1 可使用稳定开发期占位名，正式分发前再冻结品牌并制定迁移方案。

### 验收

- 已清理 P0-5 / P0-6 作为 P0-A 阶段命名的残留。
- 已确认 sqlite-vec、打包、备份、诊断报告、完整 Onboarding 均有降级或后置路径。

---

## 2026-05-12（D-063：向量 / RAG 主库混合策略）

### 已完成

- 用户确认采用 **hybrid_sqlite**：Embedding 写入主库 `embeddings` 表 + **sqlite-vec** 相似度检索，与 FTS5、Text-to-SQL、元数据过滤等构成 **混合检索**；**非独立向量数据库**（Milvus / Pinecone / 与主库分离的专库）。
- 新增决策 **D-063**，并更新 **D-059** 说明冻结清单条数随 D-063 增至 technical-stack §11 **27** 条。
- `docs/data-model.md` **v0.4-draft**：新增 **§2.8**；§11 冻结门槛补充向量形态 + 文档版本头更新。
- `docs/technical-stack-and-prototype-plan.md` **v0.4**：**§2.1** 向量存储与 RAG 路径；决策矩阵 SQLite 行补充混合检索；§11.1 插入第 2 项并重排 **8–27** 编号。
- `docs/mvp-scope.md` **v0.5**：§10.1 / §10.2 补充 D-063。
- `docs/product-architecture.md` **v0.6**：P0-A 数据层 4 层框图注释（单一主库 + 非独立向量库）。
- `docs/ai-provider-architecture.md`：§1 互引 `data-model` §2.7–2.8 与 D-063。
- `docs/development-plan.md` **v0.20**：已完成段首条 + 决策表 D-063 + D-059 条文案 + 第四轮「26 条」改为「27 条（D-063）」。
- `README.md`：文档说明与 Done 段更新。

### 验收

- `grep`：各文档对「独立向量库」的排除与「主库混合」表述一致，D-063 在 development-plan / mvp / data-model / technical-stack 可互链。

---

## 2026-05-12（第四轮架构优化 8 条建议落地）

### 当前任务

基于第四轮跨文档评估结论，实施 8 条架构优化建议：跨文档 permission 枚举统一、SQLite 方言修复、技术栈表述清理、桌面系统 API 契约、Repository 抽象层接口契约、冻结清单同步、Personal Agent 占位规则、错误处理与可观测性策略 + Onboarding 落地 + 命名冻结。所有优化只涉及文档调整，不改变 P0-A 工程实现范围与技术栈。

### 已完成

- 建议 1：跨文档 permission 枚举统一为 P0 3 值（normal / sensitive / do_not_share）：
  - `docs/api-design.md`：3 处示例 + 错误码白名单新增 `invalid_permission_value` + 新增 §4.5 permission 字段约定
  - `docs/text-to-sql.md`：默认排除清单 + `allowed_permissions` 默认值改为 `["normal"]` + 与 data-model 互引
  - `docs/knowledge-invocation-system-design-plan.md`：调用过滤条件改写为 P0 3 值 + P1 兼容映射注释
  - `docs/data-model.md`：调用过滤章节改写为 P0 3 值 + sensitive / do_not_share 处理规则
- 建议 2：`docs/text-to-sql.md` §7 SQL 模板修复 SQLite 方言违反：
  - 7.1 / 7.3 / 7.4 / 7.9 模板：`= true / = false` 改为 `= 1 / = 0`
  - 7.4 模板：`:tag_name = ANY(tag_names)` 改为 `EXISTS (SELECT 1 FROM json_each(tag_names) WHERE value = :tag_name)`
  - §3 默认调用条件清单：增加"逻辑条件 vs 方言转换"注释
- 建议 3：清理"技术栈未确定"过时表述：
  - `README.md`：技术栈状态段落改为"P0 技术栈已确定"
  - `docs/api-implementation-plan.md` §2：技术栈中立约定改为技术栈映射，明确 Electron + FastAPI + SQLite + SQLAlchemy 栈
  - `docs/product-architecture.md`：桌面注脚去掉 "Tauri 或同等桌面框架"，改为 "Electron（D-039）"，Tauri 仅作为 P2 备选
- 建议 4：在 `docs/api-design.md` 升级为 v0.3-draft，新增 §16 桌面系统 API（10 节）：
  - 17.2 `/api/health` + `/api/system/info`
  - 17.3 `/api/system/data-dir` + `:move`（带 confirmation_token）
  - 17.4 `/api/backups` CRUD + `:restore`（auto backup before restore）
  - 17.5 `/api/exports/knowledge-units` + `/api/exports/project`
  - 17.6 `/api/settings`（PATCH 字段白名单）
  - 17.7 `/api/ai-providers`（API Key 必走 IPC，HTTP 拒绝带 `api_key`）
  - 17.8 `/api/onboarding/state` + `:sample-materials:import`
  - §4.4 错误码白名单新增 7 项（`invalid_permission_value` / `migration_in_progress` / `ai_provider_unavailable` / `backup_in_progress` / `agent_not_supported_in_p0` / `api_key_must_use_ipc` / `data_dir_move_failed`）
- 建议 5：在 `docs/api-implementation-plan.md` 升级为 v0.3-draft，新增 §11 Repository 抽象层接口契约（10 节）：
  - 命名与文件组织（P0-A 默认按业务聚合组织 Repository，避免每表一个文件的样板膨胀）
  - 接口签名约定（Protocol + 业务 dataclass + 命名参数，禁止原始 SQL）
  - 事务边界与 UnitOfWork（Service 层显式 commit）
  - 异步策略（aiosqlite → asyncpg）
  - 异常转化映射（IntegrityError → DuplicateError 等）
  - SQL 方言适配点矩阵（boolean / timestamp / JSON / 全文 / 向量）
  - 测试约定（Fake / in-memory / 临时文件三档）
  - P1 PostgreSQL 迁移检查清单
- 建议 6：统一三处冻结清单：
  - `docs/mvp-scope.md` §10 升级为 v0.4：按"数据模型 / 技术栈 / 权限与 Agent / API 契约 / 产品包装"5 个分类细化
  - `docs/technical-stack-and-prototype-plan.md` §11 升级为 v0.3：与 mvp-scope §10 同步同一份冻结项（**第四轮结束时为 26 条，D-063 后增至 27 条**）
  - 与 `docs/data-model.md` §11 互引
- 建议 7：定义 P0 Personal Agent 占位规则：
  - `docs/knowledge-invocation-system-design-plan.md` §6.1：Invocation Request 字段表新增 `agent_id`（P0 default null），并补充占位规则 5 条
  - §6.2 Scope 计算原则补充"P1 多 Agent 优先取 default_project_scope，P0 跳过"
  - `docs/mvp-scope.md` §3.3：P0-B 调用预览能力章节新增 Personal Agent 占位规则段落
  - `docs/api-design.md` §11.1：Invocation Request 示例新增 `agent_id: null` + 显式 ID 返回 `agent_not_supported_in_p0` 提示
- 建议 8：错误处理与可观测性 + Onboarding 落地 + 命名冻结：
  - 新增 `docs/error-handling-and-observability.md` v0.1（12 节）：错误 envelope / HTTP 状态码映射 / 错误码命名规范 / P0 错误码白名单聚合 / UI 消息映射 + i18n 文案示例 / 全局错误展示位置 / 诊断报告契约（POST /api/system/diagnostics:export）/ 日志策略（分层 + 位置 + 级别 + 脱敏 + 轮转）/ 崩溃报告与遥测（P0 默认全 OFF）/ P1 可观测性指标 / 与 audit_logs / processing_status_events 边界澄清
  - `docs/p0a-execution-plan.md` 升级为 v0.2：
    - §2.2.1 产品命名与品牌冻结：W1 开工前必须冻结应用品牌名 / Bundle ID / Product ID / 数据目录名 / Keychain service 名 / SemVer 起始版本
    - W2 任务表新增 3 行：Onboarding API + sample-materials + 前端 Onboarding 5 步引导 + 全局 Toast/Banner/Modal 组件 + 错误码 i18n 映射
    - W2 DoD 补充：错误响应统一 envelope + 前端能根据 error code 显示中文 UI 文案
    - W4 任务表新增 4 行：诊断报告 API + 日志脱敏 + 设置页面 + Error Boundary + Onboarding E2E
    - W4 DoD 补充：诊断报告 / 任意错误码可被翻译 / 日志日轮转 30 天清理
    - §6.2 降级原则新增错误响应 envelope（不可降）+ Onboarding（保留 1 步）+ 诊断报告（保留导出 sidecar 日志 1 个能力）
- 同步更新 `README.md`：
  - 文件列表新增 `error-handling-and-observability.md`
  - api-design / api-implementation-plan 描述升级为 v0.3 + Repository 抽象层契约
  - Done 段落补充第四轮 8 条优化
  - Pending 段落补充第四轮新增 6 项评审任务
- 同步更新 `docs/development-plan.md` 升级为 v0.19：
  - 已完成段落补充第四轮 8 条优化（带具体子项）
  - 决策记录新增 D-055 至 D-062
- 文件版本变更：
  - api-design v0.2-draft → v0.3-draft
  - api-implementation-plan v0.2-draft → v0.3-draft
  - mvp-scope v0.3 → v0.4
  - technical-stack-and-prototype-plan v0.2 → v0.3
  - p0a-execution-plan v0.1 → v0.2
  - development-plan v0.18 → v0.19
  - 新增 error-handling-and-observability v0.1
- 决策记录新增 D-055 至 D-062：
  - D-055：permission 跨文档统一为 P0 3 值
  - D-056：SQLite 方言统一适配（`= 1` + `json_each`）
  - D-057：桌面系统 API 契约（9 组 endpoint + 7 个新错误码）
  - D-058：Repository 抽象层接口契约
  - D-059：冻结清单三处同步（**26→27 条**，含 D-063）
  - D-060：P0 Personal Agent 占位规则
  - D-061：错误处理与可观测性策略
  - D-062：产品命名与品牌冻结时机（P0-A W1 前）

### 验收结果

- 跨文档关键词检查：
  - `permission.*"private"` / `permission.*"project_internal"` / `permission.*"restricted"`：无残留（除 D-051 兼容映射与 P1 评估说明）
  - text-to-sql §7 SQL 模板：无 `= true` / `= false` / `ANY(array)`
  - README / api-implementation-plan / product-architecture：无 "技术栈未确定" / "Node.js or Python" / "TS or Python" 中立表述
- 文档间互引完整：error-handling-and-observability 引用 api-design §16 / data-model §3.7 / desktop-architecture §13 / ai-provider-architecture §6；api-design §16 引用 desktop-architecture §15 与 ai-provider-architecture §5；api-implementation-plan §11 引用 data-model §2.2、§5、§6；mvp-scope §10 引用 data-model §11、technical-stack §11、p0a-execution-plan §2.2.1。
- 冻结清单一致性：mvp-scope §10 / technical-stack §11 / data-model §11 三处冻结项分类一致，无版本差异。

### 待完成

- 评审 `docs/api-design.md` v0.3 §16 桌面系统 API 是否覆盖 P0-A 启动必需的所有交互（健康检查 / 备份 / 设置 / Onboarding）。
- 评审 `docs/api-implementation-plan.md` v0.3 §11 Repository 抽象层契约，确认接口签名、UoW 事务、异常映射、方言适配、测试约定足以支撑 P0-A W1 开工。
- 评审 `docs/error-handling-and-observability.md` v0.1，确认错误码白名单、UI 消息映射、诊断报告契约和日志脱敏规则。
- 在 P0-A W1 开工前敲定 `docs/p0a-execution-plan.md` §2.2.1 列出的命名条目（应用品牌名、Bundle ID、Product ID、数据目录名、Keychain service 名、SemVer 起始版本）。
- 三处冻结清单（mvp-scope §10 / technical-stack §11 / data-model §11）正式签字冻结，进入 P0-A 工程实现。

---

## 2026-05-12（第三轮架构优化 8 条建议落地）

### 当前任务

基于第三轮跨文档评估结论，实施 8 条架构优化建议：P0-A 可执行周计划、Schema 演进与数据迁移工具链、Electron 安全实践与产品包装、AI Provider 抽象、测试策略、桌面单用户简化、Personal Agent 实体预埋、事件分类决策树。所有优化只涉及文档调整，不改变 P0-A 工程实现范围和技术栈选择。

### 已完成

- 建议 1：新增 `docs/p0a-execution-plan.md` v0.1，定义 P0-A 4 周周计划（W1 工程骨架 → W2 建库前半段 → W3 建库后半段 → W4 检索预览 + 打包）、任务依赖图、Definition of Done、第一条开工命令清单、降级策略、量化验收指标。
- 建议 7：在 `docs/desktop-architecture.md` 升级为 v0.2，新增 §12 Schema 演进与数据迁移工具链：
  - Alembic 工具选型（支持 SQLite/PostgreSQL 双后端）
  - SQLite ALTER TABLE 限制应对（batch_alter_table）
  - 应用启动迁移流程（检测版本 → 自动备份 → 执行迁移 → 验证 → 失败回滚）
  - 备份与回滚策略（保留最近 5 次自动备份 + 手动备份）
  - 跨大版本升级（v0.1 → v0.5 自动按序执行）
  - 与 Electron 自动更新协同
  - Schema 版本与应用版本的关系
- 建议 8：在 `docs/desktop-architecture.md` 新增 §13 Electron 安全实践、§14 产品包装规范、§15 用户首次体验：
  - §13 安全基线（contextIsolation/sandbox/CSP/IPC 输入校验/preload 收敛/日志脱敏）
  - §14 应用品牌、版本号策略 SemVer、标准菜单（macOS/Windows/Linux）、跨平台分发清单
  - §15 5 步 Onboarding 流程、示例材料库、设置页面分组、内置帮助
- 建议 3：新增 `docs/ai-provider-architecture.md` v0.1：
  - AI 能力清单（embedding/chat/summarization/tag_suggestion/text_to_sql/rerank/ku_extraction/relation_suggestion）
  - Provider 抽象接口（Python/TypeScript Protocol 草案）
  - API Key 系统 Keychain 存储约定（service/account 命名 + 注入流程）
  - 网络降级策略（7 类降级触发 + 用户感知 + 离线优先模式）
  - 多 Provider 路由（用户级 → 项目级 → Agent 级 → fallback 链）
  - 调用成本与速率统计（ai_call_logs P1 表）
  - P0 → P1 阶段路径（P1.0 embedding → P1.1 建库 → P1.2 调用 → P1.3 高级 → P2 本地 LLM）
- 建议 4：新增 `docs/testing-strategy.md` v0.1：
  - 测试金字塔（Unit / Repository IT / Service IT / Contract Test / E2E）
  - P0 fixture 数据集（6 段典型材料 + 期望切片数 / KU 数）
  - 性能基线（原建议为 10K KU 检索 < 1 秒，现已被 P0-A Core 裁剪为 1K must / 10K pressure target；Source 导入 < 3 秒、冷启动 < 5 秒保留）
  - SQLite WAL 并发测试场景
  - Playwright Electron E2E 7 步流程（含示例代码）
  - CI 集成预案（GitHub Actions 三平台矩阵）
  - P1 AI 能力评估方案（mock baseline 对比 + 5 项指标）
- 建议 2：在 `docs/data-model.md` 升级为 v0.3-draft：
  - 新增 §2.6 桌面单用户假设（users 表只有一行；user_id 预埋 P1 多设备）
  - §5.5 permission 简化为 3 值（normal / sensitive / do_not_share），P1 兼容映射回 6 值
  - §6.1 users 表注释明确 P0 单行假设
- 建议 5：在 `docs/data-model.md` 新增 §3.6 Personal Agent 实体预埋：
  - P1 草案 agents/agent_invocations/agent_memories 表
  - agents 表字段（system_prompt/default_project_scope/allowed_kb_types/memory_visibility）
  - 同时在 `docs/product-architecture.md` 升级为 v0.5，新增 §5.4.1 Personal Agent 的产品定位章节（多 Agent / 隔离配置 / 共享知识库 / 长期上下文 / 调用可解释 + P0/P1/P2 阶段路径）
- 建议 6：在 `docs/data-model.md` 新增 §3.7 事件类对象分类决策树：
  - 5 类事件表对照（audit_logs / processing_status_events / quality_events / feedback_events / system_logs）
  - 决策树（用户操作 vs 系统事件 → 写操作 vs 反馈 / 流程状态 vs 质量异常 vs 底层日志）
  - 已知重叠和处理原则（feedback bad_citation vs quality bad_citation 等）
  - P1 评估方案 B（统一 events 表 + 多态字段）的优劣对比和决策
- 同步更新 `README.md`：
  - 文件列表新增 `ai-provider-architecture.md` / `p0a-execution-plan.md` / `testing-strategy.md`
  - data-model 描述升级为 v0.3-draft
  - desktop-architecture 描述升级为 v0.2
  - Done 段落补充第三轮 8 条优化总结
  - Pending 段落补充新增 5 项评审任务
- 同步更新 `docs/development-plan.md` 升级为 v0.18：
  - 已完成段落补充第三轮 8 条优化
  - 新增决策记录 D-046 至 D-054
- 文件版本变更：
  - desktop-architecture v0.1 → v0.2
  - data-model v0.2-draft → v0.3-draft
  - product-architecture v0.4 → v0.5
  - development-plan v0.17 → v0.18
  - 新增 p0a-execution-plan v0.1
  - 新增 ai-provider-architecture v0.1
  - 新增 testing-strategy v0.1
- 决策记录新增 D-046 至 D-054：
  - D-046：P0-A 可执行周计划文档化
  - D-047：Schema 演进采用 Alembic + 自动备份 + 失败回滚
  - D-048：Electron 安全基线（contextIsolation/sandbox/CSP/IPC 校验/日志脱敏）
  - D-049：API Key 存储采用系统 Keychain
  - D-050：AI Provider 抽象层 P0 即位
  - D-051：桌面单用户简化（users 单行 + permission 3 值）
  - D-052：Personal Agent 实体 P0 预埋（schema-only）
  - D-053：5 张事件表保留方案 A，P1 视数据量评估方案 B
  - D-054：测试金字塔 + P0 fixture + CI 三平台

### 进行中

无。

### 待完成

- 评审 `docs/p0a-execution-plan.md`，确认 4 周周计划是否可立即开工。
- 评审 `docs/ai-provider-architecture.md`，确认 P0 mock 抽象是否预埋 P1 真实 AI 切换路径。
- 评审 `docs/testing-strategy.md`，确认测试金字塔、性能基线和 CI 矩阵是否覆盖 P0-A 验收。
- 评审 `docs/desktop-architecture.md` v0.2 新增的 Schema 迁移、安全实践、产品包装、Onboarding 章节。
- 评审 `docs/product-architecture.md` §5.4.1 Personal Agent 定位章节。
- 评审 `docs/data-model.md` 桌面单用户简化、permission 3 值、Agent 实体预埋、事件分类决策树。
- 进入 P0-A 工程骨架创建阶段（按 `docs/p0a-execution-plan.md` §5 第一组命令开工）。

### 当前阻塞

无。

---

## 2026-05-12（第二轮架构优化 8 条建议落地）

### 当前任务

基于跨文档系统性评估结论，实施 8 条架构优化建议：桌面框架 Electron、P0 数据库调整为 SQLite、P0 拆分为 P0-A/P0-B、文档架构与代码架构分离、数据模型精简、桌面 UX 约束、数据可移植性和跨文档一致性修复。

### 已完成

- 建议 1+7：新增 `docs/desktop-architecture.md` v0.1，定义 Electron 选型理由、FastAPI sidecar 部署架构、进程模型、Sidecar 管理策略、Python Runtime 打包方案、前后端通信方式、打包与分发策略、P0 工程目录。
- 建议 6：在 `docs/desktop-architecture.md` §9 中定义桌面 UX 约束（窗口布局、系统集成、交互模式、性能预期）。
- 建议 8：在 `docs/desktop-architecture.md` §10 中补充数据可移植性设计（导出格式、备份还原、Obsidian 互通 P1、数据主权声明）。
- 建议 2：在 `docs/technical-stack-and-prototype-plan.md` 中将数据库选型从 PostgreSQL + pgvector 调整为 P0 SQLite + sqlite-vec，更新结论、推荐理由、决策矩阵、目录结构、数据库章节和冻结清单。
- 建议 3：在 `docs/mvp-scope.md` 中拆分 P0 为 P0-A（建库核心闭环，约 15 张表，2-3 周）和 P0-B（调用预览，P0-A 验证通过后 2-3 周），更新建库能力和调用预览能力章节标记。
- 建议 4：在 `docs/product-architecture.md` 总架构图后新增 §4.0 文档架构 vs. P0 代码架构，明确 7 层文档架构 → P0-A 4 层代码架构的映射关系。
- 建议 5：精简 `docs/data-model.md`：
  - 新增 §2.4 P0 SQLite 类型映射表。
  - 新增 §2.5 metadata_json 使用约束。
  - 移除 source_descriptions、chunks、knowledge_units 上的 embedding_id/status/profile 冗余字段，统一通过 embeddings 表的 owner_type + owner_id 查询。
  - 为所有 metadata_json 字段标注 P0 预期用途。
  - 在 knowledge_relations 表增加 project_id 字段。
  - 标记 P0-A 建库必需对象和 P0-B 调用预览对象，注明 retrieval_logs 与 retrieval_plans 的区别。
  - 更新 embeddings.vector 类型为 BLOB（sqlite-vec 格式）。
  - 更新冻结门槛清单。
- 跨文档不一致修复：
  - `docs/architecture-design-plan.md`：relation_type 枚举补充 `solves`，与 data-model §5.9 一致。
  - `docs/api-design.md`：项目创建 API 补充 `kb_type` 字段和可选值说明。
  - `docs/text-to-sql.md`：修复 evidence_packs 查询模板（无 project_id，改为 JOIN invocation_requests），新增 §2.2 SQLite 方言适配说明。
  - `docs/data-model.md`：tag_type 补充 `discipline_tag` 和 `custom_tag`，与 architecture-design-plan 一致。
  - 更新所有文档日期为 2026-05-12。
- 同步更新 `README.md`、`docs/development-plan.md` 和本进度记录。
- 文件版本变更：
  - product-architecture v0.3→v0.4
  - architecture-design-plan v0.8→v0.9
  - knowledge-invocation-system-design-plan v0.5→v0.6
  - data-model v0.1-draft→v0.2-draft
  - text-to-sql v0.1-draft→v0.2-draft
  - api-design v0.1-draft→v0.2-draft
  - api-implementation-plan v0.1-draft→v0.2-draft
  - technical-stack v0.1-draft→v0.2
  - mvp-scope v0.2→v0.3
  - development-plan v0.16→v0.17
  - 新增 desktop-architecture v0.1
- 决策记录新增 D-039 至 D-045。
- 追加架构收敛：
  - 将 `docs/product-architecture.md` 和 `docs/technical-stack-and-prototype-plan.md` 的交付口径统一为 P0-A 先交付建库闭环 + Retrieval Preview，P0-B 再交付 Invocation / Evidence Pack / Citation Preview / Memory Draft。
  - 将 `docs/data-model.md` 表分层明确为 P0-A `must_create`、P0-B `create_later`、PDF 模块 `contract-only`，并标出 `processing_status_events` 为 P0-A optional event。
  - 清理 `docs/architecture-design-plan.md`、`docs/open-source-rag-research.md`、`README.md` 和 `docs/development-plan.md` 中把 PostgreSQL + pgvector 误写成 P0/MVP 主路径的残留表述。
  - 将 P0-A Knowledge Unit 最小字段单独标注，五轴分类和 `use_for` 可先通过 tags 或 `metadata_json` 表达。

### 进行中

无。

### 待完成

- 评审 `docs/desktop-architecture.md`，确认 Electron + SQLite + sidecar 架构。
- 评审 P0-A / P0-B 拆分边界和实施节奏。
- 评审 P0-A must_create、P0-B create_later、PDF 模块 contract-only 表分层。
- 进入 P0-A 工程骨架创建阶段。

### 当前阻塞

无。

---

## 2026-05-12（双域架构优化 6 条建议落地）

### 当前任务

基于 PDF 模块清单与当前双域架构的系统性比对结论，实施 6 条架构优化建议：知识组织层独立化、AI 能力分层、知识库类型学、持续优化机制、前端架构定位和数据维护归属。所有优化只涉及文档调整，不改变 P0 工程实现范围和技术栈选择。

### 已完成

- 优化 1：在 `docs/product-architecture.md` 中将知识组织提升为独立能力层（Section 4.0），同步调整 `docs/architecture-design-plan.md`（新增 Section 2.3，Section 5.7 增加归属说明）。
- 优化 2：在产品架构中显式定义 Building AI 和 Invocation AI 两层 AI 能力栈（Section 4.0.1），同步调整 `docs/architecture-design-plan.md` 和 `docs/knowledge-invocation-system-design-plan.md`。
- 优化 3：在 `docs/data-model.md` 的 `projects` 表中引入 `kb_type` 字段，新增 `kb_type` 枚举（Section 5.10），同步在 `docs/product-architecture.md` 共享底座中增加知识库类型学说明。
- 优化 4：在 `docs/architecture-design-plan.md` 中增加知识持续优化机制（Section 5.10），定义触发条件、操作类型和 Review 约束，同步在 `docs/data-model.md` 中扩展 `review_tasks.target_type` 并新增 `optimization_action_type` 枚举（Section 5.7）。
- 优化 5：在 `docs/product-architecture.md` 总架构图和领域边界中增加前端体验层（Section 5.0）。
- 优化 6：在 `docs/product-architecture.md` 横切支撑层中明确数据维护归属原则（Section 5.4），同步在 `docs/architecture-design-plan.md` 建库域职责中增加写入型维护操作。
- 同步更新 `README.md`、`docs/development-plan.md` 和本进度记录。
- 文件版本变更：product-architecture v0.2→v0.3、architecture-design-plan v0.7→v0.8、knowledge-invocation-system-design-plan v0.4→v0.5、development-plan v0.15→v0.16。决策记录新增 D-032 至 D-037。

### 进行中

无。

### 待完成

- 评审 PDF 模块候选契约对象的 P0-A optional event / P0-B create_later / contract-only 分层。
- 评审 Citation Preview / Query Explanation 第一版展示哪些质量和版本信号。

### 当前阻塞

无。

### 与计划差异

无。按优化建议计划逐条执行文档调整，未进入代码实现。

### 验证记录

- 本阶段为文档优化任务，不涉及代码测试。
- 所有优化仅调整文档表述和架构层级，未改变 P0 工程实现范围和技术栈选择。

---

## 2026-05-12（PDF 架构优化）

### 当前任务

根据 `/Users/achen/Desktop/ai数据库产品/个人智能数据库.pdf` 对当前“知识库构建系统 / 知识调用系统”双模块架构进行文档优化；吸收 PDF 的代码层模块清单，但不扩大工程 P0。

### 已完成

- 已确认 PDF 是单页代码层树形架构图，核心模块包括用户系统、入库系统、文件处理系统、AI 结构化整理系统、数据库存储系统、知识组织系统、知识库调用系统、AI 智能体系统、前端系统、数据维护系统、安全与运维系统。
- 已将 PDF 作为模块 checklist 吸收，而不是作为 P0 直接实现范围。
- 已更新 `docs/product-architecture.md` 到 v0.2，新增横切支撑层，并把用户 / 权限 / 数据归属 / 反馈 / 数据维护 / 版本管理 / 日志 / 异常监控 / 安全 / 性能成本从双模块中抽为治理能力。
- 已更新 `docs/architecture-design-plan.md` 到 v0.7，将建库域细化为资料接入、文件接收与状态反馈、文件格式校验 / 任务队列、解析 / 清洗 / 切片、AI 结构化整理、Review / Validation、存储 / 索引 / 审计。
- 已更新 `docs/knowledge-invocation-system-design-plan.md` 到 v0.4，明确调用域读取 processing status、parse warning、chunk quality、quality event、feedback event 和 version state，并在 Citation Preview / Query Explanation 中展示这些信号。
- 已更新 `docs/data-model.md`，补充 `ingestion_jobs`、`processing_status_events`、`parse_warnings`、`chunk_quality_checks`、`quality_events`、`version_snapshots`、`feedback_events` 和 `system_logs` 作为候选契约；后续已进一步分层为 P0-A optional event、P0-B create_later 和 contract-only。
- 已更新 `docs/mvp-scope.md` 到 v0.2，确认 PDF 模块不扩大 P0，P0 仍只做 `text_import`、mock / rule-based、Evidence Pack、Citation Preview 和 Query Explanation。
- 已同步 README、`docs/development-plan.md` 和本进度记录。

### 进行中

无。

### 待完成

- 评审 PDF 模块候选契约对象的 P0-A optional event / P0-B create_later / contract-only 分层。
- 评审 Citation Preview / Query Explanation 第一版展示哪些质量和版本信号。

### 当前阻塞

无。

### 与计划差异

无。按用户给定计划执行为文档优化任务，未进入代码实现。

### 验证记录

- 已运行 `rg` 检查 PDF 新增概念是否进入相关文档：`文件接收与状态反馈`、`文件格式校验`、`任务队列`、`内容清洗`、`切片质量控制`、`AI结构化整理`、`数据维护`、`版本管理`、`日志`、`异常监控`、`安全`、`性能成本`。
- 已运行 `rg` 检查 P0 排除项是否仍然存在：原生 PDF 解析、OCR、真实 AI 抽取、真实 embedding、真实 Text-to-SQL、完整 RAG answer、自动实体关系抽取、图数据库、多 Agent 执行。
- 本阶段为文档任务，不涉及代码测试。

## 2026-05-09（第四轮优化）

### 当前任务

执行第四轮文档优化：在已有数据模型、MVP 范围、API 草案、Text-to-SQL 查询契约和 route-level 实施计划基础上，补齐技术栈选择与 P0 原型实施边界，并同步 README、开发计划和进度记录。

### 已完成

- 已复核当前文档体系，确认 `docs/text-to-sql.md` 和 `docs/api-implementation-plan.md` 已存在。
- 已确认当前主要缺口是：技术栈仍未最终推荐，P0 原型启动边界、目录结构、验证命令和实施切片尚未独立成文档。
- 已将本轮优化范围写入 `docs/development-plan.md` v0.14。
- 已新增 `docs/technical-stack-and-prototype-plan.md`，明确 P0 推荐技术栈、原型目录、实施切片、数据库迁移顺序、验证命令和实现前冻结清单。
- 已同步 README 文档索引、Done / Pending 状态。
- 已同步 `docs/development-plan.md` 的文档结构、文档拆分路线、决策记录 D-030、验证重点和下一步。
- 已同步 `docs/api-implementation-plan.md`、`docs/product-architecture.md` 和 `docs/architecture-design-plan.md` 中的新文档关系。

### 进行中

无。

### 待完成

无。本轮优化已完成；后续评审项见项目 Pending 列表。

### 当前阻塞

无。

### 与计划差异

无。

### 验证记录

- 已通过 `rg --files` 确认 `docs/technical-stack-and-prototype-plan.md` 已进入当前文档体系。
- 已通过 `rg` 检查确认 `docs/technical-stack-and-prototype-plan.md`、`D-030`、`Electron`、`React + Vite + TypeScript`、`FastAPI sidecar`、`SQLite + sqlite-vec`、`P0-0 工程骨架`、`原型目录` 和 `验证命令` 已进入 README 和相关 docs。
- 已通过残余 `rg` 检查确认旧 MVP 技术栈待办和进行中占位不再残留为未完成任务。
- 已通过 `wc -l README.md docs/*.md` 完成文档规模检查，当前文档总计 7983 行。
- 已通过 `git status --short` 尝试检查版本状态，结果为 `fatal: not a git repository (or any of the parent directories): .git`。
- 本阶段为文档任务，不涉及代码测试。

## 2026-05-09（第三轮优化）

### 当前任务

执行第三轮文档优化：在已有 `docs/data-model.md`、`docs/mvp-scope.md` 和 `docs/api-design.md` 基础上，补齐 Text-to-SQL P0 查询契约与 API route-level 实施映射，并同步 README、开发计划和进度记录。

### 已完成

- 已复核当前文档体系，确认 P0 范围和 API 草案已经存在。
- 已确认当前主要缺口是：Text-to-SQL 仍停留在典型问题列表，API 仍停留在 endpoint 草案，后续原型实现缺少 query contract、route/service/repository 映射和实施切片。
- 已将本轮优化范围写入 `docs/development-plan.md` v0.13。
- 已新增 `docs/text-to-sql.md`，明确 P0 查询契约、白名单对象、只读视图、典型 SQL 模板、SQL 安全规则和 Query Explanation。
- 已新增 `docs/api-implementation-plan.md`，明确 route-level 分层、DTO、service、repository、事务边界、mock 模块、OpenAPI 生成路线和合同测试清单。
- 已同步 README 文档索引、Done / Pending 状态。
- 已同步 `docs/development-plan.md` 的文档结构、文档拆分路线、决策记录 D-028 / D-029、验证重点和下一步。
- 已同步 `docs/product-architecture.md`、`docs/data-model.md`、`docs/architecture-design-plan.md` 和 `docs/knowledge-invocation-system-design-plan.md` 中的新文档关系。

### 进行中

无。

### 待完成

无。本轮优化已完成；后续评审项见项目 Pending 列表。

### 当前阻塞

无。

### 与计划差异

无。

### 验证记录

- 已通过 `rg --files` 确认 `docs/text-to-sql.md` 和 `docs/api-implementation-plan.md` 已进入当前文档体系。
- 已通过 `rg` 检查确认 `docs/text-to-sql.md`、`docs/api-implementation-plan.md`、`D-028`、`D-029`、`Query Explanation`、`SQL 模板`、`route/service/repository` 和 `合同测试` 已进入 README 和相关 docs。
- 已通过残余 `rg` 检查确认旧 Text-to-SQL 与 route-level 待办不再残留为未完成任务。
- 已通过 `wc -l README.md docs/*.md` 完成文档规模检查，当前文档总计 7425 行。
- 已通过 `git status --short` 尝试检查版本状态，结果为 `fatal: not a git repository (or any of the parent directories): .git`。
- 本阶段为文档任务，不涉及代码测试。

## 2026-05-09

### 当前任务

执行第二轮文档优化：在已有产品总架构和数据模型草案基础上，补齐 P0 MVP 范围与 P0 API 设计草案，并同步 README、开发计划和进度记录。

### 已完成

- 已复核当前文档体系，确认已存在 `docs/product-architecture.md` 和 `docs/data-model.md`。
- 已确认当前主要缺口是：P0 范围尚未独立成文档，API 边界仍停留在列表层，后续原型实现缺少可执行接口草案。
- 已新增 `docs/mvp-scope.md`，明确工程 P0 输入、建库能力、调用预览能力、P0 不做、P1/P2 范围、验收标准和验证用例。
- 已新增 `docs/api-design.md`，定义 P0 建库、Review、Retrieval Preview、Invocation、Evidence Pack、Citation Preview、Feedback 和 Memory Draft API 草案。
- 已同步 README 文档索引、Done / Pending 状态。
- 已同步 `docs/development-plan.md` 到 v0.12，补充 D-026 / D-027 决策记录和下一步路线。
- 已同步 `docs/product-architecture.md` 的文档关系，补充 `docs/mvp-scope.md` 和 `docs/api-design.md`。
- 已同步 `docs/data-model.md` 的冻结门槛，补充 MVP 范围与 API 草案一致性检查。
- 已同步 `docs/architecture-design-plan.md` 和 `docs/knowledge-invocation-system-design-plan.md` 中的新文档入口。

### 进行中

无。

### 待完成

无。本轮优化已完成；后续评审项见项目 Pending 列表。

### 当前阻塞

无。

### 与计划差异

无。

### 验证记录

- 已通过 `rg --files` 确认 `docs/mvp-scope.md` 和 `docs/api-design.md` 已进入当前文档体系。
- 已通过 `rg` 检查确认 `api-design`、`mvp-scope`、`P0 API`、`text_import`、`Evidence Pack`、`Citation Preview`、`Memory Draft`、`D-026`、`D-027`、`OpenAPI`、`route-level` 已进入 README 和相关 docs。
- 已通过残余 `rg` 检查确认旧 API 待办和进行中占位不再残留为未完成任务。
- 已通过 `wc -l README.md docs/*.md` 完成文档规模检查，当前文档总计 6064 行。
- 已通过 `git status --short` 尝试检查版本状态，结果为 `fatal: not a git repository (or any of the parent directories): .git`。
- 本阶段为文档任务，不涉及代码测试。

## 2026-05-08

### 当前任务

执行产品合并优化：在保留“知识库构建系统”和“知识调用系统”工程边界的前提下，新增统一产品总架构文档，产出 `docs/data-model.md` v0.1-draft，并同步 README、开发计划和进度记录。

### 已完成

- 已检查当前仓库结构。
- 已确认当前仓库只有根目录 `AGENTS.md`，尚无 README 和 `docs/` 文档体系。
- 已读取 `AGENTS.md` 中与项目定位、文档要求、Text-to-SQL、Knowledge Unit、MVP 和开发规范相关的约束。
- 已创建 `docs/development-plan.md`。
- 已创建 `docs/architecture-design-plan.md`。
- 已创建 `README.md`。
- 已完成建库系统架构设计计划初稿。
- 已将 `docs/development-plan.md` 升级到 v0.2。
- 已补充下一阶段任务拆解、Decision Log、架构验收清单、文档拆分路线和后续验证方式。
- 已阅读 `/Users/achen/Downloads/codex_kb_system_prompt.md`。
- 已将 `docs/development-plan.md` 升级到 v0.3。
- 已将 `docs/architecture-design-plan.md` 升级到 v0.2。
- 已把建库主线从 8 步细化为 9 步：新增 Source Description Card、Embedding + Multi-indexing、Human Review + Validation、Commit + Retrieval + Feedback。
- 已把 README 同步到 v0.3 计划状态。
- 已将 `docs/development-plan.md` 升级到 v0.4。
- 已将 `docs/architecture-design-plan.md` 升级到 v0.3。
- 已把工程 P0 收紧为 `text_import + source_origin`，避免误纳入 PDF / OCR / URL / 代码解析器。
- 已将工程 P0 的 RAG answer 改为 retrieval preview / citation-ready retrieval，完整 RAG answer 放到 P1 或 Agent 调用系统。
- 已确认 Source Description Card 是建库 9 步基线和工程 P0 必备对象。
- 已新增数据模型 v0.1 冻结阶段，要求 Text-to-SQL 和 API 设计前先产出 `docs/data-model.md`。
- 已明确真实 AI 自动抽取 Knowledge Unit 不进入工程 P0，P0 只做手动创建 + 规则 / Mock 候选抽取。
- 已完成 LightRAG / GraphRAG 第一轮开源调研。
- 已新增 `docs/open-source-rag-research.md`，记录 LightRAG、Microsoft GraphRAG、Neo4j GraphRAG 和 LlamaIndex GraphRAG 的可借鉴机制与分期边界。
- 已将 `docs/development-plan.md` 升级到 v0.5。
- 已将 `docs/architecture-design-plan.md` 升级到 v0.4。
- 已确认 LightRAG / GraphRAG 不进入工程 P0 依赖；P0 只保留 relation / MOC 占位和 citation-ready retrieval。
- 已将 relation expansion retrieval 放入 P1 候选，将 community summary / Global Search / Neo4j 或 LightRAG 后端评估放入 P2。
- 已同步 README 文档索引、Done / Pending 和技术栈状态。
- 已将 `docs/development-plan.md` 升级到 v0.6。
- 已将 `docs/architecture-design-plan.md` 升级到 v0.5。
- 已新增 P0 AI 能力替代策略：Source Description、Candidate Knowledge Unit、Tag / Type / Properties 使用手动 + 规则 + Mock，真实 AI API 放入 P1。
- 历史记录：当时曾明确 P0 embedding 使用 deterministic mock vector 和 384 维；该口径已在 2026-05-14 D-068 被更新为 open-source profile 优先、`mock_fixed_384` 仅作 fallback。
- 已要求 Embedding v0.1 存储决策早于 data-model v0.1 冻结。
- 已将 `embeddings` 纳入数据模型候选对象。
- 已将 `knowledge_unit_tags`、`v_knowledge_units_with_tags`、`v_retrieval_evidence` 纳入 Text-to-SQL 可查询边界。
- 已明确 P0 manual relation + MOC placeholder 已确认，待设计的是字段、UI 操作和 retrieval preview 使用方式。
- 已同步 README 的 Done / Pending 和技术栈状态。
- 已确认当前目录不是 git 仓库，本阶段以文件检查和文档验证为准。
- 已新增 `docs/knowledge-invocation-system-design-plan.md`，作为知识调用系统架构主文档。
- 已在知识调用系统文档中定义 Invocation Request、Retrieval Plan、Evidence Pack、Agent Context、Citation Preview、Feedback / Memory Loop 主线。
- 已明确调用系统默认优先调用 confirmed Knowledge Unit，Chunk / Source 作为证据与引用。
- 已明确 Text-to-SQL 负责结构化导航，RAG 负责证据补全。
- 已明确调用系统 P0 先聚焦可解释检索、Evidence Pack 和引用输出，不直接扩展成多 Agent 自主执行。
- 已将 `docs/development-plan.md` 升级到 v0.7，补充知识调用系统阶段 K、决策记录和验收清单。
- 已同步 README 文档索引、知识调用系统主线、关键概念、Done / Pending。
- 已将 `docs/development-plan.md` 升级到 v0.8，明确调用系统 P0 只做 Evidence Pack + Citation Preview + Query Explanation，不做最小 RAG answer。
- 已将 `docs/knowledge-invocation-system-design-plan.md` 升级到 v0.2，收紧 P0 流程为证据包、引用预览和查询解释。
- 已将调用系统 P0 预留对象纳入 data-model v0.1 计划：`invocation_requests`、`retrieval_plans`、`evidence_packs`、`answer_citations`、`ai_answers`、`memories`、`retrieval_feedback`、`v_invocation_evidence`。
- 已统一 Source Description 与 Knowledge Unit 的 embedding 字段表达，改为 `embedding_id`、`embedding_status`、`embedding_profile`，避免与统一 `embeddings` 表冲突。
- 已同步 README 的知识调用系统主线、关键概念、Done / Pending 和技术栈状态。
- 已将 data-model 路线从“直接冻结 v0.1”调整为“先产出 v0.1-draft，待 Review、Embedding、Relation、Text-to-SQL 视图和调用系统最小对象确认后再冻结 v0.1 stable”。
- 历史记录：当时已明确 mock vector 只验证写入、查询、排序和引用链路，不能作为真实语义召回质量验收；该口径已被 D-068 细化为 `mock_fixed_384` fallback profile。
- 已更新 D-002：当前优先级改为“建库工程 P0 优先，知识调用系统架构并行”。
- 已同步 README 的 Done / Pending 与开发计划 v0.8 的冻结顺序。
- 已将 `docs/development-plan.md` 升级到 v0.9。
- 已将当前推荐下一步调整为：先产出 `docs/data-model.md` v0.1-draft，再基于草案定义 Text-to-SQL 可查询对象、只读视图和典型问题。
- 已在工程 P0 清单中补充调用系统候选契约对象与 `v_invocation_evidence` 只读视图预留。
- 已补齐 P0 调用 API 边界：Invocation、Retrieval Plan、Evidence Pack、Citation Preview、Query Explanation、Feedback / Memory Draft。
- 已明确 Evidence Pack 与 Citation Preview 刷新页面或重新打开项目后仍需可复盘，不能只做前端临时展示。
- 已同步 `docs/knowledge-invocation-system-design-plan.md` 的 API 方向，将 Citation Preview、Query Explanation、Feedback / Memory Draft 标记为 P0，RAG Answer 与 Memory Management 标记为 P1。
- 已将 MVP 验收闭环中的“上传 Markdown / Text”改为通过 `text_import` 输入 / 粘贴 Markdown 或 Plain Text，并设置 `source_origin`。
- 已将 Source Description 与 Knowledge Unit 字段候选中的 `metadata` 改为 `metadata_json`。
- 已同步 README 的 Done / Pending 与开发计划 v0.9。
- 已将 `docs/architecture-design-plan.md` 升级到 v0.6，标题改为“知识库构建系统架构设计计划”，并明确本文档不代表完整产品总架构。
- 已将 `docs/development-plan.md` 升级到 v0.10，明确产品拆分为“知识库构建系统”和“知识调用系统 / Agent 调用系统”。
- 已将 `docs/knowledge-invocation-system-design-plan.md` 升级到 v0.3，与“知识库构建系统”命名对齐。
- 已同步 README 的产品拆分、文档说明、主线标题和 Done 状态。
- 已将 `docs/development-plan.md` 升级到 v0.11，记录“产品层合并、工程层分域、数据层共享”的优化方向。
- 已新增 `docs/product-architecture.md`，作为一个产品、两个工程域和共享底座的总架构文档。
- 已新增 `docs/data-model.md` v0.1-draft，包含建库域对象、调用域候选契约对象、`knowledge_unit_chunks`、`evidence_items`、三类 embedding 统一记录和只读视图草案。
- 已同步 README 文档索引、合并判断、Done / Pending 状态。
- 已同步 `docs/architecture-design-plan.md`，补充 `docs/product-architecture.md` 和 `docs/data-model.md` 作为完整产品架构和共享数据模型入口。
- 已同步 `docs/knowledge-invocation-system-design-plan.md`，补充 `evidence_items`、`knowledge_unit_chunks` 和 data-model 草案评审入口。

### 进行中

无。

### 待完成

- [ ] 评审 `docs/product-architecture.md`，确认“一个产品、两个工程域、共享底座”为长期架构原则。
- [ ] 评审 `docs/data-model.md` v0.1-draft，确认 `knowledge_unit_chunks`、`evidence_items` 和三个只读视图是否进入 v0.1 stable。
- [ ] 评审 `docs/mvp-scope.md`，确认工程 P0 范围、P0 不做内容和验收标准。
- [ ] 评审 `docs/api-design.md`，确认 P0 API 是否足以支撑后续原型实现。
- [ ] 评审 `docs/text-to-sql.md`，确认 P0 查询契约、只读视图和典型 SQL 模板是否足以进入模板实现。
- [ ] 评审 `docs/api-implementation-plan.md`，确认 route/service/repository 分层和 P0 实施切片是否足以支撑原型实现。
- [ ] 评审 `docs/technical-stack-and-prototype-plan.md`，确认 Electron + React + Vite + TypeScript、FastAPI sidecar、SQLite + sqlite-vec 是否作为 P0 原型技术栈。
- [ ] 确认工程 P0 的 `text_import + source_origin` 输入模型。
- [ ] 定义 P0 AI 能力替代策略的具体规则和 Mock 输出格式。
- [ ] 明确 Embedding v0.1 存储决策：mock/local/remote、维度、表/列、状态字段和重建策略。
- [ ] 定义 Source Description Card 的 P0 字段。
- [ ] 定义 Knowledge Unit 最小字段集。
- [ ] 设计 Human Review + Validation 状态流转。
- [ ] 定义 Classification / Tag / Properties / Relation 第一版规则。
- [ ] 明确 Source Description / Chunk / Knowledge Unit 三类 embedding 和多索引策略。
- [ ] 明确 relation expansion retrieval、community summary 和 Global Search 的详细 P1/P2 设计。
- [ ] 评审 Invocation Request、Retrieval Plan、Evidence Pack、Citation Preview 和 AIAnswer 的最小字段集。
- [ ] 评审知识调用系统 P0 的 Citation Preview、Query Explanation 和 `AIAnswer.output_type` 规则。
- [ ] 在关键前置决策完成后冻结 data-model v0.1 stable。
- [ ] 按确认后的技术栈进入 P0-0 工程骨架创建。

### 当前阻塞

无。

### 与计划差异

无。

### 验证记录

- 已通过 `rg --files` 确认初始仓库仅包含 `AGENTS.md`。
- 已通过文档创建结果确认 `README.md` 与 `docs/` 文档体系存在。
- 已通过 `rg` 检查确认关键术语已覆盖：`建库系统`、`Source`、`Chunk`、`Knowledge Unit`、`Human Review`、`Text-to-SQL`、`RAG`。
- 已通过开发计划重写结果确认 `docs/development-plan.md` 包含 `下一阶段任务拆解`、`决策记录 Decision Log`、`架构验收清单` 和 `文档拆分路线`。
- 已通过关键术语检查确认 `Source Description Card`、`Multi-indexing`、`Human Review + Validation`、`source_descriptions`、`retrieval_logs` 已进入计划或架构文档。
- 已通过计划更新确认 review findings 中的 P0 越界、Source Description 状态不一致、输入范围含混、缺少数据模型冻结、AI 自动抽取冲突均已处理。
- 已通过联网调研核对 LightRAG、Microsoft GraphRAG、Neo4j GraphRAG 和 LlamaIndex GraphRAG 的当前公开资料。
- 已通过文档更新确认 `docs/open-source-rag-research.md` 存在，并在 README 和开发计划中登记。
- 已通过计划与架构更新确认 GraphRAG 相关能力未进入工程 P0 依赖范围。
- 已通过计划更新确认 4 条 review findings 均已处理：P0 无 AI API 策略、embedding 决策前置、Text-to-SQL join 表补齐、Relation P0 状态一致。
- 已通过 `rg --files` 确认当前文档体系存在。
- 已通过 `git status --short` 尝试检查版本状态，结果为 `fatal: not a git repository (or any of the parent directories): .git`。
- 已通过文档更新确认 `docs/knowledge-invocation-system-design-plan.md` 存在，并在 README、开发计划和进度记录中登记。
- 已通过关键术语检查确认 `Invocation Request`、`Retrieval Plan`、`Evidence Pack`、`Agent Context`、`AIAnswer`、`Memory` 已进入调用系统文档。
- 已通过最终 `rg` 检查确认 README、开发计划、进度记录和调用系统文档均包含新增文档索引与核心术语。
- 已通过本轮文档更新确认 4 条 review findings 均已处理：`progress.md` 同步 v0.8，调用系统 P0 不做最小 RAG answer，data-model v0.1 纳入调用系统对象，Source Description / Knowledge Unit embedding 字段统一为 embedding record 引用。
- 已通过本轮补充修正确认 data-model 不再在下一步第 6 步直接冻结，改为先产出 v0.1-draft，并补充 mock/fallback vector 不代表语义召回质量的验收说明。
- 已通过最终 `rg` 检查确认 D-002、data-model v0.1-draft、Citation Preview、最小 RAG answer 边界和 mock/fallback vector 验收口径均已进入文档。
- 已通过残余 `rg` 检查确认旧表述“P0 是 retrieval preview 还是最小 RAG answer”已移除；`Cited Answer / Creation Output` 仅作为 P1 后续能力出现。
- 已通过 `rg` 检查确认 `Citation Preview`、`Query Explanation`、`AIAnswer.output_type`、`v_invocation_evidence`、`retrieval_preview`、`mock_answer`、`rag_answer` 已进入相关文档。
- 已通过本轮文档更新确认 4 条 review findings 均已处理：下一步顺序改为 data-model draft 优先；工程 P0 清单补齐调用系统候选契约对象；MVP 验收改为 `text_import + source_origin`；字段候选改为 `metadata_json`。
- 已通过本轮文档更新确认 3 条 review findings 均已处理：工程 P0 清单补齐调用系统候选契约对象；API 边界补齐 Invocation / Evidence Pack / Citation Preview / Query Explanation / Feedback Draft；下一步顺序保持 data-model draft 先于 Text-to-SQL 视图。
- 已通过本轮文档更新确认“知识库构建系统”和“知识调用系统”命名边界已同步到 README、开发计划、构建系统架构文档和调用系统架构文档。
- 已通过 `rg --files` 确认 `docs/product-architecture.md` 和 `docs/data-model.md` 已进入当前文档体系。
- 已通过 `rg` 检查确认 `product-architecture`、`data-model`、`产品层合并`、`工程层分域`、`共享底座`、`knowledge_unit_chunks`、`evidence_items`、`v_knowledge_units_with_tags`、`v_retrieval_evidence`、`v_invocation_evidence` 已进入 README 和相关 docs。
- 已通过残余 `rg` 检查确认旧待办“将知识调用系统对象纳入后续 data-model”和“产出 data-model v0.1-draft”不再残留为未完成项。
- 已通过 `wc -l README.md docs/*.md` 完成文档规模检查，当前文档总计 4900 行。
- 本阶段为文档任务，不涉及代码测试。
