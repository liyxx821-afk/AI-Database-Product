# 测试与评估策略

版本：v0.31
日期：2026-05-17  
状态：完整 P0 入库、P0-Z0a/Z0b 竖切、ProcessingJob、File Inspection、切片前准备层、结构化整理检查门、知识切片质量闭环、安全运维横切层、检查门映射单一来源、事件枚举单一来源、切片执行 profile fixture、AI 结构化整理 profile 与 D-079 存储映射 fixture、D-080 知识调用 / implicit_agent / D-081-D085 调用边界、profile schema、反馈策略与前端状态 fixture、D-098 Knowledge Workspace 页面契约 fixture、D-105 Citation Detail / Evidence Pack replay smoke、D-106 i18n settings smoke、D-107 feedback / memory smoke、D-108 feedback diagnostics smoke、D-109 desktop runtime smoke、D-110 feedback diagnostics export smoke、D-111 feedback filters / export history smoke、D-112 citation detail focus smoke、向量检索与 RAG 验收策略 + provider fallback fixture + D-090 技术栈执行优化测试口径 + D-091 工程化验收门槛 + D-092 代码骨架前置契约测试口径 + D-093 桌面运行时硬化测试口径 + D-094 P0-Core 工程骨架开工测试口径

## 1. 文档目的

本文档解决一个核心问题：

> 各文档零散提到 contract test、smoke test、合同测试等，但缺少统一的测试策略。具体缺口：没有覆盖上传 / 完整性校验 / 解析 / OCR-ASR 降级 / RAG fallback 的 P0 fixture 数据集、性能基线、SQLite 并发测试、桌面 E2E 方案和 CI 集成预案。如果不统一定义，完整 P0 完成时无法系统验收。

本文档定义：

- 测试金字塔（单元 / Repository / Service 集成 / 合同 / 桌面 E2E）
- P0 fixture 数据集（文本、PDF/Office/图片/音频占位、hash 错误、unsupported parser + 期望输出）
- P0 知识调用 fixture（simple fact、concept explanation、timeline、file lookup、relationship analysis、summary synthesis、complex hybrid、citation/feedback/frontend state）
- 性能基线（1K KU must、10K KU pressure、上传进度、解析状态、检索响应、RAG fallback 耗时）
- SQLite WAL 模式并发测试
- Electron + Playwright E2E 测试方案
- CI 集成预案（GitHub Actions / GitLab CI）
- P0 开源优先 AI 能力与 fallback 评估方案（mock / local provider baseline 对比）

本文档不替代：

- `docs/api-implementation-plan.md`（合同测试 10 条）
- `docs/p0a-execution-plan.md`（每周交付物的验收）

---

## 2. 测试策略原则

### 2.1 测试金字塔（成本与价值）

```text
        ┌─────────┐
        │  E2E    │  少（5-10 个核心流程）
        │ Playwright│
        └─────────┘
       ┌───────────┐
       │  Contract │ 中（按 P0 关键 API）
       │   Test    │
       └───────────┘
      ┌─────────────┐
      │ Service IT  │ 中（业务流程）
      └─────────────┘
     ┌───────────────┐
     │ Repository IT │ 中（SQL 查询）
     └───────────────┘
    ┌─────────────────┐
    │   Unit Tests    │ 多（rules / mock / utils）
    └─────────────────┘
```

### 2.2 P0 优先验证"链路完整"，语义质量先做可解释降级

P0 阶段 AI 能力采用开源优先 ProviderRegistry，因此测试优先关心：

- 数据流是否完整（Upload / text_import → File → Source → Parse → Chunk → KU → Review → Embedding → Retrieval → Evidence → Answer/Fallback）
- 状态机是否正确（pending_review → confirmed → 检索可见）
- 来源是否可追溯（KU 是否能 join 回 Source）
- Provider 缺失时是否进入明确错误或 fallback，不丢文件、不丢状态
- P0 默认工具缺失时是否记录 `provider_key`、`capability_status`、`fallback_reason`

P0 不把以下指标作为阻塞项：

- mock / fallback embedding 的语义召回质量
- mock / local LLM 摘要的主观质量
- OCR / ASR / 图片理解的生产级准确率

P1 再引入大规模语义质量评估、citation accuracy 人工评分和 provider 成本评估。

### 2.3 测试隔离原则

- 单元测试：纯函数，无 DB / 网络
- Repository 测试：使用临时 SQLite 文件，每个测试独立
- Service 集成：使用临时 SQLite + mock provider
- 合同测试：从 HTTP 层调用，验证 request/response schema
- E2E 测试：完整 Electron 应用 + 临时数据目录

### 2.4 不测试 Electron 系统行为

不测试：

- Electron 主进程窗口管理（信任 framework）
- 系统托盘 / 全局快捷键（信任 framework）
- 自动更新（P1 上线后单独验证）

测试：

- IPC 消息处理逻辑
- Sidecar 启动 / 重启 / 崩溃恢复
- 文件拖放 / 分片上传 → File → Source → Parse → Chunk → Evidence/RAG fallback 的端到端

### 2.5 D-090 技术栈执行优化测试口径

D-090 后新增以下测试约束：

- 依赖分组测试：P0-Z0a CI 只安装 `core + dev` 依赖时，API health、SQLite migration、text_import、rule chunk、KU review、embedding fallback、retrieval/evidence-only smoke test 必须通过。
- optional provider 缺失测试：PyMuPDF、PaddleOCR、Whisper、bge-m3、bge-reranker-v2、LLM provider 缺失时，系统必须返回 `disabled / unavailable / fallback` 状态和明确 `fallback_reason`，不得 import-time crash。
- sqlite-vec probe 测试：模拟 `available / degraded / unavailable` 三态，验证 `embeddings` 表、VectorStoreService、Query Explanation 和 `/api/system/status` 表达一致。
- File Inspection 分层测试：Z0a 只用扩展名 / MIME / 文件头摘要也能完成 text_import / Markdown 主链路；Z0b/Z1 再验证 libmagic、qpdf、oletools 和 preview。
- 前端状态测试：Zustand store 能消费 SSE job events，React Context 不承载大块任务状态；断线后可通过 job snapshot 恢复。
- Evidence-first RAG 测试：P0-Z0a 必须先持久化 retrieval log / evidence pack / evidence items，再生成 `ai_answers(output_type=evidence_only_answer)`；不得要求 LLM provider。

### 2.6 D-091 工程化验收门槛测试口径

D-091 后，以下测试必须进入首批工程回归基线：

- 最小依赖 gate：在只安装 Python `core + dev` extras 的环境中，`pnpm smoke:p0-z0a` 或等价脚本必须通过；测试链为 health → migration → text_import / Markdown → rule chunk → KU review → mock embedding → retrieval log → evidence pack → evidence-only answer。
- Provider lazy-load 测试：模拟 PyMuPDF、PaddleOCR、Whisper、bge-m3、reranker 和 LLM SDK 均不存在，应用 import、FastAPI startup、migration 和 health 不得失败；ProviderRegistry 必须输出 `capability_status`、`fallback_reason`、`load_error_class`。
- sidecar 生命周期测试：覆盖正常启动、端口占用、启动失败、运行中崩溃、手动重启和应用退出清理；Renderer 不允许出现无法解释的空白页。
- typed fetch 测试：页面级 API 调用不得绕过 wrapper；wrapper 必须解析 error envelope，并把 `recoverable`、`fallback_reason`、`capability_status` 传给 Toast / Banner / Error Boundary。
- sqlite-vec 一致性测试：三态 probe 在 `/api/system/status`、Provider summary、VectorStoreService、Query Explanation 中完全一致；`degraded / unavailable` 时不得声称使用真实 vector search。
- Evidence-first 不变量测试：强制 evidence pack 或 evidence items 写入失败时，系统应返回 evidence error，不得写入 `ai_answer`。

### 2.7 D-092 代码骨架前置契约测试口径

D-092 后，首批工程还必须补充以下测试：

- OpenAPI 类型生成测试：导出 `openapi.json`，生成 TypeScript API types，运行 `pnpm typecheck`；禁止前端手写漂移 DTO。
- Sidecar 打包 spike 测试：在 packaged 或 pseudo-packaged 形态下启动 FastAPI sidecar，验证 health、日志目录、端口选择和优雅退出。
- Provider manifest 测试：每个 provider capability 都能从 manifest 读出 `extra_group / import_path / probe_function / fallback_provider_key`，lazy-load 不依赖散落 import。
- Trace chain 测试：同一用户动作从 HTTP request、ProcessingJob、SSE event、retrieval log、Evidence Pack 到 answer 都可用同一 `trace_id` 串起。
- Migration 波次测试：Alembic 文件名和内容标记 `z0a / z0b / z1 / z2`；Z0a migration 不创建 Z1/Z2 后置对象。
- SQLite 性能基线测试：1K / 10K KU fixture 下记录 FTS5、metadata filter、fallback ranking 和 Evidence Pack 组装耗时。
- Zustand store slice 测试：workspace / job / review / retrieval / citation 五个 slice 独立可测，React Context 不承载跨域任务状态。
- Evidence failure type 测试：覆盖 `no_retrieval_result / insufficient_evidence / permission_blocked / citation_binding_failed / vector_degraded`，失败时不得写 `ai_answer`。

### 2.8 D-093 桌面运行时硬化测试口径

D-093 后，首批桌面工程必须补充以下测试：

