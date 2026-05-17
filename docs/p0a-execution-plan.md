# P0 执行计划

版本：v0.21
日期：2026-05-17  
状态：已升级为 P0-Core / P0-File / P0-AI / P0-RAG 完整执行计划 + P0-Z0a/Z0b 竖切 / ProcessingJob / File Inspection / 切片前准备层 / 结构化整理检查门 / 知识切片质量闭环 / 安全运维横切层 / 检查门映射契约细化 / 切片执行 profile 收敛 / AI 结构化整理 profile 与 D-079 存储映射收敛 / D-080 知识调用 profile 与前端状态契约收敛 / D-081-D085 实现前边界修正 / D-090 技术栈执行优化 / D-091 技术栈工程化验收门槛 / D-092 代码骨架前置契约优化 / D-093 桌面运行时硬化 / D-094 P0-Core 桌面工程骨架开工契约

## 1. 文档目的

本文档把五张架构图和 `docs/mvp-scope.md` 当前版本转化为可执行工程计划。

P0 当前不是轻量建库闭环，而是完整入库与知识处理平台：

```text
本地用户 / 账号预埋
→ 文件上传 / 接收 / 完整性校验
→ 文件解析 / 清洗 / 切片
→ AI 结构化 / Review
→ Embedding / VectorStore
→ Query Understanding / Retrieval Strategy / Hybrid Retrieval / Citation Trace / RAG answer
→ Feedback / Memory Draft
```

---

## 2. 开工前置 Checklist

### 2.1 文档冻结确认

- [ ] `docs/mvp-scope.md` v0.13 已确认 P0 四切片与 P0-Z0a / Z0b / Z1 / Z2 波次、D-080 调用/Agent/前端边界。
- [ ] `docs/data-model.md` v0.20-draft 已确认 P0-Z0a blocking 对象、Z0b 补齐对象、检查门映射、事件枚举单一来源、切片前准备、chunk quality/source metadata、`chunk_execution_profile`、`structured_organization`、D-079 存储映射、D-080 profile、D-081/D-082/D-083/D-085 调用边界、D-092 trace chain / Evidence Pack 失败态与 Provider capability/fallback 元数据。
- [ ] `docs/api-design.md` v0.18-draft 已确认 Upload / File / Job Events / Parse / Chunk Build / KU Extract / Retrieval / RAG / System Status API、ProcessingJob、sensitive grant、provider capability status、chunk summary 执行 profile、D-079 structuring summary 与 D-080-D085 query/ranking/citation/feedback 响应。
- [ ] `docs/api-implementation-plan.md` v0.20-draft 已确认 route-service-repository 映射、`ChunkBuildService` 执行 profile、`KnowledgeExtractionService` 结构化整理 profile、D-079 review payload 边界、D-080-D085 RetrievalPreview / Evidence / RAG 实施边界、D-092 OpenAPI 类型生成 / trace chain / migration 波次命名、D-093 桌面运行时 API 约束与 D-094 P0-Core API skeleton 顺序。
- [ ] `docs/rag-pipeline.md` v0.8-draft 已确认 RAG answer / evidence-only fallback、Evidence Pack 失败态、chunk quality 风险展示与 D-080-D085 调用路由。

### 2.2 技术决策

- [ ] Electron 版本：33.x stable。
- [ ] Node.js：20 LTS+。
- [ ] Python：3.11+。
- [ ] SQLite：3.40+。
- [ ] sqlite-vec：优先启用；不可用时只降级运行时，不删除 VectorStore 抽象。
- [ ] AI 能力：开源优先 ProviderRegistry；商业 Provider 仅可选。
- [ ] Python 依赖：使用 `uv + pyproject.toml`，至少拆分 `core / file / ai / ocr / asr / dev` optional dependency groups；W1/W2 只阻塞 `core + dev`。
- [ ] Node 依赖：使用 `pnpm`，前端状态采用 Zustand；React Context 只保留 API base、auth status、theme 等全局配置。
- [ ] 上传：Uppy + tus-style chunk upload；进度默认 SSE。
- [ ] 存储：本地 `tmp/uploads/` + `sources/`；StorageAdapter 按 S3-compatible 语义设计。
- [ ] 队列：P0 默认 `local_sqlite_worker`；TaskQueueAdapter 兼容后续 Celery + Redis。
- [ ] Parser：P0-Z0a 阻塞 text / Markdown 内置解析；PyMuPDF / pdfplumber 作为同轮增强，缺失不得阻塞工程骨架。
- [ ] OCR / ASR：PaddleOCR / Whisper 进入 Z1 optional；缺失返回明确错误码，不阻塞 Z0a。
- [ ] Embedding / Rerank：Z0a 必须有 `embeddings` 表和 `mock_fixed_384` fallback；bge-m3 / bge-reranker-v2 为 optional provider，按 capability probe 启用。
- [ ] 知识调用：规则 `query_understanding_profile`、`retrieval_strategy_profile`、`ranking_profile`、`citation_trace_profile`；LLM rewrite / reranker / GraphRAG 缺失时 graceful fallback。
- [ ] 前端：Electron + React + Vite + TypeScript + Zustand；状态默认 SSE、Toast、Error Boundary、Loading Skeleton、Auth Guard。
- [ ] 工程化门槛：W1 必须具备最小依赖 CI gate、optional provider 延迟加载、typed fetch wrapper、sidecar 生命周期验证、sqlite-vec 三态一致性和 evidence-first smoke。
- [ ] 代码骨架前置契约：W1 必须冻结 OpenAPI → TypeScript 类型生成、Provider manifest、trace chain、migration 波次命名、SQLite 性能基线脚本、Zustand store slices 和 Evidence Pack 失败态。
- [ ] 桌面运行时硬化：W1 必须验证 local session token、127.0.0.1 sidecar 绑定、SQLite WAL / backup / integrity check、worker heartbeat、状态栏 runtime summary 和最小诊断包。
- [ ] P0-Core 工程骨架：W1 必须先通过 `smoke:p0-core`，再进入 upload / parse / review / RAG 业务链路。

