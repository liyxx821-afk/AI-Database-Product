# AI 个人知识库产品

本项目是一个面向专业内容创作者的 AI 个人知识库 / 个人数据库产品原型。**产品形态为桌面软件**（非网页应用、非移动 App），面向 macOS / Windows 用户。

产品目标是帮助用户把分散的材料、笔记、项目经验、对话、研究记录、文档和图像，转化为结构化、可检索、可溯源、可复用、可被个人 Agent 长期调用的知识资产。

## 项目定位

本项目不是普通聊天机器人、文件管理器、网盘、简单笔记软件或纯向量数据库 Demo。

当前核心判断：

```text
未来每个人都会有自己的个人 Agent，
而个人 Agent 的能力基础是个人数据库和个人知识库。
```

产品可以分为两个部分：

1. **知识库构建系统**：把用户材料转化为可确认、可追溯、可检索的 Knowledge Unit。
2. **知识调用系统 / Agent 调用系统**：让个人 Agent 通过 Text-to-SQL、RAG、全文检索和向量检索调用个人知识资产。

当前架构：

```text
AI 个人知识资产系统
├── 前端体验层（Knowledge Workspace：/dashboard /import /library /search /ask /graph /outputs /settings）
├── 知识构建域（写入：Source → Chunk → KU → Review → Confirmed）
├── 知识组织层（跨域：标签 / 分类 / 关系 / MOC / 知识库优化）
├── 知识调用域（只读：Intent → Retrieval → Evidence → Citation → Feedback）
├── AI 能力栈（Building AI 建库侧 + Invocation AI 调用侧，开源优先 ProviderRegistry + fallback）
├── 共享底座（数据契约 + 知识库类型学 + 索引）
└── 横切支撑层（治理：Auth / 权限 / 版本记录 / 日志 / 安全 / 性能成本）
```

当前阶段已从文档与架构设计进入 **P0 Feedback Diagnostics Advanced Filters / Export History Z0b-lite 代码阶段**。D-100 已创建 Electron + React + Vite + TypeScript、FastAPI sidecar、SQLite、OpenAPI/generated types、runtime contracts、P0-Z0a text import / review / evidence-only smoke 和八页黑白灰低保真 Knowledge Workspace 壳层；D-101 已补齐文件上传、分片接收、完整性校验、File Inspection Z0a、真实 file list 和 `smoke:p0-file`；D-102 已补齐 Parser Router Z0a、Source / Chunk 创建、parse task、source API 和 `smoke:p0-parse`；D-103 已把 parsed Source / Chunk 接入 Candidate KU、Review Queue、384 维 fallback embedding 和 `smoke:p0-ku`；D-104 已把 confirmed KU 接入 Retrieval Preview、Evidence Pack detail、Search / Ask 真实查询状态和 `smoke:p0-search-ask`；D-105 已把 Evidence Pack detail 扩展为可复盘 Citation Detail，并在 `/search`、`/ask` 内嵌 detail replay 面板和 `smoke:p0-citation-detail`；D-106 已把八页工作台 UI 文案改为默认中文、可切换英文，并通过 `/api/settings` 将语言偏好持久化到 app data 的 `config.json`；D-107 已新增 append-only feedback events、pending-review Memory Draft、memory review confirm/ignore、`/ask` 反馈与保存入口、`/outputs` 草稿摘要和 `smoke:p0-feedback-memory`；D-108 已新增 Feedback Diagnostics 只读列表 / 聚合摘要 API、`/outputs` 反馈诊断面板和 `smoke:p0-feedback-diagnostics`；D-109 已新增 `smoke:p0-desktop-runtime`，验证已 build Electron Main / Preload、renderer preview、FastAPI sidecar、preload bridge、local token、受保护 API、非空 Renderer 和 sidecar clean shutdown；D-110 已新增 Feedback Diagnostics JSON / CSV 脱敏导出 API、`/outputs` 当前筛选导出按钮和 `smoke:p0-feedback-export`；D-111 已新增 feedback diagnostics 高级过滤、`config.json.feedback_export_history` 最近 20 条导出历史 metadata、`/outputs` Export History 面板和 `smoke:p0-feedback-filters-history`。

## 当前文档

```text
AGENTS.md
README.md
docs/
├── ai-provider-architecture.md
├── api-design.md
├── api-implementation-plan.md
├── architecture-design-plan.md
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
apps/
├── api
├── desktop-main
├── desktop-preload
└── renderer
packages/
├── api-types
├── runtime-contracts
└── shared-config
scripts/
```

文档说明：