- Sidecar local auth 测试：无 `X-Local-Session-Token`、错误 token、重启后的旧 token 都被拒绝；正确 token 可通过 health 和业务 API。
- 绑定地址测试：sidecar 只监听 `127.0.0.1`；不得监听 `0.0.0.0`。
- Main/preload 注入测试：Renderer 页面不能硬编码 API base 或裸 `fetch("http://localhost")`；typed fetch wrapper 统一注入 token 与 `trace_id`。
- SQLite 数据保护测试：WAL、busy_timeout、foreign_keys、quick_check、migration lock、pre-migration backup 均可验证；模拟损坏库时返回 `database_integrity_failed` 并进入只读恢复。
- Worker isolation 测试：长任务进入 ProcessingJob + worker；worker crash 后 health 仍返回 sidecar 存活，并给出 `worker_unavailable` 或 recoverable job 状态。
- Runtime status bar 测试：sidecar、DB、worker、provider、job 五类状态能从系统状态 API 映射到 UI。
- Provider settings panel 测试：manifest 中 `user_visible / provider_type / fallback_provider_key / network_required / api_key_required` 能正确展示；mock/system 不显示为真实 AI 能力。
- 最小诊断包测试：导出的诊断包包含脱敏日志、provider status、recent jobs、system status；不得包含 API Key、用户原文、数据库文件或完整私密路径。

### 2.9 D-094 P0-Core 工程骨架开工测试口径

D-094 后，首批代码工程必须先通过 `smoke:p0-core`，再运行或开发业务 smoke。D-112 后，阶段顺序固定为 `smoke:p0-core` → `smoke:p0-desktop-runtime` → `smoke:p0-i18n-settings` → `smoke:p0-file` → `smoke:p0-parse` → `smoke:p0-ku` → `smoke:p0-search-ask` → `smoke:p0-citation-detail` → `smoke:p0-citation-focus` → `smoke:p0-feedback-memory` → `smoke:p0-feedback-diagnostics` → `smoke:p0-feedback-export` → `smoke:p0-feedback-filters-history` → `smoke:p0-z0a`：

| 测试项 | 期望 |
|---|---|
| Monorepo structure check | `apps/desktop-main`、`apps/desktop-preload`、`apps/renderer`、`apps/api`、`packages/api-types`、`packages/runtime-contracts`、`packages/shared-config` 存在并职责清楚 |
| Runtime state machine transitions | 覆盖 `booting → sidecar_starting → sidecar_ready → db_checking → migration_running? → worker_starting → ready/degraded/recovery_required → shutting_down` |
| Preload API contract | 只暴露 `getRuntimeConfig / getRuntimeStatus / onRuntimeStatusChange / openFileDialog / exportDiagnostics`，不暴露 Node 能力 |
| Sidecar local token health | 无 token、错误 token、旧 token 被拒绝；正确 token 可访问 `/api/health` 和 runtime endpoint |
| App data dir + SQLite init | 数据库、WAL、日志、backup hook 全部落在 app data dir；SQLite init 包含 WAL、foreign keys、busy timeout、quick check |
| Desktop runtime smoke | build 产物 Electron Main / Preload 可启动；Renderer 通过 bridge 读取 runtime config 并访问受保护 sidecar API；退出后 sidecar pid 不残留 |
| Shutdown cleanup | 应用退出后 sidecar 和 worker 被清理，不残留后台进程或锁文件 |
| Status bar mapping | runtime state 和 sidecar / DB / worker / provider / vector 子状态能映射到底部状态栏 |
| Smoke order | `pnpm smoke:p0-core` 必须先于 `pnpm smoke:p0-desktop-runtime`，`pnpm smoke:p0-desktop-runtime` 必须先于 `pnpm smoke:p0-i18n-settings`，`pnpm smoke:p0-i18n-settings` 必须先于 `pnpm smoke:p0-file`，`pnpm smoke:p0-file` 必须先于 `pnpm smoke:p0-parse`，`pnpm smoke:p0-parse` 必须先于 `pnpm smoke:p0-ku`，`pnpm smoke:p0-ku` 必须先于 `pnpm smoke:p0-search-ask`，`pnpm smoke:p0-search-ask` 必须先于 `pnpm smoke:p0-citation-detail`，`pnpm smoke:p0-citation-detail` 必须先于 `pnpm smoke:p0-citation-focus`，`pnpm smoke:p0-citation-focus` 必须先于 `pnpm smoke:p0-feedback-memory`，`pnpm smoke:p0-feedback-memory` 必须先于 `pnpm smoke:p0-feedback-diagnostics`，`pnpm smoke:p0-feedback-diagnostics` 必须先于 `pnpm smoke:p0-feedback-export`，`pnpm smoke:p0-feedback-export` 必须先于 `pnpm smoke:p0-feedback-filters-history`，`pnpm smoke:p0-feedback-filters-history` 必须先于 `pnpm smoke:p0-z0a` 通过 |
| Business feature block | `smoke:p0-core` 通过前不得新增 upload parsing UI、RAG UI、真实 Provider 接入、OCR/ASR、图谱或用户聊天入口；初期可用 review checklist 执行，后续再自动化 |

`smoke:p0-core` 最小链路固定为：

```text
Electron Main boot
→ sidecar_starting
→ local token health
→ app data dir / SQLite init
→ runtime status endpoint
→ renderer shell + status bar
→ diagnostics export stub
→ graceful shutdown
```

### 2.10 D-098 Knowledge Workspace 页面契约测试口径

D-098 后，Renderer 页面测试不是视觉装饰检查，而是验证 8 个主页面能正确消费 runtime、job、provider、retrieval、citation 和 review 状态。

| 页面 | 必测状态 | 关键场景 |
|---|---|---|
| `/dashboard` | loading / empty / degraded / done | 首屏进入 dashboard；最近导入为空；provider degraded；最近搜索/问答摘要可见 |
| `/import` | loading / empty / degraded / recoverable_error / done | 拖拽上传进度、解析失败可恢复、hash 不一致、provider capability 显示 PDF/Word/PPT/音频/视频/图片真实可用性 |
| `/library` | loading / empty / degraded / recoverable_error / done | 文档列表、分类树、标签/时间/项目筛选、自动分类结果、文件状态和 review pending 状态 |
| `/search` | loading / empty / degraded / recoverable_error / done | 简单事实、概念解释、时间线、文件定位、复杂综合问题；空结果和证据不足必须显示原因 |
| `/ask` | loading / empty / degraded / recoverable_error / done | evidence-only answer、provider unavailable、citation 展示、相关文档卡片、追问、反馈按钮 |
| `/graph` | loading / empty / degraded / done | 无关系时 disabled reason；有 confirmed relation 或 relation suggestion evidence 时可点击回源；不要求 GraphRAG |
| `/outputs` | loading / empty / degraded / recoverable_error / done | 无 evidence 时禁止生成或导出；会议纪要/学习笔记/项目摘要/汇报提纲必须绑定 citation |
| `/settings` | loading / empty / degraded / recoverable_error / done | 语言切换默认中文、英文切换、普通浏览器 session fallback、auth disabled、provider disabled、runtime degraded、存储状态、导入导出状态和 Keychain 写入边界 |

页面级不变量：

1. 8 个内部路由 `/dashboard`、`/import`、`/library`、`/search`、`/ask`、`/graph`、`/outputs`、`/settings` 必须在左侧导航可达。
2. 底部 runtime status bar 在所有页面可见。
3. 页面 API 调用通过 typed fetch wrapper；不得手写 localhost、token 或后端 DTO。
4. Import 页面格式能力来自 provider/capability status，不得硬编码“全部支持”。
5. Search / Ask 必须展示 Query Explanation、Evidence Pack、Citation Trace、provider/fallback 状态和空结果 / 证据不足原因。
6. Graph 不要求 GraphRAG；Outputs 不自动写 confirmed knowledge。
7. 微信 / 网盘 / Obsidian / Notion 入口只作为 P1/P2 placeholder，必须显示 disabled reason 或 future label。
8. 错误引用、缺失来源、有用/无用等反馈只写反馈事件或 pending review，不自动修改 confirmed knowledge。

### 2.11 D-105 Citation Detail / Evidence Pack replay 测试口径

D-105 后，Citation Detail 是 `/search` 和 `/ask` 内嵌面板，不新增主路由。测试目标是证明后端 detail endpoint 足够渲染复盘信息，前端不自行拼接证据链。

| 测试项 | 期望 |
|---|---|
| confirmed KU detail | confirmed KU 被检索命中后，`GET /api/evidence-packs/{id}` 返回 KU title/status/type、chunk citation/content excerpt、source title/origin/type、rank score 和 citation trace |
| pending_review exclusion | `pending_review` KU 不进入 Evidence Pack，也不出现在 citation detail |
| no evidence replay | 无证据时 detail 返回空 `items`、`failure_type=no_retrieval_result`、fallback reason 和 no evidence reason，不生成伪答案 |
| vector degraded replay | sqlite-vec degraded 时 detail 仍保留 source/chunk/KU 绑定，并返回 `provider_status=degraded` 与 `fallback_reason` |
| Search UI replay | `/search` 的 Evidence Items 提供 Open detail，并渲染后端返回的 Citation Detail panel |
| Ask UI replay | `/ask` 从 answer 的 `evidence_pack_id` 打开同一 detail panel，展示 answer 使用过的 evidence item、citation label 和 source/chunk/KU |

`smoke:p0-citation-detail` 固定链路：

```text
text import
→ pending_review preview/detail confirms no_retrieval_result
→ confirm KU
→ retrieval preview
→ evidence pack detail validates KU / Chunk / Source / query explanation / provider fallback
→ evidence-only answer
→ answer evidence_pack_id detail replay
```

### 2.12 D-112 Citation Detail Focus / Evidence Trace Interaction 测试口径

D-112 后，Citation Detail 仍是 `/search` 和 `/ask` 内嵌面板，不新增主路由。测试目标是证明后端 detail endpoint 可按 evidence item 聚焦，Renderer 可筛选、排序、切换和复制引用轨迹，而不修改检索结果或业务对象。