### 2.3 产品命名与本地数据目录

W1 前必须确定开发期占位：

- 应用名：例如 `KnowledgeBaseDev`。
- Bundle ID：例如 `dev.local.knowledgebase`。
- Product ID / 数据目录名 / Keychain service 名。
- SemVer 起始版本：`0.1.0-alpha`。

正式品牌和图标可以在外部分发前冻结。

---

## 3. P0 分层

| 切片 | 必须完成 | 可降级 |
|---|---|---|
| P0-Core | Electron/FastAPI/SQLite、local_user、账号预埋、Project/Folder/Tag、错误 envelope、审计日志 | 真实登录 disabled |
| P0-File | Upload task、分片/直传、文件接收、完整性校验、files、ProcessingJob、processing status | Parser 失败可恢复 |
| P0-AI | Parser Router、内容清洗、Chunk、chunk quality、KU 抽取、Review、Embedding、VectorStore | Provider 不可用时规则/mock |
| P0-RAG | Query Understanding、Retrieval Strategy、Retrieval Plan summary（Z2 持久化）、Ranking、Evidence Pack、Citation Trace、Query Explanation、RAG answer、feedback_signal、memory draft | LLM / reranker / GraphRAG 不可用时 evidence-only / hybrid score / relation evidence fallback |

### 3.0 P0-Z0a / Z0b 先行竖切

W1-W3 先完成 P0-Z0a，避免一次性实现完整 P0 对象：

```text
local_user / project / folder / tag
→ upload 或 text_import
→ verify / inspect job
→ parse / chunk
→ candidate KU / review confirm
→ embed job
→ retrieval log / evidence pack / evidence-only answer（不调用 LLM）
```

P0-Z0b 同周补齐账号预埋 schema、分片恢复、source description、citation 明细、sensitive grant 和审计日志；P0-Z1 补齐质量事件、关系和更完整 parser warning；P0-Z2 补齐 invocation plan、memory draft、feedback 和完整 RAG answer provider/fallback 复盘。

### 3.0.1 D-090 首批依赖约束

W1-W2 不安装或不要求 OCR、ASR、reranker、真实 LLM、GraphRAG、Redis/Celery、PostgreSQL、独立向量库。首批工程只证明：

```text
FastAPI sidecar
→ SQLite migration
→ local worker / SSE
→ text_import or simple upload
→ rule chunk
→ KU review
→ embedding fallback
→ evidence-only answer
```

如果某个 optional provider 在开发机可用，可以接入 capability probe，但不得把它写成 W1/W2 验收前置条件。

### 3.0.2 D-091 工程化验收门槛

W1-W2 的验收不只看功能能否跑通，还要看技术栈边界是否被实际守住。D-091 增加以下 blocking gate：

| Gate | 必须证明 | 不允许 |
|---|---|---|
| 最小依赖 CI | `core + dev` + Node 基础依赖即可完成 P0-Z0a smoke | OCR / ASR / reranker / LLM / GraphRAG 进入首批必装 |
| Provider 延迟加载 | optional provider 缺失不影响启动、migration、health、text_import | 在模块 import 阶段直接导入重依赖并导致 crash |
| Sidecar 生命周期 | 启动、端口冲突、崩溃、重启、退出清理有明确状态和日志 | Renderer 假设 FastAPI 永远可用 |
| typed fetch | 页面只通过 typed fetch wrapper 访问 API，统一 request_id 和 error envelope | 页面组件散写裸 `fetch` |
| sqlite-vec 三态 | `/api/system/status`、Provider summary、VectorStoreService、Query Explanation 表达一致 | sqlite-vec 不可用时删除向量层或伪装成真实向量召回 |
| Evidence-first | retrieval log / evidence pack / evidence items 先于 answer 写入 | evidence 失败仍生成无来源 answer |

这些 gate 应进入 `pnpm smoke:p0-z0a` 或等价脚本，作为后续接入增强 Provider 前的回归基线。

### 3.0.3 D-092 代码骨架前置契约

D-092 要求代码骨架创建前先冻结以下契约：

