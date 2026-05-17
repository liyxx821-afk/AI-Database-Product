# 分布式开发计划

版本：v0.4
日期：2026-05-17
状态：基于当前技术栈与架构设计审查形成的 P0 代码阶段分工计划；用于多人、多工作流或多 Agent 并行开发；已补充共享契约锁、集成节奏、PR 准入 / 退出标准、冲突预案、风险登记、D-098 Knowledge Workspace 八页 IA / S6 页面所有权，以及 D-099 前后端交付边界；不改变 P0 本地桌面运行架构，不新增运行时代码、migration、OpenAPI、endpoint 或依赖

## 1. 文档用途

本文档回答三个问题：

1. 当前技术栈和架构设计是否适合继续推进桌面软件开发。
2. 下一阶段代码实现应该如何拆分给不同开发流并行推进。
3. 哪些共享契约、验收门槛和文件所有权必须先固定，避免并行开发造成漂移。

术语说明：

- 本文中的“分布式开发”指**开发协作方式的分布**，包括多人、多分支、多工作流或多 Agent 协作。
- 它不表示把 P0 产品运行时改成分布式系统。
- P0 仍然是本地优先桌面软件：Electron 主进程管理窗口和本地 sidecar，FastAPI sidecar 提供本机 API，SQLite + sqlite-vec 作为主数据层。

## 2. 当前技术栈审查结论

当前技术栈可以继续作为 P0 代码阶段基础，不建议在开工前更换主栈。

### 2.1 保持不变的主栈

| 层级 | 当前选择 | 审查结论 |
|---|---|---|
| 桌面壳 | Electron Main / Preload | 符合本地文件系统、窗口生命周期、sidecar 管理和桌面分发需求 |
| 前端 | React + Vite + TypeScript | 适合快速构建知识工作台、状态面板、Review UI 和引用查看界面 |
| 状态 | Zustand + typed fetch + SSE | 足以支撑 P0 runtime 状态、job 事件、review 状态和检索反馈 |
| 后端 | FastAPI sidecar | 适合 Python 文档处理、RAG、embedding、Text-to-SQL 和本地服务封装 |
| 数据库 | SQLite + sqlite-vec + FTS5 | 符合 P0 本地优先、低安装成本和可迁移目标 |
| 数据访问 | Repository + UnitOfWork | 保留 P1 PostgreSQL 迁移点，避免业务逻辑绑定 SQLite 方言 |
| AI 能力 | ProviderRegistry + optional provider | 支持模型供应商、开源模型和 fallback 能力分层 |
| 后台任务 | local_sqlite_worker + ProcessingJob + SSE | P0 不需要 Redis/Celery，但必须保证单写者和可恢复事件流 |
| 合同 | OpenAPI + Pydantic + generated TS types | 是并行开发的核心边界，必须从首个 API 开始执行 |

### 2.2 不建议提前引入的技术

| 技术 | P0 处理方式 | 原因 |
|---|---|---|
| PostgreSQL + pgvector | 保持 P1 迁移选项 | P0 本地桌面安装和打包成本更高 |
| 独立向量数据库 | 暂不引入 | 会增加部署、备份、同步和证据一致性复杂度 |
| Redis / Celery | 暂不引入 | P0 可用 local_sqlite_worker 承担本地任务队列 |
| GraphRAG / 图数据库 | 暂缓 | P0 关系以 KnowledgeRelation、Link/Backlink 和 MOC 建模即可 |
| 多 Agent 执行系统 | 暂缓 | P0 只保留 implicit_agent 和只读调用边界 |
| 云同步 / 多设备协作 | 暂缓 | 会改变权限、冲突合并和隐私模型 |

### 2.3 主要风险

当前风险不在选型，而在实现时跨模块漂移：

- Renderer 绕过 preload 直接访问 Node 或后端地址。
- API schema、Pydantic DTO、generated TS types 和前端 fetch contract 不同步。
- sqlite-vec 不可用时，检索降级后 citation / evidence 规则被削弱。
- FastAPI route 同步跑整文件解析、embedding 或 FTS 重建，导致 UI 卡死或 SQLite 锁争用。
- Main、sidecar、worker、SSE 和 Repository 对同一 runtime state / job state 使用不同枚举。
- 开发态能跑，但 packaged sidecar、native dependency、日志路径和数据目录在打包态失败。
- 多个开发流同时编辑共享契约文件，导致 D-090 到 D-095 的开工约束失效。

### 2.4 二次审查后的优化结论

本轮审查确认：技术栈不需要替换，分布式开发计划需要从“工作流拆分”升级为“契约驱动的并行交付机制”。

| 审查项 | 结论 | 对分布式开发计划的优化 |
|---|---|---|
| 桌面运行时 | Electron + FastAPI sidecar + SQLite 路线成立 | S0/S1/S2 必须先形成 runtime contract，不允许业务流先建 UI 或 route |
| API 与类型 | OpenAPI/generated TS types 是前后端协作边界 | S1 拥有 API contract lock；所有业务 PR 先对齐 generated types |
| 数据写入 | SQLite 本地单写者是 P0 稳定性关键 | S2/S3 共享 data write lock；route 不直接跑重写入 |
| 检索与证据 | sqlite-vec 可降级，但 citation 不可降级 | S5 拥有 evidence contract；S6 只能展示后端返回的 evidence，不在 UI 拼证据 |
| 打包态 | 桌面软件不能只验开发态 | S7 从 Phase 0 开始维护 packaged sidecar spike |
| 多工作流协作 | 最大风险是共享契约并发编辑 | 新增 contract lock、PR gate、冲突预案和 integration cadence |