| 测试项 | 期望 |
|---|---|
| detail summary | confirmed KU 检索后，`GET /api/evidence-packs/{id}` 返回 `detail_summary`，包含 item/source/KU 计数、citation labels、rank score min/max 和 no evidence reason |
| focus item | `GET /api/evidence-packs/{id}?focus_item_id={eitem}` 返回 `focused_item_id`，目标 item 仍保留 KU / Chunk / Source 绑定 |
| invalid focus | 非本 pack 的 `focus_item_id` 返回 error envelope，错误码 `evidence_item_not_in_pack` |
| trace path | 每个 evidence item 的 `citation_trace.trace_path` 按 Evidence Pack → Evidence Item → KU → Chunk → Source 返回 |
| copy-safe payload | `citation_trace.copy_payload` 只包含 citation label 与 trace ids / titles，不包含 source excerpt、answer text、local token、DB path 或完整本地路径 |
| no evidence focus | no evidence pack detail 返回空 items、`failure_type=no_retrieval_result` 和 `detail_summary.no_evidence_reason` |
| UI focus interaction | `/search` Evidence Items 与 `/ask` citation label / item id 可打开并聚焦同一 Citation Detail 面板；过滤、rank/source 排序、上一条/下一条和复制按钮可见 |

`smoke:p0-citation-focus` 固定链路：

```text
create multiple text imports
→ confirm KUs
→ retrieval preview
→ evidence pack detail validates detail_summary
→ focus specific evidence item
→ validate trace_path and copy-safe payload
→ invalid focus returns evidence_item_not_in_pack
→ no evidence detail exposes no_evidence_reason
```

### 2.13 D-106 UI i18n / Bilingual Settings 测试口径

D-106 后，语言偏好由后端 `/api/settings` 持久化，Renderer 只负责渲染 typed message keys。测试目标是证明默认中文、英文切换、后端 `config.json` 持久化和普通浏览器 degraded fallback 都可复盘。

| 测试项 | 期望 |
|---|---|
| default language | `GET /api/settings` 在无配置文件时返回 `language=zh-CN` |
| persisted language | `PATCH /api/settings` 保存 `en-US` 后再次 `GET` 返回 `en-US`；切回 `zh-CN` 同理 |
| validation | 非法语言和未知字段返回 `validation_error`；无 local token 仍返回 sidecar auth error |
| Renderer i18n | 8 个主路由的导航、标题、按钮、状态、空态和 runtime bar 能随语言切换 |
| Browser fallback | 普通浏览器无 Electron preload 时显示 bridge degraded，语言切换只保存在 session，不直接读写本地文件 |
| Data boundary | 用户上传内容、文件名、KU、source excerpt、citation label、API enum/status code 不翻译 |

`smoke:p0-i18n-settings` 固定链路：

```text
start temporary API
→ unauthorized GET /api/settings is rejected
→ GET default zh-CN
→ PATCH en-US
→ GET persisted en-US
→ PATCH zh-CN
→ invalid language returns validation_error
```

### 2.13 D-107 Feedback Events / Memory Draft Review 测试口径

D-107 后，feedback 是 append-only local event，Memory Draft 是 pending-review 回流对象。测试目标是证明反馈不污染知识真值，Memory 必须经过 Review 才能确认。

| 测试项 | 期望 |
|---|---|
| feedback auth / validation | `POST /api/feedback` 需要 local token，非法 feedback type 或无目标返回 validation error |
| target binding | `evidence_pack_id`、`ai_answer_id`、`evidence_item_id` 至少一个存在，且必须指向已存在对象 |
| append-only feedback | feedback 写入 `feedback_events`，不修改 confirmed KU、Source、Evidence Pack 或 AIAnswer |
| memory draft create | `POST /api/memory-drafts` 需要存在的 `ai_answer_id` 和非空 content，创建 `memories.status=pending_review` |
| review task | Memory Draft 创建 `review_tasks.target_type=memory`，不直接成为 confirmed memory |
| memory confirm / ignore | Review confirm 标记 `confirmed / user_confirmed=true`；ignore 标记 `archived`；均不创建 confirmed KU |
| Renderer integration | `/ask` 可提交反馈和保存 Memory Draft；`/library` 可处理 memory review；`/outputs` 可复盘 draft 状态 |

`smoke:p0-feedback-memory` 固定链路：

```text
text import
→ confirm KU
→ evidence-only answer
→ submit useful feedback
→ create Memory Draft from answer
→ confirm memory review
→ verify feedback policy and memory confirmed state
```

---

### 2.14 D-108 Feedback Diagnostics / Event Replay 测试口径

D-108 后，feedback diagnostics 是只读复盘能力。测试目标是证明系统能列出反馈事件、过滤目标、补足 query / citation 上下文并汇总计数，同时不写 `retrieval_feedback` 或修改知识真值。

| 测试项 | 期望 |
|---|---|
| diagnostics auth | `GET /api/feedback` 与 `GET /api/feedback/summary` 无 local token 被拒绝 |
| event list | useful / bad_citation / missing_source 等事件按 `created_at desc` 返回，保留 target binding、ranking_effect、query 和 citation_label |
| filters | `feedback_type`、`target_type`、`ai_answer_id`、`evidence_pack_id`、`evidence_item_id` 能收敛结果；`limit` 默认 50、最大 100 |
| summary | 返回 total、by_type、by_target_type、positive_count、negative_count、last_event_at 和 `feedback_policy` |
| no mutation | 诊断读取不修改 `feedback_events`、`knowledge_units`、`evidence_packs`、`ai_answers`、`memories`，也不依赖 `retrieval_feedback` |
| Renderer integration | `/outputs` 可显示 Feedback Diagnostics 摘要、事件列表、过滤控件、empty/degraded/recoverable_error/done 状态 |

`smoke:p0-feedback-diagnostics` 固定链路：

```text
text import
→ confirm KU
→ evidence-only answer
→ submit multiple feedback events
→ list diagnostics
→ filter diagnostics
→ summary checks
→ verify no retrieval_feedback write dependency
```

---

### 2.15 D-109 Desktop Runtime Smoke / Pseudo-Packaged Sidecar 测试口径

D-109 后，桌面运行时必须有可重复 smoke，证明不是只在 `uvicorn --reload` 或浏览器预览里成立。该 smoke 不代表正式安装器，只验证 build 产物、bridge、sidecar 和退出清理。

| 测试项 | 期望 |
|---|---|
| build artifact launch | 使用已 build `desktop-main/dist/main.js`、`desktop-preload/dist/preload.js` 和 renderer preview 启动 |
| bridge config | Renderer 通过 preload bridge 读取 `apiBaseUrl`、`appName`、`appVersion` 和会话 token；smoke result 不写出 token 明文 |
| protected API | 无 token 访问 `/api/settings` 返回 401；带 bridge token 访问 `/api/settings` 和 `/api/system/runtime` 返回 200 |
| local boundary | sidecar 只绑定 `127.0.0.1`；CORS 只允许本地 `127.0.0.1:<port>` renderer 来源 |
| renderer health | 页面 body 非空，runtime status 可读 |
| clean shutdown | Electron 退出前停止 sidecar，脚本确认 sidecar pid 不残留 |

`smoke:p0-desktop-runtime` 固定链路：

```text
build shared packages / preload / main / renderer
→ start renderer preview on 127.0.0.1
→ launch Electron dist/main.js with KB_DESKTOP_SMOKE=1
→ Electron Main starts FastAPI sidecar
→ Renderer bridge probe calls health / settings / runtime
→ write redacted result
→ stop sidecar
→ verify pid cleanup
```

---

### 2.16 D-110 Feedback Diagnostics Export 测试口径

D-110 后，feedback diagnostics export 是只读、脱敏、当前筛选范围内的导出能力。测试目标是证明 JSON / CSV 导出能复用 D-108 诊断上下文，同时不泄露 source text、answer text、local token、DB path 或完整本地路径。

| 测试项 | 期望 |
|---|---|
| export auth | `GET /api/feedback/export` 无 local token 被拒绝 |
| json export | `format=json` 返回 summary、events、record_count、filters、`redacted=true`、`includes_source_text=false` |
| csv export | `format=csv` 返回稳定表头，并包含 query、citation_label、ranking_effect、comment、created_at |
| filters | `feedback_type`、`target_type`、`ai_answer_id`、`evidence_pack_id`、`evidence_item_id` 和 `limit` 对导出生效 |
| no leakage | 导出 content 不包含 source excerpt、answer text、local token、SQLite path、app data path 或完整本地路径 |
| no mutation | 导出不写 `retrieval_feedback`，不修改 `feedback_events`、`knowledge_units`、`evidence_packs`、`ai_answers` 或 `memories` |
| Renderer integration | `/outputs` 可选择 JSON / CSV 并导出当前筛选结果；Renderer 使用 Blob download，不使用 Node fs |

`smoke:p0-feedback-export` 固定链路：

```text
text import
→ confirm KU
→ evidence-only answer
→ submit multiple feedback events
→ list diagnostics
→ export JSON
→ export filtered CSV
→ verify no source text / token / path leakage
```

### 2.17 D-111 Feedback Filters / Export History 测试口径

D-111 后，feedback diagnostics 支持深层过滤和导出历史 metadata。测试目标是证明列表、summary、export 使用同一组 filters，export history 只保存脱敏 metadata，不保存导出正文。

| 测试项 | 期望 |
|---|---|
| auth | feedback list、summary、export、export-history 无 local token 均被拒绝 |
| advanced filters | `created_from/created_to`、`search`、`ranking_effect`、`has_comment`、`sort`、`limit` 对列表生效 |
| filtered summary | summary 按同一 filters 聚合，且不写任何业务对象 |
| filtered export | JSON / CSV export 使用同一 filters，并写入 export history metadata |
| history redaction | history 不保存 `content`、source text、answer text、local token、DB path 或完整本地路径 |
| delete history | 删除单条 history 后列表不再返回该记录，且不影响 `feedback_events` |
| validation | invalid `ranking_effect` / `sort` / datetime 返回 validation error |