- [AGENTS.md](./AGENTS.md)：项目长期开发准则、产品定位、技术原则和 Codex 工作规则。
- [docs/project-background-brief.md](./docs/project-background-brief.md)：项目背景说明书 v0.13，面向后续 Agent 的快速接手入口，概括项目为什么存在、目标用户、当前架构、冻结技术选择、P0-Z0a/Z0b/Z1/Z2 边界、常见误区、推荐阅读顺序、D-090 技术栈执行优化、D-091 工程化验收门槛、D-092 代码骨架前置契约、D-093 桌面运行时硬化、D-094 P0-Core 工程骨架开工契约、D-095 架构审查实现验收强化、D-096/D-097 分布式开发计划、D-098 前端页面信息架构、D-099 前后端交付边界与 D-104 Search / Ask 真实接入后的实现前检查点。
- [docs/architecture-design-plan.md](./docs/architecture-design-plan.md)：知识库构建系统架构设计计划 v1.3，只覆盖材料入库、知识单元生成、确认、索引和可追溯，不代表完整产品总架构；已补齐知识切片质量闭环与 AI 结构化整理 profile。
- [docs/product-architecture.md](./docs/product-architecture.md)：产品总架构 v0.15，说明完整 P0 如何由 P0-Core / P0-File / P0-AI / P0-RAG 四切片落地，并纳入 File Inspection、知识切片质量闭环、AI 结构化整理 profile、知识调用 profile、D-081-D085 调用边界、隐式单 Agent、D-098 八页 Knowledge Workspace 页面契约、安全运维横切层与 P0-Z0a/Z0b 竖切。
- [docs/data-model.md](./docs/data-model.md)：数据模型 v0.23-draft，定义账号预埋、上传、文件、File Inspection、解析、切片前准备层、检查门映射、知识切片质量、切片执行 profile、AI 结构化整理 profile、D-079 结构化整理子字段与存储映射、D-080 调用 profile 元数据、D-081/D-082/D-083/D-085 调用边界与 profile schema、D-092 trace chain 与 Evidence Pack 失败态、D-104 Retrieval Preview 复用既有 `retrieval_logs` / `evidence_packs` / `evidence_items` / `ai_answers` 边界、D-107/D-108 `feedback_events` / `memories` 与只读诊断边界、安全运维事件、事件枚举单一来源、知识单元、向量、RAG answer、用户记录对象、Provider capability/fallback 元数据和 P0-Z0a/Z0b/Z1/Z2 迁移波次。
- [docs/mvp-scope.md](./docs/mvp-scope.md)：MVP 范围说明 v0.13，锁定完整 P0 入库、File Inspection、知识切片质量闭环、AI 结构化整理 profile、知识库调用 profile、D-081-D085 调用持久化 / profile / feedback_policy 边界、前端状态契约与安全运维横切层范围、验收标准、P0-Z0a/Z0b 实现竖切和降级边界。
- [docs/api-design.md](./docs/api-design.md)：P0 API 设计草案 v0.26，定义 Auth preembed、Upload、File Inspection、ProcessingJob Events、File processing、Knowledge pipeline、chunk build、KU extract structuring summary、切片前准备、检查门摘要、切片执行 profile summary、Retrieval Preview、Evidence Pack detail / Citation Detail replay、RAG answer/fallback、query understanding、retrieval strategy、ranking、citation trace、feedback actions / feedback policy、Provider capability status、桌面系统 API、D-106 `/api/settings` language 持久化边界、D-107 `/api/feedback` / `/api/memory-drafts` 回流边界、D-108 `GET /api/feedback` / `GET /api/feedback/summary` 诊断读取边界、D-110 `GET /api/feedback/export` JSON / CSV 脱敏导出边界，以及 D-111 高级 filters / export history 边界。
- [docs/text-to-sql.md](./docs/text-to-sql.md)：Text-to-SQL P0 查询契约 v0.4，定义白名单对象、只读视图、典型 SQL 模板、权限过滤、Query Explanation，以及 D-081/D-085 的 Z0a retrieval_log 锚点 / Z2 persisted 调用对象边界。
- [docs/api-implementation-plan.md](./docs/api-implementation-plan.md)：API route-level 实施计划 v0.28-draft，定义 P0-Core / P0-File / P0-AI / P0-RAG 的 route、DTO、service、repository、事务边界、job-first chunk build、切片前准备、切片执行 profile、AI 结构化整理 profile、知识调用 profile、隐式单 Agent 边界、D-081-D085 调用边界、D-092 OpenAPI 类型生成 / trace chain / migration 波次命名、D-093 桌面运行时 API 约束、D-094 P0-Core API skeleton 顺序、D-098 页面到 API service 映射、D-105 Citation Detail / Evidence Pack replay 实现边界、D-106 SettingsService / config.json language 持久化边界、D-107 FeedbackService / MemoryService Z0b-lite 实现边界、D-108 Feedback Diagnostics 只读诊断边界、D-110 Feedback Diagnostics Export 只读脱敏导出边界、D-111 advanced filters / export history config 持久化边界、知识切片质量闭环、安全运维状态、P0-Z0a/Z0b 竖切和 Repository 抽象层接口契约。
- [docs/desktop-architecture.md](./docs/desktop-architecture.md)：桌面应用架构 v0.10，定义 Electron 选型、FastAPI sidecar 部署、SQLite 本地数据库、IPC 通信、打包分发、文件系统集成、离线边界、桌面 UX 约束、数据可移植性、Schema 演进与数据迁移工具链、Electron 安全实践、产品包装规范、首次体验流程、D-092 sidecar 打包验证 spike、D-093 桌面运行时硬化、D-094 P0-Core 启动状态机 / preload API surface、D-098 桌面 Shell / 八页内部路由、D-106 语言设置持久化、D-109 pseudo-packaged desktop runtime smoke 和 D-111 feedback export history metadata config。
- [docs/distributed-development-plan.md](./docs/distributed-development-plan.md)：分布式开发计划 v0.4，基于当前技术栈与架构审查结果，把下一阶段 P0 代码实现拆成 S0-S7 工作流、依赖图、分支 / PR 计划、文件所有权矩阵和 G0-G8 验收门槛；补充共享契约锁、集成节奏、PR 准入 / 退出标准、冲突预案、风险登记、D-098 S6 页面所有权和 D-099 前后端交付边界；明确这里的“分布式”是开发协作方式，不是把 P0 桌面运行时改成分布式系统。
- [docs/ai-provider-architecture.md](./docs/ai-provider-architecture.md)：AI Provider 抽象架构 v0.14，定义 file detection / security scan / preview generation / parser / OCR / ASR / vision / cleaning / PII / token counting / structure recovery / chunking / AI structuring / LLM / Embedding / Reranker 能力注册、Provider manifest、Provider 能力面板、切片执行和 AI 结构化整理 profile adapter 边界、D-082 调用 profile 与 Provider capability 分工、Provider 类型边界、API Key 安全存储、降级策略和多 Provider 路由。
- [docs/p0a-execution-plan.md](./docs/p0a-execution-plan.md)：P0 6 周执行计划 v0.21，定义 P0-Core / P0-File / P0-AI / P0-RAG 的周计划、P0-Z0a/Z0b 竖切、D-090 首批依赖约束、D-091 工程化验收门槛、D-092 代码骨架前置契约、D-093 桌面运行时硬化、D-094 P0-Core 工程骨架开工契约、File Inspection 分层、切片前准备、AI 结构化整理 profile、知识调用 profile、D-081-D085 实现前边界、默认工具栈、降级策略和量化验收指标。
- [docs/testing-strategy.md](./docs/testing-strategy.md)：测试与评估策略 v0.30，定义测试金字塔、P0-Z0a fixture、ProcessingJob fixture、File Inspection fixture、切片前准备 fixture、检查门映射 fixture、Chunk Quality fixture、AI 结构化整理 fixture、知识调用路由 fixture、D-081-D085 持久化边界/profile/前端状态 fixture、D-098 页面契约 fixture、D-105 Citation Detail smoke、D-106 i18n settings smoke、D-107 feedback / memory smoke、D-108 feedback diagnostics smoke、D-109 desktop runtime smoke、D-110 feedback export smoke、D-111 feedback filters / history smoke、安全运维 fixture、D-090 技术栈执行优化 fixture、D-091 工程化验收门槛、D-092 代码骨架前置契约测试口径、D-093 桌面运行时硬化测试口径、D-094 P0-Core 工程骨架开工测试口径、SQLite 并发测试、Electron + Playwright E2E 方案、CI 集成预案和 P1 AI 能力评估方案。
- [docs/error-handling-and-observability.md](./docs/error-handling-and-observability.md)：错误处理与可观测性 v0.9，定义错误响应 envelope、错误码白名单（含 File Inspection、provider capability、parser、OCR/ASR、upload、RAG fallback、feedback 记录失败、sidecar auth、database integrity 和 worker unavailable）、UI 错误消息映射、诊断报告契约、日志分层与脱敏、D-083 前端状态契约、D-092 trace chain、D-093 桌面运行时诊断、D-094 runtime_state 与 UI severity、安全运维横切层、事件枚举单一来源和 P1 可观测性指标，并作为 API error envelope 单一来源。
- [docs/git-management.md](./docs/git-management.md)：Git 管理说明 v0.2，记录本地仓库初始化状态、GitHub private remote、忽略规则、行尾与二进制策略、提交类型、分支建议、首次提交建议和禁止事项。
- [docs/technical-stack-and-prototype-plan.md](./docs/technical-stack-and-prototype-plan.md)：技术栈与 P0 原型实施计划 v0.31，推荐 Electron + React + Vite + TypeScript、FastAPI sidecar、SQLite + sqlite-vec，并根据 README 入口口径把技术栈优化为 P0-Z0a 最小可执行栈、完整 P0 扩展栈和 P1/P2 后置栈，同时落地 D-090 依赖分组、Zustand 状态、sqlite-vec capability probe、File Inspection 分层、evidence-first RAG 执行口径、D-091 工程化验收门槛、D-092 代码骨架前置契约、D-093 桌面运行时硬化、D-094 P0-Core 桌面工程骨架开工契约、D-095 架构审查实现验收强化、D-098 Knowledge Workspace 页面 IA、D-104 Search / Ask typed API 接入、D-107 Feedback / Memory typed API 接入、D-108 Feedback Diagnostics typed API 接入、D-109 Desktop Runtime Smoke、D-110 Feedback Diagnostics Export 和 D-111 Feedback Filters / Export History typed API 接入。
- [docs/development-plan.md](./docs/development-plan.md)：持续迭代开发计划、决策记录、架构验收清单和文档拆分路线。
- [docs/knowledge-invocation-system-design-plan.md](./docs/knowledge-invocation-system-design-plan.md)：知识调用系统架构设计计划 v0.11，定义 Agent 如何通过 query understanding、retrieval strategy、ranking、citation trace、Text-to-SQL、RAG、证据包和引用解释调用个人知识资产，并收紧 `implicit_agent`、feedback signal、sensitive grant、P0-Z0a evidence-only 边界与 D-098 Search / Ask / Graph / Outputs 调用页面契约。
- [docs/open-source-rag-research.md](./docs/open-source-rag-research.md)：LightRAG / GraphRAG 开源调研、可借鉴机制和分期边界。
- [docs/rag-pipeline.md](./docs/rag-pipeline.md)：RAG 与 Embedding 向量检索管线 v0.8-draft，明确 P0-Z0a evidence-only、P0-Z2 RAG answer、embedding profile registry、query understanding、retrieval strategy、ranking、citation trace、feedback signal / feedback_policy、D-081-D085 调用 profile、D-092 Evidence Pack 失败态和 chunk quality / source metadata 风险提示。
- [docs/progress.md](./docs/progress.md)：当前阶段进度记录。

## 知识库构建系统主线

当前架构主线：

```text
Source
→ File Receiving / Status Feedback
→ Format Validation / Processing Queue
→ Source Description
→ Parsing / Cleaning / Chunking
→ Chunk Quality Check
→ Candidate Knowledge Unit
→ AI Structured Organization
→ Classification / Embedding / Relations / Schema Match
→ Human Review + Validation
→ Confirmed Knowledge Unit
→ Multi-index + Version / Audit Log
→ Retrieval + Feedback
```

第一阶段重点不是做完整 Agent，而是把以下链路设计清楚：

```text
用户输入材料
→ 系统生成 Source
→ 系统记录接收、校验、排队和处理状态
→ 系统生成 Source Description Card
→ 系统解析、清洗并切分 Chunk
→ 系统记录切片质量检查
→ 用户手动创建或系统规则 / Mock 生成 Candidate Knowledge Unit
→ 系统推荐分类、标签、属性、schema match、关系
→ 用户确认与质量验证
→ 系统固化为可调用知识资产
→ 系统提供检索预览和可引用证据
```