优化方向：

1. 把 S0/S1/S2/S7 视为 foundation lanes，先稳定 runtime、API、data 和 verification。
2. 把 S4/S5/S6 视为 feature lanes，只能在对应契约固定后进入。
3. 每个 PR 都必须声明 contract impact、data impact、runtime impact、evidence impact 和 verification command。
4. 每次合并后都更新 `docs/progress.md`，若改变边界则同步 `docs/development-plan.md` 和相关领域文档。

### 2.5 前后端边界审查后的优化结论（D-099）

本轮审查确认：前后端技术选择已经明确，下一步风险是 Renderer、preload、FastAPI sidecar、worker 和 SQLite 的职责被混写。D-099 将前后端边界固定为以下工程事实：

| 边界层 | 技术与职责 | 不允许做的事 |
|---|---|---|
| Electron Main | 管理窗口、数据目录、sidecar 生命周期、本地 token、原生文件能力和诊断导出 | 承载业务规则、直接拼 RAG evidence、向 Renderer 暴露长期 token |
| Preload bridge | 注入 typed runtime / API 配置、暴露受限原生能力、隔离 Node 能力 | 暴露任意 Node API、暴露数据库路径、让 Renderer 自己发现 sidecar |
| Renderer Frontend | React + Vite + TypeScript；八页工作台、状态展示、Review / Evidence / Citation UI | 直接访问 Node / 文件系统 / SQLite；手写长期 DTO；在 UI 中伪造 evidence 或 citation |
| API client | generated TypeScript types + typed fetch wrapper + error envelope | 绕过 OpenAPI 类型、硬编码 response shape、吞掉 request_id / error code |
| FastAPI sidecar | Pydantic schema、OpenAPI、route、service、repository、job snapshot、error envelope | 把重任务同步跑在 route 内；把 UI 布局状态写入业务表 |
| Worker / SSE | local_sqlite_worker、ProcessingJob、`processing_status_events`、SSE 续读 | 直接由 Renderer 驱动写库；不写 event_seq / fallback_reason |
| SQLite / sqlite-vec | 本地主库、FTS5、sqlite-vec、metadata、migration、backup、quick_check | 被 Renderer 直接访问；绕过 Repository / UnitOfWork；向量降级时删除 evidence 规则 |

D-099 的优化目标不是新建前后端，而是把“前端能消费什么、后端必须提供什么、中间契约在哪里生成”写清楚。

## 3. 架构优化建议

### 3.1 以契约优先组织并行开发

并行开发的第一优先级不是多写功能，而是把共享契约作为单一事实源：

- `packages/runtime-contracts`：`runtime_state`、`job_state`、`capability_status`、错误码、事件枚举、UI severity。
- `apps/api` Pydantic schema：OpenAPI 输出的唯一后端来源。
- `packages/api-types`：由 OpenAPI 生成，不手写漂移类型。
- `docs/error-handling-and-observability.md`：error envelope、错误码和诊断链来源。
- `docs/data-model.md`：migration、表、枚举和 trace chain 来源。
- `docs/testing-strategy.md`：合同测试和 smoke gate 来源。

建议规则：

1. 共享契约文件只能由对应 workstream owner 修改。
2. 任何业务 PR 如果需要改共享枚举，先提交契约 PR，再做业务实现。
3. generated 文件在集成分支统一生成，避免多个分支反复冲突。

### 3.2 先跑通 P0-Core，再做业务 UI

后续代码阶段应保持 D-094 既定顺序：

```text
repo skeleton
→ P0-Core runtime skeleton
→ sidecar health / auth / runtime / status
→ SQLite init / migration guard
→ smoke:p0-core
→ text import / rule chunk / KU review / fallback embedding
→ smoke:p0-z0a
→ ingestion / retrieval / evidence / UI 深化
```

在 `smoke:p0-core` 通过前，不开发上传解析 UI、RAG UI、真实 Provider 接入、OCR/ASR、图谱功能或面向用户的 Chat。

### 3.3 按工作流分布，不按技术层孤立分布

不要把开发简单分成“前端一个人、后端一个人、数据库一个人”。本项目的风险在跨层契约，因此建议按可验收工作流拆分：

- Runtime Core：Main / preload / sidecar lifecycle / runtime status。
- Contract Core：OpenAPI / generated TS / error envelope。
- Data Core：SQLite init / migration / Repository / UnitOfWork。
- Job Core：ProcessingJob / worker / SSE / event replay。
- Knowledge Build：source / chunk / candidate KU / review。
- Retrieval Evidence：embedding fallback / FTS / evidence pack / citation trace。
- Renderer Workspace：只消费 typed preload API 和 generated API types。
- Verification Release：CI / smoke / packaged sidecar / diagnostics。

### 3.4 保留本地桌面边界

P0 运行时不做服务拆分：

- 不把 FastAPI sidecar 独立部署成远程服务。
- 不把 worker 拆成外部队列服务。
- 不引入云数据库、云对象存储或远程索引。
- 不把 Provider 配置、API Key、原文材料自动上传到外部。
- 不把本地日志或诊断包自动发送到云端。

### 3.5 将 D-095 风险变成每个工作流的验收项

每个 workstream 都必须显式覆盖 D-095：

