# 产品总架构

版本：v0.15
日期：2026-05-17  
状态：已按架构图升级为完整 P0 入库、File Inspection、知识切片质量闭环、AI 结构化整理 profile、D-079 存储映射、D-080 知识调用 / implicit_agent / 前端交互收敛、D-081-D085 调用持久化边界 / InvocationProfileSchema v1 / feedback_policy / 前端状态契约、D-098 Knowledge Workspace 八页信息架构、RAG 平台与安全运维横切层，并收紧 P0-Z0a/Z0b 实现竖切

## 1. 文档目的

本文档用于回答并落实一个核心判断：

> 知识库构建系统和知识调用系统可以合并为一个产品，但必须保留清晰的工程边界。

本项目应被表达为一个完整的 **AI 个人知识资产系统**，而不是两套独立工具。

两个架构文档的职责继续保留：

- `docs/architecture-design-plan.md`：知识库构建系统架构。
- `docs/knowledge-invocation-system-design-plan.md`：知识调用系统架构。

本文档负责说明二者如何组成一个产品、共享哪些对象、如何形成闭环，以及 P0 应优先验证什么。

---

## 2. 产品级结论

### 2.1 可以合并为一个产品

两个系统的关系不是并列产品，而是同一个产品中的上下游能力。

```text
个人材料
→ 知识构建
→ 可信知识资产
→ Agent 知识调用
→ 回答 / 创作 / 决策 / 复盘
→ 反馈与再沉淀
```

建库系统负责把材料变成可信知识资产；调用系统负责让个人 Agent 在明确范围、权限和证据基础上使用这些知识资产。

### 2.2 不能合并成一个无边界模块

产品层可以合并，但工程层必须分域。

原因：

- 建库域是写入域，负责创建、编辑、确认和审计知识。
- 调用域默认是只读域，负责检索、证据组装、引用解释和反馈。
- 调用输出不能直接污染长期知识库，必须回到 Review。
- 权限、状态、用户确认和来源追踪需要在两个域之间保持一致。

---

## 3. 一句话定位

本产品是面向专业内容创作者的 AI 个人知识资产系统，形态为**桌面软件**（非网页应用、非移动 App）：

> 帮助用户把分散材料转化为可确认、可追溯、可检索、可调用的 Knowledge Unit，并让个人 Agent 基于这些可信知识资产进行问答、创作、决策和复盘。

桌面软件定位的意义：

- 数据默认存储在本地，用户对个人知识资产拥有完整控制权。
- 性能和交互体验对标专业桌面工具（如 Obsidian、VS Code、Figma Desktop），而非轻量级网页应用。
- 可以利用本地文件系统、本地数据库和本地计算资源，减少对云服务的强依赖。
- 离线可用性是长期目标之一：核心知识库操作应在无网络环境下正常运行。
- 采用 **Electron** 作为桌面框架，FastAPI 作为 sidecar，SQLite 作为本地数据库（详见 `docs/desktop-architecture.md`）。

产品主张不是“上传文件后聊天”，而是：

```text
资料收集
→ 知识整理
→ 关系建立
→ 可信调用
→ 创作生成
→ 复盘沉淀
```

---

## 4. 总体架构

```text
AI 个人知识资产系统
├── 前端体验层（Knowledge Workspace）
│   ├── AI 工作台首页 / 项目选择页 / 上传资料页 / 文件管理页
│   ├── 知识库页面 / 对话与 RAG 页面 / 引用与查询解释页
│   ├── 数据可视化入口 / 设置页
│   ├── 内部路由：/dashboard /import /library /search /ask /graph /outputs /settings
│   ├── 建库工作台（Source / Chunk / KU / Review 操作面）
│   ├── 调用工作台（Query / Evidence / Citation / Feedback 操作面）
│   ├── 知识组织面板（Tag / Folder / Relation / MOC 管理）
│   └── 系统管理（Project / Settings / Memory）
├── 知识构建域（写入：Source → Chunk → KU → Review → Confirmed）
│   ├── Source Intake
│   ├── File Receiving + Status Feedback
│   ├── Format Validation + Processing Queue
│   ├── Source Registry
│   ├── Source Description
│   ├── Parsing / Cleaning / Chunking
│   ├── Chunk Strategy / Context Enrichment / Source Binding / Quality
│   ├── AI Structured Organization
│   ├── Human Review + Validation
│   └── Commit / Indexing / Audit
├── 知识组织层（跨域：标签 / 分类 / 关系 / MOC / 知识库优化）
│   ├── 标签系统（Folder-Tag Mirroring + topic / discipline / use / status 标签 + 标签合并 / 层级）
│   ├── 分类映射（五轴分类 + 自动归类 + Schema Match）
│   ├── 关系管理（manual relation + P1 AI 推荐 + 反向链接）
│   ├── MOC / 知识地图（P0 占位 → P1 半自动 → P2 community summary）
│   └── 知识库优化（重复检测 / 标签规范化 / 关系调整 / 质量提升）
├── 知识调用域（只读：Intent → Retrieval → Evidence → Citation → Feedback）
│   ├── Invocation Request（Z0a summary / Z2 persisted）
│   ├── Query Understanding Profile（intent / rewrite_status / keyword / scope / constraint）
│   ├── Retrieval Strategy Profile（BM25 / vector / metadata / file index / relation evidence / hybrid）
│   ├── Ranking Profile（hybrid score / metadata / source_reliability_score / feedback weight）
│   ├── Evidence Pack
│   ├── Citation Trace Profile（Chunk / Source / File / text span）
│   ├── Feedback Policy（local_only / current_project / capped_weight）
│   ├── Agent Context / implicit_agent
│   ├── Citation Preview / Query Explanation
│   └── Feedback Signal / Memory Review
├── AI 能力栈
│   ├── Building AI（建库侧：内容理解 / 信息抽取 / 标签推荐 / 卡片生成 / 质量校验 / 摘要生成）
│   └── Invocation AI（调用侧：意图识别 / 查询规划 / RAG 回答 / 创作输出 / 任务规划）
├── 共享底座（数据契约：Users / Sources / Chunks / KUs / Tags / Relations / Embeddings）
│   ├── Users / Projects / Knowledge Spaces
│   ├── Folders / Tags / Properties
│   ├── Sources / Source Descriptions / Chunks
│   ├── Knowledge Units / Relations / MOC
│   ├── Embeddings / Indexes / Retrieval Logs
│   ├── AIAnswers / Memories / Feedback
│   ├── Processing Status / Quality Events / Version Snapshots
│   └── Permissions / Status / Audit Logs
└── 横切支撑层（治理：Auth / 权限 / 日志 / 安全 / 版本记录 / 性能成本）
    ├── Auth / Permission / Data Ownership
    ├── User Records / Feedback Events
    ├── Version Snapshots / Modification History / Rollback Records
    ├── System Logs / Exception Monitoring
    ├── Security / Privacy / Backup / Delete
    └── Performance / Cost / Stability Monitoring
```