| 契约 | W1/W2 交付物 | 验收方式 |
|---|---|---|
| OpenAPI 类型生成 | `scripts/export-openapi.py`、`pnpm generate:api-types`、生成的 TS API types | Pydantic schema 改动后生成类型并通过 `pnpm typecheck` |
| Sidecar 打包 spike | packaged 或 pseudo-packaged FastAPI sidecar health check | 打包形态可启动、写日志、优雅退出 |
| Provider manifest | provider capability manifest | lazy-load、Settings 展示、测试 fixture 均读 manifest |
| Trace chain | `trace_id / request_id / job_id / event_seq / retrieval_log_id / evidence_pack_id / ai_answer_id` 贯穿规则 | 诊断报告可按 trace 聚合 |
| Migration 波次命名 | Alembic 文件名显式含 `z0a / z0b / z1 / z2` | migration review 不混入后置对象 |
| SQLite 性能基线 | `pnpm bench:sqlite` 或等价脚本 | 1K / 10K KU 检索与 Evidence Pack 组装有可重复结果 |
| Zustand store slices | `workspaceStore / jobStore / reviewStore / retrievalStore / citationStore` | 页面不临时创建跨域大状态 |
| Evidence failure types | `no_retrieval_result / insufficient_evidence / permission_blocked / citation_binding_failed / vector_degraded` | 失败时返回解释，不写无来源 answer |

### 3.0.4 D-093 桌面运行时硬化

D-093 要求 W1/W2 不只跑通开发态功能，还必须证明桌面软件运行边界真实成立：

| Gate | 必须证明 | 不允许 |
|---|---|---|
| Sidecar local auth | sidecar 只绑定 `127.0.0.1`，请求必须携带本地会话 token | Renderer 裸连 localhost 或端口/token 硬编码 |
| Main-injected API config | API base、token、trace 注入都由 Main/preload 控制 | 页面组件拼 URL 或读取持久 token |
| SQLite data safety | WAL、busy_timeout、foreign_keys、quick_check、pre-migration backup 启用 | migration 失败后无法恢复或写入源码目录 |
| Worker isolation | 长任务通过 job + worker 执行，health 不被重任务阻塞 | API route 同步执行 OCR/embedding/index rebuild |
| Runtime status bar | sidecar / DB / worker / provider / job 状态可见 | 用户看到空白页但不知道哪层失败 |
| Provider settings panel | manifest 状态、联网属性、fallback 和 API Key 需求可见 | mock/system 被包装成真实 AI 能力 |
| Minimal diagnostics | 可导出脱敏 logs、provider status、recent jobs、system status | 诊断包包含 API Key、原文、DB 或完整私密路径 |

### 3.0.5 D-094 P0-Core 桌面工程骨架开工契约

D-094 把 W1 的第一目标收窄为桌面工程骨架。`smoke:p0-core` 通过前，不进入 upload / parse / review / RAG 业务链路。

| Gate | 必须证明 | 不允许 |
|---|---|---|
| Monorepo responsibility split | `apps/desktop-main`、`apps/desktop-preload`、`apps/renderer`、`apps/api` 职责独立；`packages/api-types`、`packages/runtime-contracts`、`packages/shared-config` 可被引用 | Electron Main、Renderer、FastAPI sidecar 混成单目录或互相越权 |
| Startup state machine | `booting / sidecar_starting / sidecar_ready / db_checking / migration_running / worker_starting / ready / degraded / recovery_required / shutting_down` 贯穿 Main、API、Renderer 和诊断 | 前端另造不可追踪的 loading/failed 状态 |
| Preload API | `getRuntimeConfig / getRuntimeStatus / onRuntimeStatusChange / openFileDialog / exportDiagnostics` 可用 | 直接暴露 Node、fs、child_process、数据库连接或长期 token |
| Local token health check | `/api/health` 只在正确 `X-Local-Session-Token` 下通过 | Renderer 裸连 localhost 或 API base/token 硬编码 |
| SQLite init + backup hook | app data dir、WAL、quick_check、migration skeleton、pre-migration backup hook 建立 | 数据库、日志、上传缓存写入源码目录或安装目录 |
| Runtime status bar | shell 加载后显示 sidecar / DB / worker / provider / vector 状态 | 用户看到空白页但不知道哪层失败 |
| `smoke:p0-core` | sidecar、local token、DB init、runtime status、shutdown 可重复通过 | 业务 smoke 代替运行时骨架 smoke |

骨架通过后，再执行 `smoke:p0-z0a`：text import → rule chunk → KU review → fallback embedding → evidence-only。

### 3.1 P0 默认工具落地