- 打包态可运行，不只验证 dev server。
- sqlite-vec 降级时 citation 和 evidence 仍然可检查。
- SQLite 写入经 worker 或 UnitOfWork 管理，避免多写者。
- 首个 API 即 OpenAPI + generated TS + typed fetch。
- Main 与 sidecar 日志滚动、脱敏、有保留上限。

### 3.6 设置共享契约锁

并行开发开始前，必须定义四类锁：

| 契约锁 | Owner | 覆盖内容 | 变更规则 |
|---|---|---|---|
| runtime contract lock | S0 + S1 | `runtime_state`、preload API、sidecar lifecycle、local token、runtime summary | 先改 `packages/runtime-contracts`，再改 Main/API/UI |
| api contract lock | S1 | OpenAPI、Pydantic schema、error envelope、generated TS types | schema 变更必须附带生成类型和合同测试 |
| data write lock | S2 + S3 | migration、Repository、UnitOfWork、worker 写入、SQLite lock | route 不直接新增重写入；大批量写入经 worker |
| evidence contract lock | S5 + S6 | RetrievalLog、Evidence Pack、Evidence Item、Citation Trace、no evidence 状态 | UI 不补造 citation；无证据必须返回空证据态 |

任何 PR 触碰这些锁，都应在 PR 描述中写明：

```text
Contract impact:
Data impact:
Runtime impact:
Evidence impact:
Verification:
Docs updated:
```

### 3.7 固定集成节奏

建议使用短周期集成，而不是多个大分支长期并行：

- foundation lanes 每天合入一次可运行骨架，不等待完整业务。
- feature lanes 不直接长期偏离 main；每完成一个小 gate 就合并。
- generated types 由 S1 在合并点统一生成，避免多个分支反复改同一输出文件。
- migration 文件只允许 S2 创建；业务流提出 schema request，不直接抢写 migration。
- `smoke:p0-core` 失败时，停止合并 S4/S5/S6 业务 PR，先修 runtime / contract / data 基础。

### 3.8 采用“先失败可见，再功能完整”的实现顺序

每条工作流先实现失败态、降级态和诊断入口，再实现完整功能：

- S0 先显示 sidecar unavailable、DB checking、recovery required。
- S1 先保证 error envelope、auth failure、schema mismatch 可测。
- S2 先实现 migration lock、quick_check failure、backup failure。
- S3 先实现 worker unavailable、job failed、event replay gap。
- S4 先实现 parse failed、review pending、source missing。
- S5 先实现 no evidence、vector degraded、permission blocked。
- S6 先实现 UI 空态、错误态、degraded 状态和 citation 缺失态。
- S7 先让失败脚本输出可定位原因，再追求覆盖完整功能。

### 3.9 前后端交付边界（D-099）

每个跨前后端功能都必须同时交付四件事：

1. **Backend contract**：FastAPI route / Pydantic schema / error envelope / OpenAPI。
2. **Generated type**：由 OpenAPI 生成的 TypeScript 类型，进入 `packages/api-types`。
3. **Frontend adapter**：Renderer 只通过 typed fetch wrapper 或 preload-exposed API 调用，不手写 response shape。
4. **UI state mapping**：页面明确 `loading / empty / degraded / recoverable_error / done` 与后端字段的对应关系。

推荐交付模板：

```text
Feature:
Backend owner:
Frontend owner:
API contract:
Generated types:
Renderer route/page:
State mapping:
Failure states:
Evidence / citation impact:
Verification:
```

禁止事项：

- Renderer 不硬编码 `localhost`、端口、sidecar token 或数据库路径。
- Renderer 不直接访问 Node、文件系统、SQLite、`sources/` 原文目录或 Keychain。
- Renderer 不手写长期维护的 DTO、错误码、job state 或 provider state。
- UI mock 只能作为 contract fixture，必须与 OpenAPI / generated types 同步；不得变成真实数据来源。
- FastAPI route 不把耗时解析、embedding、FTS rebuild、Evidence Pack build 同步跑完。
- 后端不为展示方便创建无业务意义 endpoint；页面优先消费已定义 summary / detail / event / evidence contract。
- Graph / Outputs 页面没有 confirmed relation 或 Evidence Pack 时只能显示空状态或 disabled reason。

## 4. 工作流拆分

### 4.1 S0 Runtime Desktop Core

职责：

- 建立 `apps/desktop-main`、`apps/desktop-preload`、`apps/renderer` 和 `apps/api` 的最小启动链路。
- Main 负责 sidecar 启动、停止、端口注入、本地 token 注入、窗口生命周期和数据目录初始化。
- preload 暴露最小 typed API，不向 renderer 暴露 Node 能力。
- renderer 只显示 runtime status、diagnostics entry 和最小错误态。

主要文件范围：

```text
apps/desktop-main/
apps/desktop-preload/
apps/renderer/
packages/runtime-contracts/
```

验收：

- `pnpm dev:desktop` 能启动桌面窗口。
- sidecar ready 后 renderer 能看到 `runtime_state=ready`。
- sidecar crash 后 renderer 显示 degraded / recovery_required。
- 通过 `smoke:p0-core` 的 runtime 部分。

### 4.2 S1 API Contract and Type System

职责：

- 建立 FastAPI app skeleton。
- 定义 P0-Core 第一组 endpoint：`/api/health`、`/api/system/runtime`、`/api/system/status`、`/api/system/diagnostics:export`、`/api/auth/status`。
- 定义 error envelope、request_id、local auth 失败态。
- 输出 OpenAPI 并生成 TypeScript types。

主要文件范围：