### 4.0 文档架构 vs. P0 代码架构

上面的 7 层架构图是**文档架构**，描述产品完整的概念分层。P0 代码实现不需要在工程上同时构建 7 层。

**P0 代码架构精简为 4 层**（详见 `docs/mvp-scope.md` §2、`docs/desktop-architecture.md` §11）：

```text
P0 代码架构（4 层）

┌─────────────────────────────────────────────┐
│  1. 前端（React / Electron Renderer）       │
│     上传 / 入库 / Review / RAG 工作台       │
├─────────────────────────────────────────────┤
│  2. API 层（FastAPI sidecar）               │
│     P0-Core + P0-File + P0-AI + P0-RAG      │
│     开源优先 ProviderRegistry + Parser Router│
├─────────────────────────────────────────────┤
│  3. Repository 抽象层                       │
│     隔离业务流程和 SQL，保留 P1 后端迁移能力│
├─────────────────────────────────────────────┤
│  4. 数据层（SQLite + sqlite-vec）           │
│     单一主库：结构化行 + embeddings BLOB   │
│     + sqlite-vec 向量检索 + FTS5 全文      │
│     （混合检索；非独立向量数据库）          │
└─────────────────────────────────────────────┘

Electron 主进程：窗口管理 + sidecar 生命周期 + IPC + 文件操作
```

对照关系：

| 文档架构层 | P0 代码落地 | 说明 |
|---|---|---|
| 前端体验层 | → 第 1 层 | AI 工作台首页、项目选择、上传、文件管理、知识库、对话/RAG、引用与查询解释、可视化入口、设置页 |
| 知识构建域 | → 第 2 层（业务模块） | P0-Core / P0-File / P0-AI 核心 |
| 知识组织层 | → 第 2 层（合入业务模块） | P0 不需要独立进程/服务 |
| 知识调用域 | → 第 2 层（P0-RAG） | P0 即实现 Evidence Pack、Citation、RAG answer/fallback |
| AI 能力栈 | → 第 2 层（ProviderRegistry） | P0 开源优先，未配置时规则/mock 降级 |
| 共享底座 | → 第 3+4 层 | Repository + SQLite |
| 横切支撑层 | → 第 2 层（中间件/装饰器） | P0 仅 audit_log，不需要独立层 |

这个对照确保：文档架构不会被代码实现"缩水"遗忘，代码实现也不会因文档架构过度膨胀。

### 4.0.2 P0-Z0a/Z0b 竖切与完整 P0 的关系

完整 P0 仍由 P0-Core / P0-File / P0-AI / P0-RAG 四切片组成，但工程初始化先做 P0-Z0a：

```text
local_user / project / folder / tag
→ upload 或 text_import
→ verify / inspect job
→ parse / chunk
→ candidate KU / review confirm
→ embed job
→ retrieval log / evidence pack / evidence-only answer（不调用 LLM）
```

P0-Z0a 的目标是证明同一主库、同一 ProcessingJob/event 状态线、同一 evidence 模型能跑通。P0-Z0b 再补齐账号预埋 schema、分片恢复、citation 明细、sensitive grant 和审计日志；P0-Z1 再增强 File / Parser / Quality / Relation，P0-Z2 再补齐 invocation plan、memory draft、feedback 和完整 RAG answer provider/fallback。

### 4.0.1 知识组织层的定位

知识组织层是共享底座之上、两个工程域之间的独立概念能力层。它不属于建库域的内部步骤，也不属于调用域的检索逻辑，而是两个域共同依赖的知识结构化能力。P0 代码中合并进 API 层的业务模块，P1 可提取为独立服务。

定位依据：

- 建库域调用知识组织层来推荐标签、分类、关系和 MOC。
- 调用域调用知识组织层的标签体系和关系图谱来限定检索范围和扩展上下文。
- 知识组织能力（标签合并、关系调整、重复检测、质量提升）跨越建库和调用两个域。

知识组织层的核心模块：

| 模块 | 职责 | P0 边界 | P1/P2 扩展 |
|---|---|---|---|
| 标签系统 | Folder-Tag Mirroring、topic/discipline/use/status 标签、标签合并与层级管理 | folder mirror tag + 规则/Mock 推荐 + 用户确认 | AI 标签推荐、标签合并建议、标签层级自动整理 |
| 分类映射 | 五轴分类、自动归类、Schema Match、语义对齐 | 规则/Mock 推荐 + 用户确认 | AI 自动分类、跨学科映射、分类稳定性检测 |
| 关系管理 | 手动关系、AI 推荐关系、反向链接、关系类型 | manual relation + relation index 占位 | AI 推荐关系、relation expansion retrieval、GraphRAG 式关系抽取 |
| MOC / 知识地图 | 主题地图、项目知识地图、知识导航 | MOC 占位 | 半自动 MOC、community summary、Global Search |
| 知识库优化 | 重复检测、标签规范化、关系调整、质量提升 | 文档定义（不实现） | 规则触发 + 用户手动触发 → AI 推荐优化 |