## 知识调用系统主线

调用系统负责把已确认的知识资产转化为个人 Agent 可使用的上下文。

当前架构主线：

```text
Invocation Request（Z0a 为 response/log summary；Z2 持久化）
→ Query Understanding Profile
→ Retrieval Strategy Profile
→ Retrieval Plan（Z0a 为 response/log summary；Z2 持久化）
→ SQL + Keyword + Vector + Relation Retrieval
→ Ranking Profile
→ Evidence Pack
→ Citation Trace Profile
→ Agent Context / implicit_agent
→ Citation Preview / Query Explanation
→ RAG Answer / evidence-only fallback / Creation Output
→ Feedback Signal + Memory Review
```

第一阶段重点不是做全自动 Agent，而是把以下链路做成可追溯、可降级、可复盘的 P0-RAG：

```text
用户提出问题 / 创作 / 决策任务
→ 系统识别意图、查询改写、关键词、范围、约束和输出格式
→ 系统执行权限、状态和确认状态过滤
→ 系统按问题类型选择 FTS5/BM25、向量、metadata、source/file index 或 hybrid search
→ 系统生成 hybrid score、metadata 权重、source_reliability_score / source_reliability_label 和 feedback weight
→ 系统构建 Evidence Pack
→ 系统展示 Citation Preview、Query Explanation、citation trace 和 RAG answer / evidence-only fallback
→ 用户反馈点击、收藏、有用 / 无用、错误引用或缺失来源，反馈只影响后续排序建议，不自动改写知识真值
```

## 关键概念

- **Source**：原始材料来源。
- **Source Description Card**：资料级说明卡，保存摘要、关键词、可信度、权限和资料级 embedding。
- **Chunk**：服务检索和引用的文本片段。
- **Processing Status Event**：资料接收、格式校验、任务队列、解析、切片和失败重试等处理状态记录。
- **Chunk Quality Check**：切片是否为空、过长、重复、缺少来源或无法引用的质量检查。
- **Knowledge Unit**：最小可复用知识资产。
- **Tag**：显式语义索引。
- **Properties**：机器可读结构化字段。
- **Relation**：知识之间的关系。
- **MOC / Community Summary**：未来用于主题级、项目级知识地图和全局理解的组织层。
- **Review Item**：AI 推荐到用户确认之间的工作流对象。
- **Validation**：来源、引用、类型、重复、冲突、权限、检索和 Agent 调用质量检查。
- **Text-to-SQL**：个人 Agent 查询结构化个人数据库的核心技术主线。
- **RAG**：基于用户知识库进行来源可追溯生成的机制。
- **Invocation Request**：一次用户知识调用请求。
- **Query Understanding Profile**：记录意图识别、查询改写、关键词、范围、约束和输出格式判断；P0 默认规则 / 模板，LLM 只是可选 provider。
- **Retrieval Strategy Profile**：记录简单事实、概念解释、关系分析、总结归纳、时间线、文件定位和复杂综合问题分别走哪些检索路径。
- **Ranking Profile**：记录 hybrid score、metadata 权重、source_reliability_score / source_reliability_label、feedback weight 和 reranker fallback。
- **Citation Trace Profile**：记录 Chunk ID、Source/File 定位、页码 / 段落 / text span、原文片段回显、citation confidence、source_reliability_score 和 source_reliability_label。
- **Feedback Signal**：用户点击、收藏、有用 / 无用、错误引用、缺失来源等检索反馈；只影响排序建议，不直接修改 confirmed knowledge。
- **implicit_agent**：P0 隐式单 Agent 边界，允许对话上下文、只读任务规划、内部工具调用、RAG 问答和内容草稿，不允许多 Agent、自主执行或外部 API 工具调用。
- **Retrieval Plan**：系统为一次调用生成的多通道查询计划。
- **Evidence Pack**：由 Knowledge Unit、Chunk、Source、Relation 和查询轨迹组成的证据包。
- **Agent Context**：最终传给模型的上下文。
- **Citation Preview / Query Explanation**：P0 用于展示证据引用、查询路径和可追溯依据；RAG Provider 缺失时降级为 evidence-only answer。
- **AIAnswer / Memory**：Agent 输出与可回流沉淀的长期记忆对象。
- **Quality Event / Feedback Event**：错误引用、缺少来源、回答有用 / 无用等可复盘质量与反馈记录。
- **Version Snapshot / System Log**：支撑数据维护、版本回溯、异常监控、安全和性能成本统计的横切契约。

## 技术栈状态

P0 技术栈已确定（详见 `docs/development-plan.md` D-029 / D-039 / D-040），当前已进入 Feedback Diagnostics / Event Replay Z0b-lite 代码阶段。

P0 技术栈：

- Desktop Framework：**Electron**
- Frontend：React + TypeScript + Vite（Electron Renderer Process）
- Backend：Python + FastAPI（Electron Sidecar）
- Database：**SQLite + sqlite-vec**（P0 本地内嵌），P1 可选迁移 PostgreSQL + pgvector
- Metadata：JSON（SQLite JSON 函数查询）
- Search：SQLite FTS5 全文检索 + sqlite-vec 向量检索 + metadata/tag/folder/relation 索引
- AI Layer：Embedding、Tagging、Text-to-SQL、RAG generation 模块化接口
- Invocation Layer：`query_understanding_profile`、`retrieval_strategy_profile`、`ranking_profile`、`citation_trace_profile`、`feedback_signal`、`feedback_policy`、`InvocationProfileSchema v1` 和 `implicit_agent` 元数据契约。
- Frontend Layer：D-098 固定 `/dashboard`、`/import`、`/library`、`/search`、`/ask`、`/graph`、`/outputs`、`/settings` 八页 Knowledge Workspace；P0 使用 React Context 或 Zustand、fetch/Axios、SSE、Toast、Error Boundary、Loading Skeleton 和 `FrontendStateContract`。
- P0 AI：开源优先 ProviderRegistry；未配置时使用手动 + 规则 + fallback/mock profile（仅用于链路验证）；embedding 默认优先 `bge_m3_local`，缺失时才使用 `mock_fixed_384` fallback。
- P0 默认工具细化：Uppy + tus-style upload、SSE、local filesystem + S3-compatible StorageAdapter、local_sqlite_worker、libmagic/python-magic、charset-normalizer、qpdf/oletools/EXIF adapter、Pillow/PyMuPDF/openpyxl/FFmpeg preview、PyMuPDF/pdfplumber、PaddleOCR/Whisper optional、pandas/Pandera、KeyBERT/HanLP/spaCy、bge-m3 和 bge-reranker-v2 optional。
- GraphRAG：P0 不引入 Neo4j / LightRAG 依赖；P1/P2 再评估。
- Agent：P0 只保留隐式单 Agent；多 Agent、自主执行、外部 API 工具调用、Learning-to-Rank 和 WebSocket 双向事件通道进入 P1/P2。
- P0 拆分：P0-Core（骨架/账号预埋）+ P0-File（上传/解析）+ P0-AI（结构化/向量）+ P0-RAG（证据/RAG/回流）。
- 离线：P0 核心功能全部离线可用。

备选技术栈与选择理由见 `docs/technical-stack-and-prototype-plan.md`。  
桌面框架与部署架构详见 `docs/desktop-architecture.md`。

## 验证方式

当前代码阶段使用：

- `pnpm generate:api-types`
- `pnpm typecheck`
- `pnpm api:ruff`
- `pnpm api:test`
- `pnpm smoke:p0-core`
- `pnpm smoke:p0-desktop-runtime`
- `pnpm smoke:p0-i18n-settings`
- `pnpm smoke:p0-file`
- `pnpm smoke:p0-parse`
- `pnpm smoke:p0-ku`
- `pnpm smoke:p0-search-ask`
- `pnpm smoke:p0-citation-detail`
- `pnpm smoke:p0-feedback-memory`
- `pnpm smoke:p0-feedback-diagnostics`
- `pnpm smoke:p0-feedback-export`
- `pnpm smoke:p0-feedback-filters-history`
- `pnpm smoke:p0-z0a`
- `pnpm --filter @knowledgebase-dev/renderer build`
- `pnpm --filter @knowledgebase-dev/desktop-preload build`
- `pnpm --filter @knowledgebase-dev/desktop-main build`
- `git diff --check`

## Done