| 能力 | P0 默认 | 缺失时行为 |
|---|---|---|
| Upload | Uppy + tus-style API | 返回上传错误码，upload_task 保留 |
| Progress | SSE + `Last-Event-ID` | 可退回轮询 `GET /api/uploads/{id}` / job snapshot |
| Storage | local filesystem + StorageAdapter | 文件不进入云端，状态仍可恢复 |
| Queue | local_sqlite_worker | 任务状态写入 ProcessingJob（物理表可为 `ingestion_jobs`）/ `processing_status_events`，支持 lock、heartbeat、retry、幂等复用 |
| File Detection | libmagic/python-magic | 扩展名 + MIME + 文件头签名 fallback |
| Encoding | charset-normalizer | chardet optional；记录 detected_encoding |
| Security | qpdf / oletools / EXIF adapter | ClamAV / Docker Sandbox disabled；静态风险检查继续 |
| Structure | PyMuPDF / pdfplumber / openpyxl | Unstructured / Docling / LayoutParser optional |
| Chunk Preparation | input integrity + OCR/layout check + strategy match + structure integrity gate | 检查失败写 fallback / warning，不阻塞 Z0a 规则切片 |
| Token Counting | tiktoken | 规则估算 fallback |
| Structure Recovery | PyMuPDF/fitz + pdfplumber + openpyxl | python-docx / Unstructured / Tika / GROBID / BeautifulSoup/lxml optional |
| Chunk Strategy | rule + document structure + length bounds | LangChain Text Splitter / LlamaIndex Node Parser 仅 P1 adapter |
| Preview | Pillow / PyMuPDF / openpyxl / FFmpeg | `preview_unavailable`，不阻塞入库 |
| PDF/Text | Built-in text/Markdown + PyMuPDF + pdfplumber | `unsupported_parser` / `parser_unavailable` |
| OCR | PaddleOCR | `ocr_unavailable` + parse warning |
| ASR | Whisper / FunASR optional | `asr_unavailable` + parse warning |
| Video | FFmpeg metadata/frame extraction | video parser unavailable，文件保留 |
| Cleaning | pandas + Pandera | 只做最小规则清洗，记录 quality warning |
| Tags | KeyBERT + HanLP/spaCy + rule | rule/mock tag suggestion |
| Embedding | `bge_m3_local` profile if available | fallback `mock_fixed_384`（dimension=384） |
| Rerank | bge-reranker-v2 if available | hybrid merge score |
| RAG | custom Evidence Pack + Citation | evidence-only answer |
| Query Understanding | rule/template profile | LLM rewrite unavailable 时规则识别 |
| Retrieval Strategy | BM25 / vector / metadata / file index / relation evidence / hybrid route | GraphRAG / LTR unavailable 时不阻塞 |
| Frontend State | SSE + Toast / Error Boundary / Skeleton | WebSocket unavailable 时无影响 |

P0-Z0a 技术栈执行口径：

| 类别 | Z0a 阻塞 | Z0a 非阻塞 |
|---|---|---|
| Python 依赖 | `core + dev` | `file / ai / ocr / asr` extras |
| 文件解析 | text / Markdown | PDF / Office / OCR / ASR / video |
| 向量 | `embeddings` 表 + fallback vector | bge-m3 / sqlite-vec 高质量召回 |
| 检索 | FTS5 + metadata + fallback ranking | reranker / GraphRAG |
| 回答 | evidence-only | provider `rag_answer` |

---

## 4. 6 周执行计划

### W1：P0-Core 工程骨架与账号预埋

目标：应用可启动，sidecar 可连接 SQLite，local_user 与账号预埋对象可查询。

任务：

- 创建 Electron + React + FastAPI + SQLite monorepo。
- 创建 P0-Core monorepo 目录骨架：`apps/desktop-main`、`apps/desktop-preload`、`apps/renderer`、`apps/api`、`packages/api-types`、`packages/runtime-contracts`、`packages/shared-config`。
- 创建 `pyproject.toml` optional dependency groups：`core / file / ai / ocr / asr / dev`。
- 创建 `pnpm-workspace.yaml`，固定桌面 Main、Preload、Renderer、共享 packages 和脚本工作区。
- 创建 OpenAPI 导出与类型生成脚本：`uv run python scripts/export-openapi.py`、`pnpm generate:api-types`。
- 创建 `runtime_state` 枚举契约：`booting / sidecar_starting / sidecar_ready / db_checking / migration_running / worker_starting / ready / degraded / recovery_required / shutting_down`。
- 创建 preload API surface 契约：`getRuntimeConfig / getRuntimeStatus / onRuntimeStatusChange / openFileDialog / exportDiagnostics`。
- 创建最小依赖 smoke gate：只安装 `core + dev` 时可运行 health、migration、text_import、rule chunk、KU review、embedding fallback、retrieval/evidence-only。
- 创建 `pnpm smoke:p0-core`：验证 sidecar、local token、DB init、runtime status 和 shutdown。
- 创建 sidecar 打包 spike：最小 packaged / pseudo-packaged FastAPI sidecar 可 health check、写日志、优雅退出。
- 创建 Alembic 迁移工具链。
- Alembic migration 文件名按 `z0a / z0b / z1 / z2` 波次命名，不把后置对象混入 Z0a。
- 创建 users / user_profiles / auth_identities / roles / access_policies。
- 实现 `GET /api/auth/status`。
- 登录 / 注册 / Token 写接口返回 `auth_not_enabled_in_p0`。
- 创建 Project / Folder / Tag + Folder-Tag Mirroring。
- 建立统一 error envelope、request_id、核心错误码。
- 建立基础 audit_logs / system_logs。
- 前端建立 Zustand store：workspace、job events、review queue、retrieval session、citation panel；React Context 只放 API base、auth status 和 theme。
- 前端固定 Zustand slices：`workspaceStore`、`jobStore`、`reviewStore`、`retrievalStore`、`citationStore`。
- 前端建立 typed fetch wrapper：统一 request_id、error envelope、recoverable、fallback_reason、capability_status 和写接口 retry 禁止规则。
- Electron Main 建立 sidecar lifecycle manager：启动、端口选择、health check、崩溃退出码记录、重启入口和应用退出清理。
- ProviderRegistry 建立 optional provider lazy loader：缺失 PyMuPDF、PaddleOCR、Whisper、bge-m3、reranker 或 LLM SDK 时只返回 capability status，不影响启动。
- ProviderRegistry 建立 provider manifest，记录 provider_key、capability、extra_group、import_path、probe_function、fallback_provider_key 和 user_visible。
- 建立 trace chain 规则：Electron、FastAPI、worker、SSE、Evidence Pack 均写 `trace_id`。
- 实现 sqlite-vec capability probe：`available / degraded / unavailable` 三态，写入 system status；不可用时不阻塞启动。
- 创建 SQLite 性能基线脚本，至少覆盖 1K / 10K KU 的 FTS5、metadata filter、fallback ranking 和 Evidence Pack 组装。
- `smoke:p0-core` 通过前，禁止开发 upload parsing UI、RAG UI、真实 Provider 接入、OCR/ASR、图谱功能和面向用户的 Chat。