`smoke:p0-feedback-filters-history` 固定链路：

```text
text import
→ confirm KU
→ evidence-only answer
→ submit useful / bad_citation / missing_source feedback with mixed comments
→ advanced list filters
→ filtered summary
→ export JSON / CSV
→ read export history
→ delete one history record
→ verify no source text / token / path leakage
```

---

## 3. 测试层级详细约定

### 3.1 单元测试（Unit Tests）

**对象**：

- `SourceDescriptionRules.buildDescriptionFromText`
- `ChunkingRules.splitTextIntoChunks`
- `EmbeddingService.embedOrFallback`
- `MockEmbeddingFallback.createMockVector`
- `MockKnowledgeUnitRules.suggestCandidateUnits`
- `EvidenceGapRules.detectEvidenceGaps`
- `TextToSqlTemplateService.planReadOnlyQuery`
- 各种 utils（hash、validator、formatter）

**覆盖率目标**：

- 关键 rules / mock：100%
- 一般 utils：≥ 80%
- 总体：≥ 70%

**工具**：

- Python：`pytest` + `pytest-cov`
- TypeScript：`vitest` 或 `jest`

**示例**：

```python
def test_chunking_splits_by_heading():
    text = "# 标题1\n\n段落1。\n\n# 标题2\n\n段落2。"
    chunks = ChunkingRules.split_text_into_chunks(text)
    assert len(chunks) == 2
    assert chunks[0].section_title == "标题1"
    assert chunks[1].section_title == "标题2"

def test_mock_embedding_is_deterministic():
    text = "相同的输入"
    v1 = MockEmbeddingFallback.create_mock_vector(text)
    v2 = MockEmbeddingFallback.create_mock_vector(text)
    assert v1.vector == v2.vector
    assert len(v1.vector) == 384
    assert v1.profile == "mock_fixed_384"
```

### 3.2 Repository 测试（Integration with SQLite）

**对象**：

每个 Repository 类的 CRUD 和复杂查询。

**约束**：

- 使用临时 SQLite 文件（`tempfile.mkstemp()`）
- 每个测试函数前自动迁移 + 测试后自动清理
- 测试 SQLite 方言适配（JSON 数组、boolean、日期）

**示例**：

```python
@pytest.fixture
def repo(tmp_path):
    db_path = tmp_path / "test.db"
    engine = create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(engine)
    return KnowledgeUnitRepository(engine)

def test_create_and_query_ku(repo):
    ku_id = repo.create({
        "title": "test",
        "content": "test content",
        "knowledge_type": "claim",
        "status": "pending_review",
    })
    ku = repo.get(ku_id)
    assert ku["title"] == "test"
    assert ku["status"] == "pending_review"

def test_query_by_status_filter(repo):
    repo.create({"title": "a", "status": "confirmed", ...})
    repo.create({"title": "b", "status": "pending_review", ...})
    confirmed = repo.list(status="confirmed")
    assert len(confirmed) == 1
```

### 3.3 Service 集成测试

**对象**：

- `UploadService.createTask`
- `UploadService.completeTask`
- `FileIntegrityService.verify`
- `ParserRouter.route`
- `IngestionService.importTextSource`
- `ParseTaskService.run`
- `KnowledgeUnitService.createCandidate`
- `ReviewService.applyAction`
- `RetrievalPreviewService.preview`
- `EvidencePackService.buildPack`
- `RagAnswerService.answerOrFallback`

**约束**：

- 测试完整业务流程（多个 repository 协同）
- 验证事务边界（部分失败应回滚）
- 验证 audit log 写入

**示例**：

```python
def test_text_import_creates_source_chunk_audit(tmp_db):
    service = IngestionService(repos=tmp_db.repos, providers=mock_providers)
    result = service.import_text_source(
        project_id=test_project_id,
        folder_id=test_folder_id,
        title="test source",
        source_origin="manual_note",
        raw_text="A 段落。\n\nB 段落。",
        permission="normal",
    )

    # 验证 Source 创建
    source = tmp_db.repos.sources.get(result.source_id)
    assert source["title"] == "test source"

    # 验证 Source Description 自动生成
    desc = tmp_db.repos.source_descriptions.get_by_source(result.source_id)
    assert desc is not None

    # 验证 Chunk 切分
    chunks = tmp_db.repos.chunks.list_by_source(result.source_id)
    assert len(chunks) >= 2

    # 验证 embedding profile 与 dimension 契约
    for chunk in chunks:
        emb = tmp_db.repos.embeddings.get_by_owner("chunk", chunk["id"])
        assert emb["profile"] in ["bge_m3_local", "mock_fixed_384"]
        assert emb["dimension"] == embedding_profile_registry[emb["profile"]]["dimension"]

    # 验证 audit log
    logs = tmp_db.repos.audit_logs.list_by_target("source", result.source_id)
    assert any(log["action"] == "create" for log in logs)
```

### 3.4 合同测试（Contract Test）

**对象**：所有 P0 API endpoint。

**约束**：

- 从 HTTP 层调用（FastAPI TestClient）
- 验证 request schema、response schema、错误码
- 不测试业务逻辑细节（已在 Service 层覆盖）

**P0 合同测试清单**（来自 `docs/api-implementation-plan.md` §10 和本次 P0 扩展，编号会随契约扩展递增）：