- 已完成 Feedback Diagnostics Advanced Filters / Export History Z0b-lite（D-111）：
  - `GET /api/feedback`、`GET /api/feedback/summary`、`GET /api/feedback/export` 已支持 `created_from`、`created_to`、`search`、`ranking_effect`、`has_comment`、`sort=created_desc|created_asc` 与 `limit`。
  - 新增 `GET /api/feedback/export-history` 与 `DELETE /api/feedback/export-history/{id}`；每次导出只向 app data `config.json.feedback_export_history` 写入最近 20 条 metadata、summary totals、filters、content_sha256 和脱敏标记，不保存导出正文。
  - Renderer `/outputs` Feedback Diagnostics 面板增加关键词、时间、ranking effect、comment、排序、limit、重置、高级过滤和 Export History 面板；列表、summary 与导出共享当前过滤条件。
  - 已新增并验证 `pnpm smoke:p0-feedback-filters-history`；反馈驱动排序、feedback 编辑、重新下载旧 content、系统级 zip 诊断包、真实 LLM、provider-backed RAG、Text-to-SQL provider 和 GraphRAG 继续后置。

- 已完成 Feedback Diagnostics Export Z0b-lite（D-110）：
  - 新增 `GET /api/feedback/export`：复用 D-108 filters，支持 `format=json|csv`，返回 filename、mime_type、record_count、generated_at、filters、summary、content 和脱敏标记。
  - JSON 导出包含 summary + events；CSV 导出包含稳定事件表头与 query / citation_label / ranking_effect 上下文字段；不包含 source excerpt、answer text、local token、DB path 或完整本地路径。
  - Renderer `/outputs` Feedback Diagnostics 面板增加 JSON / CSV 格式选择和当前筛选导出按钮，使用 Blob download，不使用 Node fs 或本地路径。
  - 已新增并验证 `pnpm smoke:p0-feedback-export`；反馈驱动排序、反馈编辑、系统级 zip 诊断包、真实 LLM、provider-backed RAG、Text-to-SQL provider、GraphRAG 和长期导出存储继续后置。
- 已完成 Desktop Runtime Smoke / Pseudo-Packaged Sidecar Z0b-lite（D-109）：
  - 新增 `KB_DESKTOP_SMOKE=1` smoke-only 启动模式，Electron Main 会加载已 build preload、启动 FastAPI sidecar、等待 renderer preview、执行 bridge probe 并写入脱敏 JSON 结果。
  - 新增 `pnpm smoke:p0-desktop-runtime`：构建 shared packages、desktop main/preload、renderer，启动 Vite preview 和 Electron dist/main，验证 `runtime.getRuntimeConfig()`、local token、`/api/settings` 授权、`/api/system/runtime`、非空页面和 sidecar clean shutdown。
  - 修正 preload build 产物路径为 `dist/preload.js`，并为本地 `127.0.0.1` renderer 来源增加受限 CORS，保证 Electron Renderer 能通过 typed fetch wrapper 调用 sidecar。
  - 本阶段不新增主路由、数据库表、API schema、真实打包签名、PyInstaller、真实 LLM、Provider RAG、OCR/ASR 或 GraphRAG。
- 已完成 Feedback Diagnostics / Event Replay Z0b-lite（D-108）：
  - 新增 `GET /api/feedback`：按 `created_at desc` 返回 append-only 反馈事件，支持 `feedback_type`、`target_type`、`evidence_pack_id`、`ai_answer_id`、`evidence_item_id` 和 `limit` 过滤。
  - 新增 `GET /api/feedback/summary`：返回 total、by_type、by_target_type、positive_count、negative_count、last_event_at 和当前 `feedback_policy`。
  - 诊断记录从 `feedback_events.metadata_json` 还原 `feedback_signal` / `feedback_policy`，并通过既有 Evidence Pack、Evidence Item、AIAnswer 和 RetrievalLog 补足 query / citation 上下文；仍不写 `retrieval_feedback`，不修改 confirmed KU、Source、Evidence Pack、AIAnswer 或 Memory。
  - Renderer `/outputs` 增加 Feedback Diagnostics 面板，显示摘要计数、类型/目标分布、事件列表和过滤控件；新增 UI 文案已进入中英双语 i18n。
  - 已新增并验证 `pnpm smoke:p0-feedback-diagnostics`；反馈驱动排序、真实 LLM、provider-backed RAG、Text-to-SQL provider、GraphRAG 和自动长期记忆继续后置。
- 已完成 Feedback Events / Memory Draft Review Z0b-lite（D-107）：
  - 新增 `feedback_events` 与 `memories` 最小表；`POST /api/feedback` 只写 append-only 本地事件，不修改 confirmed KU、Source、Evidence Pack 或 AIAnswer。
  - 新增 `POST /api/memory-drafts`、`GET /api/memory-drafts`、`GET /api/memory-drafts/{id}`；从 evidence-only answer 创建 `memories.status=pending_review` 和 `review_tasks.target_type=memory`。
  - Review confirm / ignore 已支持 memory：confirm 标记 `confirmed / user_confirmed=1`，ignore 标记 `archived`；KU review 逻辑保持不变。
  - Renderer `/ask` 增加反馈按钮和保存 Memory Draft 面板；`/library` Review 队列可处理 memory 任务；`/outputs` 显示 Memory Draft 摘要；新增 UI 文案已进入中英双语 i18n。
  - 已新增并验证 `pnpm smoke:p0-feedback-memory`；真实 LLM、provider-backed RAG、`retrieval_feedback`、Text-to-SQL provider、GraphRAG 和自动长期记忆继续后置。
- 已完成 UI i18n / Bilingual Settings Z0b-lite（D-106）：
  - 新增 `GET /api/settings` 与 `PATCH /api/settings`，后端默认返回 `language=zh-CN`，只接受 `zh-CN / en-US`，并将语言偏好原子写入 app data `config.json`。
  - Renderer 新增轻量 typed i18n 层、settings store 和 `/settings` 语言切换控件；普通浏览器无 Electron bridge 时只做 session fallback 并显示 degraded。
  - 八页低保真工作台的导航、标题、按钮、状态、空态、runtime bar、Import/Library/Search/Ask/Citation Detail/Graph/Outputs/Settings 核心 UI 文案已覆盖中英双语；用户内容、文件名、KU、source excerpt、citation label 和 API enum 不翻译。
  - 已新增并验证 `pnpm smoke:p0-i18n-settings`；真实 LLM、feedback、Memory Draft、Text-to-SQL provider、GraphRAG、设计稿级 UI 优化和新主路由继续后置。
- 已完成 Citation Detail / Evidence Pack Replay Z0b-lite（D-105）：
  - 扩展 `GET /api/evidence-packs/{evidence_pack_id}`，后端直接返回可渲染的 Citation Detail：KU title/status/type、Chunk citation/content excerpt、Source title/origin/type、rank score、provider/fallback、query explanation summary 和 citation trace。
  - `/search` 的 Evidence Items 增加 Open detail；`/ask` 可从 answer 的 `evidence_pack_id` 打开同一 detail replay 面板。
  - 空证据包继续显示 `failure_type=no_retrieval_result`、fallback reason 和 no evidence reason；Renderer 不拼接证据链。
  - 已新增并验证 `pnpm smoke:p0-citation-detail`；真实 LLM、feedback、Memory Draft、Text-to-SQL provider、GraphRAG 和关系推理继续后置。
- 已完成 Retrieval Preview / Search-Ask Integration Z0a（D-104）：
  - 新增 `POST /api/retrieval/preview` 和 `GET /api/evidence-packs/{evidence_pack_id}`；`POST /api/retrieval/evidence-only` 复用同一 Evidence Pack 组装逻辑。
  - 检索只读取 `knowledge_units.status = confirmed`；`pending_review` 候选不会进入 Evidence Pack。
  - 无证据时返回 `failure_type=no_retrieval_result`，保留 no evidence reason，不生成伪答案。
  - Renderer `/search` 接入真实 query input、Query Explanation、Evidence Pack、Evidence Items、Citation Trace 和 provider/fallback 状态；`/ask` 接入 evidence-only answer。
  - 已新增并验证 `pnpm smoke:p0-search-ask`；真实 LLM、provider-backed RAG、Memory Draft、feedback、Text-to-SQL provider、GraphRAG 和关系推理继续后置。
- 已完成 Candidate KU / Review / fallback embedding Z0a（D-103）：
  - 新增 Knowledge Unit API：`POST /api/knowledge-units:extract`、`GET /api/knowledge-units`、`GET /api/knowledge-units/{id}`。
  - parsed Source / Chunk 可显式生成 `pending_review` Candidate KU、Review Task 和 `mock_fixed_384` fallback embedding；重复执行默认复用已有候选，避免重复污染。
  - Review confirm 后 KU 才进入 confirmed 检索范围；evidence-only answer 仍只读取 confirmed KU。
  - Renderer `/library` 增加 Source Extract 操作和真实 Review 队列，可 confirm / ignore 候选 KU。
  - 已新增并验证 `pnpm smoke:p0-ku`；真实 LLM、自动关系写入、标签合并、Memory Draft、provider-backed RAG 继续后置。