验收：

- `pnpm dev` 或等价脚本启动 Electron + Vite + FastAPI。
- `pnpm dev:desktop` 或等价脚本启动 Electron Main + preload + Renderer + FastAPI sidecar。
- `/api/health` 和 `/api/auth/status` 返回 200。
- `GET /api/system/runtime` 返回统一 `runtime_state`、sidecar、DB、worker、provider、vector 摘要。
- `pnpm smoke:p0-core` 先于 `pnpm smoke:p0-z0a` 通过。
- 创建 Project / Folder 后可重启复盘。
- `uv run ruff check .`、`uv run pytest`、`pnpm typecheck` 命令存在并可运行基础用例。
- sqlite-vec 不可用时系统进入 degraded vector mode，`embeddings` 表和 VectorStoreService 仍存在。
- `pnpm smoke:p0-z0a` 或等价脚本存在，并证明最小依赖路径不需要 OCR / ASR / reranker / LLM。
- sidecar 端口冲突和启动失败能返回明确错误状态，不导致 Renderer 空白页。
- 页面 API 调用统一走 typed fetch wrapper，error envelope 能映射到 Toast / Error Boundary。
- OpenAPI 导出的 TS 类型参与前端 typecheck。
- sidecar 打包 spike 在临时 app data dir 下能启动、写日志并退出清理。
- migration 文件名和内容符合 Z0a/Z0b 波次边界。
- SQLite 1K / 10K KU 基线脚本能稳定输出结果。

### W2：P0-File 上传、接收、完整性校验

目标：用户可上传文件，系统有进度、完整性校验、file_id 和可恢复状态。

任务：

- 创建 upload_tasks / upload_parts / files / file_integrity_checks。
- 实现 `POST /api/uploads`。
- 实现 `PUT /api/uploads/{id}/parts/{part_no}`。
- 实现 `POST /api/uploads/{id}:complete`。
- 实现 `GET /api/uploads/{id}`。
- 实现 `POST /api/files/{file_id}:verify`。
- 文件先写入 `tmp/uploads/`，完成后移动到 `sources/`。
- 前端采用 Uppy 实现文件选择、拖放、分片上传、失败重试入口。
- 上传协议采用 tus-style chunk upload；后端用 FastAPI endpoint 落盘并记录 `upload_parts`。
- 进度反馈默认 SSE；同时保留 `GET /api/uploads/{id}` 轮询兜底。
- 文件保存通过 `StorageAdapter`，P0 实现 `local_fs`，接口保留 S3-compatible 语义。
- 上传和完整性任务进入 `local_sqlite_worker`，不要求 Redis / Celery 常驻服务。
- 上传完成后创建 File Inspection job。Z0a 至少包含扩展名 / MIME / 文件头摘要、基础 risk summary 和可恢复状态；Z0b/Z1 再补 libmagic、qpdf、oletools、EXIF 和 preview asset。job 使用通用 `GET /api/jobs/{job_id}` / `events` 查询。

验收：

- 小文件直传成功。
- 大文件分片合并成功。
- hash 不一致返回 `integrity_check_failed`。
- 失败文件不丢失，可查看状态。
- SSE 进度和轮询状态返回一致。

### W3：P0-File / P0-AI Parser Router 与 Source/Chunk

目标：上传文件能进入解析任务，生成 Source、Source Description、Chunk 和质量记录。

任务：