```text
apps/api/app/api/
apps/api/app/schemas/
apps/api/app/core/
packages/api-types/
scripts/export-openapi.py
```

验收：

- OpenAPI 可稳定导出。
- generated TS types 与后端 schema 一致。
- 前端 typed fetch 不手写响应结构。
- API 合同测试覆盖 success、error envelope 和 local auth。
- D-099 后，每个页面相关 API 都要标注 frontend consumer、service owner、response state mapping 和 failure state。

### 4.3 S2 Data and Migration Core

职责：

- 建立 SQLite 初始化、WAL、quick_check、pre-migration backup 和 migration lock。
- 建立 Repository / UnitOfWork skeleton。
- 实现 P0-Z0a 最小表或空迁移骨架，不提前扩大到 Z1/Z2。
- 定义 sqlite-vec capability probe 的存储和 runtime 汇报位置。

主要文件范围：

```text
apps/api/app/db/
apps/api/app/repositories/
apps/api/app/services/database/
apps/api/migrations/
```

验收：

- 新数据目录首次启动可自动初始化。
- migration 期间业务写入被拒绝并返回 `migration_in_progress`。
- `PRAGMA quick_check` 失败能进入 recovery_required。
- sqlite-vec `available / degraded / unavailable` 或等价状态能被 API 和 UI 读取。

### 4.4 S3 Worker and Job Events

职责：

- 建立 local_sqlite_worker。
- 定义 ProcessingJob 状态机、幂等 active job、取消、重试和 heartbeat。
- 定义 `processing_status_events` 事件写入和 SSE 续读。
- 确保重写入不在 route 线程内同步完成。

主要文件范围：

```text
apps/api/app/workers/
apps/api/app/services/jobs/
apps/api/app/api/jobs*
packages/runtime-contracts/
```

验收：

- 同一 job 内 `event_seq` 单调递增。
- SSE 支持 `Last-Event-ID` 或等价续读。
- worker crash 后 job 能进入可解释失败态。
- 批写入有上限、退让和错误事件。

### 4.5 S4 Ingestion and Knowledge Build

职责：

- 实现 P0-Z0a 文本导入。
- 创建 Source、Chunk 和 Candidate Knowledge Unit。
- 先使用 rule chunk 和 fallback extraction，不接入重型 OCR/ASR/真实 LLM。
- 提供 Review 所需的候选知识单元、来源片段和用户确认状态。

主要文件范围：

```text
apps/api/app/services/ingestion/
apps/api/app/services/chunking/
apps/api/app/services/knowledge_units/
apps/api/app/repositories/
```

验收：

- text import 创建 source、chunk、candidate KU 和 review task。
- 所有 candidate KU 都能追溯到 source / chunk。
- AI 建议知识默认 pending_review，不直接 confirmed。
- `smoke:p0-z0a` 的入库段通过。

### 4.6 S5 Retrieval and Evidence

职责：

- 建立 embedding fallback、FTS5 和 sqlite-vec capability-aware 检索。
- 实现 RetrievalLog、Evidence Pack、Evidence Item 和 evidence-only answer。
- 保证向量降级不削弱引用、来源和解释。
- Text-to-SQL 先做白名单模板和只读查询，不做自由 SQL 执行。

主要文件范围：

```text
apps/api/app/services/retrieval/
apps/api/app/services/evidence/
apps/api/app/services/text_to_sql/
apps/api/app/services/embedding/
apps/api/app/repositories/
```

验收：

- 检索结果至少能显示 Knowledge Unit / Chunk / Source 引用。
- sqlite-vec 不可用时，keyword / FTS / metadata fallback 仍能产生 evidence-only answer。
- 无证据时返回明确空证据态，不生成看似有来源的答案。
- RetrievalLog 记录查询、过滤、capability 状态和降级原因。

### 4.7 S6 Renderer Workspace

职责：

- 建立桌面工作台 shell，而不是 landing page。
- 提供左侧八页导航、runtime status bar、project / knowledge space navigation、job progress、review panel、evidence panel 和 query explanation entry。
- 只通过 preload 注入的 typed API 与 generated API types 访问后端。
- UI 状态与 `runtime_state`、job state、capability status 保持一致。
- 遵守 D-098 页面契约：首屏进入 `/dashboard`，`/graph` 和 `/outputs` 在 P0 可作为可解释入口或 disabled placeholder，但不得生成无来源图谱或无 Evidence 的输出。

D-098 后，S6 页面所有权固定如下：

| 内部路由 | 首批职责 | 依赖契约 |
|---|---|---|
| `/dashboard` | 最近导入、知识库概览、文档数量、AI 摘要数量、最近搜索 / 问答和快捷入口 | runtime summary、job summary、retrieval summary |
| `/import` | 拖拽上传、本地文件夹导入入口、格式能力状态、上传进度和解析状态 | upload / job / provider capability API |
| `/library` | 分类树、文档列表、标签 / 时间 / 项目筛选、自动分类结果和文件状态 | source / file / tag / review summary |
| `/search` | 自然语言搜索、结果排序、命中文段、来源文件、标签筛选和跨文档结果 | retrieval response、Evidence Pack、Citation Trace |
| `/ask` | 聊天式提问、evidence-only / provider answer、引用来源、相关文档卡片、追问和生成入口 | RAG answer response、provider/fallback status |
| `/graph` | 文档 / 标签 / 项目 / 人物 / 会议节点与可解释关系视图 | confirmed relation / relation suggestion evidence |
| `/outputs` | 会议纪要、学习笔记、项目摘要、汇报提纲和导出入口 | answer / output draft + Evidence/Citation |
| `/settings` | 账号、存储、AI 模型、外观主题、导入导出和 runtime/provider 状态 | system runtime、settings、provider capability |