- 已完成 Parser Router / Source / Chunk Z0a（D-102）：
  - 新增 Parse / Source API：`POST /api/files/{file_id}:parse`、`GET /api/parse-tasks/{id}`、`GET /api/sources`、`GET /api/sources/{source_id}`。
  - 新增 `parse_tasks`、`parse_warnings`、`chunk_quality_checks`；解析过程写入 `file_parse` ProcessingJob 和状态事件。
  - Z0a Parser Router 支持 text / markdown / json / csv 类文件生成 Source / Chunk；unsupported / blocked 文件保留可恢复状态。
  - Renderer `/library` 增加 Parse 操作和 Sources 面板。
  - 已新增并验证 `pnpm smoke:p0-parse`；真实 parser provider、OCR/ASR 和 preview asset 继续后置。
- 已完成 P0-File 上传与 File Inspection Z0a（D-101）：
  - 新增 Upload / File API：`POST /api/uploads`、`PUT /api/uploads/{id}/parts/{part_no}`、`POST /api/uploads/{id}:complete`、`GET /api/uploads/{id}`、`GET /api/files`、`GET /api/files/{file_id}`、`POST /api/files/{file_id}:verify`。
  - 新增本地上传与检查数据对象：`upload_tasks`、`upload_parts`、`files`、`file_integrity_checks`、`file_inspection_results`；文件先进入 app data 的 `tmp/uploads/`，完成后进入 `sources/`。
  - File Inspection Z0a 记录扩展名、MIME、文件大小、sha256、文件头摘要、基础 risk summary、recoverable 状态和 `file_inspection` ProcessingJob events。
  - Renderer `/import` 接入 Uppy core + 自定义黑白灰低保真上传控件，`/library` 显示真实 file list，`/dashboard` 显示 upload/file 计数。
  - 已新增并验证 `pnpm smoke:p0-file`；Parser Router、Source/Chunk 自动创建、OCR/ASR、preview asset 和真实 Provider 继续后置。
- 已完成 P0 代码阶段首轮实现（D-100）：
  - 新增 monorepo 工程骨架：`apps/desktop-main`、`apps/desktop-preload`、`apps/renderer`、`apps/api`、`packages/runtime-contracts`、`packages/api-types`、`packages/shared-config` 和 `scripts`。
  - 建立 FastAPI sidecar、local token middleware、SQLite 初始化、P0-Core API、OpenAPI 导出、generated TypeScript types、统一 error envelope 与 runtime status。
  - 跑通 P0-Z0a 最小业务链路：text import → Source → Chunk → Candidate KU → Review confirm → fallback embedding → RetrievalLog → Evidence Pack → evidence-only answer。
  - 建立 Electron Main sidecar lifecycle、受限 preload bridge、typed fetch wrapper、Zustand store slices 和八页黑白灰低保真 Knowledge Workspace route shell。
  - 已验证：`pnpm generate:api-types`、`pnpm typecheck`、`pnpm api:ruff`、`pnpm api:test`、`pnpm smoke:p0-core`、`pnpm smoke:p0-z0a`、renderer build、desktop preload/main build、`git diff --check`。
- 已完成前后端交付边界与分布式开发计划强化（D-099）：
  - `docs/distributed-development-plan.md` 升级为 **v0.4**，明确 Electron Main、Preload bridge、Renderer Frontend、typed API client、FastAPI sidecar、local_sqlite_worker 与 SQLite/sqlite-vec 的职责边界。
  - 新增 D-099 前后端交付模板、禁止事项、S1/S6 API-to-UI handoff 要求、G8 Frontend / Backend Boundary Gate、前后端边界漂移风险和 preload 过宽风险。
  - `docs/development-plan.md` 升级为 v0.53，决策表新增 D-099；`docs/progress.md`、`docs/project-background-brief.md`（v0.11）与本文档已同步。
  - 本轮仍为文档-only 优化，未新增运行时代码、migration、OpenAPI 文件、endpoint 或依赖。
- 已完成前端页面信息架构与工作台契约收敛（D-098）：
  - `docs/product-architecture.md` 升级为 **v0.15**，固定 Knowledge Workspace 八个内部路由：`/dashboard`、`/import`、`/library`、`/search`、`/ask`、`/graph`、`/outputs`、`/settings`。
  - `docs/technical-stack-and-prototype-plan.md`、`docs/desktop-architecture.md`、`docs/api-design.md`、`docs/api-implementation-plan.md`、`docs/testing-strategy.md` 和 `docs/distributed-development-plan.md` 已同步页面 IA、桌面 shell、页面到 API 组映射、S6 页面所有权和页面状态验收。
  - `docs/development-plan.md`、`docs/progress.md`、`docs/project-background-brief.md` 与本文档已同步。本轮仍为文档-only，未新增运行时代码、migration、OpenAPI 文件、endpoint 或依赖。
- 已完成分布式开发计划二次优化（D-097）：
  - `docs/distributed-development-plan.md` 升级为 **v0.2**，在不改变 P0 本地桌面技术栈的前提下，补充二次审查结论、runtime / API / data / evidence 四类共享契约锁、集成节奏、失败态优先实现顺序、关键路径 / 并行窗口、PR 准入 / 退出标准、冲突处理顺序、文档所有权、G6/G7 gate 和风险登记。
  - `docs/development-plan.md` 升级为 v0.51，决策表新增 D-097；`docs/progress.md`、`docs/project-background-brief.md`（v0.9）与本文档已同步。
  - 本轮仍为文档-only 优化，未新增运行时代码、migration、OpenAPI 文件、endpoint 或依赖。
- 已完成当前技术栈与架构设计审查后的分布式开发计划（D-096）：
  - 新增 `docs/distributed-development-plan.md` **v0.1**，明确继续沿用 Electron + React + Vite + TypeScript、FastAPI sidecar、SQLite + sqlite-vec、local_sqlite_worker、SSE、ProviderRegistry 和 OpenAPI/generated types 的 P0 本地桌面栈。
  - 将下一阶段代码实现拆成 **S0 Runtime Desktop Core / S1 API Contract / S2 Data and Migration / S3 Worker and Job Events / S4 Ingestion and Knowledge Build / S5 Retrieval and Evidence / S6 Renderer Workspace / S7 Verification and Release**，并补充分支、PR、文件所有权与 G0-G5 验收门槛。
  - `docs/development-plan.md` 升级为 v0.50，决策表新增 D-096；`docs/progress.md`、`docs/project-background-brief.md`（v0.8）与本文档已同步。
  - 本轮仍为文档-only 优化，未新增运行时代码、migration、OpenAPI 文件、endpoint 或依赖。
- 已完成架构审查实现验收强化（D-095）：
  - `docs/technical-stack-and-prototype-plan.md` 升级为 **v0.24**，新增 §2.8 / §11.6：**打包态 CI**、**sqlite-vec 降级与 citation 一致性**、**SQLite 单写者与批写入退让**、**OpenAPI 首日**、**日志滚动与隐私**。
  - `docs/development-plan.md` 升级为 v0.49，决策表新增 D-095；`docs/progress.md`、`docs/project-background-brief.md`（v0.7）与本文档已同步。
  - 本轮仍为文档-only 优化，未新增运行时代码、migration、OpenAPI 文件、endpoint 或依赖。
- 已完成 P0-Core 桌面工程骨架开工契约：
  - `docs/technical-stack-and-prototype-plan.md` 升级为 v0.23，新增 D-094 P0-Core 桌面工程骨架开工契约。
  - `docs/desktop-architecture.md` 升级为 v0.6，补齐 runtime state machine 与最小 preload API surface。
  - `docs/p0a-execution-plan.md` 升级为 v0.21，将 `smoke:p0-core` 置于 upload / parse / review / RAG 业务链路之前。
  - `docs/testing-strategy.md` 升级为 v0.21，补充 D-094 对 monorepo structure、runtime state、preload API、local token、SQLite init、shutdown cleanup 和 status bar mapping 的测试口径。
  - `docs/api-implementation-plan.md`、`docs/error-handling-and-observability.md` 和 `docs/project-background-brief.md` 已同步 D-094。
  - 本轮仍为文档-only 优化，未新增运行时代码、migration、OpenAPI 文件、endpoint 或依赖。