- 创建 ProcessingJob / processing_status_events / parse_tasks / parse_warnings；ProcessingJob 物理表可为 `ingestion_jobs`，必须支持 `file_id nullable` / `source_id nullable` / `target_type` / `target_id`，以覆盖 Source 创建前的 inspect / preview。
- 固定 ProcessingJob 状态机和幂等规则：同一 `(target_type, target_id, job_type)` 只允许一个 active job，重复 inspect / preview / parse / embed 请求默认复用。
- 创建 file_inspection_results。
- 实现 File Inspection：真实类型识别、编码检测、安全检查、结构识别和预览生成。
- 实现 Parser Router：消费 FileInspectionReport 中的 detected_mime_type、file_signature、risk_level、risk_flags、structure result，再选择 parser_key。
- 接入开源优先 parser adapter：Markdown/plain text 内置是 Z0a 阻塞；PDF 文本 PyMuPDF、PDF 表格 pdfplumber 是 Z0b/Z1 或同轮增强。
- 预留 Unstructured / Docling / Apache Tika / LayoutParser adapter，但不作为 P0 必装依赖。
- OCR 路径默认 PaddleOCR optional；缺失时返回 `ocr_unavailable` 并写 parse warning，不阻塞 Z0a。
- ASR 路径默认 Whisper optional，中文增强预留 FunASR；缺失时返回 `asr_unavailable` 并写 parse warning，不阻塞 Z0a。
- 视频路径默认 FFmpeg 做元数据 / 抽帧，PySceneDetect 场景切分为 optional。
- 预览路径默认 Pillow/PyMuPDF/openpyxl/FFmpeg；预览失败返回 `preview_unavailable`，不阻塞 parse。
- 实现 `POST /api/files/{file_id}:parse`。
- 实现 `GET /api/parse-tasks/{id}`。
- 实现 `GET /api/jobs/{job_id}` 和 `GET /api/jobs/{job_id}/events`，上传事件 API 只作为别名。
- 实现 `POST /api/sources/{source_id}/chunks:build`。
- `chunks:build` 必须先创建或复用 ProcessingJob，再执行 input/OCR/strategy/structure/source binding 检查；只有 source 不存在、项目/权限不匹配可以在 job 创建前失败。
- 实现切片前准备层：输入完整性检查、OCR/版面检查、内容类型识别、策略匹配检查、结构完整性检查。
- 实现切片策略判断：P0-Z0a 使用规则 + 文档结构 + 长度边界；Z0b 写入 `chunk_strategy_profile`、`context_summary` 和 `source_metadata`。
- 实现切片执行 profile 选择：`text_semantic`、`structured_table`、`image_ocr`、`audio_transcript`、`video_scene`、`mixed` 仍走同一个 ProcessingJob / event / quality check 流程；LangChain、LlamaIndex、sentence-transformers、CLIP、Table Transformer 只作为 P1/P2 adapter。
- 实现结构恢复：P0 使用 PyMuPDF/fitz、pdfplumber、openpyxl 的标题/段落/页码/表格/图片位置；P1 才接 python-docx、Unstructured、Tika、GROBID、BeautifulSoup/lxml。
- 实现上下文补充和来源绑定：每个 chunk 至少能追溯 source/file/page/section/paragraph 或对应结构位置；多模态 transcript 缺失时写 `fallback_reason`。
- 实现切片质量检查：`input_integrity`、`ocr_layout_quality`、`strategy_match`、`structure_integrity`、`length_bounds`、`semantic_integrity`、`topic_mix`、`context_sufficient`、`source_traceability`、`structured_binding`、`metadata_completeness`、`source_binding`、`noise_duplicate`、`readability`、`searchability`。
- 实现检查门映射：流程 gate 使用 `input_integrity_check` 等 `_check` 名；数据库质量维度使用 `chunk_quality_checks.check_type`；`source_traceability` 负责追踪字段完整性，`source_binding` 负责 citation/evidence 绑定可用性。
- Z0a 创建 chunks 并在 chunk 上保留最小质量状态；Z0b 创建 chunk_quality_checks；Z1 再补齐 quality_events 和结构化 / 多模态 chunk；Z2 才启用 LLM quality evaluator / reranker 复核。
- 保留 `POST /api/sources/text-import` 作为无物理文件的同管线入口。

验收：

- Markdown/plain text 上传后可生成 Source + Chunk。
- Z0a text / Markdown fixture 生成 Source + Chunk；PDF 文本 fixture 通过 PyMuPDF 生成 Source + Chunk作为 Z0b/Z1 或同轮增强验收；PDF 表格 fixture 通过 pdfplumber 生成 parse warning 或结构化摘要。
- 不支持格式返回 `unsupported_parser`，文件记录仍保留。
- OCR / ASR provider 缺失时不丢文件，状态为可恢复失败。
- 伪装扩展名必须以 detected_mime_type / file_signature 为准；blocked/quarantined 文件默认不创建 parse task。
- Source Detail 可读取 chunk quality、parse warning、preparation_profile、content_kind、chunk_strategy_profile、chunk_execution_profile、chunk_type、context_summary 和 source_metadata。
- 长文本过长、主题混杂、语义断裂、缺 source metadata、重复 / 水印 / 乱码必须生成 `chunk_quality_checks` warning 或 failed。
- 输入缺页、OCR 低置信、版面错位、标题层级混乱、目录映射错误、表格 / 图片未绑定正文位置必须生成切片前准备 warning 或 failed。