主要文件范围：

```text
apps/renderer/src/app/
apps/renderer/src/routes/
apps/renderer/src/features/runtime/
apps/renderer/src/features/import/
apps/renderer/src/features/library/
apps/renderer/src/features/review/
apps/renderer/src/features/retrieval/
apps/renderer/src/features/citation/
apps/renderer/src/services/
```

验收：

- 左侧导航可达 `/dashboard`、`/import`、`/library`、`/search`、`/ask`、`/graph`、`/outputs`、`/settings`。
- runtime degraded、worker unavailable、vector degraded、no evidence 等状态有明确 UI。
- Review 操作不会绕过后端状态机。
- citation / evidence 面板能展示来源链。
- Search / Ask 页面显示 Query Explanation、Evidence Pack、Citation Trace、provider/fallback 状态和空结果 / 证据不足原因。
- Graph / Outputs 数据不足时展示 disabled reason 或可解释空状态，不生成无来源内容。
- 页面数据只能来自 typed fetch wrapper、preload-exposed runtime API 或 contract fixture；不得硬编码后端 URL、临时 JSON shape 或本地文件路径。
- Electron + Playwright 或等价 smoke 能访问关键界面。

### 4.8 S7 Verification and Release

职责：

- 建立最小 CI 和本地验证命令。
- 维护 `smoke:p0-core`、`smoke:p0-z0a`、contract tests、SQLite 并发测试和 packaged sidecar spike。
- 检查日志滚动、诊断包脱敏、数据目录迁移和 native dependency gate。

主要文件范围：

```text
scripts/
.github/workflows/
apps/api/tests/
apps/renderer/tests/
docs/testing-strategy.md
```

验收：

- core-only CI 可在没有重型 provider 依赖时通过。
- packaged sidecar spike 覆盖路径、native dependency 和端口/token 注入。
- `git diff --check`、lint、typecheck、pytest、build 和 smoke 形成最小闭环。
- 失败时输出能定位到 runtime、API、worker、DB、provider 或 renderer。

## 5. 依赖图

```text
S0 Runtime Desktop Core
S1 API Contract and Type System
S2 Data and Migration Core
        ↓
S3 Worker and Job Events
        ↓
S4 Ingestion and Knowledge Build
        ↓
S5 Retrieval and Evidence
        ↓
S6 Renderer Workspace
        ↓
S7 Verification and Release
```

并行原则：

- S0、S1、S2 可以并行启动，但共享枚举和 error envelope 必须先由 S1/S0 对齐。
- S3 依赖 S2 的数据库和 S1 的 API/error contract。
- S4 依赖 S3 的 job 事件和 S2 的最小表。
- S5 依赖 S4 的 chunk / KU / evidence source。
- S6 可以先做 runtime shell，但业务 UI 必须等对应 API contract 固定。
- S7 从第一天开始，不应等业务完成后补测试。

### 5.1 关键路径和并行窗口

| 阶段 | 可并行 | 必须串行 | 阻塞条件 |
|---|---|---|---|
| Phase 0 | S0/S1/S2/S7 | runtime/API/data contract 的最终命名 | `packages/runtime-contracts` 或 OpenAPI 不稳定 |
| Phase 1 | S0/S1/S2/S7 | `smoke:p0-core` | sidecar、local token、SQLite init、runtime status 任一失败 |
| Phase 2 | S3/S4/S7 | job event contract 先于 text import job | worker/event replay 不可用 |
| Phase 3 | S4/S5/S6/S7 | evidence contract 先于 RAG / citation UI | 无法从 answer 回溯到 Evidence Pack / Source |
| Phase 4 | S6/S7 | D-098 八页 route shell 与 packaged sidecar spike 先于 alpha 交付 | 打包态 sidecar、日志、数据目录或页面状态契约失败 |

### 5.2 最小集成分支策略

如果项目只有一个主要实现者，可以不创建所有 feature 分支，但仍应保留工作流边界：

```text
main
└── local working tree
    ├── commit 1: S0/S1/S2 foundation skeleton
    ├── commit 2: S7 smoke:p0-core
    ├── commit 3: S3 job/event
    ├── commit 4: S4/S5 Z0a business smoke
    └── commit 5: S6 renderer integration
```

如果多人 / 多 Agent 并行，应使用 feature branch，并在每天或每个 gate 后向 integration branch 合并：

```text
main
└── integration/p0-core
    ├── feature/p0-core-runtime
    ├── feature/p0-api-contracts
    ├── feature/p0-data-core
    └── feature/p0-verification-release
```

`integration/p0-core` 通过 `smoke:p0-core` 后，再开放 S3-S6 的业务分支。

## 6. 阶段计划

### Phase 0：契约和目录骨架

目标：

- 建立 monorepo 目录和最小 package 配置。
- 建立 `packages/runtime-contracts`。
- 建立 FastAPI skeleton、OpenAPI export 和 generated TS types。
- 建立 empty renderer shell 和 runtime status 占位。

完成标准：

- `pnpm install`、`uv sync --extra core --extra dev` 或等价命令可执行。
- `pnpm generate:api-types` 可生成类型。
- 没有业务功能，仅验证工程骨架。

### Phase 1：P0-Core Runtime Smoke

目标：