P0 实现说明：P0 阶段知识组织层在代码层仍内嵌于建库流程的步骤中执行（分类、标签推荐、关系创建等），但在架构文档上明确其独立身份，为 P1/P2 的模块独立化和调用域复用做好准备。

### 4.0.1 AI 能力栈的定位

AI 能力栈按职责分为两层：**Building AI**（建库侧 AI）和 **Invocation AI**（调用侧 AI）。两层 AI 的底层模型接口可以共享（同一个 LLM provider），但模块边界、Prompt 策略、评估标准和上线节奏应独立管理。

#### Building AI（建库侧 AI）

服务知识构建域和知识组织层，负责把原始材料转化为结构化知识资产。

| 能力模块 | 职责 | P0 实现 | P1/P2 扩展 |
|---|---|---|---|
| 内容理解 | 理解输入材料的主题、结构和语义 | 规则/Mock | 真实 LLM 理解 |
| 信息抽取 | 从 Source/Chunk 中抽取候选 KU | 用户手动 + 规则/Mock | 真实 AI 自动抽取 |
| 标签推荐 | 推荐 topic/discipline/use 标签 | 规则/Mock 推荐 | AI 推荐 + 解释 |
| 卡片生成 | 生成 Source Description Card | 标题+首段+heading 拼装 | AI 摘要 + 关键术语 |
| 质量校验 | 检查 KU 完整性、重复、冲突 | 规则检查 | AI 质量评估 |
| 摘要生成 | 生成知识单元和来源摘要 | 模板摘要 / 候选摘要，不覆盖 Source 原文、不自动确认 | AI 摘要质量增强 |
| 实体关系抽取 | 从文本中抽取实体和关系 | 实体候选 / 三元组候选 / 关系候选只进入 Review payload | P1 AI 推荐 → Review；P2 图数据库 / GraphRAG adapter |
| Schema Match | 将 KU 字段映射到可查询 Schema | 规则匹配 | AI 语义匹配 |

#### Invocation AI（调用侧 AI）

服务知识调用域，负责让个人 Agent 在具体任务中调用知识资产。

| 能力模块 | 职责 | P0 实现 | P1/P2 扩展 |
|---|---|---|---|
| 意图识别 | 判断用户任务类型和检索范围 | `query_understanding_profile` 规则/模板；不需要改写时写 `rewrite_status=not_needed`，需要改写但 Provider 缺失时才 fallback | AI 意图分类 |
| 查询规划 | 生成 Retrieval Plan summary（SQL + 向量 + 关键词 + 关系） | `retrieval_strategy_profile` 规则路由；Z0a 为 response/log summary，Z2 再持久化 Retrieval Plan | AI 查询规划 |
| 排序与反馈 | 合并混合检索分数和用户反馈信号 | `ranking_profile` + `feedback_signal` + `feedback_policy`；反馈只影响排序建议 | Reranker / Learning-to-Rank |
| 引用溯源 | 还原证据来源和可信度 | `citation_trace_profile` 绑定 Chunk / Source / File / text span，并区分 `source_reliability_score` 与 `source_reliability_label` | 更精细证据校验 |
| Text-to-SQL | 将自然语言转为只读 SQL | Schema + 示例/Mock | 真实 Text-to-SQL 模型 |
| RAG 回答生成 | 基于 Evidence Pack 生成带引用的回答 | P0-Z0a 只生成 `evidence_only_answer`；P0-Z2 或显式 Provider 增强路径生成 `rag_answer` | P1 增强质量、评估和多 Provider 路由 |
| 创作输出 | 生成提纲、脚本、总结、比较表等 | 只生成带 Evidence/Citation 的草稿，不自动入库 | P1/P2 创作引擎 |
| 任务规划 | 多步骤任务的分解和执行规划 | 只读规划摘要，不执行外部工具 | P2 Agent 任务执行 |
| Reranking | 对检索结果进行重排序 | optional provider；缺失回退 hybrid score | P1 reranker |

#### 两层 AI 的管理原则

- 两层共享同一个 AI provider 抽象接口（embedding model、chat model、summarization model 等），但各自管理 Prompt 模板和评估指标。
- Building AI 的输出必须进入 Review 流程，不能直接写入主知识库。
- Invocation AI 的输出必须区分证据和推理，引用来源必须可追溯。
- P0 两层均采用开源优先 ProviderRegistry；未配置 Provider 时使用规则 / mock / evidence-only 降级，P1 再提升质量、评估集和商业 Provider 适配。
- D-077 将 Building AI 的 AI 结构化整理收敛为 `structured_organization` profile：内容理解、摘要、关键概念抽取、结构化字段生成、知识卡片生成、分类标签和关系建议都记录 provider / fallback / quality；关系建议只进入 Review，不直接写 confirmed relation。
- D-079 将新图中的标签生成、分类整理、结构化字段、知识卡片类型、实体候选和三元组候选进一步收敛为上述 profile 的子字段；P0 不做自动确认的摘要、标签、卡片或实体关系，所有 derived artifact 都必须绑定 Source / Chunk 并进入 Review。
- D-080 将调用侧收敛为 `query_understanding_profile`、`retrieval_strategy_profile`、`ranking_profile`、`citation_trace_profile`、`feedback_signal` 和 `implicit_agent`。P0 只做隐式单 Agent 的只读调用与 evidence-first 回答，不做多 Agent、自主执行、外部 API 工具调用或 GraphRAG 运行时。
- D-081-D085 将调用实现边界进一步收紧：P0-Z0a 只必须持久化 retrieval log / Evidence Pack / evidence-only answer，并通过 `retrieval_log_id` / `evidence_pack_id` 串起闭环；Invocation / Retrieval Plan / Memory / Retrieval Feedback 持久化进入 P0-Z2；profile 使用 `InvocationProfileSchema v1`；反馈必须受 `feedback_policy` 约束，前端状态统一走 `FrontendStateContract`。