- 已完成桌面运行时硬化优化：
  - `docs/technical-stack-and-prototype-plan.md` 升级为 v0.22，新增 D-093 桌面运行时硬化。
  - `docs/desktop-architecture.md` 升级为 v0.5，补齐 sidecar 本地会话 token、`127.0.0.1` 绑定、SQLite WAL / quick_check / pre-migration backup 和 Main 注入式 API 配置。
  - `docs/p0a-execution-plan.md` 升级为 v0.20，将 sidecar local auth、SQLite 数据保护、worker isolation、runtime status bar、Provider settings panel 和最小诊断包写入 W1/W2 gate。
  - `docs/testing-strategy.md` 升级为 v0.20，补充 D-093 对 sidecar token、绑定地址、preload 注入、SQLite 数据保护、worker heartbeat、状态栏、Provider 面板和诊断包的测试口径。
  - `docs/api-implementation-plan.md`、`docs/error-handling-and-observability.md`、`docs/ai-provider-architecture.md` 和 `docs/project-background-brief.md` 已同步 D-093。
  - 本轮仍为文档-only 优化，未新增运行时代码、migration、OpenAPI 文件、endpoint 或依赖。
- 已完成代码骨架前置契约优化：
  - `docs/technical-stack-and-prototype-plan.md` 升级为 v0.21，新增 D-092 代码骨架前置契约。
  - `docs/p0a-execution-plan.md` 升级为 v0.19，将 OpenAPI → TypeScript 类型生成、Provider manifest、trace chain、migration 波次命名、SQLite 1K/10K 性能基线、Zustand store slices 和 Evidence Pack 失败态写入 W1/W5 gate。
  - `docs/testing-strategy.md` 升级为 v0.19，补充 D-092 对类型生成、sidecar 打包 spike、Provider manifest、trace chain、migration 命名、SQLite baseline、Zustand slices 和 evidence failure 的测试口径。
  - `docs/data-model.md` 升级为 v0.20-draft，补齐 `trace_id` 字段映射与 Evidence Pack `failure_type` 约束。
  - `docs/api-implementation-plan.md`、`docs/desktop-architecture.md`、`docs/ai-provider-architecture.md`、`docs/error-handling-and-observability.md`、`docs/rag-pipeline.md` 和 `docs/project-background-brief.md` 已同步 D-092。
  - 本轮仍为文档-only 优化，未新增运行时代码、migration、OpenAPI 文件、endpoint 或依赖。
- 已完成技术栈工程化验收门槛优化：
  - `docs/technical-stack-and-prototype-plan.md` 升级为 v0.20，新增 D-091 工程化验收门槛。
  - `docs/p0a-execution-plan.md` 升级为 v0.18，将最小依赖 CI gate、Provider lazy-load、sidecar lifecycle、typed fetch、sqlite-vec 三态一致性和 evidence-first 不变量写入 W1/W2 gate。
  - `docs/testing-strategy.md` 升级为 v0.18，补充 D-091 对最小依赖、Provider 缺失、sidecar 生命周期、typed fetch、sqlite-vec 一致性和 evidence failure 的测试口径。
  - `docs/project-background-brief.md` 升级为 v0.3，同步后续 Agent 实现前检查点。
  - 本轮仍为文档-only 优化，未新增运行时代码、migration、OpenAPI 文件、endpoint 或依赖。
- 已完成技术栈执行优化：
  - `docs/technical-stack-and-prototype-plan.md` 升级为 v0.19，新增 D-090 执行优化口径。
  - `docs/p0a-execution-plan.md` 升级为 v0.17，将依赖分组、Zustand、sqlite-vec capability probe、File Inspection Z0a/Z0b 分层、optional Provider 后置写入开工 Checklist 与 W1-W3 任务。
  - `docs/testing-strategy.md` 升级为 v0.17，补充 D-090 对依赖分组、optional provider 缺失、sqlite-vec 三态、File Inspection 分层、Zustand SSE 状态和 evidence-first RAG 的测试口径。
  - `docs/project-background-brief.md` 升级为 v0.2，同步后续 Agent 实现前检查点。
  - 本轮仍为文档-only 优化，未新增运行时代码、migration、OpenAPI 文件、endpoint 或依赖。
- 已完成 README 对齐后的技术栈优化：
  - `docs/technical-stack-and-prototype-plan.md` 升级为 v0.18，新增 D-088 技术栈优化口径。
  - 将 README 中的桌面本地优先、P0 四切片、P0-Z0a evidence-only、Provider fallback、主库混合检索和 `implicit_agent` 边界压缩为 P0-Z0a 最小可执行栈、完整 P0 扩展栈、P1/P2 后置栈。
  - 本轮仍为文档-only 优化，未新增运行时代码、migration、OpenAPI 文件、endpoint 或依赖。
- 已建立本地 Git 管理基础：
  - 初始化本地 Git 仓库，默认分支为 `main`，并设置中文路径显示不转义。
  - 新增 `.gitignore`、`.gitattributes` 和 `docs/git-management.md`，覆盖本地临时文件、密钥、数据库、上传资料、日志、构建产物、模型权重、行尾规范和二进制文件处理。
- 已上传到 GitHub private repo：
  - 远程仓库：`ChenchenChen001/ai-database-product`
  - 可见性：private
  - `origin` 绑定为 `https://github.com/ChenchenChen001/ai-database-product.git`
- 已新增 `docs/project-background-brief.md` 项目背景说明书：
  - 面向后续 Agent 快速查阅，集中说明项目定位、目标用户、非目标、核心原则、当前架构、P0 切片、冻结技术选择、数据对象速览、推荐阅读顺序和过期口径。
  - 明确当前仓库仍为产品与架构文档阶段，后续进入工程代码前应先按 README、开发计划、进度记录和领域主文档确认边界。
- 已完成 D-085 Z0a 调用锚点与反馈 / citation 边界修正：
  - `evidence_packs` 与 `ai_answers` 在 P0-Z0a 通过 `retrieval_log_id` / `evidence_pack_id` 串起闭环，`request_id` / `retrieval_plan_id` 可为空；P0-Z2 再持久化 Invocation / Retrieval Plan。
  - Z0a RAG response 返回 `evidence_item_ids`、`citation_labels` 和 `citation_trace_summary`，不要求持久化 citation 明细 ID；`answer_citations` 仍从 Z0b 起补齐。
  - 反馈口径收敛为 Z0a response-only 或 append-only `feedback_events`，Z2 才写 `retrieval_feedback`，且必须携带 `feedback_policy`。
- 已完成 D-084 跨文档同步：
  - 将 D-081-D083 的调用持久化边界、`InvocationProfileSchema v1`、`feedback_policy` 和 `FrontendStateContract` 补齐到 `rag-pipeline`、`product-architecture`、`mvp-scope`、`ai-provider-architecture`、`text-to-sql`、`error-handling-and-observability`。
  - 修正入口文档版本与 README 索引，确保 P0-Z0a summary / P0-Z2 persisted、`rewrite_status=not_needed`、`source_reliability_score/source_reliability_label` 和 feedback 反污染边界一致。
- 已完成 D-081/D-082/D-083 实现前收敛修正：
  - D-081：P0-Z0a 只必须持久化 `retrieval_logs`、`evidence_packs`、`evidence_items` 和 `ai_answers(output_type=evidence_only_answer)`；`invocation_requests`、`retrieval_plans`、`memories`、`retrieval_feedback` 进入 P0-Z2 或可选提前实现。
  - D-082：固定 `InvocationProfileSchema v1`，补齐 `profile_envelope`、`rewrite_status`、`relation_evidence` route、`source_reliability_score` / `source_reliability_label`。
  - D-083：固定 `FrontendStateContract` 与 `feedback_policy`，反馈默认 local_only + current_project scope，只影响排序建议和诊断，不自动改写 confirmed knowledge。
  - 修正 D-080 后遗留的 P0/P1 answer 边界：P0-Z0a 为 `evidence_only_answer`，P0-Z2 或显式 Provider 增强路径才启用 citation-bound `rag_answer`。
- 已完成 D-080 知识库调用、AI 智能体与前端交互架构收敛：
  - 知识库调用系统补齐 `query_understanding_profile`、`retrieval_strategy_profile`、`ranking_profile`、`citation_trace_profile` 和 `feedback_signal`。
  - 检索策略路由明确为简单事实走 FTS5/BM25、概念解释走向量、时间线走 metadata filter、文件定位走 source/file index、复杂问题走 hybrid search；关系分析只使用已确认关系或 relation suggestion 证据。
  - P0 AI 智能体收敛为 `implicit_agent`：只读规划、内部工具调用、RAG 问答和内容草稿可用；多 Agent、自主执行、外部 API 工具调用、GraphRAG、Learning-to-Rank 和 WebSocket 必需依赖均不进入 P0。
  - 前端系统契约补齐页面、交互、状态、接口和异常提示模块，默认 Electron + React + Vite + TypeScript + SSE + Toast / Error Boundary / Loading Skeleton。
  - 本轮仍为文档-only 收敛，未新增运行时代码、migration、OpenAPI 或 endpoint。