### W4：P0-AI 结构化整理、Review、Embedding

目标：系统能从 Source/Chunk 生成候选 KU，用户确认后进入可调用知识资产，并生成 embedding。

任务：

- 实现 Source Description 规则/开源优先生成。
- 实现 pandas + Pandera 内容清洗：去重、空值、类型修复、标准化、异常检测。
- 实现 `POST /api/knowledge-units:extract`。
- `POST /api/knowledge-units:extract` 默认创建或复用 `ProcessingJob(target_type=source, job_type=extract)`，返回 `structuring_summary`。
- 结构化整理链固定为内容理解、摘要生成、关键概念抽取、结构化字段生成、知识卡片生成、分类与标签管理、知识关系建议；每步写 provider/fallback/quality 记录。
- D-079 子字段进入同一链路：摘要类型、标签合并/去重、分类归属、字段映射、卡片类型、实体候选和三元组候选都写入 `knowledge_units.metadata_json.structured_organization`，不新增顶级 step。
- P0 结构化整理默认 profile：`p0_rule_structuring_v1`、`p0_summary_template_v1`、`p0_key_concept_rules_v1`、`p0_schema_mapping_v1`、`p0_knowledge_card_template_v1`、`p0_classification_tagging_v1`、`p0_relation_suggestion_stub_v1`。
- P0 默认工具：Pydantic / JSON Schema、Jinja2 / Markdown / YAML Frontmatter、KeyBERT / YAKE、spaCy / HanLP、规则模板；LLM、LlamaIndex、LangChain Structured Output、Instructor / Guardrails、BGE / Sentence-Transformers、BERTopic、NetworkX / RDFlib 只作为增强 adapter。
- 结构化整理状态统一写 `structured_organization_started/completed/warning/failed`；具体失败步骤写 `payload_json.step`。
- 关系建议只创建 review task，不直接写 confirmed relation；所有 KU / tag / card / relation 候选必须可编辑、可忽略、可回滚。
- 实现 Knowledge Unit 手动创建和编辑。
- 标签推荐默认 KeyBERT + HanLP/spaCy + 规则；LLM tag provider 仅 optional。
- 实现 Review Queue 与 confirm/edit/ignore/reject/do_not_use。
- 创建 `embeddings` 表和 `EmbeddingRepository`。
- 实现 `POST /api/embeddings/rebuild`。
- Embedding 默认优先 `bge_m3_local`；不可用时使用 fallback `mock_fixed_384`，并记录 `provider_key`、`profile`、`dimension`、`capability_status`、`fallback_reason`。
- 实现 VectorStoreService，封装 sqlite-vec / fallback ranking。
- 前端实现 Source Detail、Chunk List、KU Detail、Review Queue。

验收：

- 500-2000 字材料可生成或手动创建 3-5 条 KU。
- KU 未确认前不进入默认调用范围。
- 每个 Chunk / KU 可写入 embedding 记录。
- sqlite-vec 不可用时仍通过 VectorStoreService 降级。
- bge-m3 缺失时仍能完成 mock embedding 和索引状态展示。

### W5：P0-RAG Hybrid Retrieval、Evidence、Citation

目标：已确认知识能通过结构化过滤、全文、向量和关系进入 Evidence Pack。

任务：

- 创建 retrieval_logs；P0-Z0a 不要求持久化 invocation_requests / retrieval_plans。
- 创建 evidence_packs / evidence_items；Z0a 返回 `evidence_item_ids`、`citation_labels` 和 `citation_trace_summary`，`answer_citations` 持久化进入 Z0b。
- 实现 `POST /api/retrieval/preview`。
- 实现 `query_understanding_profile`：意图、`rewrite_status`、关键词、检索范围、约束、输出格式。
- 实现 `retrieval_strategy_profile`：simple_fact / concept_explanation / timeline / file_lookup / relationship_analysis / summary_synthesis / complex_hybrid。
- 在 API response summary 与 retrieval log 中保存 query / strategy / ranking / citation profile；Invocation Request / Retrieval Plan 持久化顺延到 P0-Z2。
- 实现 Evidence Pack build。
- 实现 Evidence Pack 失败态：`no_retrieval_result / insufficient_evidence / permission_blocked / citation_binding_failed / vector_degraded`。
- 接入 bge-reranker-v2 optional；不可用时使用 hybrid merge score。
- 实现 `ranking_profile`：hybrid score + metadata 权重 + source reliability + feedback weight。
- 实现 `citation_trace_profile`：chunk/source/file/page/paragraph/text span。
- 实现 Citation Preview。
- 实现 Query Explanation。
- 默认过滤 user_verified、available_for_agent、permission、status。
- Citation Preview 必须展示 parse warning / chunk quality / source metadata 风险；预览资产不得作为 citation 证据。

验收：