### 4.1 PDF 代码层模块清单的吸收方式

`个人智能数据库.pdf` 更接近代码层模块树，而不是新的产品边界。本文档吸收它的模块拆分，但不把 PDF 中所有能力直接纳入工程 P0。

吸收原则：

- PDF 中的入库、文件处理、AI 结构化整理和存储链路，进入知识构建域。
- PDF 中的知识组织系统（标签、分类、关系、图谱、知识库优化、实体关系抽取）提升为独立的知识组织层。
- PDF 中的问答、RAG、任务规划和内容生成，进入知识调用域或 P1/P2 的 Agent 能力。
- PDF 中的用户、权限、日志、异常、安全、性能成本，统一放入横切支撑层。
- PDF 中的数据维护拆分处理：写入型维护操作归入知识构建域，记录型治理能力归入横切支撑层。
- PDF 中的生产级自动多模态解析、自动实体关系抽取、商业闭源 AI 强依赖、图谱可视化和多 Agent 规划，不进入工程 P0。

---

## 5. 领域边界

### 5.0 前端体验层（Knowledge Workspace）

前端不是附属 UI，而是知识工作台的核心体验载体。它直接决定用户能否高效完成知识建库、知识调用、知识组织和系统管理任务。

> **产品形态：桌面软件。** 本产品是桌面应用程序，不是网页应用，不是移动 App。前端体验层通过 **Electron** 封装为原生桌面软件（D-039 已确认；Tauri 仅作为 P2 评估备选），面向 macOS / Windows 用户提供本地化体验。

前端体验层在产品架构中位于最上层，面向用户直接交互，连接下层的建库域、知识组织层、调用域和共享底座。

主要工作台：

| 工作台 | 职责 | 连接的后端域 |
|---|---|---|
| 建库工作台 | Source 上传/导入、Chunk 查看、KU 编辑、Review 确认 | 知识构建域 |
| 调用工作台 | 自然语言查询、Evidence Pack 查看、Citation Preview、Query Explanation、Feedback | 知识调用域 |
| 对话 / RAG 页面 | 多轮上下文、AI 思考状态、evidence-only / provider answer、citation 展示、反馈按钮 | 知识调用域 + AI 能力栈 |
| 引用与查询解释页 | query understanding、strategy route、ranking summary、citation trace、evidence gaps | 知识调用域 |
| 数据可视化入口 | 知识图谱入口、检索统计、文件统计、时间线、AI 调用统计 | 知识组织层 + 横切支撑层 |
| 知识组织面板 | Tag 管理、Folder 管理、Relation 查看/编辑、MOC 浏览 | 知识组织层 |
| 系统管理 | Project / Knowledge Space 管理、Settings、Memory 管理 | 共享底座 + 横切支撑层 |

前端体验原则：

- 用户不应感知为两个割裂系统，建库和调用在同一个工作台中无缝切换。
- 来源必须清楚展示：每条知识的 Source、Chunk 和引用路径可直接追溯。
- AI 建议必须可编辑：标签、分类、关系的推荐结果支持用户确认、修改或忽略。
- 区分确认知识和 AI 建议：已确认（confirmed）和未确认（pending_review）的知识在 UI 上有明确视觉区分。
- 检索结果必须可检查：Evidence Pack 的组成、排序依据和证据空缺对用户可见。
- SQL / 检索路径应尽量可解释：Query Explanation 面板展示检索逻辑。

P0 边界：

- P0 前端实现按 `docs/technical-stack-and-prototype-plan.md` 已有计划执行（Electron + React + Vite + TypeScript）。
- P0 交互状态必须覆盖上传进度、AI 思考、检索失败、无权限、网络异常、空结果、citation 展示和用户反馈按钮；默认使用 SSE、Toast、Error Boundary、Loading Skeleton、Auth Guard、React Context 或 Zustand。
- Vue / Next.js、Redux、WebSocket 双向通道只作为替代或 P1 评估项，不替换 P0 默认路线。
- 本文档只定义前端在产品架构中的定位和工作台划分，不替代前端技术方案。

### 5.0.1 Knowledge Workspace 八页信息架构（D-098）

D-098 将前端体验层收敛为 8 个主页面。它们是 Renderer 内部 route contract，不新增后端 endpoint，也不改变 Electron + FastAPI sidecar + SQLite 的 P0 桌面边界。