- Electron Main 启动 sidecar。
- renderer 读取 runtime status。
- local auth、health、status、diagnostics API 可用。
- SQLite 数据目录和 quick_check 可用。

完成标准：

- `pnpm dev:desktop` 可启动。
- `pnpm smoke:p0-core` 通过。
- sidecar crash、DB init failure、auth failure 有明确错误态。

### Phase 2：P0-Z0a Data and Job Skeleton

目标：

- 建立 Source / Chunk / Candidate KU / ProcessingJob / Event / RetrievalLog / Evidence Pack 最小对象。
- 建立 worker、SSE 和 job event replay。
- 建立 text import 的 job-first 链路。

完成标准：

- text import 能产生 source、chunk、candidate KU 和 review task。
- job 状态和事件可从 UI 或 API 读取。
- SQLite 单写者和 migration lock 可被测试。

### Phase 3：Knowledge Review and Evidence

目标：

- 完成用户确认 / 修改 / 忽略 candidate KU 的最小闭环。
- 完成 embedding fallback、FTS 检索、Evidence Pack 和 evidence-only answer。
- 完成 citation trace summary。

完成标准：

- `pnpm smoke:p0-z0a` 通过。
- 无证据问题不生成伪答案。
- vector degraded 时仍显示可追踪引用和降级原因。

### Phase 4：Renderer Integration and Packaged Alpha

目标：

- 补齐 D-098 八页工作台 route shell：`/dashboard`、`/import`、`/library`、`/search`、`/ask`、`/graph`、`/outputs`、`/settings`。
- P0-Z0a 优先打通 dashboard / import / library / search / ask 的最小 evidence-only 链路。
- `/graph` 和 `/outputs` 先作为可解释入口或 disabled placeholder，完整图谱交互与内容生成增强进入 Z1/Z2。
- 补齐 Review 面板、Evidence 面板、Runtime 状态条和诊断导出入口。
- 跑 packaged sidecar spike。
- 固定 alpha 级别日志滚动、诊断脱敏和数据目录策略。

完成标准：

- 首屏进入 `/dashboard`，左侧导航可达 8 个页面，底部 runtime status bar 始终可见。
- 每页都有 `loading / empty / degraded / recoverable_error / done` 状态，状态来自既有 store 和 API summary。
- dev 和 packaged spike 都能启动到可检查状态。
- 核心状态和错误在 UI 中可见。
- README、开发计划、进度记录与实际代码状态一致。

## 7. 分支和 PR 计划

建议分支：

| 分支 | 所属工作流 | 主要写入范围 |
|---|---|---|
| `feature/p0-core-runtime` | S0 | `apps/desktop-main`、`apps/desktop-preload`、runtime UI |
| `feature/p0-api-contracts` | S1 | `apps/api/app/api`、schemas、OpenAPI、`packages/api-types` |
| `feature/p0-data-core` | S2 | `apps/api/app/db`、repositories、migrations |
| `feature/p0-worker-events` | S3 | worker、ProcessingJob、SSE |
| `feature/p0-ingestion-review` | S4 | ingestion、chunking、KU review |
| `feature/p0-retrieval-evidence` | S5 | retrieval、embedding、evidence、Text-to-SQL stub |
| `feature/p0-renderer-workspace` | S6 | renderer workspace、D-098 八页 route shell、review/evidence UI |
| `feature/p0-verification-release` | S7 | scripts、tests、CI、packaged spike |

合并顺序：

1. 先合并 S1 契约骨架和 S0/S2 最小骨架。
2. 再合并 S3 worker/event。
3. 再合并 S4/S5 业务竖切。
4. S6 UI 可提前做 runtime shell，但业务面板在 API contract 固定后合并。
5. S7 的测试脚本应跟随每个阶段持续更新。

PR 规则：

- 每个 PR 声明所属 workstream、写入范围、依赖、验证命令。
- 共享契约变更必须附带 generated types、合同测试和文档同步。
- 不允许一个 PR 同时大改 API、migration、renderer 和 packaging。
- 不允许为了通过 UI smoke 绕过 error envelope、preload API 或 Repository 边界。

### 7.1 PR 准入标准

一个 PR 开始前必须满足：

- 已声明 workstream 和 owner。
- 已确认是否触碰 runtime / API / data / evidence 四类契约锁。
- 已列出预计修改路径，避免与其他工作流重叠。
- 已确认依赖的上游 gate 已通过。
- 已确认本 PR 不引入 P1/P2 默认依赖。

### 7.2 PR 退出标准

一个 PR 合并前必须满足：

- `git diff --check` 通过。
- 对应 workstream 的最小验证命令通过，或说明为何无法运行。
- 如果改 API schema，已重新生成 TS types 并通过 typecheck。
- 如果改 migration / repository，已说明数据回滚或恢复策略。
- 如果改 worker / SSE，已覆盖失败态和续读态。
- 如果改 retrieval / evidence，已覆盖 no evidence 和 vector degraded。
- 如果改 renderer，UI 没有绕过 preload/API contract。
- 如果改文档索引，README、开发计划和进度记录已同步。

### 7.3 冲突处理顺序

发生冲突时按以下顺序处理：

1. 先保留 `packages/runtime-contracts`、OpenAPI、data model 和 error envelope 的单一来源。
2. 再调整 service / repository / worker。
3. 最后调整 renderer UI 和 smoke 脚本。
4. 不通过删除合同测试或降级验证来解决冲突。
5. 如果业务实现与 D-090-D096 冲突，先更新设计文档并记录决策，再改代码。