- 未确认 KU 不进入默认结果。
- Evidence Pack 刷新后可复盘。
- Citation Preview 可还原 Source / Chunk / KU。
- Query Explanation 展示 query understanding、strategy route、结构化过滤、关键词、向量、ranking、reranker / merge score 和 fallback 信息。
- 关系分析在 P0 只读取 confirmed relation 或 relation_suggestion evidence，不运行 GraphRAG。
- 有 `chunk_quality_checks.status=warning/failed` 的 evidence item 必须带质量风险提示。
- Evidence Pack 失败时返回可解释失败态，不写 `ai_answer`。

### W6：P0-RAG Answer、反馈回流、E2E 验收

目标：P0 完整链路可演示；Z0a 保持 evidence-only answer，W6 在 Provider 可用时启用 RAG answer，不可用时继续 evidence-only fallback。

任务：

- 实现 `POST /api/rag/answers`。
- 补齐 P0-Z2 的 invocation_requests / retrieval_plans 持久化；Z0a 继续只依赖 `retrieval_log_id` + Evidence Pack。
- Z0a 已创建 `ai_answers(output_type=evidence_only_answer)`；W6 可先返回 response-only `feedback_policy`，P0-Z2 再补齐 memories / retrieval_feedback，并在 Provider 可用时启用 `rag_answer`。
- 实现 evidence-only fallback。
- 实现 Feedback 边界：Z0a 可选写 append-only `feedback_events` 或只返回 feedback actions；Z2 才写 `retrieval_feedback`。
- 实现 `feedback_signal` 与 `feedback_policy`：click / favorite / useful / not_useful / bad_citation / missing_source / downrank_source，只影响后续排序建议，默认 local_only + current_project scope。
- 返回 `implicit_agent` 边界：对话上下文、意图理解、只读规划、内部检索、RAG 问答、内容草稿；禁止外部 API 工具调用、自主执行和多 Agent。
- 实现 Save as Memory Draft。
- 实现 Save as Candidate KU。
- 实现 `GET /api/system/status` 本地汇总：日志模块、异常监控、数据安全、性能成本、系统稳定性。
- 写入日志分类：`user_action`、`auth`、`file_processing`、`ai_call`、`permission_change`、`error`、`performance`、`security`。
- 从 ProcessingJob 和 system_logs 派生上传失败、解析失败、检索失败、RAG answer fallback、队列停滞和高资源任务监控。
- 验证备份 / 恢复 / 删除 / 隐私设置和 sensitive grant 的审计摘要；P0 不强制外部 APM 或云遥测。
- 完成 P0 E2E smoke test。
- 更新 README 启动与验收说明。

验收：

- Provider 可用时返回 `rag_answer`。
- Provider 缺失时返回 `evidence_only_answer` + `rag_provider_missing`。
- Reranker 缺失时返回 hybrid score fallback；GraphRAG 缺失时返回 relation evidence fallback。
- answer / memory / candidate KU 回流必须进入 Review。
- feedback_signal 不自动修改 confirmed KU / relation / source truth。
- 前端能展示上传进度、AI 思考、检索失败、无权限、网络异常、空结果、citation 和反馈按钮状态。
- `/api/system/status` 能返回本地日志、监控、安全、性能成本和稳定性摘要。
- API 耗时、慢查询、AI provider 调用估算成本、存储占用、高资源任务至少进入本地 `system_logs.metadata_json` 或可派生状态。
- 完整 E2E：local_user → upload → verify → parse → chunk → KU → review → embedding → retrieval → evidence → answer/fallback → feedback。

---

## 5. 降级策略

不可降级：

- `files` 与 `sources` 分工。
- 上传任务和状态可追踪。
- 完整性校验。
- Parser/AI 失败可恢复。
- Review 才能确认长期知识。
- `embeddings` 表与 VectorStore 抽象。
- Evidence Pack / Citation 持久化。

可降级：

- 真实登录：disabled contract。
- PDF/Office/Image/Audio/Video parser：开源 adapter 缺失时可恢复失败。
- OCR/ASR：缺 Provider 时返回 `ocr_unavailable` / `asr_unavailable`。
- RAG LLM：缺 Provider 时返回 evidence-only answer。
- sqlite-vec：运行时 fallback ranking。
- 打包：开发模式交付。

---

## 6. 量化验收

| 指标 | 目标 | 说明 |
|---|---|---|
| 冷启动 | < 5 秒 | Electron + sidecar |
| 小文件上传 | < 3 秒 / 2MB | 含入库记录 |
| 1K KU 检索 | < 1 秒 | must |
| 10K KU 检索 | < 1 秒 | pressure target |
| hash 校验失败 | 100% 可解释 | 返回错误码和状态 |
| Parser 失败 | 0 数据丢失 | 文件保留，可重试 |
| RAG Provider 缺失 | 100% fallback | evidence-only answer |

---

## 7. 文档关系

```text
docs/mvp-scope.md
└── P0 范围、四切片、验收标准
docs/data-model.md
└── P0-Z0a / Z0b / Z1 / Z2 对象波次、files/sources 分工、RAG 对象
docs/api-design.md
└── API 语义和错误码
docs/api-implementation-plan.md
└── route-service-repository 映射
docs/rag-pipeline.md
└── hybrid retrieval、answer/fallback、citation
```