| 路由 | 页面 | 核心职责 | 连接的后端域 | P0 分期 |
|---|---|---|---|---|
| `/dashboard` | 首页 / 总览 Dashboard | 展示最近导入、知识库概览、文档数量、AI 摘要数量、最近搜索/问答和快捷入口 | Runtime status、Source summary、Retrieval/Answer summary、Provider status | P0-Core 先展示 shell 与 runtime；P0-Z0a 接入最小 summary |
| `/import` | 资料导入页 | 拖拽上传、本地文件夹导入、格式能力状态、上传进度、解析状态 | Upload、File Inspection、ProcessingJob、Provider capability | P0-Z0a 支持 text/file 最小链路；微信/网盘/Obsidian/Notion 仅为 P1/P2 入口占位 |
| `/library` | 知识库 / 文件管理页 | 分类树、文档列表、标签/时间/项目筛选、自动分类结果、文件状态 | Project/Folder/Tag、Source/File、Chunk、Review | P0-Z0a 展示可追溯 Source/Chunk/KU 摘要 |
| `/search` | 智能搜索页 | 自然语言搜索、结果排序、命中文段、来源文件、标签筛选、跨文档结果 | Retrieval Preview、Evidence Pack、Citation Trace、Feedback | P0-Z0a evidence-first；无 LLM 时仍返回 query explanation 和 evidence-only 结果 |
| `/ask` | AI 问答页 | 聊天式提问、evidence-only/provider answer、引用来源、相关文档卡片、追问和生成入口 | RAG Answer、Evidence Pack、Citation、AIAnswer、Feedback | P0-Z0a 默认 evidence-only；Provider 可用后才启用带 citation answer |
| `/graph` | 知识图谱 / 关系网络页 | 展示文档、标签、项目、人物、会议节点与关系强弱，节点可回到资料 | Tag/Relation/MOC、confirmed relation、relation suggestion evidence | P0 只做可解释关系视图和空态，不做 GraphRAG 或装饰性背景图 |
| `/outputs` | 生成结果页 | 会议纪要、学习笔记、项目摘要、汇报提纲、Word/PDF/Markdown 导出入口 | AIAnswer、Memory Draft、Review、Citation/Evidence | P0 作为入口和 disabled / pending review 视图；完整生成增强进入 Z1/Z2 |
| `/settings` | 设置页 | 账号、存储、AI 模型、外观主题、导入导出、runtime/provider 状态 | Auth status、System runtime、Settings、Provider capability、Backups/Exports | P0-Core 可读取 runtime/provider/storage 状态；写入能力受 disabled contract 约束 |

页面分期固定为：

```text
P0-Core: desktop shell + left navigation + runtime status bar + settings/runtime status
P0-Z0a: dashboard / import / library / search / ask 的最小 evidence-only 工作流
P0-Z0b: 补齐 citation 明细、source summary、provider/fallback 状态和 Review 入口
P0-Z1/Z2: graph 交互增强、outputs 生成增强、provider answer 和更完整的反馈闭环
```

页面体验约束：

- 首屏必须是 `/dashboard` 知识工作台，不做 landing page 或营销首页。
- `/ask` 不能退化成普通 ChatGPT clone；回答必须显示 Evidence Pack、Citation Trace、provider/fallback 状态和证据不足原因。
- `/search` 必须展示 Query Explanation、strategy route、ranking summary 和可追溯命中文段。
- `/graph` 不能只是炫酷背景；每条关系必须能回到 confirmed relation 或 relation suggestion evidence，数据不足时展示 disabled reason。
- `/outputs` 的摘要、报告、纪要和导出物都是 derived artifact，必须绑定 Evidence/Citation，不能绕过 Review 写入 confirmed knowledge。
- `/import` 展示 PDF / Word / PPT / 音频 / 视频 / 图片等格式能力时，必须读取 Provider capability status，不得伪装成 P0 已完整支持。
- 页面跨页状态继续复用 `workspaceStore / jobStore / reviewStore / retrievalStore / citationStore`；页面局部 UI 状态留在组件内，不新增大而全的 store slice。

### 5.1 知识构建域

目标：

把用户材料转化为可信、可追溯、可调用的知识资产。

主要职责：

- 接收 `text_import` 材料。
- 记录文件接收、文件格式校验、任务排队和处理状态。
- 创建 Source。
- 生成 Source Description Card。
- 解析、清洗并切分 Chunk。
- 记录 parse warning、chunk quality 和处理异常。
- 创建 Candidate Knowledge Unit。
- 推荐 type、tags、properties、schema match 和 relations。
- 执行 Human Review + Validation。
- 写入 Confirmed Knowledge Unit。
- 建立全文索引、向量索引、metadata 索引、tag/folder 索引和 relation 索引。
- 记录 Audit Log。

输出对象：

```text
Source
SourceDescription
Chunk
Candidate KnowledgeUnit
Confirmed KnowledgeUnit
Tag
KnowledgeRelation
ReviewItem
EmbeddingRecord
RetrievalLog
AuditLog
IngestionJob
ProcessingStatusEvent
ParseWarning
ChunkQualityCheck
QualityEvent
VersionSnapshot
```

### 5.2 知识组织层

目标：

为两个工程域提供统一的知识结构化能力，确保标签、分类、关系和知识地图在建库和调用中保持一致。

主要职责：

- 管理标签体系：Folder-Tag Mirroring、标签命名空间、标签合并与重命名、标签层级。
- 管理分类映射：五轴分类（学科 / 问题 / 方法 / 对象 / 应用）、Schema Match、语义对齐。
- 管理关系：手动关系、AI 推荐关系（P1）、反向链接、关系类型和关系索引。
- 管理 MOC / 知识地图：主题组织、项目知识地图、知识导航结构。
- 知识库优化：重复检测、标签规范化、关系调整、质量提升、过期标记。

与建库域的关系：

- 建库域在 KU 提取后调用知识组织层的标签推荐、分类映射和关系推荐能力。
- 建库域的 Review 流程依赖知识组织层提供的重复检测和冲突检测。

与调用域的关系：

- 调用域的检索计划依赖知识组织层的标签体系来限定检索范围。
- 调用域的 relation expansion retrieval 依赖知识组织层的关系图谱。
- 调用域的 Citation Preview 展示的标签和关系来自知识组织层的数据。

P0 边界：

- P0 代码层仍内嵌于建库步骤中执行。
- P0 架构文档上明确知识组织层的独立身份和模块列表。
- P1 开始将标签管理、关系管理等模块独立为可复用 service。

### 5.3 知识调用域

目标：

让个人 Agent 在任务中安全、准确、可解释地调用已确认知识资产。

主要职责：