1. 请求字段缺失返回 `validation_error`
2. 不存在对象返回 `not_found`
3. 权限或状态不允许返回 `permission_denied` 或 `agent_call_not_allowed`
4. 不支持 `source_origin` 返回 `unsupported_source_origin`
5. Review 之前不可进入 agent_default
6. `GET /api/auth/status` 返回 local_user 和 auth disabled 状态
7. Evidence Pack 创建后可通过 ID 读取
8. Citation Preview 不依赖前端临时缓存
9. Text-to-SQL 模板只执行 SELECT
10. Feedback / Memory Draft 不绕过 Review
11. `POST /api/uploads` 创建上传任务并返回 upload_task_id
12. 分片缺失时 `:complete` 返回 `upload_part_missing`
13. hash 不一致时返回 `upload_hash_mismatch` 或 `integrity_check_failed`
14. unsupported parser 返回 `unsupported_parser`，文件仍保留在可恢复状态
15. OCR / ASR Provider 缺失时返回 `ocr_unavailable` / `asr_unavailable`
16. P0-Z0a `POST /api/rag/answers` 不调用 LLM，固定返回 `evidence_only_answer`
17. `GET /api/ai-providers/capabilities` 返回 parser / OCR / ASR / token_counting / structure_recovery / document_layout / table_structure / html_xml_structure / academic_paper_structure / chunk_strategy / semantic_chunking / context_enrichment / chunk_quality_eval / content_understanding / schema_mapping / knowledge_card_generation / classification_tagging / relation_suggestion / embedding / rerank / LLM 的 `status`、`fallback_profile`、`fallback_reason`、`next_action`
18. SSE 进度事件使用 `event_seq` 作为 `id`，客户端带 `Last-Event-ID` 后只补发缺失事件
19. `local_sqlite_worker` 锁超时后任务可被重新领取，超过重试阈值进入 `failed_recoverable` 或 `failed_final`
20. 通用 `GET /api/jobs/{job_id}` / `GET /api/jobs/{job_id}/events` 可覆盖 upload / inspect / parse / embed / rag answer；`uploads/{id}/events` 仅作为别名
21. `permission_mode=user_preview` 只能展示 sensitive 摘要，不能生成 Evidence Pack；`explicit_sensitive_confirmed` 必须带未过期、未撤销、scope 匹配且未复用的 `sensitive_access_grant_id`
22. `file_inspection_results.status=quarantined` 必须汇总到 `files.inspection_status=quarantined` 且默认阻断 parse
23. 同一 `(target_type, target_id, job_type)` 只能有一个 active ProcessingJob；重复 inspect / preview / parse / embed 请求默认返回既有 job
24. `sensitive_access_grant_id` 过期、撤销、scope 不匹配或二次复用时，Evidence Pack 创建必须失败
25. P0-Z2 才验证 Provider 可用时 `rag_answer` 输出；Provider 缺失时继续 `evidence_only_answer`
26. `POST /api/sources/{source_id}/chunks:build` 返回 ProcessingJob 和 `chunk_summary`
27. chunk build 必须在 input/OCR/strategy/structure/source binding 检查前创建或复用 ProcessingJob；除 source 不存在、项目/权限不匹配外，早期失败也必须能通过 `GET /api/jobs/{job_id}` 和事件恢复。
28. chunk build 必须写 `chunk_preparation_started`、`chunk_strategy_selected`，完成时写 `chunk_preparation_completed`；策略不匹配、结构恢复、上下文补充、来源绑定或质量失败时写 `chunk_preparation_warning`、`chunk_strategy_mismatch`、`chunk_structure_recovered`、`chunk_context_enriched`、`chunk_source_binding_failed`、`chunk_quality_warning` 或 `chunk_quality_failed`。
29. `chunk_summary.check_summary` 必须使用 `docs/data-model.md` 的 check gate 映射：`check_gate` 采用 `_check` 名，`check_type` 采用 `chunk_quality_checks.check_type` 枚举，不允许新增未登记名称。
30. P0-Z0a 每个 chunk 必须具备最小 `source_location` 和 `quality_status`；缺失时 Source Detail 返回质量 warning。
31. P0-Z0b 每个 chunk 必须具备可追溯 `source_metadata`；缺失 source/file/page/section 等字段时 `chunk_quality_checks(check_type=source_traceability)` 返回 warning/failed，无法绑定 citation/evidence 对象时 `chunk_quality_checks(check_type=source_binding)` 返回 warning/failed。
32. 切片前准备必须覆盖输入完整性、OCR/版面、策略匹配、结构完整性、metadata 完整性和来源绑定检查；失败或跳过必须记录 `fallback_reason`
33. 长文本过长、主题混杂、语义断裂、重复 / 水印 / 乱码必须进入 `chunk_quality_checks`
34. Embedding / LLM / Reranker 缺失时，chunk build 仍完成规则切片并记录 `fallback_reason`
35. `chunk_summary.check_summary` 必须能按 `chunk_type` 区分 `text_semantic`、`structured_table`、`image_ocr`、`audio_transcript`、`video_scene`、`mixed` 路径，并返回对应 `chunk_execution_profile`
36. `source_binding_status` 只验证 Citation / Evidence 可用性；embedding、FTS5、sqlite-vec 或 metadata filter 的索引状态必须由 embedding / index job fixture 验证
37. `POST /api/knowledge-units:extract` 返回 ProcessingJob 与 `structuring_summary`，其中 `content_understanding / summary_generation / key_concept_extraction / schema_mapping / knowledge_card_generation / classification_tagging / relation_suggestion` 每步都有 `provider_key`、`capability_status`、`fallback_reason` 和 `status`
38. 内容理解、摘要、关键概念、结构化字段、知识卡片、分类标签、关系建议任一 Provider 不可用时，结构化整理必须回退到规则或 pending review；关系建议不得绕过 Review 写 confirmed relation
39. `GET /api/system/status?window=24h` 返回 logs / exception_monitoring / data_security / performance_cost / stability 模块状态、`status_reason` 和阈值说明
40. 上传失败、解析失败、检索失败、RAG answer fallback、队列停滞和高资源任务必须能从 `processing_status_events` 或 `system_logs` 派生
41. 权限变更、隐私设置、备份 / 恢复 / 删除必须写入可脱敏审计摘要
42. Retrieval Preview / RAG Answer 响应必须包含 `query_understanding_profile`、`retrieval_strategy_profile`、`ranking_profile`、`citation_trace_profile`、`feedback_policy` 和可用 `feedback_actions`
43. `simple_fact` 路由默认选择 FTS5 / BM25；`concept_explanation` 路由默认选择 sqlite-vec；`timeline` 路由默认选择 metadata filter；`file_lookup` 路由默认选择 source / file index；`complex_hybrid` 路由默认选择 hybrid search
44. `relationship_analysis` 在 P0 只能读取 confirmed relation 或 relation_suggestion evidence；GraphRAG、外部图数据库和 Learning-to-Rank 缺失不得阻塞 P0
45. LLM query rewrite、reranker、GraphRAG、WebSocket 不可用时必须回退规则路由、hybrid score、evidence-only answer 和 SSE 状态；简单事实查询应记录 `rewrite_status=not_needed`，不得误标为 LLM rewrite fallback
46. Evidence / Citation 必须能追踪 chunk_id、source_id、file_id、page/section、paragraph/text span；预览、摘要、知识卡片不得替代 citation
47. `feedback_signal` 可记录 click / favorite / useful / not_useful / bad_citation / missing_source / downrank_source，并必须带 `feedback_policy`；默认 local_only + current_project scope，且不得自动改写 confirmed Knowledge Unit、confirmed relation 或 source truth
48. `implicit_agent` 只能包含对话上下文、意图理解、只读任务规划、内部检索、RAG 问答和草稿生成；外部 API 工具调用、自主执行和多 Agent 协作必须返回 disabled / unsupported 边界
49. `FrontendStateContract` 必须覆盖上传进度、AI 思考、检索失败、无权限、网络异常、空结果、citation 展示和用户反馈按钮
50. D-081 验收：P0-Z0a 不要求 `invocation_requests` / `retrieval_plans` / `memories` / `retrieval_feedback` 持久化；这些对象只在 P0-Z2 fixture 中作为必填持久化验收
51. D-082 验收：`InvocationProfileSchema v1` 中 `source_reliability_score` 与 `source_reliability_label` 不得混用，`relation_evidence` 不得写成 P0 GraphRAG runtime
52. D-085 验收：Z0a `evidence_packs` / `ai_answers` 必须能在 `request_id` / `retrieval_plan_id` 为空时通过 `retrieval_log_id` 和 `evidence_pack_id` 串起闭环；Z2 fixture 才要求 Invocation / Retrieval Plan 非空
53. D-085 验收：Z0a RAG response 返回 `evidence_item_ids`、`citation_labels`、`citation_trace_summary`，不得要求持久化 citation 明细 ID；`answer_citations` 只在 Z0b+ fixture 中验收
54. D-085 验收：Z0a feedback 只能是 response-only summary 或 append-only `feedback_events`；`retrieval_feedback` 只在 Z2 fixture 中验收，并必须携带 `feedback_policy`

**示例**：

```python
def test_text_import_unsupported_origin_returns_error(client):
    response = client.post("/api/sources/text-import", json={
        "project_id": str(test_project_id),
        "folder_id": str(test_folder_id),
        "title": "test",
        "source_origin": "unsupported_xxx",
        "raw_text": "test",
    })
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "unsupported_source_origin"
```

### 3.5 桌面 E2E 测试

**对象**：完整 Electron 应用 + Renderer + Sidecar。