## 8. 文件所有权矩阵

| 路径 | Owner | 其他工作流规则 |
|---|---|---|
| `packages/runtime-contracts/` | S0 + S1 | 变更枚举前先更新合同测试 |
| `packages/api-types/` | S1 | 由 OpenAPI 生成，不手写业务类型 |
| `apps/api/app/api/` | S1 | 业务 route 需引用 service，不直接写复杂逻辑 |
| `apps/api/app/db/` | S2 | migration、connection、backup、lock 归 S2 |
| `apps/api/app/repositories/` | S2 | S4/S5 可提接口需求，不直接绕过 UnitOfWork |
| `apps/api/app/workers/` | S3 | route 不直接执行重任务 |
| `apps/api/app/services/ingestion/` | S4 | 文件处理重型 provider 后置 |
| `apps/api/app/services/retrieval/` | S5 | evidence/citation 不允许被 UI 层补写 |
| `apps/renderer/` | S0 + S6 | renderer 不访问 Node，不手写后端 URL；D-098 八页路由归 S6，跨页状态复用既有 store |
| `apps/renderer/src/services/` | S6 + S1 | typed fetch wrapper、API adapter 和 contract fixture 归这里；不得绕过 generated types |
| `apps/desktop-preload/` | S0 + S6 | 只暴露受限 runtime/native bridge；不得透传 Node、DB path 或长期 token |
| `scripts/` | S7 | smoke 脚本必须匹配当前 docs gate |
| `.github/workflows/` | S7 | core-only job 不能依赖重型 provider |
| `docs/` | 对应 owner | 契约变化必须同步计划与进度 |

### 8.1 文档所有权补充

| 文档 | Owner | 更新触发 |
|---|---|---|
| `docs/technical-stack-and-prototype-plan.md` | S0/S1/S2/S7 联合 | 技术栈、目录、命令、gate 或冻结项变化 |
| `docs/desktop-architecture.md` | S0 | Main/preload/sidecar/packaging/runtime state 变化 |
| `docs/api-implementation-plan.md` | S1 | endpoint、DTO、service、repository 映射变化 |
| `docs/data-model.md` | S2 | migration、表、枚举、trace chain、Z0a/Z0b 波次变化 |
| `docs/testing-strategy.md` | S7 | smoke、contract test、CI、fixture 或 performance baseline 变化 |
| `docs/rag-pipeline.md` | S5 | retrieval、embedding、evidence、citation、answer 边界变化 |
| `docs/development-plan.md` | 集成 owner | 决策、阶段、文档结构、验收清单变化 |
| `docs/progress.md` | 当前执行者 | 每次完成可验证阶段或文档同步 |

## 9. 验收门槛

### G0：Repo Skeleton Gate

- 目录结构与 D-094 一致。
- 依赖分组可安装。
- OpenAPI export 命令存在。
- runtime contracts 可被前后端引用。

### G1：P0-Core Gate

- `pnpm dev:desktop` 可启动桌面应用。
- sidecar health、runtime、status、auth API 可用。
- renderer 显示 runtime 状态。
- SQLite init、quick_check、migration lock 和 graceful shutdown 可验证。

### G2：Contract Gate

- 首个 API 即有 OpenAPI。
- TS types 由 OpenAPI 生成。
- typed fetch 使用 error envelope。
- 后端合同测试覆盖 success / error / auth。

### G3：P0-Z0a Gate

- text import → source → chunk → candidate KU → review task → fallback embedding → evidence-only answer 跑通。
- `processing_status_events`、`retrieval_logs`、`evidence_packs`、`evidence_items`、`ai_answers(output_type=evidence_only_answer)` 符合 P0-Z0a 边界。
- 不提前持久化 Z2 的 invocation_requests、retrieval_plans、memories 或 retrieval_feedback。

### G4：Packaged Sidecar Gate

- packaged sidecar spike 覆盖路径、端口、token、native dependency 和日志路径。
- 不以 `uvicorn --reload` 作为唯一验收。
- 打包态和开发态 runtime state 表现一致。

### G5：Evidence and Privacy Gate

- 无证据不回答。
- vector degraded 时 citation 不降级。
- 日志不含原文、密钥或敏感片段。
- 诊断包需用户主动导出，不自动上传。

### G6：Integration Gate

- integration branch 合并前，`smoke:p0-core` 必须保持通过。
- 若进入 P0-Z0a，`smoke:p0-z0a` 必须覆盖 text import、chunk、candidate KU、review、fallback embedding、evidence-only answer。
- README、`docs/development-plan.md`、`docs/progress.md` 与实际实现状态一致。
- 未跟踪文件、生成文件和本地数据目录不得混入 PR。

### G7：Decision Drift Gate

- 如果实现需要改变 D-090-D096 已冻结口径，必须新增决策记录。
- 如果只是执行细节变化，只更新对应领域文档和进度记录。
- 如果发现文档之间冲突，以当前实现阶段的 `docs/development-plan.md` 决策记录和 `docs/progress.md` 最新记录为入口，再回写领域文档。

### G8：Frontend / Backend Boundary Gate（D-099）

- Renderer 只通过 preload bridge、typed fetch wrapper 和 generated API types 访问后端能力。
- API base URL、local token 和 runtime config 只能由 Electron Main / preload 注入。
- 所有页面 API response 都能从 Pydantic schema 追到 generated TS types。
- UI 状态必须能追到后端字段、job event、provider capability 或 evidence/citation 状态。
- Contract fixture 必须与 OpenAPI 类型一致，且不得替代真实 service / repository contract。
- `grep` / lint 或等价检查应阻止 renderer 出现直接 `fs`、`child_process`、SQLite path、长期 token 或裸 `localhost`。