- 接收用户问题、创作任务、决策任务或复盘任务。
- 通过 `query_understanding_profile` 识别 intent、`rewrite_status`、关键词、scope、constraint 和输出格式。
- 通过 `retrieval_strategy_profile` 生成 Retrieval Plan summary：简单事实走 FTS5/BM25，概念解释走向量检索，时间线走 metadata filter，文件定位走 source/file index，复杂综合走 hybrid search；P0-Z2 再持久化 `retrieval_plans`。
- 组合 SQL、metadata、tag、folder、full-text、vector、relation evidence 检索。
- 使用 `ranking_profile` 合并 hybrid score、metadata 权重、`source_reliability_score` 和 feedback weight；`source_reliability_label` 只用于 UI 解释；reranker 缺失时回退混合分数。
- 构建 Evidence Pack。
- 组装 Agent Context。
- 展示 Citation Preview 和 Query Explanation，并暴露处理质量、版本、权限过滤、strategy route、ranking 和 citation trace 信号。
- 记录 AIAnswer 或 retrieval preview，并以 `feedback_policy` 约束后续反馈影响范围。
- 将有价值输出保存为 Memory Draft 或 Candidate Knowledge Unit。
- 记录 `feedback_signal`：点击、收藏、有用/无用、错误引用、缺失来源和降权来源只影响后续排序建议，不自动改写知识真值。

输出对象：

```text
InvocationRequest
RetrievalPlan
EvidencePack
AgentContext
AnswerCitation
AIAnswer
MemoryDraft
RetrievalFeedback
```

P0 关系分析边界：只读已确认 `KnowledgeRelation` 或 `relation_suggestion` 证据；GraphRAG、Learning-to-Rank、外部图数据库和自动关系推理进入 P1/P2 adapter。

### 5.4 横切支撑层

横切支撑层不是第三个业务模块，而是两个工程域共同依赖的治理能力。

#### 数据维护的域归属原则

判断标准：**如果操作会改变 Knowledge Unit、Chunk、Source、Relation、Tag 的内容或状态，就属于建库域；如果只是记录和观测，就属于横切支撑层。**

| 维护操作 | 归属 | 说明 |
|---|---|---|
| 更新文件/切片/元数据 | 知识构建域 | 写入操作，必须受 Review 或用户动作约束 |
| 更新向量/重建索引 | 知识构建域 | 写入操作，影响检索结果 |
| 更新关系/标签 | 知识组织层 → 建库域执行 | 写入操作，走 Review |
| 删除资料 | 知识构建域 | 写入操作，需要用户明确确认 |
| 版本快照记录 | 横切支撑层 | 只记录，不修改 |
| 修改历史日志 | 横切支撑层 | 只记录，不修改 |
| 回滚记录 | 横切支撑层 | 记录回滚事件（回滚执行本身由建库域负责） |
| 系统日志/异常日志 | 横切支撑层 | 只记录，不修改 |

#### 横切支撑层职责（仅限记录型治理能力）

- 认证、Token、角色权限和文件 / 知识库访问权限。
- 用户 ID、项目空间、数据归属和用户数据隔离。
- 上传记录、检索记录、问答记录和反馈事件。
- 版本快照、修改历史和回滚记录。
- 日志、异常监控、安全检测、权限控制、敏感信息检测。
- 接口响应速度、数据库性能、AI 调用成本和存储空间统计。
- 系统健康检查、任务队列监控、失败任务重试、接口限流和本地告警。

横切支撑层不包含写入型数据维护操作（如资料更新、索引重建、关系修改等），这些归入知识构建域。

P0 边界：

- P0 可以先保留必要字段、日志和状态事件契约。
- P0 默认本地实现，不依赖云监控、Sentry、Prometheus、Grafana、Temporal 或 Redis。
- 不要求实现完整团队权限、复杂审计后台、自动成本治理、完整数据库加密或生产级安全运营。

### 5.4.1 Personal Agent 的产品定位

`AGENTS.md` 强调本项目的核心命题是"个人 Agent 的能力底座"。Personal Agent 不是单一聊天界面，而是用户长期可拥有、可配置、可组合的多个智能体。

#### Personal Agent 的概念边界

| 维度 | 说明 |
|---|---|
| 多 Agent | 一个用户可以拥有多个 Personal Agent，例如"研究助手"、"创作助手"、"决策助手" |
| 隔离配置 | 每个 Agent 有独立的 system_prompt、可访问 Project 范围、可访问 kb_type、记忆边界 |
| 共享知识库 | 所有 Agent 共享同一个用户知识库，但调用范围可独立限制 |
| 长期上下文 | Agent 通过 Memory 和 Knowledge Unit 形成长期上下文，不依赖单次对话 |
| 调用可解释 | 每次 Agent 调用都通过 Evidence Pack 暴露使用了哪些 KU / Chunk / Source |

#### Agent 与现有架构的关系

```text
用户
└── 多个 Personal Agent
    ├── Agent A：研究助手
    │   ├── 默认 Project 范围：所有 reference_kb + project_kb
    │   ├── 记忆：Agent A 私有
    │   └── 调用历史：P0-Z2 通过 invocation_requests + evidence_packs
    ├── Agent B：创作助手
    │   ├── 默认 Project 范围：所有 inspiration_kb + project_kb
    │   ├── 记忆：Agent B 私有
    │   └── 调用历史：P0-Z2 通过 invocation_requests + evidence_packs
    └── 共享底层：用户的 Knowledge Unit / Source / Chunk / Tag / Relation
```

#### P0 / P1 / P2 阶段路径

| 阶段 | Agent 实现 | 说明 |
|---|---|---|
| P0-Core / P0-RAG | 不实现可配置 Agent 实体 | 单用户、单 `implicit_agent`，所有 invocation 默认归主 Agent；账号与角色只做 disabled contract；仅允许对话上下文、意图理解、只读任务规划、内部检索、RAG 问答和内容草稿 |
| P1 | 引入 `agents` 表（schema-only → 实现） | 用户可创建多个 Agent，每个 Agent 配置独立 system_prompt 和默认范围 |
| P1+ | Agent 间记忆共享策略 | 用户可配置某条 Memory 是否对其他 Agent 可见 |
| P2 | 多 Agent 协作 | Agent 之间可以传递任务、共享 Evidence Pack |