- 已完成基于五张架构图的完整 P0 架构升级：
  - 原 P0-A / P0-B 已被 P0-Core / P0-File / P0-AI / P0-RAG 四切片取代。
  - 账号预埋、上传任务、分片/直传、完整性校验、文件保存、Parser Router、解析任务、切片质量、AI 结构化、Embedding、Hybrid Retrieval、Evidence Pack、Citation、RAG answer / evidence-only fallback 和用户记录全部进入 P0 架构。
  - `text_import` 已调整为统一入库管线的一种输入方式，不再是 P0 唯一入口。
  - 默认 AI 能力改为开源优先 ProviderRegistry；商业 Provider 仅作为可选适配。
- 已完成基于三张技术选型图的 P0 架构细化：
  - 明确 P0 默认上传、状态反馈、存储、队列、解析、OCR、ASR、数据清洗、标签、Embedding、Rerank、RAG 和 Text-to-SQL 工具栈。
  - ProviderRegistry 扩展为能力注册中心，记录 `provider_key`、`provider_version`、`profile`、`capability_status` 和 `fallback_reason`。
  - 保持桌面本地优先：不强制 Redis、MinIO、PostgreSQL、Qdrant 或商业模型。
- 已完成本轮架构契约收紧：
  - `mock_fixed_384` 从 P0 默认 embedding 改为 fallback profile；384 维只属于该 fallback，不再作为全局默认。
  - Provider capability 状态统一为 `available / fallback / unavailable / disabled / error`。
  - `local_sqlite_worker` 与 SSE 状态流补齐 lock、heartbeat、retry、`event_seq` 和 `Last-Event-ID` 续读契约。
- 已完成 File Inspection 架构细化：
  - 上传完成与 Parser Router 之间新增真实类型识别、编码检测、安全风险检查、结构识别和预览生成。
  - 新增 `file_inspection_results` 统一承载 inspection report，Parser Router 必须优先消费 `detected_mime_type`、`file_signature`、`risk_level` 和结构识别结果。
  - P0 默认静态风险检查，不执行未知文件；ClamAV、Docker Sandbox、Docling、LayoutParser、Detectron2、Video-LLaVA 均不作为 P0 必装依赖。
- 已完成实现前 P0 竖切收紧：
  - 完整 P0 保留为架构范围，但工程实现按 P0-Z0a / P0-Z0b / P0-Z1 / P0-Z2 波次推进。
  - P0-Z0a 只保留首批 blocking migration；账号预埋明细、分片恢复、citation 明细、sensitive grant 和审计日志进入 P0-Z0b。
  - `ProcessingJob` 作为领域对象，物理表可暂用 `ingestion_jobs`；支持 `target_type` / `target_id` / `file_id nullable` / `source_id nullable`，可覆盖 Source 创建前的 inspect / preview。
  - ProcessingJob 固定状态机和 active job 幂等规则，重复 inspect / preview / parse / embed 默认复用既有 job。
  - 长任务事件统一为 `GET /api/jobs/{job_id}` 和 `GET /api/jobs/{job_id}/events`；上传 events 仅作为别名。
  - sensitive 进入 Evidence Pack 必须使用 `permission_mode=explicit_sensitive_confirmed` 和未过期、未撤销、scope 匹配且一次性的 `sensitive_access_grant_id`。
  - P0-Z0a 的 RAG 输出固定为 evidence-only answer，不调用 LLM；Provider 型 `rag_answer` 进入 P0-Z2 或增强路径。
- 已完成 D-076 切片执行 profile 与工具矩阵收敛：
  - `chunk_type` 收敛为 `text_semantic / structured_table / image_ocr / audio_transcript / video_scene / mixed`。
  - `chunk_execution_profile` 只作为 ChunkBuildService 内部执行 profile，不新增表、endpoint、migration 或 OpenAPI。
  - LangChain、LlamaIndex、sentence-transformers、CLIP/BLIP/Florence、Table Transformer 只作为 P1/P2 adapter；P0 缺失时回退规则切片并记录 `fallback_reason`。
  - `source_binding_status` 继续只表达 Citation/Evidence 可用性，索引状态归 embedding/index job。
- 已完成 D-077 AI 结构化整理 profile 与质量门细化：
  - `structured_organization` 固定为内容理解、摘要生成、关键概念抽取、结构化字段生成、知识卡片生成、分类标签和关系建议。
  - P0 默认使用 Pydantic / JSON Schema、Jinja2 / Markdown / YAML Frontmatter、KeyBERT / YAKE、spaCy / HanLP 和规则模板。
  - LLM、LlamaIndex、LangChain Structured Output、Instructor / Guardrails、BGE / Sentence-Transformers、BERTopic、Neo4j、NetworkX、RDFlib 仅作为增强 adapter。
  - 关系建议只进入 Review，不直接写 confirmed relation；所有 KU / tag / relation 候选默认 pending review。
  - D-077 实现边界已收紧：Z0a/Z0b 的结构化质量异常先写 `processing_status_events` 和 `metadata_json` 摘要，`quality_events` / `knowledge_relations` 保持 P0-Z1 对象，不阻塞首批 migration。
- 已完成 D-079 结构化整理与存储映射收敛：
  - 标签生成、分类整理、字段映射、知识卡片类型、实体候选和三元组候选均写入 `structured_organization` 子字段，不新增顶级 step。
  - `processing_status_events` 补齐 `structured_organization_started/completed/warning/failed`，具体失败步骤写 `payload_json.step`。
  - 新图中的数据库模块被解释为逻辑存储职责：P0 仍使用 local StorageAdapter + SQLite + sqlite-vec + FTS5，不引入 PostgreSQL、Qdrant、Neo4j 等默认依赖。

### 历史 Done 记录（已被 D-066+ 当前口径取代）