**工具**：[Playwright for Electron](https://playwright.dev/docs/api/class-electron)。

**P0 E2E 12 步流程**：

```typescript
import { _electron as electron, test, expect } from '@playwright/test';

test('P0 smoke test：完整入库到 RAG fallback 流程', async () => {
  const app = await electron.launch({
    args: ['./dist/main.js'],
    env: {
      KNOWLEDGE_DATA_DIR: '/tmp/kb-e2e-' + Date.now(),
    },
  });
  const window = await app.firstWindow();

  // 1. 创建项目
  await window.click('text=新建项目');
  await window.fill('[name=project-name]', 'E2E 测试项目');
  await window.click('text=创建');
  await expect(window.locator('text=E2E 测试项目')).toBeVisible();

  // 2. 创建文件夹
  await window.click('text=新建文件夹');
  await window.fill('[name=folder-name]', '产品定位');
  await window.click('text=创建');

  // 3. 导入材料，可以是上传文件或 text_import
  await window.click('text=导入材料');
  await window.fill('[name=source-text]', '本项目是 AI 个人知识库... (500字)');
  await window.click('text=导入');
  await expect(window.locator('text=Source 创建成功')).toBeVisible();

  // 4. 验证解析和切片状态
  await expect(window.locator('text=解析完成')).toBeVisible();
  await expect(window.locator('text=Chunk')).toBeVisible();

  // 5. 创建 Knowledge Unit
  await window.click('text=新建知识单元');
  await window.fill('[name=ku-title]', '产品核心定位');
  await window.fill('[name=ku-content]', 'AI 个人知识资产系统');
  await window.selectOption('[name=ku-type]', 'claim');
  await window.click('text=创建并送审');

  // 6. Review 确认
  await window.click('text=Review 队列');
  await window.click('text=产品核心定位');
  await window.click('text=确认');
  await expect(window.locator('text=已确认')).toBeVisible();

  // 7. Embedding / 向量索引状态
  await expect(window.locator('text=已索引')).toBeVisible();

  // 8. Hybrid Retrieval
  await window.click('text=检索');
  await window.fill('[name=query]', '核心定位');
  await window.click('text=搜索');
  await expect(window.locator('text=产品核心定位')).toBeVisible();

  // 9. Evidence Pack / RAG fallback
  await window.click('text=生成回答');
  await expect(window.locator('text=Evidence Pack')).toBeVisible();
  await expect(window.locator('text=来源')).toBeVisible();
  await expect(window.locator('text=检索策略')).toBeVisible();
  await expect(window.locator('text=引用路径')).toBeVisible();

  // 10. 保存为 Memory Draft
  await window.click('text=保存为记忆');
  await expect(window.locator('text=待确认')).toBeVisible();

  // 11. 重启验证持久化
  await app.close();
  const app2 = await electron.launch({
    args: ['./dist/main.js'],
    env: {
      KNOWLEDGE_DATA_DIR: process.env.KNOWLEDGE_DATA_DIR,
    },
  });
  const window2 = await app2.firstWindow();
  await expect(window2.locator('text=E2E 测试项目')).toBeVisible();
  await window2.click('text=E2E 测试项目');
  await expect(window2.locator('text=产品核心定位')).toBeVisible();
  await expect(window2.locator('text=Evidence Pack')).toBeVisible();
  await app2.close();
});
```

**P0 必备 E2E 场景**：

1. 完整入库到 RAG fallback 流程（上述 12 步）
2. Uppy 文件拖放导入、tus-style 分片上传、SSE 上传进度、hash 校验
3. Folder-Tag Mirroring 验证
4. 未确认 KU 不出现在默认检索
5. Sidecar 崩溃后自动重启
6. 数据备份与还原
7. 离线模式（断网）
8. unsupported parser / OCR unavailable / RAG provider missing 可恢复状态
9. `GET /api/ai-providers/capabilities` 与页面状态条显示一致
10. 知识调用路由：simple fact、concept explanation、timeline、file lookup、relationship analysis、complex hybrid 均能展示 strategy route
11. Citation Trace：chunk/source/file/text span 可追踪，错误引用反馈可记录
12. 前端状态：上传进度、AI 思考、检索失败、无权限、网络异常、空结果、citation 和反馈按钮可见

---

## 4. P0 Fixture 数据集

### 4.1 输入材料 Fixture

P0 测试使用统一的输入材料数据集。位置：`tests/fixtures/sources/`。

| Fixture 文件 | 描述 | 字数 | 期望切片数 | 期望 KU 数 |
|---|---|---|---|---|
| `product-idea-500.md` | 产品想法（短） | 500 | 2-3 | 2-3 |
| `research-note-1000.md` | 研究笔记（中） | 1000 | 4-6 | 3-5 |
| `meeting-minutes-800.md` | 会议纪要 | 800 | 3-5 | 2-4 |
| `code-doc-1500.md` | 技术文档 | 1500 | 5-8 | 4-6 |
| `design-inspiration-700.md` | 设计灵感（设计师场景） | 700 | 3-4 | 2-3 |
| `mixed-content-2000.md` | 混合内容（最长） | 2000 | 7-10 | 5-8 |
| `sample-research.pdf` | PDF 解析 fixture | 2 页 | 2-5 | 1-3 |
| `sample-sheet.xlsx` | 表格解析 fixture | 1 sheet | 1-3 | 1-2 |
| `sample-image.png` | OCR / 图片理解 fixture | 1 图 | 0-2 | 0-1 |
| `sample-audio.wav` | ASR fixture | 30 秒 | 0-2 | 0-1 |
| `spoofed-extension.pdf` | 扩展名伪装 fixture | - | 0 | 0 |
| `garbled-text.txt` | 乱码 / 编码检测 fixture | 500 | 1-2 | 0-1 |
| `office-macro.docm` | Office 宏风险 fixture | - | 0 | 0 |
| `encrypted.pdf` | 加密 PDF 风险 fixture | 1 页 | 0 | 0 |
| `exif-image.jpg` | EXIF 检查和图片预览 fixture | 1 图 | 0-1 | 0 |
| `sample-video.mp4` | FFmpeg 封面 / media probe fixture | 10 秒 | 0-1 | 0 |
| `unsupported.bin` | unsupported parser | - | 0 | 0 |

### 4.1.1 Provider / fallback fixture 矩阵

| 场景 | 默认能力 | 期望结果 |
|---|---|---|
| Uppy 小文件直传 | `upload_adapter=uppy`, `status_channel=sse` | upload_task completed，SSE 与轮询状态一致 |
| tus-style 分片缺片 | `protocol=tus_style` | `upload_part_missing`，可重试 |
| 扩展名伪装 | libmagic/python-magic | 以 `detected_mime_type` / `file_signature` 为准，扩展名只作弱信号 |
| 文本乱码 | charset-normalizer | 写入 `detected_encoding`；无法修复时写 quality warning |
| Office 宏 | oletools | `risk_flags=office_macro`，`risk_level=blocked` 或 warning policy |
| 加密 PDF | qpdf | `risk_flags=encrypted_pdf`，默认不进入 parse |
| EXIF 图片 | EXIF adapter | 写入 EXIF 摘要，不泄露敏感字段到 prompt |
| 预览工具缺失 | Pillow/PyMuPDF/openpyxl/FFmpeg unavailable | `preview_unavailable`，文件保留，parse 不被阻塞 |
| ClamAV disabled | ClamAV unavailable | `capability_status=unavailable`，静态检查继续 |
| 隔离文件 | security_scan quarantined | `files.inspection_status=quarantined`，`storage_status=quarantined`，parse 返回 `file_blocked_by_risk_policy` |
| PDF 文本 | PyMuPDF | parse_task parsed，记录 `provider_key=pymupdf` |
| PDF 表格 | pdfplumber | 表格摘要或 parse warning，记录 `provider_key=pdfplumber` |
| Excel 结构 | openpyxl | 生成前 N 行摘要或 structured table chunk，缺失时 `structure_recovery=fallback` |
| Token 计数缺失 | tiktoken unavailable | 使用 rule_estimator，写入 `fallback_reason=token_counter_unavailable` |
| 扫描 PDF OCR 未安装 | PaddleOCR unavailable | `ocr_unavailable`，文件保留，parse warning 可见 |
| 音频 ASR 未安装 | Whisper unavailable | `asr_unavailable`，文件保留，parse warning 可见 |
| Embedding provider 未安装 | bge-m3 unavailable | `mock_fixed_384`，`capability_status=fallback`，`fallback_reason=provider_capability_unavailable` |
| Reranker 未安装 | bge-reranker-v2 unavailable | 使用 hybrid merge score |
| LLM 未配置 | local_llm unavailable | `evidence_only_answer` + `rag_provider_missing` |
| 结构化整理 LLM 未配置 | local_llm unavailable | `structured_organization.step_status.content_understanding.capability_status=fallback`，候选进入 pending review |
| 概念抽取 provider 缺失 | KeyBERT / YAKE unavailable | `fallback_reason=concept_provider_missing`，不丢 Source / Chunk |
| 结构化字段校验失败 | Pydantic / JSON Schema validation failed | Z0a/Z0b 写 `processing_status_events.event_type=structured_organization_failed` + `structured_organization.quality_scores.schema_mapping=failed`；Z1 后同步 `quality_events.event_type=schema_mapping_failed`，候选 KU 进入 Review |
| 关系建议 provider 缺失 | graph / LLM unavailable | `relation_suggestion.status=skipped`，只写 `review_tasks.target_type=relation_suggestion` payload，不写 confirmed relation |

### 4.2 Fixture 示例（`product-idea-500.md`）

```markdown
# 产品想法：AI 个人知识库

## 核心判断

未来每个人都会有自己的个人 Agent，而个人 Agent 的能力基础不是单次对话，而是个人数据库和个人知识库。

## 目标用户

专业内容生产者：技术开发者、设计师、影视/媒体从业者、自媒体内容创作者。

## 解决的问题

传统文件夹和笔记工具可以保存材料，但无法解决：
- 理解材料的语义意义
- 建立材料之间的关系
- 支持有来源依据的 AI 生成

## 核心机制

资料收集 → 知识整理 → 关系建立 → 选题 / 想法生成 → 内容创作 → 作品复盘 → 资产沉淀
```

期望输出：

- 1 个 Source（title="产品想法：AI 个人知识库"）
- 1 个 Source Description（summary 包含 "AI 个人知识库" 和 "个人 Agent"）
- 4 个 Chunk（按 H2 标题分割）
- 候选 KU 至少 3 条：
  - "未来每个人都会有自己的个人 Agent"（claim）
  - "目标用户是专业内容生产者"（fact）
  - "核心机制是从资料到资产的闭环"（method）

### 4.3 用户操作 Fixture

```yaml
# tests/fixtures/user-actions/p0-smoke.yaml
project:
  name: "P0 Smoke Test"
  kb_type: "project_kb"
folders:
  - name: "产品定位"
sources:
  - file: "product-idea-500.md"
    folder: "产品定位"
    source_origin: "markdown"
uploads:
  - file: "sample-research.pdf"
    expected_inspection_status: "passed"
    expected_status: "parsed"
    expected_provider_key: "pymupdf"
  - file: "office-macro.docm"
    expected_status: "file_blocked_by_risk_policy"
    expected_risk_flags: ["office_macro"]
  - file: "sample-video.mp4"
    expected_preview_status: "ready_or_preview_unavailable"
  - file: "sample-image.png"
    expected_status: "ocr_unavailable"
    expected_fallback_reason: "ocr_unavailable"
  - file: "sample-audio.wav"
    expected_status: "asr_unavailable"
    expected_fallback_reason: "asr_unavailable"
  - file: "unsupported.bin"
    expected_status: "unsupported_parser"
expected:
  source_count: 1
  chunk_count_min: 2
  chunk_count_max: 4
  candidate_ku_count_min: 3
  audit_log_actions: ["create_source", "create_chunks", "create_embedding"]
  embedding_profile_when_provider_missing: "mock_fixed_384"
  embedding_capability_status_when_provider_missing: "fallback"
  rerank_strategy_when_provider_missing: "hybrid_merge_score"
  rag_output_type_when_provider_missing: "evidence_only_answer"
  required_query_understanding_profile: "p0_rule_query_understanding_v1"
  required_retrieval_strategy_profiles:
    - "p0_route_simple_fact_bm25_v1"
    - "p0_route_concept_vector_v1"
    - "p0_route_timeline_metadata_v1"
    - "p0_route_file_lookup_v1"
    - "p0_route_relationship_evidence_v1"
    - "p0_route_complex_hybrid_v1"
  required_ranking_profile: "p0_hybrid_score_v1"
  required_citation_trace_profile: "p0_chunk_source_trace_v1"
  required_feedback_signals:
    - "click"
    - "favorite"
    - "useful"
    - "not_useful"
    - "bad_citation"
    - "missing_source"
    - "downrank_source"
  implicit_agent_allowed_actions:
    - "query_understanding"
    - "read_only_planning"
    - "internal_retrieval"
    - "rag_answer"
    - "draft_generation"
  implicit_agent_blocked_actions:
    - "autonomous_execution"
    - "external_api_tool_call"
    - "multi_agent_delegation"
  structuring_profile: "p0_rule_structuring_v1"
  required_structuring_steps:
    - "content_understanding"
    - "summary_generation"
    - "key_concept_extraction"
    - "schema_mapping"
    - "knowledge_card_generation"
    - "classification_tagging"
    - "relation_suggestion"
  required_structuring_quality:
    - "topic_understanding"
    - "summary_quality"
    - "concept_extraction"
    - "schema_mapping"
    - "card_normalization"
    - "tag_consistency"
    - "relation_suggestion"
  relation_suggestions_require_review: true
  job_events_api: "GET /api/jobs/{job_id}/events"
  sensitive_preview_requires_grant_for_evidence: true
  chunk_z0a_required_metadata: ["source_location", "quality_status"]
  chunk_z0b_required_metadata: ["preparation_profile", "content_kind", "chunk_strategy_profile", "context_summary", "source_metadata"]
  z0b_required_chunk_quality_checks:
    - "input_integrity"
    - "ocr_layout_quality"
    - "strategy_match"
    - "structure_integrity"
    - "length_bounds"
    - "semantic_integrity"
    - "topic_mix"
    - "context_sufficient"
    - "source_traceability"
    - "structured_binding"
    - "multimodal_completeness"
    - "metadata_completeness"
    - "source_binding"
    - "noise_duplicate"
    - "readability"
    - "searchability"
  required_system_status_modules:
    - "logs"
    - "exception_monitoring"
    - "data_security"
    - "performance_cost"
    - "stability"
  system_status_required_fields: ["window", "status", "status_reason", "threshold"]
```

E2E 测试和合同测试可消费同一份 fixture。

---

### 4.4 知识切片质量 fixture

新增 `tests/fixtures/chunk-quality/`：

| fixture | 目标 | 期望 |
|---|---|---|
| `long-text-mixed-topics.md` | 长文本过长、主题混杂 | 生成多个 chunk；`topic_mix` 或 `semantic_integrity` 至少 warning |
| `detached-context.md` | chunk 离开原文不可读 | 写入 `context_summary`；缺失则 `context_sufficient=failed` |
| `missing-page-source.pdf` | 页码 / source metadata 缺失 | `source_traceability=warning/failed` |
| `low-confidence-ocr-layout.pdf` | OCR 低置信、版面错位 | `ocr_layout_quality=warning`，记录 `fallback_reason` |
| `broken-heading-hierarchy.pdf` | 标题层级混乱、目录映射错误 | `structure_integrity=warning/failed`，不得静默按扩展名策略切分 |
| `mixed-content-source.md` | 正文、表格、图片、代码、对话混合 | `strategy_match` 检查通过；不同内容进入不同 chunk strategy 或写 warning |
| `image-ocr-caption.png` | OCR 图片切片 | `chunk_type=image_ocr`；PaddleOCR 缺失时 `fallback_reason=ocr_unavailable` |
| `code-block-mixed.md` | 代码块与正文混排 | `chunk_type=text_semantic` 或 `mixed`；代码边界不可被段落规则破坏 |
| `conversation-transcript.md` | 对话 transcript 切片 | 带 transcript metadata 时 `chunk_type=audio_transcript`；缺失时进入 `mixed` 或 pending review |
| `video-scene-metadata.mp4` | 视频场景弱结构 | `chunk_type=video_scene`；FFmpeg 缺失时保留 Source 并写 recoverable warning |
| `unbound-table-figure.pdf` | 表格 / 图片未绑定正文位置 | `structured_binding` 或 `source_binding=warning/failed` |
| `duplicated-watermark.pdf` | 重复、水印、乱码 | `noise_duplicate=warning` |
| `table-structure.xlsx` | 结构化内容切片 | `chunk_type=structured_table`，保留 sheet / row range |
| `audio-transcript-missing.wav` | 多模态 transcript 缺失 | 文件保留；`multimodal_transcript_available=skipped` + `asr_unavailable` |
| `uncitable-chunk.md` | 无法 citation 绑定的 chunk | `source_binding=warning/failed`，`source_binding_status` 不混入索引状态 |

这些 fixture 只验证 P0 可解释质量信号，不验证 LLM 主观语义质量。

### 4.5 AI 结构化整理 fixture

新增 `tests/fixtures/structured-organization/`：

| fixture | 目标 | 期望 |
|---|---|---|
| `topic-drift-source.md` | 内容理解偏离主题 | `topic_understanding=warning/failed`，必要时要求补上下文 |
| `overlong-summary.md` | 摘要过长、遗漏核心信息或幻觉 | `summary_quality=warning/failed`，不得覆盖 Source 原文 |
| `concept-duplicates.md` | 关键概念重复、粒度不统一 | `concept_extraction=warning`，候选概念进入 Review |
| `schema-missing-source.yaml` | 结构化字段缺 source / chunk 指针 | `schema_mapping_failed`，候选 KU 不可 confirmed |
| `card-without-citation.md` | 知识卡片缺标题、摘要、标签或来源 | `card_normalization=failed`，卡片进入 pending review |
| `tag-conflict.md` | 分类错误、标签重复或层级不一致 | `tag_consistency=warning/failed`，触发合并或重命名建议 |
| `invalid-relation.md` | 关系方向错误、无依据或循环依赖 | `relation_suggestion=warning/failed`，不写 confirmed relation |
| `llm-unavailable-structuring.md` | LLM / LangChain / LlamaIndex 不可用 | 回退 `p0_rule_structuring_v1`，每步写 `fallback_reason` |
| `summary-type-routing.md` | QA / 段落 / 文件 / 项目 / 长文压缩摘要混用 | `summary_generation.result.summary_types` 正确区分，且 `replaces_source_text=false` |
| `tag-hierarchy-merge.md` | 标签层级混乱、同义标签重复 | `classification_tagging.tag_operations` 生成层级、合并和去重候选，进入 Review |
| `classification-routing.md` | 资料类型、项目归属和知识库归属不确定 | `classification_tagging.classification_routing` 写候选和置信度，不自动归档 |
| `metadata-field-extraction.md` | 标题、作者/来源、时间、关键词字段缺失或冲突 | `schema_mapping.field_mapping` 标出缺失字段，候选 KU 不可 confirmed |
| `card-type-generation.md` | 概念 / 人物 / 项目 / 文件 / 灵感 / 问答卡片类型混用 | `knowledge_card_generation.result.card_type` 正确，卡片必须绑定 Source / Chunk |
| `entity-relation-triples.md` | 实体、三元组和 KU 关系候选无证据 | `relation_suggestion.result.entity_candidates / triple_candidates / relation_candidates` 带 evidence chunk，关系不写 confirmed |
| `storage-write-mapping.md` | 原文件、文本、元数据、向量、关系、反馈和任务状态写入边界混乱 | 验证 files / sources / chunks / metadata_json / embeddings / review_tasks / Z0a feedback_events-or-response-summary / Z2 retrieval_feedback / processing_jobs 映射，不引入独立数据库依赖 |
| `z0a-rag-anchor-without-invocation.md` | Z0a Evidence / Answer 错误依赖 `invocation_requests` 或 `retrieval_plans` | `request_id` / `retrieval_plan_id` 为空时仍可通过 `retrieval_log_id`、`evidence_pack_id`、`evidence_item_ids` 完成 evidence-only answer |
| `z0a-citation-trace-no-citation-id.md` | Z0a 响应错误返回持久化 `citation_id` | 返回 citation label + trace summary；Z0b 才创建 `answer_citations` |

这些 fixture 验证的是 AI 结构化整理 profile、质量门和 Review 边界，不验证商业 LLM 的生成质量。

### 4.6 安全运维 fixture

新增 `tests/fixtures/ops-security/`：

| 场景 | 期望 |
|---|---|
| 上传失败 | `processing_status_events.event_type=upload_failed`，可恢复状态可读 |
| 解析失败 | `parse_warnings` + `processing_status_events.event_type=parse_failed` |
| 检索失败 | `system_logs(log_type=error)` 或 retrieval error event 可被 `/api/system/status` 汇总 |
| RAG provider missing | `rag_answer_fallback` 计数 + `fallback_reason=rag_provider_missing` |
| 权限变更 | `audit_logs.action=permission_change`，内容脱敏 |
| 备份 / 恢复 / 删除 / 隐私设置 | 写入审计摘要，破坏性操作要求 confirmation token |
| 高资源任务 | `system_logs(log_type=performance)`，`high_resource_task` 计数可读 |

---

### 4.7 知识调用 / Agent / 前端状态 fixture

新增 `tests/fixtures/invocation-routing/`：

| fixture | 目标 | 期望 |
|---|---|---|
| `simple-fact-bm25.md` | 简单事实问答 | `retrieval_strategy_profile=p0_route_simple_fact_bm25_v1`，走 FTS5/BM25 |
| `concept-vector-search.md` | 概念解释和近义召回 | `retrieval_strategy_profile=p0_route_concept_vector_v1`，走 sqlite-vec，缺失时 fallback |
| `timeline-metadata-filter.md` | 时间线 / 版本 / 更新时间问题 | `retrieval_strategy_profile=p0_route_timeline_metadata_v1`，走 metadata filter |
| `file-lookup-source-index.md` | 文件定位、页码、路径问题 | `retrieval_strategy_profile=p0_route_file_lookup_v1`，返回 source/file index 和 citation trace |
| `relationship-confirmed-relation.md` | 关系分析 | 只读 confirmed relation 或 relation_suggestion evidence；GraphRAG unavailable 不阻塞 |
| `summary-synthesis-hybrid.md` | 总结归纳问题 | hybrid search + Evidence Pack，未配置 LLM 时 evidence-only answer |
| `complex-hybrid-search.md` | 复杂综合问题 | keyword + vector + metadata + relation evidence 合并；reranker 缺失回退 hybrid score |
| `bad-citation-feedback.md` | 错误引用反馈 | 写 `feedback_signal.signal_type=bad_citation`，不改写 confirmed knowledge |
| `missing-source-feedback.md` | 缺失来源反馈 | 写 `feedback_signal.signal_type=missing_source`，用于后续排序/诊断 |
| `feedback-policy-scope.md` | 反馈策略作用域 | 写 `feedback_policy.storage_scope=local_only` 与 `effect_scope=current_project`，不影响全局知识真值 |
| `implicit-agent-boundary.md` | P0 隐式 Agent 边界 | 允许只读规划和内部检索；外部 API 工具调用 / 自主执行 / 多 Agent 返回 unsupported |
| `frontend-state-contract.md` | 前端状态契约 | `FrontendStateContract` 覆盖 loading / empty / fallback / blocked / recoverable_error / done |
| `z0a-no-invocation-plan-persistence.md` | D-081 / D-085 边界 | Z0a 只验证 retrieval log + Evidence Pack + evidence-only answer，不要求 Invocation / Retrieval Plan 持久化 |
| `invocation-profile-schema-v1.md` | D-082 schema | 验证 `profile_envelope`、`rewrite_status`、`source_reliability_score` / `source_reliability_label` 命名一致 |

这些 fixture 验证 D-080/D-081/D-082/D-083 的调用路由、排序、溯源、反馈、持久化边界和 UI 状态契约，不验证商业 LLM 主观回答质量。

---

## 5. 性能基线

### 5.1 P0 性能目标

| 指标 | 目标 | 测试方法 |
|---|---|---|
| 应用冷启动 | < 5 秒 | E2E：从 launch 到首屏可交互 |
| 应用热启动（已索引） | < 2 秒 | E2E：第二次启动 |
| text_import 导入（500 字） | < 1 秒 | Service IT：同一入库管线 |
| 小文件上传（2MB） | < 3 秒 | Service IT：含 upload_task / file / source |
| 大文件上传进度 | 必须可见 | E2E：进度条和状态事件 |
| Source 导入（2000 字） | < 3 秒 | Service IT |
| Chunk 切分（10K 字） | < 2 秒 | 单元测试 |
| Mock Embedding 生成（100 chunks） | < 500ms | 单元测试 |
| KU 创建 | < 200ms | Repository IT |
| Review 操作 | < 200ms | Service IT |
| 检索响应（10 KU 库） | < 100ms | Service IT |
| 检索响应（1K KU 库） | < 500ms | Service IT |
| 检索响应（10K KU 库，pressure） | < 1 秒 | Service IT（用大 fixture），不阻塞 P0-Core |
| RAG evidence-only fallback | < 1 秒 | Service IT：1K KU 检索后组装 |
| System status 汇总 | < 200ms | Service IT：读取本地日志、任务、provider capability 摘要 |
| 数据库迁移（空库 → P0-Z0a 表） | < 5 秒 | Repository IT；Z0b/Z1/Z2 迁移单独计时 |
| 数据库备份（10K KU 库） | < 5 秒 | Service IT |

### 5.2 大数据集 fixture

`tests/fixtures/large-dataset/` 提供大规模数据：

- `1k-knowledge-units.sql`（生成脚本）
- `10k-knowledge-units.sql`（生成脚本）
- `100k-chunks.sql`（生成脚本）

通过脚本生成，不入 git（生成命令保留在 `scripts/test/generate-large-dataset.py`）。

### 5.3 性能回归监控

每个 commit / PR 跑性能回归：

- 检索响应（1K KU）变慢 > 20% → CI 失败
- Source 导入变慢 > 30% → CI 失败
- 应用冷启动变慢 > 1 秒 → CI 警告

---

## 6. SQLite WAL 模式并发测试

### 6.1 桌面单用户场景的并发性

虽然桌面是单用户，但仍存在并发：

- Sidecar 内部多个异步 task（FastAPI async endpoint）
- 后台任务（embedding 生成、批量导入）与前台请求并行
- 多窗口（P1）

### 6.2 关键测试场景

| 场景 | 测试方式 | 期望 |
|---|---|---|
| 多个 source 并行导入 | 异步并发 5 个 text_import / upload | 全部成功，无锁冲突 |
| 导入中查询 KU | 一边导入一边查询 | 查询不阻塞 |
| 同一 KU 并发 Review | 两个并发 confirm | 一个成功一个返回冲突 |
| 应用突然关闭（kill -9） | 强制终止后重启 | 数据完整，最多丢失最后一次写 |
| 数据库备份中查询 | 备份时并发查询 | 查询正常 |

### 6.3 测试工具

- Python：`pytest-asyncio` + 并发任务
- 模拟应用崩溃：subprocess + `os.kill(pid, signal.SIGKILL)`
- WAL checkpoint 验证：`PRAGMA wal_checkpoint`

---

## 7. CI 集成预案

### 7.1 推荐工具

- **GitHub Actions**：开源场景默认
- **GitLab CI**：自建场景
- **本地预提交钩子**：`pre-commit` + `husky`

### 7.2 CI 矩阵

| 阶段 | 触发 | 任务 | 时长目标 |
|---|---|---|---|
| Pre-commit | 本地 commit | lint / format | < 10 秒 |
| Pre-push | 本地 push | unit + repository test | < 1 分钟 |
| PR Check | PR 创建 / 更新 | full test suite | < 10 分钟 |
| Main Branch | merge 到 main | full test + 性能回归 + 打包 | < 30 分钟 |
| Release | git tag | full test + 多平台打包 + 签名 | < 60 分钟 |

### 7.3 CI 矩阵平台

```yaml
# .github/workflows/test.yml（示例）
on: [pull_request, push]
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [macos-14, windows-latest, ubuntu-latest]
        node: ['20']
        python: ['3.11']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: ${{ matrix.node }} }
      - uses: actions/setup-python@v5
        with: { python-version: ${{ matrix.python }} }
      - run: npm ci
      - run: cd apps/api && pip install -r requirements.txt
      - run: npm run lint
      - run: npm run typecheck
      - run: cd apps/api && pytest --cov=app
      - run: npm run test:e2e  # Playwright E2E
```

### 7.4 测试报告

- 覆盖率：上传到 Codecov / Coveralls
- E2E 截图 / 视频：上传到 GitHub Artifacts
- 性能基线：每次记录到 `tests/baseline/{date}.json`

---

## 8. P1 AI 能力评估方案

P1 引入真实 AI 时，每个能力上线前必须经过 mock baseline 对比测试。详见 `docs/ai-provider-architecture.md` §10。

### 8.1 评估数据集

`tests/ai-eval/` 维护：

- `embedding/`：50 对相似 / 不相似文本对，期望相似度排序
- `summarization/`：50 段输入 + 期望摘要（人工标注）
- `tag-suggestion/`：50 段 KU + 期望标签（人工标注）
- `text-to-sql/`：30 个自然语言问题 + 期望 SQL（人工标注）
- `rag-answer/`：30 个问题 + 期望引用 + 期望回答要点

### 8.2 评估指标

| 能力 | 指标 |
|---|---|
| Embedding | 相似度排序的 Spearman 相关系数（与 ground truth 比较） |
| Summarization | ROUGE-L F1 / 人工评分（1-5） |
| Tag Suggestion | Precision @ 5 / Recall @ 10 |
| Text-to-SQL | Exact match / Execution accuracy |
| RAG Answer | Citation accuracy / 人工评分（事实性 + 完整性） |

### 8.3 评估流程

```text
1. 准备评估数据集（人工标注）
2. 跑 MockProvider baseline，记录指标
3. 跑真实 Provider，记录指标
4. 对比：真实 Provider 必须在所有关键指标上优于 mock
5. 成本评估：每千次调用预计成本 vs 收益
6. 用户体验评估：5-10 名内测用户主观评分
7. 通过 → P1 该能力上线；不通过 → 调整 prompt / 换 provider / 推迟
```

---

## 9. 测试反模式（避免）

不要做：

- 测试 mock 数据本身（mock 是测试工具，不是测试对象）
- 用真实 AI Provider 跑 CI（成本不可控、不稳定）
- 在测试中依赖外部网络（除非显式标记 `@pytest.mark.integration_external`）
- 单元测试涉及 SQLite 文件（应使用 in-memory `:memory:` 或 mock）
- E2E 测试一次跑遍所有 API（拆分为多个独立场景）
- 没有 cleanup 的测试（用 fixture / tearDown 强制清理）

---

## 10. 与其他文档的关系

```text
docs/testing-strategy.md（本文档）
└── 测试金字塔、fixture、性能基线、E2E、CI、AI 评估

docs/api-implementation-plan.md
└── §10 合同测试 10 条（被本文档 §3.4 引用）

docs/p0a-execution-plan.md
└── 每周交付物的验收（被本文档支持）

docs/ai-provider-architecture.md
└── §10 AI 能力评估（被本文档 §8 详细化）

docs/desktop-architecture.md
└── §12 Schema 迁移（迁移测试在本文档 §6.2）+ §15 Onboarding（E2E 验证）

docs/data-model.md
└── §3 对象分层与 P0-Core / P0-File / P0-AI / P0-RAG 必建表（fixture 生成依赖 schema）
```

---

## 11. 当前结论

```text
P0 测试目标：链路完整 + 状态正确 + 来源可追溯 + 失败可恢复
P0 不测试：mock / fallback 输出的主观语义质量
P0 必备测试套件：
- Unit Tests（rules / mock / utils）
- Repository IT（CRUD + SQL 方言）
- Service IT（业务流程 + 事务）
- Contract Test（覆盖上传、解析、Provider 和 RAG fallback 错误码）
- E2E（完整入库到 answer/fallback smoke 流程）
- Provider capability fixture（覆盖 PyMuPDF/pdfplumber/PaddleOCR/Whisper/bge-m3/bge-reranker-v2/local LLM 缺失与 fallback reason）

性能基线：
- 检索响应 < 1 秒（1K KU，must）
- 检索响应 < 1 秒（10K KU，pressure target）
- text_import 导入 < 3 秒（2000 字）
- 小文件上传 < 3 秒（2MB）
- 应用冷启动 < 5 秒

CI：
- macOS / Windows / Ubuntu 三平台
- PR Check < 10 分钟
- Release 跑多平台打包

AI 评估：
- mock / open-source baseline 对比强制
- 评估数据集 + 关键指标
- 商业 Provider 通过后才作为可选增强上线
```

测试不是 P0 完成后才补，而是 W1 起跟着代码一起写。