#### P0 设计预埋

虽然 P0 不实现可配置 Agent 实体，但以下设计已为 P1 预埋：

- `data-model.md` §3.6 已草案 `agents` 表 schema
- P0 运行时通过 `current_agent_id_or_null()` 写入空 Agent 归属
- `invocation_requests` / `memories` 属于 P0-Z2 或可选提前实现；后续可通过 Alembic 迁移补充 `agent_id`
- 检索过滤接口已包含 scope 参数，P1 可注入 Agent 默认范围

P0 设计原则：**不为 P1 多 Agent 提前增加复杂度，但避免做出 P1 难以撤销的决定**。

P0 `implicit_agent` 运行边界：

- 允许：多轮对话上下文、意图理解、`rewrite_status=not_needed/fallback/applied`、只读任务规划、内部知识库 / 数据库 / 文件索引查询、Evidence Pack 组装、RAG 问答、带引用内容草稿。
- 禁止：多 Agent 协作、自主执行用户任务、调用外部 API 工具、修改用户文件、直接写 confirmed Memory / Knowledge Unit、绕过 Review、无 citation 的知识库回答。
- 默认：P0-Z0a 使用 evidence-only answer；P0-Z2 或显式 Provider 增强路径才可走 provider answer，但必须带 citation。

### 5.5 共享底座

共享底座不是第三套产品，而是两个工程域共同依赖的数据契约。

它负责：

- 统一对象命名。
- 统一状态、权限和确认规则。
- 统一来源追踪。
- 统一 embedding 和索引记录。
- 统一调用日志和反馈回流。
- 支撑 Text-to-SQL 只读查询。
- 支持知识库类型学（`kb_type`），允许按不同组织视角管理知识。

共享底座应由 `docs/data-model.md` 维护。

#### 知识库类型学

`projects` 表引入 `kb_type` 字段，支持按不同视角组织知识库：

| 类型 | 说明 | P0 | 典型场景 |
|---|---|---|---|
| `project_kb` | 项目知识库 | 支持 | 围绕具体项目组织知识 |
| `reference_kb` | 参考资料库 | 支持 | 存储文献、文档、参考材料 |
| `person_kb` | 人物知识库 | P1 | 关键人物、专家、合作者 |
| `timeline_kb` | 时间线知识库 | P1 | 按时间组织事件和决策 |
| `inspiration_kb` | 灵感素材库 | P1 | 创意灵感和素材 |
| `method_kb` | 方法论知识库 | P1 | 方法、原则、最佳实践 |
| `custom` | 用户自定义 | P1 | 用户自定义组织方式 |

知识库类型不新增数据表，而是作为 `projects` 表的可选维度。Text-to-SQL 可以查询"所有方法论知识库中的核心判断"，检索也可以按知识库类型限定范围。

---

## 6. 读写隔离原则

### 6.1 建库域可以写入主知识库

建库域可以写入：

```text
sources
source_descriptions
chunks
knowledge_units
knowledge_unit_tags
knowledge_relations
review_tasks
embeddings
retrieval_logs
audit_logs
```

但写入主知识库必须经过 Review 或明确的用户动作。

### 6.2 调用域默认只读主知识库

调用域默认只能读取：

```text
user_verified = true
available_for_agent = true
permission allowed
status not in do_not_use / archived
```

`pending_review` 可以在草稿检索或调试模式中出现，但必须明确标识为未确认。

### 6.3 调用输出必须回到 Review

调用域产生的回答、提纲、判断或复盘结论不能直接成为长期知识。

正确路径：

```text
AIAnswer
→ Memory Draft / Candidate Knowledge Unit
→ Review Item
→ Validation
→ Confirmed Memory / Confirmed Knowledge Unit
```

---

## 7. 端到端产品闭环

### 7.1 建库闭环

```text
Upload / text_import
→ File Receiving / Integrity Check
→ File Save + file_id
→ File Inspection / Risk Policy / Preview
→ Source
→ Source Description
→ Parser Router / Format Validation / Processing Queue
→ Parsing / Cleaning / Chunking
→ Chunk Quality Check
→ Candidate Knowledge Unit
→ AI Structured Organization
→ Classification / Relation / Schema Match
→ Review + Validation
→ Confirmed Knowledge Unit
→ Multi-index + Version / Audit
```

### 7.2 调用闭环

```text
User Task
→ Invocation Request（Z0a summary / Z2 persisted）
→ Intent / Scope / Policy
→ Retrieval Plan（Z0a summary / Z2 persisted）
→ SQL + Keyword + Vector + Relation Retrieval
→ Evidence Pack
→ Agent Context
→ Citation Preview / Query Explanation
→ Feedback / Memory Review
```

### 7.3 回流闭环

```text
Citation Preview / RAG Answer / evidence-only answer
→ Save as Memory Draft
→ Save as Candidate Knowledge Unit
→ Review + Validation
→ Confirmed Knowledge Asset
```

---

## 8. P0 产品闭环

P0 不追求完整多 Agent，也不追求生产级云协作，但必须覆盖完整入库、文件处理、AI 结构化和 RAG 闭环。

P0 拆分为四个工程切片：

| 切片 | 职责 |
|---|---|
| P0-Core | 桌面骨架、本地用户、账号预埋、项目空间、权限、审计、错误 envelope |
| P0-File | 上传、分片/直传、接收、完整性校验、文件保存、File Inspection、预览生成、状态反馈 |
| P0-AI | Parser Router、开源优先解析/OCR/ASR、内容清洗、切片、KU 抽取、Embedding |
| P0-RAG | Query Understanding、Retrieval Strategy、Hybrid Retrieval、Ranking、Evidence Pack、Citation Trace、Query Explanation、RAG answer/evidence-only fallback、Feedback Signal / Policy、用户记录 |