以下条目只保留为历史决策记录；若出现 P0-A / P0-B、P0-A Core 或“text_import 单入口”等旧口径，以本次 P0-Core / P0-File / P0-AI / P0-RAG 四切片升级为准。
- 已建立根目录 `AGENTS.md`。
- 已合并项目产品定位、个人 Agent 判断、Knowledge Unit、Obsidian-inspired 组织逻辑、Text-to-SQL 和 RAG 方向。
- 已创建建库系统架构设计计划。
- 已创建当前阶段开发计划和进度记录。
- 已将开发计划优化为 v0.4，收紧工程 P0：统一 `text_import + source_origin`，P0 只做建库闭环和检索预览，不做完整 RAG answer。
- 已将建库系统架构设计计划同步为 v0.3。
- 已完成 LightRAG / GraphRAG 第一轮调研，并新增 `docs/open-source-rag-research.md`。
- 已将开发计划优化为 v0.5，确认 LightRAG / GraphRAG 不进入工程 P0 依赖，只作为分阶段架构参考。
- 已将建库系统架构设计计划同步为 v0.4，补充 relation / MOC / GraphRAG 分期边界。
- 已将开发计划优化为 v0.6，明确 P0 无 AI API 替代策略、embedding v0.1 前置决策、Text-to-SQL join 表和 Relation P0 状态。
- 已将建库系统架构设计计划同步为 v0.5，补充 mock embedding、EmbeddingRecord 和 P0/P1 AI 能力边界。
- 已新增知识调用系统架构设计计划，明确 Invocation Request、Retrieval Plan、Evidence Pack、Agent Context、Citation Preview 和 Memory Review 主线。
- 已将开发计划升级为 v0.7，补充知识调用系统阶段 K、决策记录、验收清单和后续待办。
- 已将开发计划升级为 v0.8，明确调用系统 P0 不做最小 RAG answer，并补齐 data-model 调用系统预留对象与 embedding 字段一致性。
- 已将知识调用系统架构设计计划升级为 v0.2，收紧为 Evidence Pack + Citation Preview + Query Explanation。
- 已调整 data-model 路线：先产出 v0.1-draft，待 Review、Embedding、Relation、Text-to-SQL 视图和调用系统最小对象确认后再冻结 v0.1 stable。
- 已将开发计划升级为 v0.9，修正 data-model draft 与 Text-to-SQL 的先后顺序，补充调用系统候选契约对象、P0 调用 API 边界，并统一 `text_import` 与 `metadata_json` 口径。
- 已将 `docs/architecture-design-plan.md` 升级为 v0.6，明确它是知识库构建系统架构，不是完整产品总架构。
- 已新增 `docs/product-architecture.md`，明确产品层合并、工程层分域、数据层共享。
- 已新增 `docs/data-model.md` v0.1-draft，包含字段表、关系图、只读视图草案、`knowledge_unit_chunks` 和 `evidence_items`。
- 已新增 `docs/mvp-scope.md`，明确 P0/P1/P2 范围、P0 不做内容和验收用例。
- 已新增 `docs/api-design.md`，明确 P0 建库、Review、Retrieval Preview、Invocation、Evidence Pack、Citation Preview、Feedback 和 Memory Draft API 边界。
- 已新增 `docs/text-to-sql.md`，明确 P0 只读查询契约、白名单对象、典型 SQL 模板、SQL 安全边界和 Query Explanation。
- 已新增 `docs/api-implementation-plan.md`，明确 P0 route-level 实施映射、service / repository 分层、事务边界、mock 模块和合同测试清单。
- 已新增 `docs/technical-stack-and-prototype-plan.md`，明确 P0 推荐技术栈、原型目录、实施切片、数据库迁移顺序、验证命令和实现前冻结清单。
- 已根据 `个人智能数据库.pdf` 优化双模块架构：新增横切支撑层，细化建库域的文件接收与状态反馈、格式校验 / 任务队列、内容清洗、切片质量控制、AI 结构化整理、版本、日志、异常、安全和性能成本边界，并保持 P0 不扩张。
- 已完成双域架构优化 6 条建议落地：知识组织提升为独立能力层、AI 能力分为 Building AI 和 Invocation AI 两层、引入知识库类型学（kb_type）、增加知识持续优化机制、前端体验层显式定位、数据维护域归属明确（写入型归建库域，记录型归横切层）。
- 已完成第二轮架构优化 8 条建议落地：
  - 新增 `docs/desktop-architecture.md`，确定 Electron 框架、FastAPI sidecar、SQLite 本地数据库、桌面 UX 约束和数据可移植性。
  - 数据库选型从 PostgreSQL 调整为 P0 SQLite + sqlite-vec，通过 Repository 抽象层支持 P1 迁移。
  - P0 拆分为 P0-A（建库核心）和 P0-B（调用预览），降低首次验证风险。
  - 区分文档架构（7 层）和 P0 代码架构（4 层）。
  - 数据模型精简：移除 embedding 冗余字段、约束 metadata_json 用途、补充 SQLite 类型映射。
  - 修复跨文档不一致：relation_type 补充 solves、tag_type 补充 discipline_tag/custom_tag、api-design 补充 kb_type、text-to-sql 修复 evidence_packs JOIN。
- 已完成第三轮架构优化 8 条建议落地：
  - 新增 `docs/p0a-execution-plan.md`，定义 P0-A 4 周周计划、依赖图、Definition of Done 和第一条开工命令清单。
  - 在 `docs/desktop-architecture.md` 新增 Schema 演进与数据迁移工具链（Alembic + 自动备份 + 回滚 + 跨大版本支持 + 自动更新协同）。
  - 在 `docs/desktop-architecture.md` 新增 Electron 安全实践（contextIsolation、sandbox、CSP、IPC 输入校验、日志脱敏）、产品包装规范（SemVer、标准菜单、跨平台分发、隐私声明）和首次体验流程（5 步 Onboarding + 设置页面 + 内置帮助）。
  - 新增 `docs/ai-provider-architecture.md`，定义 LLM Provider 抽象接口、API Key 系统 Keychain 存储、网络降级策略、多 Provider 路由和 P0 → P1 真实 AI 增量启用路径。
  - 新增 `docs/testing-strategy.md`，定义测试金字塔、P0 fixture 数据集、性能基线、SQLite 并发测试、Electron + Playwright E2E 方案、CI 集成预案和 P1 AI 评估方案。
  - 数据模型新增桌面单用户假设（users 单行）、permission 简化为 3 值（normal / sensitive / do_not_share）、Personal Agent 实体预埋（agents / agent_invocations / agent_memories，P1）、事件分类决策树（5 类事件归属规则 + P1 统一事件总线评估）。
  - 在 `docs/product-architecture.md` 新增 §5.4.1 Personal Agent 的产品定位章节，明确多 Agent 模型和 P0/P1/P2 阶段路径。
- 已确认 **Embedding + RAG + 向量检索** 采用 **主库混合（D-063）**：`embeddings` 表 + sqlite-vec + FTS5 + 结构化/全文混合检索；P0 **不**引入独立向量数据库；P1 优先 PostgreSQL + pgvector；详见 `docs/data-model.md` §2.8、`docs/technical-stack-and-prototype-plan.md` §2.1、决策 **D-063**。
- 已新增 `docs/rag-pipeline.md`，把 RAG + Embedding + 向量数据库落实为执行口径：P0-A Core 必须有 `embeddings` 表、`EmbeddingRepository` 和 `VectorStoreService` 抽象；sqlite-vec 可运行时降级，但不能绕开向量层。
- 已完成第四轮架构优化 8 条建议落地：
  - 批量修复跨文档 permission 枚举不一致：api-design / text-to-sql / knowledge-invocation / data-model 统一为 P0 3 值（normal / sensitive / do_not_share）；旧 6 值请求返回 `invalid_permission_value`。
  - 批量修复 text-to-sql §7 SQL 模板的 SQLite 方言违反：`= true / = false` 改为 `= 1 / = 0`，`ANY(array)` 改为 `EXISTS (SELECT 1 FROM json_each(col))`。
  - 清理"技术栈未确定"过时表述：README、api-implementation-plan、product-architecture 全部对齐已锁定的 Electron + FastAPI + SQLite 栈。
  - 在 `docs/api-design.md` 新增 §17 桌面系统 API：health / system / data-dir / backups / exports / settings / ai-providers / onboarding 共 9 组 endpoint，并补充 §4.5 permission 字段约定和 7 个新错误码。
  - 在 `docs/api-implementation-plan.md` 新增 §11 Repository 抽象层接口契约：命名约定、接口签名、UnitOfWork 事务边界、异步策略、异常转化、SQL 方言适配点、测试约定、P1 迁移检查清单。
  - 统一冻结清单：mvp-scope §10、technical-stack §11、data-model §11 三处同步同一份冻结项（技术栈 / 数据模型 / 权限与 Agent / API 契约 / 产品包装）。
  - 定义 P0 Personal Agent 占位规则：invocation_requests / memories 字段 `agent_id` 在 P0 schema-only 预埋为 nullable，写入值固定 `null`，业务通过 `current_agent_id_or_null()` 读取；P1 多 Agent 上线时 Alembic 批量回填为主 Agent ID。
  - 新增 `docs/error-handling-and-observability.md`，定义错误 envelope、UI 消息映射、诊断报告契约、日志策略和遥测开关；同步在 `docs/p0a-execution-plan.md` W2 加入 Onboarding API + i18n 错误映射任务、W4 加入诊断报告 + 设置页 + 错误 Boundary 任务，并新增 §2.2.1 产品命名与品牌冻结条款。
- 已完成 P0-A Core 裁剪优化：
  - `docs/p0a-execution-plan.md` 明确 P0-A Core / Shell / P0-A+ 分层，建库闭环、Review、Retrieval Preview 和基础错误 envelope 是 Core；诊断报告、完整备份、日志 30 天轮转、正式打包和完整 Onboarding 后置。
  - 产品命名从“W1 前正式冻结”调整为“W1 前使用稳定开发期占位名，正式外部分发前冻结”。
  - sqlite-vec 改为能力探测，可降级到 deterministic score / keyword ranking，不阻塞 P0-A Core。
  - P0-A 性能验收改为 1K KU < 1 秒 must，10K KU < 1 秒 pressure target。
  - `docs/api-implementation-plan.md` 将 P0-5 / P0-6 改为 P0-B-1 / P0-B-2，并将 Repository 组织从每表一个文件收敛为业务聚合。

## Pending

- 评审并冻结 P0-Core / P0-File / P0-AI / P0-RAG 四切片是否作为第一轮工程实现范围。
- 评审账号预埋 disabled contract、上传/解析状态机、Parser Router 和 RAG fallback 是否满足桌面本地优先原则。
- 进入代码实现前确认开发期应用名、Bundle ID、Product ID、数据目录名和 Keychain service 占位。
- 按 `docs/p0a-execution-plan.md` 的 6 周计划创建 P0 工程骨架并补充真实测试脚本。