## 10. 不做的分布式运行时能力

P0 明确不做：

- 远程后端服务部署。
- 多节点 worker。
- Redis / Celery / Kafka。
- 云数据库或云向量库。
- 多设备同步。
- 团队协作权限。
- 自动云备份。
- 自动遥测上报。
- 多 Agent 执行编排。

这些能力若进入 P1/P2，应先更新数据模型、权限模型、错误处理、隐私策略、迁移策略和测试策略。

## 11. 风险登记与处理策略

| 风险 | 触发信号 | 处理策略 | Owner |
|---|---|---|---|
| 契约漂移 | API schema、generated types、前端类型不一致 | 暂停业务合并，由 S1 统一 OpenAPI 和 TS types | S1 |
| runtime 状态不一致 | Main、sidecar、UI 对状态解释不同 | 回到 `packages/runtime-contracts` 和 D-094 状态机 | S0 |
| SQLite 锁争用 | route 阻塞、worker 写入失败、busy timeout 频发 | 将重写入迁回 worker，批写入限流 | S2/S3 |
| evidence 断链 | answer 找不到 Evidence Pack / Source | 停止 RAG UI 合并，先修 S5 evidence contract | S5 |
| 打包态失败 | dev 可用但 packaged sidecar 不可用 | S7 提升 packaged spike 为 blocking gate | S7 |
| 文档和实现不一致 | README / plan / progress 说法不一致 | 当前执行者先更新 progress，再回写 plan 和领域文档 | 集成 owner |
| P1/P2 依赖提前进入 | OCR/ASR/reranker/GraphRAG 等变成必装 | 回退为 optional provider 或 feature flag | S1/S7 |
| UI 越权 | renderer 直接读 Node、直连后端 URL 或拼 evidence | 回到 preload API 和 typed fetch contract | S0/S6 |
| 前后端边界漂移 | UI 手写 DTO、后端临时返回字段、fixture 与 OpenAPI 不一致 | S1 重新生成 types，S6 只接 generated contract，临时 mock 改成 contract fixture | S1/S6 |
| preload 过宽 | preload 暴露文件系统、DB path、长期 token 或任意 IPC | S0 收窄 preload surface，S7 增加安全检查 | S0/S7 |

## 12. 当前建议的下一步

建议下一轮代码阶段按以下顺序执行：

1. 指定 S0/S1/S2/S7 的 owner 和共享契约锁。
2. 创建 S0/S1/S2 最小骨架，不写业务 UI。
3. 建立 preload bridge 最小 surface、typed fetch wrapper 和 generated API types 输出路径。
4. 生成并验证 OpenAPI / TypeScript 类型。
5. 实现 sidecar lifecycle、local token、runtime status 和 SQLite init。
6. 跑通 `smoke:p0-core`。
7. 开放 S3/S4/S5/S6 的业务分支。
8. 再进入 text import / chunk / candidate KU / evidence-only 的 `smoke:p0-z0a`。

如果只能安排一个开发流，仍按 Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 顺序线性执行。

如果可以安排多个开发流，应让 S0/S1/S2 先并行，S7 同步建立验证脚本，S4/S5/S6 等待核心契约稳定后进入。

## 13. 待确认事项

进入代码阶段前建议确认：

- 开发期 app name、bundle id、Keychain service name 和数据目录名。
- sqlite-vec capability 枚举最终命名：沿用 `available / degraded / unavailable`，还是与 D-095 的 `available / load_failed / disabled` 做映射。
- package manager 脚本名称是否固定为 `pnpm dev:desktop`、`pnpm generate:api-types`、`pnpm smoke:p0-core` 和 `pnpm smoke:p0-z0a`。
- CI 是否先只建本地 core-only workflow，packaged sidecar spike 是否作为手动或 nightly job。
- 首批 PR 是否采用单分支线性提交，还是按 S0-S7 分支拆分。
- typed fetch wrapper 采用 `fetch` 还是 Axios 封装；无论选择哪种，都必须消费 generated types 和统一 error envelope。
- contract fixture 放在 `apps/renderer/src/services/__fixtures__` 还是 `apps/renderer/src/mocks`；无论位置如何，必须由 S1/S6 共同维护并跟随 OpenAPI 变更。

## 14. 文档优化检查清单

本计划每次优化后应检查：

- 是否仍明确 P0 是本地桌面软件，不是分布式运行时。
- 是否仍保持 Electron + React + Vite + TypeScript、FastAPI sidecar、SQLite + sqlite-vec 的主栈。
- 是否没有把 PostgreSQL、Redis/Celery、独立向量库、GraphRAG、多 Agent 执行系统或云同步提前变成 P0 默认依赖。
- 是否能从每个 workstream 回到明确文件范围、owner、输入依赖和验收命令。
- 是否说明 `smoke:p0-core` 先于 `smoke:p0-z0a`。
- 是否说明 no evidence、vector degraded、worker unavailable、sidecar crash、migration running 等失败态。
- 是否说明 Renderer / preload / FastAPI sidecar / worker / SQLite 的前后端交付边界。
- 是否禁止 Renderer 直接访问 Node、SQLite、长期 token、裸 `localhost` 或手写 DTO。
- 是否同步 README、开发计划、进度记录和项目背景说明书。