P0 应验证这一条完整闭环：

```text
Account preembed / local_user
→ Upload / text_import
→ File Receiving
→ Integrity Check
→ File Save + file_id
→ File Inspection
→ Source
→ Parser Router
→ Parsing / Cleaning
→ Chunk
→ AI Structured Organization
→ Candidate Knowledge Unit
→ Review
→ Confirmed Knowledge Unit
→ Embedding / VectorStore
→ Query Understanding / Retrieval Strategy
→ Hybrid Retrieval
→ Ranking / Evidence Pack / Citation Trace
→ RAG Answer or evidence-only fallback
→ Feedback / Memory Draft
```

P0 必须做到：

- 每个物理文件有上传、接收、校验、保存和解析状态。
- 每条 Knowledge Unit 可以追溯到 Source / Chunk。
- 默认调用不会命中未确认知识。
- Hybrid Retrieval 能展示检索结果、match reasons 和 query explanation。
- Retrieval Preview / RAG answer 能展示 `query_understanding_profile`、`retrieval_strategy_profile`、`ranking_profile`、`citation_trace_profile` 和 `feedback_actions`。
- Evidence Pack 能连接 Knowledge Unit、Chunk、Source、Relation 和 query trace。
- Citation Preview 能展示被调用知识、Source/File、页码/段落/text span、citation confidence、`source_reliability_score` 和 `source_reliability_label`。
- P0-Z0a 只生成 evidence-only answer，不调用 LLM；P0-Z2 或显式 Provider 增强路径再生成带引用 RAG answer，不可用时继续 evidence-only answer。
- 用户反馈写为 `feedback_signal`，并由 `feedback_policy` 限定 local_only / current_project / capped_weight；只影响排序建议和诊断，不自动改变 confirmed knowledge。
- Save as Memory / Candidate Knowledge Unit 不绕过 Review。
- 刷新页面或重新打开项目后，Evidence Pack 和 Citation Preview 仍可复盘。

整个 P0 暂不做真实线上账号、多租户、云同步、多 Agent 工具执行、自主执行、外部 API 工具调用、GraphRAG / Learning-to-Rank runtime、WebSocket 必需通道和独立向量数据库服务。

---

## 9. P1 / P2 演进

### 9.1 P1

P1 重点是把 P0 的本地/开源优先能力升级为更稳定的生产能力。

加入：

- 真实账号和多设备同步。
- Provider 质量评估和商业 Provider 可选接入。
- relation expansion retrieval。
- reranker。
- Memory 管理面板。
- 召回质量反馈。
- Text-to-SQL rule-based planner 到真实模型的评估。

### 9.2 P2

P2 重点是全局知识理解和复杂 Agent 调用。

评估：

- community summary。
- Global Search。
- DRIFT-like search。
- 自动 MOC / project knowledge map。
- Neo4j 或 LightRAG 作为可替换检索后端。
- 多任务 Agent 调用。
- 跨项目知识迁移。
- 创作风格长期建模。

---

## 10. UX 合并原则

用户不应感知为两个割裂系统。

建议的产品界面结构：

```text
Knowledge Workspace
├── 左侧：Knowledge Space / Folder / Tag
├── 中间：Source / Knowledge Unit / Review Queue
├── 右侧：Evidence / Citation / Agent Context
└── 底部或侧栏：Invocation / Feedback / Save as Memory
```

核心体验：

- 用户可以从材料进入建库。
- 用户可以从 Knowledge Unit 进入来源和证据。
- 用户可以从问题进入 Evidence Pack。
- 用户可以从 Citation 回到 Source / Chunk。
- 用户可以把有价值输出送回 Review。

不要把产品做成只有聊天框的界面。

---

## 11. 与其他文档的关系

```text
README.md
└── 项目入口与当前状态

docs/product-architecture.md
└── 前端体验层 + 知识构建域 + 知识组织层 + 知识调用域 + AI 能力栈 + 共享底座 + 横切支撑层的总架构

docs/architecture-design-plan.md
└── 知识库构建系统架构

docs/knowledge-invocation-system-design-plan.md
└── 知识调用系统架构

docs/data-model.md
└── 共享数据模型、只读视图、状态和冻结门槛

docs/mvp-scope.md
└── P0 / P1 / P2 / 暂缓范围、P0 用户路径和验收标准

docs/api-design.md
└── P0 建库、检索预览、调用预览和反馈回流 API 草案

docs/text-to-sql.md
└── P0 只读查询契约、典型 SQL 模板、权限过滤和 Query Explanation

docs/api-implementation-plan.md
└── API route-level 实施映射、service / repository 分层和合同测试清单

docs/technical-stack-and-prototype-plan.md
└── P0 推荐技术栈、原型目录、实施切片和验证命令

docs/development-plan.md
└── 阶段计划、决策记录、验收清单和后续路线

docs/progress.md
└── 当前执行进度和验证记录
```

---

## 12. 当前结论

两个系统应合并为一个产品，产品名义上是 **AI 个人知识资产系统**。

工程实现必须坚持：

```text
产品层合并
工程层分域
数据层共享
写入需 Review
调用需证据
输出需回流
```

调整后的总架构：

```text
前端体验层
├── 知识构建域（写入：入库 → 解析 → 切片 → KU 提取 → Review → 确认入库）
├── 知识组织层（跨域：标签 / 分类 / 关系 / MOC / 知识库类型 / 持续优化）
├── 知识调用域（只读：意图 → 检索 → 证据包 → 引用预览 → 反馈回流）
├── Building AI | Invocation AI（两层 AI 能力，P0 开源优先 + fallback，P1/P2 增强）
├── 共享底座（数据契约 + 知识库类型学 + 索引）
└── 横切支撑层（Auth / 权限 / 版本记录 / 日志 / 安全 / 性能成本）
```

这是后续数据模型、API、UX 和原型开发的上位约束。
