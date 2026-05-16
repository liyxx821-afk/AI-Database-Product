# 技术栈与 P0 原型实施计划

版本：v0.19  
日期：2026-05-17  
状态：已同步——完整 P0 四切片 + P0-Z0a/Z0b 竖切 + ProcessingJob + 切片前准备层 / 结构化整理检查门 + 知识切片质量闭环 + 安全运维横切层 + 技术选型矩阵 + Provider capability 契约收紧 + 切片执行 profile + AI 结构化整理 profile + D-079 存储映射 + D-080 知识调用 / implicit_agent / D-081-D085 调用 schema、反馈策略与前端系统技术矩阵 + D-088 README 对齐后的技术栈优化 + D-090 技术栈执行优化

## 1. 文档目的

本文档把当前文档体系从“架构与接口契约”推进到“可以启动原型工程”的边界。

当前已经存在：

- `docs/product-architecture.md`：产品总架构。
- `docs/data-model.md`：数据模型 v0.19-draft。
- `docs/mvp-scope.md`：P0 / P1 / P2 范围。
- `docs/api-design.md`：P0 API 草案。
- `docs/text-to-sql.md`：P0 查询契约。
- `docs/api-implementation-plan.md`：route-level 实施映射。

但在真正创建工程代码前，还需要明确：

- P0 推荐技术栈；
- 前后端是否分离；
- 本地数据库如何启动；
- mock / rule-based 能力放在哪里；
- 原型目录如何组织；
- P0 实施切片如何排序；
- 每个切片如何验证；
- 哪些能力继续不进入 P0。

本文档不创建代码，不替代后续工程任务，但它是后续代码初始化的直接依据。

---

## 2. 当前结论

P0 原型建议采用：

```text
Desktop Framework: Electron
Frontend: React + TypeScript + Vite (Renderer Process)
Backend: Python + FastAPI (Electron Sidecar)
Database: SQLite + sqlite-vec (P0 本地内嵌，P1 可选迁移 PostgreSQL + pgvector)
Validation: pytest + ruff + frontend typecheck/build
AI: open-source-first ProviderRegistry in P0; missing providers fall back to rule-based / mock / evidence-only modes
```

推荐理由：

- **本产品是桌面软件**（非网页应用、非移动 App），采用 **Electron** 作为桌面框架（详见 `docs/desktop-architecture.md`），面向 macOS / Windows 用户。
- 产品核心包含 ingestion、chunking、Text-to-SQL、RAG、embedding 和后续文档解析，Python 生态更适合长期 AI / 数据处理演进。FastAPI 作为 Electron sidecar 运行。
- 前端需要较强交互：Review Queue、Knowledge Unit Detail、Citation Preview、Query Explanation，React + TypeScript 作为 Electron Renderer Process 更适合快速原型。
- **P0 采用 SQLite + sqlite-vec** 作为本地数据库，零安装成本，完美适配桌面应用。P0 优先使用本地 / 开源 embedding；缺失时使用 `mock_fixed_384` fallback，不需要独立 pgvector 服务。P1 在需要更高性能或多设备同步时可通过 Repository 抽象层迁移到 PostgreSQL + pgvector。
- P0 AI 能力通过开源优先 ProviderRegistry 接入；未配置时用规则、mock 和 evidence-only fallback 稳定数据流、Review、引用和调用解释。
- 桌面软件定位意味着数据默认存储在本地，用户对知识资产拥有完整控制权。P0 核心功能全部离线可用。

### 2.1 向量存储与 RAG 路径（2026-05-12 已确认，D-063）

- **Embedding**：向量写入统一表 `embeddings`（见 `docs/data-model.md` §2.7–2.8）。P0 默认优先 `bge-m3` open-source profile；未配置或不可用时才使用 `mock_fixed_384` fallback 验证链路与索引。所有 embedding record 必须记录 `embedding_profile`、`dimension`、`provider_key`、`capability_status` 和 `fallback_reason`（见 `docs/ai-provider-architecture.md`）。
- **向量库形态**：**非独立向量数据库**。P0 为 **SQLite + sqlite-vec**，向量与业务表、FTS5 全文索引同属一个本地库文件，由检索层做 **混合检索**（Text-to-SQL / 元数据过滤 + 关键词 + 向量 + 关系扩展等）。
- **P0-AI 执行口径**：向量库层是 P0 基础设施，必须包含 `embeddings` 表、`EmbeddingRepository`、向量序列化 / 反序列化、sqlite-vec capability probe 和 `VectorStoreService` 抽象。sqlite-vec 编译或加载失败时只能降级检索实现，不能绕开向量层设计。
- **RAG**：P0-RAG 已包含 Hybrid Retrieval、Evidence Pack、Citation、RAG answer / evidence-only fallback。RAG 依赖 Embedding 与混合检索，**不要求**单独部署 Milvus / Pinecone 等专库。
- **P1 迁移**：优先 **PostgreSQL + pgvector** 保持「一库混合」；仅当规模或运维有强需求时再评估独立向量引擎（本地或托管）。

当前不建议：

- 直接做纯 Next.js fullstack：后续 AI / parsing / RAG 服务容易和前端耦合。
- 直接引入复杂微服务：P0 需要验证闭环，不需要过早拆服务。
- 直接引入 Neo4j、LightRAG 或 GraphRAG 运行时依赖：当前只保留 relation / MOC / evidence 的数据边界。
- 把商业闭源模型作为 P0 必需条件：P0 默认开源优先，本地 / 开源 Provider 不可用时必须可降级。
- P0 直接使用 PostgreSQL：桌面应用用户不应被要求安装和维护数据库服务。

### 2.2 README 对齐后的技术栈优化（D-088）

README 已经把项目定位、P0 四切片、调用边界和默认工具栈写成入口口径。本节将这些口径压缩成后续工程创建时的优先级，避免实现阶段把完整工具矩阵误解为首批必装清单。

优化原则：

1. **先实现闭环，再接增强 Provider**：P0-Z0a 只要求最小可演示链路稳定，真实 embedding、OCR、ASR、reranker 和 LLM 都可以是可选增强。
2. **桌面本地优先，不引入常驻外部服务**：SQLite、local filesystem、local worker 和 SSE 是 P0 默认；Redis、MinIO、PostgreSQL、独立向量库、GraphRAG runtime 都后置。
3. **证据链优先于生成效果**：P0-RAG 的第一目标是 Evidence Pack、Citation Trace、Query Explanation 和 `evidence_only_answer`，不是先追求完整创作型回答。
4. **ProviderRegistry 是边界，不是依赖清单**：业务模块只依赖 capability status 和 profile；PyMuPDF、PaddleOCR、Whisper、bge-m3、bge-reranker-v2 等工具缺失时必须能解释和降级。
5. **前端状态要服务工作台，而不是做营销页**：P0 UI 直接进入 Knowledge Workspace，用任务状态、Review、Citation 和反馈状态驱动页面。

#### P0-Z0a 最小可执行栈

P0-Z0a 是首批工程骨架的 blocking 栈。它只覆盖 README 中的最小端到端链路：

```text
local_user / project / folder / tag
→ upload 或 text_import
→ inspect / parse / chunk
→ candidate KU / review confirm
→ embedding fallback
→ retrieval log / evidence pack / evidence-only answer
```

| 模块 | P0-Z0a 优化选择 | 说明 |
|---|---|---|
| 桌面壳 | Electron Main + secure preload | 先完成 sidecar 生命周期、端口注入、文件选择和基础窗口；自动更新、签名和正式图标后置 |
| 前端 | React + Vite + TypeScript | 直接进入工作台；不做营销首页 |
| 前端状态 | Zustand 管理 workspace / job / retrieval / citation 状态；React Context 只放 API base、auth status、theme 等全局配置 | 比全量 Context 更适合跨页面任务流；仍符合 README 的 React Context or Zustand 口径 |
| API | FastAPI sidecar + Pydantic schema | 先保证 health、auth status、project/folder/tag、source、review、retrieval、rag 基础 route |
| 数据访问 | SQLAlchemy async + aiosqlite + Repository 抽象 | P0 只实现 SQLite repository；P1 再补 PostgreSQL 实现 |
| 迁移 | Alembic + SQLite batch migration | 首批 migration 只放 Z0a blocking 对象，不提前拉入 Z0b/Z1/Z2 全量对象 |
| 存储 | local filesystem + StorageAdapter interface | `tmp/uploads/` 与 `sources/` 本地落盘；S3-compatible adapter 只保留接口 |
| 任务 | `local_sqlite_worker` + ProcessingJob + processing events | 不引入 Redis/Celery；必须支持 lock、heartbeat、retry、active job 幂等 |
| 进度 | SSE + polling fallback | 上传、解析、切片、embedding、answer 均通过 `event_seq` 可恢复 |
| File Inspection | 规则 / 文件头 / MIME / 扩展名 fallback；libmagic 可选 | 先得到 inspection summary；完整安全扫描和高质量预览进入 Z0b/Z1 |
| Parsing | text / Markdown 内置；PDF 文本 PyMuPDF 可选 | Z0a 必须能处理 text_import / Markdown / Plain Text；PDF 解析可作为同轮增强但不能阻塞骨架 |
| Chunking | heading / paragraph / length rule | 记录最小 chunk metadata；完整 `chunk_quality_checks` 在 Z0b 补齐 |
| KU / Review | 手动 + 规则候选；Pydantic / JSON Schema 校验 | 先证明 pending review → confirmed → available_for_agent 的状态流 |
| Tagging | folder mirror tag + rule tags | KeyBERT / HanLP / spaCy 是增强，不阻塞 Z0a |
| Embedding | `embeddings` 表 + `mock_fixed_384` fallback；bge-m3 可用则启用 | 向量层 schema 和接口必须存在，语义质量不以 mock 验收 |
| Retrieval | SQLite FTS5 + metadata filter + vector fallback ranking | 先形成 query explanation 和 evidence pack；sqlite-vec 不可用时仍走 VectorStoreService 降级 |
| RAG / Answer | `evidence_only_answer` | Z0a 不调用 LLM；Provider answer 到 Z2 或显式增强路径 |
| 测试 | pytest + ruff + web typecheck/build + P0 smoke test | 合同测试优先覆盖 error envelope、job state、review、retrieval/evidence |

#### 完整 P0 扩展栈

完整 P0 仍覆盖 README 中的 P0-Core / P0-File / P0-AI / P0-RAG，但应按 Z0b/Z1/Z2 补齐，不进入首批 blocking：

| 能力 | 完整 P0 默认 / 可选工具 | 补齐波次 |
|---|---|---|
| 分片上传 | Uppy + tus-style API | Z0b |
| 文件真实类型识别 | libmagic / python-magic，缺失时 fallback | Z0b |
| 编码检测 | charset-normalizer | Z0b |
| 静态安全检查 | qpdf / oletools / EXIF adapter | Z0b/Z1 |
| 预览 | Pillow / PyMuPDF / openpyxl / FFmpeg | Z0b/Z1 |
| 表格解析 | pdfplumber / openpyxl | Z1 |
| OCR | PaddleOCR，可缺失并返回 `ocr_unavailable` | Z1 |
| ASR | Whisper / FunASR optional，可缺失并返回 `asr_unavailable` | Z1 |
| Cleaning | pandas + Pandera | Z1 |
| 结构化整理 | Pydantic / JSON Schema + Jinja2 / Markdown / YAML Frontmatter + rule profile | Z0b/Z1 |
| 标签增强 | KeyBERT / YAKE / HanLP / spaCy | Z1 |
| Embedding 增强 | `bge_m3_local` 优先，`mock_fixed_384` fallback | Z0b/Z1 |
| Rerank | bge-reranker-v2 optional，缺失回退 hybrid score | Z2 |
| Provider answer | 本地 / 开源 LLM optional；缺失继续 evidence-only | Z2 |
| Feedback / Memory | append-only feedback events；Memory Draft 必须进入 Review | Z2 |

#### P1/P2 后置栈

这些技术只在 README 当前边界外作为演进选项，不应进入 P0 默认依赖：

| 技术 | 后置原因 | 阶段 |
|---|---|---|
| PostgreSQL + pgvector | 多设备同步、高并发或真实向量规模需要时再迁移 | P1 |
| Redis / Celery / Temporal | P0 本地单用户用 `local_sqlite_worker` 足够 | P1/P2 |
| MinIO / S3 / R2 | P0 默认 local filesystem，云对象存储只保留 StorageAdapter contract | P1 |
| Qdrant / Milvus / Weaviate / Chroma / Pinecone | P0 采用主库混合检索，不引入独立向量库 | P2 评估 |
| Neo4j / NebulaGraph / LightRAG / GraphRAG runtime | P0 只保留 relation evidence 和 MOC 边界，不做图增强运行时 | P2 评估 |
| WebSocket 必需通道 | P0 单向进度和状态用 SSE 足够 | P1 |
| 多 Agent / 外部工具执行 | README 已固定 P0 为 `implicit_agent` | P2 |

### 2.3 技术栈执行优化（D-090）

D-090 将 D-088 的优化建议转成工程可执行约束。后续创建代码工程时，应按本节配置依赖、状态、能力探测和验证命令。

#### Python 依赖分组

P0 API 采用 `uv + pyproject.toml`。依赖必须分组，避免 P0-Z0a 被 OCR / ASR / 模型大依赖拖慢。

```toml
[project.optional-dependencies]
core = [
  "fastapi",
  "uvicorn",
  "pydantic",
  "sqlalchemy[asyncio]",
  "aiosqlite",
  "alembic",
]
file = [
  "python-magic",
  "charset-normalizer",
  "pymupdf",
  "pdfplumber",
  "pillow",
  "openpyxl",
]
ai = [
  "pandas",
  "pandera",
  "keybert",
  "spacy",
]
ocr = [
  "paddleocr",
]
asr = [
  "openai-whisper",
]
dev = [
  "ruff",
  "pytest",
  "pytest-cov",
]
```

实施规则：

- P0-Z0a blocking 只安装 `core + dev`，可加最小 `file` 子集用于 text / Markdown / PDF smoke。
- `ocr`、`asr`、真实 embedding、reranker 和 LLM provider 不得成为 W1/W2 必装依赖。
- 缺失 optional 依赖时，ProviderRegistry 返回 `disabled` 或 `unavailable`，业务返回 recoverable error 或 fallback。
- `mock_fixed_384` 不放入 optional dependency，它是系统 fallback profile。

#### 前端状态与请求层

P0 前端采用 `pnpm` 管理 Node 依赖。状态层固定为：

| 类型 | 选择 | 说明 |
|---|---|---|
| 跨页面工作台状态 | Zustand | project、workspace、active source、review queue、retrieval session、citation panel |
| 全局只读配置 | React Context | API base URL、auth status、theme、feature flags |
| API 请求 | typed fetch wrapper | P0-Z0a 保持轻量，统一注入 request_id、error envelope、retry policy |
| 服务端缓存 | 暂不引入 TanStack Query | P0-Z1/Z2 API 数量扩大后再评估 |
| 实时状态 | SSE store | job events、upload progress、retrieval / answer status |

#### sqlite-vec capability probe

后端启动时必须执行 sqlite-vec capability probe，并写入 `/api/system/status` 与 Provider capability summary。

| probe 结果 | 行为 |
|---|---|
| `available` | VectorStoreService 使用 sqlite-vec index |
| `degraded` | 保留 `embeddings` 写入，检索使用 FTS5 + deterministic / merge score fallback |
| `unavailable` | 启动不失败，向量通道在 Query Explanation 中显示不可用和原因 |

禁止行为：

- 禁止因 sqlite-vec 加载失败删除 `embeddings` 表或绕开 VectorStoreService。
- 禁止把 fallback ranking 说成真实语义向量召回。

#### File Inspection 分层

File Inspection 分成两层执行：

| 波次 | 必须做 | 可后置 |
|---|---|---|
| P0-Z0a | 扩展名 / MIME / 文件头摘要、基础 risk summary、可恢复状态 | libmagic、qpdf、oletools、EXIF、preview asset |
| P0-Z0b/Z1 | libmagic / python-magic、charset-normalizer、qpdf / oletools / EXIF adapter、基础 preview | ClamAV、Docker Sandbox、Docling、LayoutParser、复杂视觉模型 |

Parser Router 必须优先消费 inspection summary，但 Z0a 不因高级 inspection adapter 缺失而阻塞 text_import / Markdown / Plain Text 主链路。

#### Evidence-first RAG

P0-Z0a 的 RAG 实现顺序固定为：

```text
retrieval_log
→ evidence_pack
→ evidence_items
→ citation_trace_summary
→ query_explanation
→ ai_answer(output_type=evidence_only_answer)
```

Provider 型 `rag_answer`、Memory Draft、`retrieval_feedback` 和持久化 Invocation / Retrieval Plan 仍在 P0-Z2。任何生成型回答上线前必须先通过 Evidence Pack 和 Citation Trace 验收。

#### 开发命令约定

创建工程后建议统一以下命令名：

```bash
pnpm dev:web
pnpm dev:electron
pnpm build:web
pnpm typecheck

uv run ruff check .
uv run pytest
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
```

根目录可再提供聚合命令：

```bash
pnpm dev
pnpm test
pnpm smoke:p0-z0a
```

---

## 3. 技术栈决策矩阵

| 选项 | 优点 | 风险 | P0 判断 |
|---|---|---|---|
| React + Vite | 启动快、类型清楚、适合工作台 UI | 需要单独后端 | 推荐 |
| Next.js | 全栈体验完整、路由内建 | P0 容易把 API、UI、AI 逻辑耦合 | 暂不优先 |
| FastAPI | AI / 数据处理生态好，OpenAPI 自动化好 | 前后端语言不同 | 推荐 |
| Node.js / TypeScript 后端 | 单语言、前后端类型共享方便 | 文档解析 / AI 原型生态弱于 Python | 备选 |
| PostgreSQL + pgvector | 结构化 + JSONB + FTS + vector 一体 | 桌面应用安装成本高 | **P1 推荐**（真实 embedding 后迁移） |
| SQLite + sqlite-vec | 零配置、内嵌桌面应用，支持本地 / 开源 embedding 或 mock fallback；**与结构化数据同一主库，支撑混合检索与 RAG 向量通道** | 超大规模时或需专库时 P1+ 再评估 | **P0 推荐** |
| AI ProviderRegistry | 支持开源优先、本地模型、商业可选和 fallback | 需要严格权限、Keychain 和质量标记 | **P0 推荐** |
| mock_fixed_384 | 可验证索引和引用链路 | 不代表真实语义召回 | 仅作 P0 fallback，不作为默认语义 profile |

### 3.1 三张技术选型图落地矩阵

本节把最新三张技术选型图转化为 P0 / P1 / P2 的实施口径。P0 的判断标准是：桌面本地优先、FastAPI/Python 生态优先、无额外常驻服务依赖、开源优先、失败可恢复。

| 子系统 | P0 默认 | P1 可替换 / 增强 | P2 / 暂缓 | 决策说明 |
|---|---|---|---|---|
| 文件上传 | Uppy + tus-style chunk upload | Dropzone.js / Resumable.js 可作为轻量替代 | UploadThing / FineUploader | P0 需要分片、断点、进度和失败重试；Next.js 专用上传栈不作为桌面默认 |
| 后端 API | FastAPI sidecar | Django / NestJS 仅在团队栈切换时评估 | Spring Boot | 当前后端主线是 Python AI / parsing 生态 |
| 实时状态 | SSE | WebSocket | Pusher / Socket.IO | P0 主要是上传和处理进度的单向推送，SSE 足够且实现简单 |
| 文件存储 | local filesystem：`tmp/uploads/` + `sources/` | MinIO / Cloudflare R2 / AWS S3 via S3-compatible adapter | 阿里云 OSS / 腾讯云 COS | P0 不强制云存储，但 StorageAdapter 必须兼容 S3 语义 |
| 任务队列 | `local_sqlite_worker` | Celery + Redis | BullMQ / RabbitMQ / Kafka | P0 不引入外部 Redis；队列接口需兼容后续 Celery |
| 真实类型识别 | libmagic / python-magic；缺失时扩展名 + MIME + 文件头签名 fallback | 更完整 magic database / 自定义签名库 | 纯扩展名判断 | Parser Router 必须消费检测结果，扩展名只能作为弱信号 |
| 编码检测 / 修复 | charset-normalizer | chardet | 手写编码猜测 | 文本入库前必须记录 detected_encoding 和 fallback reason |
| 文件安全检查 | qpdf、oletools、EXIF adapter；静态风险检查 | ClamAV optional、exiftool、Docker Sandbox optional | 默认执行宏或未知文件 | P0 不执行文件内容，只记录风险并可阻断解析 |
| 文件结构识别 | PyMuPDF / pdfplumber / openpyxl 基础结构 | Unstructured / Docling / LayoutParser / Detectron2 | 商业文档结构 API | P0 只保证基础结构提示，不承诺生产级版面理解 |
| 切片前准备 | FastAPI service + local_sqlite_worker + Pydantic profile 校验 | Celery / Redis 异步拆分 | Temporal 工作流编排 | P0 先把输入完整性、OCR/版面、策略匹配和结构完整性作为检查门，不拆独立服务 |
| Token 计数 | tiktoken + 规则估算 fallback | tokenizer 按 provider profile 切换 | LLM 动态预算规划 | P0 用于 chunk 长度边界和上下文预算，不代表语义质量 |
| 结构恢复 | PyMuPDF / pdfplumber / openpyxl + YAML/JSON strategy profile | python-docx、Unstructured、Apache Tika、GROBID、BeautifulSoup/lxml | LLM 结构理解 / 复杂版面模型 | P0 优先保留标题、段落、页码、表格、图片位置；复杂恢复进入 P1/P2 |
| 文件预览生成 | Pillow、PyMuPDF 首页、openpyxl 前 N 行、FFmpeg 封面 | 更高质量缩略图队列 / 批量预览 | 商业预览服务 | 预览是 UI 辅助资产，不进入 RAG citation |
| 文档解析 | 内置 text/Markdown；PDF 用 PyMuPDF；表格用 pdfplumber | Unstructured / Docling / Apache Tika / LayoutParser | 商业解析 API | P0 先保证主路径和可恢复失败，不承诺生产级多格式质量 |
| OCR | PaddleOCR | Tesseract fallback；云 OCR 可选 | Google Vision / Azure OCR / 多模态商业 OCR 作为可选 provider | 开源优先；缺失返回 `ocr_unavailable` |
| ASR | Whisper | FunASR（中文增强） | Azure Speech / Deepgram / AssemblyAI | 开源优先；缺失返回 `asr_unavailable` |
| 图片理解 | OCR + CLIP/BLIP-2/Florence-2 adapter contract | GPT-4o / Claude / Gemini 可选 | 复杂视觉推理 | P0 以图片文字、描述和图向量为主 |
| 视频处理 | FFmpeg 抽帧/元数据 | PySceneDetect 场景切分 | Video-LLaVA / Gemini Video | P0 不做完整视频理解，只保证文件不丢和状态可恢复 |
| 数据清洗 | pandas + Pandera | Polars / DuckDB | Great Expectations | P0 清洗关注去重、空值、类型修复、标准化和异常检测 |
| 切片策略 | 规则 + 文档结构 + 长度边界；`p0_rule_text_v1` / `p0_structure_aware_v1` | LangChain Text Splitter adapter / LlamaIndex Node Parser adapter / embedding semantic chunking / LLM context summary | 端到端自动语义重写 | P0-Z0a 先可运行，Z0b 补 strategy profile、source metadata 和 quality summary |
| 切片执行 Profile | 规则文本切片、tiktoken/规则 token 估算、PyMuPDF / pdfplumber / openpyxl、pandas / Pandera、KeyBERT / HanLP / spaCy | LangChain RecursiveCharacterTextSplitter / LlamaIndex Node Parser / sentence-transformers / BGE text2vec / CLIP / BLIP / Florence adapter | Table Transformer、LLM semantic chunking、LLM context expansion、reranker quality review | D-076 只记录 `chunk_execution_profile` 和 adapter，不新增 P0 capability、服务或表 |
| Chunk Quality | length / source trace / context / duplicate / readability rule checks | LLM evaluator / reranker 复核 | 人工大规模语义评分平台 | 质量信号写 `chunk_quality_checks`，不只写日志 |
| 结构化整理检查门 | 内容理解、摘要、关键词、字段生成、知识卡片、分类标签、关系建议均写 provider/fallback/quality 记录 | LLM schema mapping / reranker quality review | 自动本体构建 | P0 允许规则或 pending review；不得把未检查结果直接写 confirmed KU |
| AI 结构化整理 Profile（D-077/D-079） | Pydantic / JSON Schema、Jinja2 / Markdown / YAML Frontmatter、KeyBERT / YAKE、spaCy / HanLP、rule / LLM optional；摘要/标签/分类/字段/卡片/实体关系均写入 `structured_organization` 子字段 | LlamaIndex、LangChain Structured Output、Instructor / Guardrails、BGE / Sentence-Transformers、BERTopic、NetworkX / RDFlib | Neo4j / Graph DB、自动本体构建、商业 LLM 编排 | P0 只生成 KU / tag / card / relation 候选；关系建议进入 Review，不直接写 confirmed relation |
| Metadata / 标签 | KeyBERT + HanLP/spaCy + rule/LLM optional | Presidio 敏感信息识别 | 复杂本体/知识图谱自动构建 | 标签建议必须可审查、可编辑、可回滚 |
| Embedding | bge-m3 open-source profile；缺失 `mock_fixed_384` | jina-embeddings-v3 / bge-large-zh / E5-Mistral | OpenAI / VoyageAI 作为可选商业 provider | P0 不以商业 embedding 为必要条件 |
| Vector Store | SQLite + sqlite-vec | PostgreSQL + pgvector | Qdrant / Weaviate / Milvus / Pinecone / Chroma | P0 保持主库混合；独立向量服务不进入默认架构 |
| 数据库存储系统映射（D-079） | local StorageAdapter + SQLite 主库：`files`、`sources/chunks`、metadata_json/tags、`embeddings`、`review_tasks`、`feedback_events/audit_logs`、`processing_jobs/events` | PostgreSQL + pgvector / MinIO / Redis queue | MongoDB、Qdrant / Milvus / Weaviate / Chroma、Neo4j / NebulaGraph、Temporal | 新图中的数据库模块是逻辑职责，不替换 P0 技术栈 |
| 知识调用 / 问题理解 | `query_understanding_profile`：规则 / 模板 intent、query rewrite、keyword、scope、constraint、output format；LLM 只做 optional provider | LLM Router / prompt rewrite adapter | 自主 planner | P0 默认不依赖 LLM；query rewrite 缺失时仍能规则路由 |
| 调用 Profile Schema（D-082） | `InvocationProfileSchema v1`：`profile_envelope`、`rewrite_status`、`source_reliability_score` / `source_reliability_label` | Provider-specific profile adapter | 自主 planner schema | Profile 名称和字段必须成为 API / 数据模型 / 测试 fixture 的单一口径 |
| 检索策略路由 | `retrieval_strategy_profile`：FTS5/BM25、sqlite-vec、metadata filter、source/file index、confirmed relation / relation_suggestion `relation_evidence`、hybrid search | summary chain / richer relation expansion | GraphRAG / Learning-to-Rank / 外部图数据库 | 简单事实走 BM25，概念解释走向量，时间线走 metadata，文件定位走 source/file index，复杂问题走 hybrid |
| Ranking / Feedback | `ranking_profile`：hybrid score + metadata 权重 + source reliability + feedback weight；`feedback_signal` 写本地事件 | bge-reranker-v2 / jina-reranker / personalized ranking adapter | Learning-to-Rank 平台 | 反馈只影响后续排序建议，不自动改写 confirmed knowledge |
| Citation Trace | `citation_trace_profile`：Chunk ID、Source/File、页码、段落、text span、source reliability | 更精细 PDF/text span viewer | 自动证据真实性评分平台 | 预览、摘要、知识卡片不能替代 Source / Chunk / KU citation |
| Reranker | bge-reranker-v2 optional | jina-reranker | Cohere Rerank 商业可选 | 缺失时回退 hybrid merge score |
| RAG 编排 | 自研 Hybrid Retrieval + Evidence Pack + Citation + evidence-only / provider answer | LlamaIndex / LangChain adapter | Haystack / DSPy / LangGraph runtime | P0 证据链和数据模型优先，不把框架绑定进核心域 |
| Text-to-SQL | 只读模板 + SQL 安全校验 | Vanna / LlamaIndex SQL / LangChain SQL Agent | DB-GPT | P0 不允许模型自由猜表或生成写 SQL |
| AI 智能体 | `implicit_agent`：隐式单 Agent、对话上下文、意图理解、只读规划、内部工具调用、RAG 问答、内容草稿 | LangGraph / Agent Planner / 工具选择 adapter | 多 Agent 自主执行 / 外部 API 工具执行 / 生产级任务编排 | P0 是受控调用边界，不是完整自主 Agent |
| 前端页面 | Electron + React + Vite + TypeScript；AI 工作台首页、项目选择、上传资料、文件管理、知识库、对话/RAG、引用与查询解释、数据可视化入口、设置页 | 更复杂图谱交互 / WebSocket 双向事件 / Redux | Vue / Next.js 作为未来替代栈评估 | P0 保持桌面本地优先和 React/Electron 路线 |
| 前端交互与状态（D-083） | React Context 或 Zustand、fetch/Axios、SSE、Toast、Error Boundary、Loading Skeleton、Auth Guard、`FrontendStateContract` | WebSocket / TanStack Query / 更细粒度状态机 | 多端协同状态 | P0 必须覆盖上传进度、AI 思考、检索失败、无权限、网络异常、空结果、citation 展示和反馈按钮 |
| 长期记忆 | `memories` 表 + Review | Mem0 / Zep / LangMem 评估 | 多 Agent 自动记忆 | P0 防止无控制记忆污染 |
| 日志模块 | 本地 `audit_logs` / `system_logs` / `processing_status_events` | OpenTelemetry trace contract | 云日志平台 | P0 分类记录 user_action/auth/file_processing/ai_call/permission_change/error/performance/security |
| 异常监控 | 从 ProcessingJob 和错误事件派生本地 monitors | Sentry / OpenTelemetry | 企业级告警平台 | P0 覆盖上传、解析、检索、RAG answer、系统报错、队列停滞 |
| 数据安全 | 权限/访问控制、sensitive grant、Keychain、备份/恢复/删除/隐私设置 contract | SQLCipher / ClamAV / Docker Sandbox | 企业 DLP / SIEM | P0 不强制 DB 全量加密或 daemon，但必须记录能力状态 |
| 性能成本 | system_logs 本地汇总 API 耗时、慢查询、AI 调用估算成本、存储占用、高资源任务 | Prometheus / Grafana | 云成本平台 | 桌面 P0 默认不上传遥测 |
| 系统稳定性 | health check、local_sqlite_worker heartbeat、失败任务重试、限流、本地告警 | Celery + Redis 监控 | Temporal 工作流编排 | P0 先保证可恢复和可解释 |

### 3.2 P0 默认工具栈摘要

```text
Upload: Uppy + tus-style API + SSE progress
Backend: FastAPI sidecar
Storage: local filesystem + S3-compatible StorageAdapter contract
Queue: local_sqlite_worker + Celery-compatible TaskQueueAdapter contract
Inspection: libmagic/python-magic + charset-normalizer + qpdf/oletools/EXIF + preview adapters
Parsing: Parser Router + PyMuPDF/pdfplumber + recoverable optional adapters
Chunk preparation: FastAPI service + local_sqlite_worker + tiktoken + YAML/JSON profile + Pydantic validation
Structure recovery: PyMuPDF/fitz + pdfplumber + openpyxl; python-docx/Unstructured/Tika/GROBID/BeautifulSoup/lxml optional adapters
Cleaning: pandas + Pandera
Metadata/Tags: KeyBERT + HanLP/spaCy + optional LLM provider
Embedding: bge-m3 if available, otherwise mock_fixed_384
Vector: SQLite + sqlite-vec
Rerank: bge-reranker-v2 if available, otherwise merge score
Invocation: query_understanding_profile + retrieval_strategy_profile + ranking_profile + citation_trace_profile
RAG: Hybrid Retrieval + Evidence Pack + Citation + evidence-only / provider answer
Agent: implicit single agent only; internal read-only tool calls
Frontend: Electron + React + Vite + TypeScript + Zustand + typed fetch wrapper + SSE + Toast/Error Boundary/Loading Skeleton
```

### 3.3 Embedding profile 与维度契约

P0 不再把 `mock_fixed_384` 当作当前默认 embedding 结论。当前冻结口径如下：

| profile_key | provider_key | dimension | 用途 | capability_status |
|---|---|---:|---|---|
| `bge_m3_local` | `bge-m3` | runtime probe | P0 默认开源语义向量候选 | available / unavailable |
| `mock_fixed_384` | `mock` | 384 | provider 缺失、禁用或测试环境的最终 fallback | fallback |

实施规则：

- `embedding_profile` 必须来自 profile registry / manifest，不允许 route 或 service 临时硬编码维度。
- `dimension` 由实际 profile 决定；384 只属于 `mock_fixed_384`，不是 P0 全局默认。
- sqlite-vec index 必须和 dimension 一致。P0 可以先限制单一 active profile；若同时保留多维度向量，必须按 `vector_index_name` 或等价机制分 index / table。
- 重建 embedding 时，profile 或 dimension 变化必须让旧记录进入 `stale`，不能混用不同维度向量参与同一次 vector search。

### 3.4 local_sqlite_worker + SSE 可恢复状态契约

P0 的 `local_sqlite_worker` 不是一次性脚本，而是可恢复任务执行器。所有上传、完整性校验、解析、切片、embedding、evidence-only / RAG 生成相关长任务都遵循：

- `ProcessingJob` 保存当前快照：`status`、`attempt_count`、`locked_by`、`locked_until`、`last_event_id`、`error_code`；P0 物理表可暂用 `ingestion_jobs`。
- `processing_status_events` 保存事件流：同一 job 内单调递增 `event_seq`、`event_type`、`progress`、`capability_status`、`fallback_reason`、`payload_json`。
- SSE 使用 `event_seq` 作为 `id:`；客户端断线后通过 `Last-Event-ID` 续读，失败时回退到 `GET /api/uploads/{id}` 或对应 job snapshot。
- worker 获取任务必须写锁和心跳；锁超时后任务可被重新领取，重试次数超过阈值进入 `failed_recoverable` 或 `failed_final`。
- `inspect / preview / parse / embed / rag_answer` 默认按 `(target_type, target_id, job_type)` 幂等复用 active job，只有 `force=true` 且无 active job 时才创建新 job。
- provider 缺失不得吞掉文件：文件和 source 记录保留，任务进入可恢复状态并写入 fallback / unavailable event。

### 3.5 File Inspection 层

File Inspection 位于上传完成之后、Parser Router 之前。它把“文件是什么、是否安全、能否预览、有什么结构”统一成 `FileInspectionReport`，供 Parser Router、前端预览、Review 和错误恢复使用。

默认流水线：

```text
upload complete
→ true type detection
→ encoding detection / normalization
→ security scan / risk policy
→ structure detection
→ preview generation
→ Parser Router
→ parse / chunk / KU / embedding / RAG
```

P0 规则：

- Parser Router 必须优先使用 `detected_mime_type`、`file_signature`、`risk_level` 和 inspection result；扩展名只作为弱信号。
- 风险等级固定为 `safe / warning / blocked / quarantined`。`blocked` 和 `quarantined` 默认不进入 parse，但保留原文件、metadata 和可恢复动作。
- 预览资产只用于 UI 和 Review，不替代 Source / Chunk / Knowledge Unit，也不作为 RAG citation。
- ClamAV、Docker Sandbox、Docling、LayoutParser、Detectron2、Video-LLaVA 和商业视觉模型不作为 P0 必装依赖；缺失时写 capability status，不影响静态检查主路径。

---

## 4. 推荐原型目录

本产品是 Electron 桌面应用，采用 monorepo 组织。目录结构详见 `docs/desktop-architecture.md` §11，核心结构：

```text
electron/
├── main.ts                (Electron 主进程)
├── preload.ts             (预加载脚本)
├── sidecar.ts             (FastAPI sidecar 管理)
└── ipc-handlers.ts        (IPC 消息处理)
apps/
├── web/
│   ├── src/
│   │   ├── components/
│   │   ├── features/
│   │   │   ├── projects/
│   │   │   ├── uploads/
│   │   │   ├── files/
│   │   │   ├── sources/
│   │   │   ├── parsing/
│   │   │   ├── knowledge-units/
│   │   │   ├── review/
│   │   │   ├── retrieval/
│   │   │   ├── rag/
│   │   │   └── invocation/
│   │   ├── services/
│   │   ├── routes/
│   │   ├── types/
│   │   └── utils/
│   ├── package.json
│   └── vite.config.ts
├── api/
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   ├── schemas/
│   │   │   └── responses.py
│   │   ├── modules/
│   │   │   ├── uploads/
│   │   │   ├── files/
│   │   │   ├── ingestion/
│   │   │   ├── parsing/
│   │   │   ├── cleaning/
│   │   │   ├── source_description/
│   │   │   ├── chunking/
│   │   │   ├── knowledge_units/
│   │   │   ├── review/
│   │   │   ├── embeddings/
│   │   │   ├── retrieval/
│   │   │   ├── rag/
│   │   │   ├── text_to_sql/
│   │   │   ├── invocation/
│   │   │   ├── evidence/
│   │   │   ├── feedback/
│   │   │   ├── providers/
│   │   │   ├── storage/
│   │   │   ├── tasks/
│   │   │   └── audit/
│   │   ├── repositories/
│   │   ├── db/
│   │   ├── config/
│   │   └── main.py
│   ├── tests/
│   └── pyproject.toml
database/
├── migrations/
├── views/
└── seeds/
scripts/
├── dev/
└── validation/
docs/
```

说明：

- `apps/web` 只负责用户界面和 API 调用。
- `apps/api` 负责业务流程、数据访问、mock/rule 模块和 OpenAPI。
- `database` 保留迁移、只读视图和 seed 数据。
- `scripts` 保留开发启动和验证脚本。
- `docs` 继续作为产品、架构和实施契约来源。

如果第一版需要更轻，可以先只创建：

```text
apps/web
apps/api
docs
```

但不要把前端页面、API route、数据库访问和 mock 规则都堆在一个文件中。

---

## 5. P0 原型实施边界

### 5.1 P0 四切片必须实现

P0 原型必须覆盖以下完整闭环：

```text
local_user / auth preembed
→ Project / Folder + Mirror Tag
→ Upload / text_import
→ File / Integrity Check
→ Source Description
→ Parse / Clean
→ Chunk
→ Candidate Knowledge Unit
→ Review Confirm
→ Embedding / VectorStore
→ Hybrid Retrieval
→ Evidence Pack / Citation
→ RAG answer or evidence-only fallback
→ Feedback / Memory Draft
```

P0 不再拆成 P0-A/P0-B 延后调用域；调用、证据、RAG answer 和回流都属于 P0-RAG。

### 5.2 P0 开源优先 + 可降级

| 能力 | P0 实现方式 |
|---|---|
| Source Description | 开源优先 / 规则 fallback |
| File Parsing | Parser Router；Markdown/text 内置，PDF 用 PyMuPDF，表格用 pdfplumber；不支持格式可恢复失败 |
| OCR / ASR / 多模态 | PaddleOCR / Whisper 优先；缺失时返回 `ocr_unavailable` / `asr_unavailable` |
| Chunking | heading / paragraph / semantic rule / max length rule，记录 `chunk_strategy_profile`、`chunk_execution_profile`、`chunk_type`、`context_summary`、`source_metadata` 和 chunk quality |
| Cleaning | pandas + Pandera 做去重、空值、类型修复、标准化、异常检测 |
| Candidate KU | 开源优先结构化抽取 + 用户手动 + 规则/mock fallback |
| Tags / Type 推荐 | KeyBERT + HanLP/spaCy + 规则/LLM optional |
| Embedding | `bge_m3_local` open-source profile 优先；缺失时 `mock_fixed_384` fallback |
| Rerank | bge-reranker-v2 optional；缺失时回退 hybrid merge score |
| Text-to-SQL | template SELECT / mock query plan |
| Evidence Gap | rule-based |
| Answer | `rag_answer` 或 `evidence_only_answer` |

Chunking 的 P0 默认阶段：

```text
P0-Z0a: rule + structure + length bounds
P0-Z0b: preparation_profile + content_kind + chunk_strategy_profile + context_summary + source_metadata + chunk_quality_checks
P0-Z1: semantic chunking + structured table chunks + multimodal transcript chunks
P0-Z2: LLM summary / LLM quality evaluation / reranker review
```

D-076 收敛后的 `chunk_type` 只允许 `text_semantic`、`structured_table`、`image_ocr`、`audio_transcript`、`video_scene`、`mixed`。这些类型对应执行 profile，而不是新的 P0 平台层；LangChain、LlamaIndex、sentence-transformers、LLM、reranker、CLIP、PaddleOCR 等缺失时必须回退到规则切片或 pending review，并记录 `fallback_reason`。

### 5.3 P0 不实现

P0 不实现：

- 生产级线上账号；
- 云同步 / 云备份；
- 自动网页抓取；
- Obsidian Vault 双向同步；
- 商业闭源模型作为必需条件；
- Agent tool execution；
- 多 Agent 自主执行、外部 API 工具调用、生产级任务编排；
- 团队协作权限；
- 图数据库；
- GraphRAG / LightRAG runtime；
- Learning-to-Rank 平台或外部图数据库；
- WebSocket 作为必需状态通道，P0 默认 SSE。

---

## 6. P0 实施切片

### 6.1 P0-0 工程骨架

目标：

- 建立 `apps/web` 和 `apps/api`；
- 建立统一配置；
- 建立 health check；
- 建立数据库连接；
- 建立基础测试命令。

验收：

- API health check 返回成功；
- Web dev server 能启动；
- lint / typecheck / pytest 基础命令存在。

### 6.2 P0-1 Project / Folder / Tag

目标：

- 创建 Project；
- 创建 Folder；
- 自动创建 folder mirror tag；
- 查询 Tags。

验收：

- Folder 创建后能查到对应 mirror tag；
- folder tag namespace 与普通 topic tag 可区分。

### 6.3 P0-2 Upload / File / Source / Chunk

目标：

- 实现 Uppy + tus-style upload 的 `POST /api/uploads`、`PUT /api/uploads/{id}/parts/{part_no}`、`:complete`；
- 实现 SSE 进度和 `GET /api/uploads/{id}` 轮询兜底；
- 通过 StorageAdapter 把文件从 `tmp/uploads/` 移动到 `sources/`；
- 完成完整性校验，创建 File；
- 通过 Parser Router 创建 Source；
- Markdown/text 内置解析；PDF 使用 PyMuPDF/pdfplumber；其他格式进入可恢复失败；
- 实现 `POST /api/sources/text-import`；
- `text_import` 作为无物理文件的同管线入口创建 Source；
- 规则生成 Source Description；
- 规则切分 Chunk；
- 生成 embedding record（bge-m3 可用时真实向量；否则 `mock_fixed_384`）。

验收：

- 小文件直传、大文件分片和 hash mismatch 状态可解释；
- 输入 Markdown / Plain Text 或上传 PDF 文本后能产生 Source、Source Description 和 Chunk；
- 不支持的 `source_origin` 返回错误；
- 不支持格式返回 `unsupported_parser`，文件保留；
- embedding provider 缺失时标记为 `mock_fixed_384`。

### 6.4 P0-3 Knowledge Unit / Review

目标：

- 手动创建 Candidate Knowledge Unit；
- 可通过开源优先 / 规则 / mock 提取候选 KU；
- pandas + Pandera 清洗内容；
- KeyBERT + HanLP/spaCy + 规则推荐标签；
- 关联 Chunk 和 Tag；
- 创建 Review Task；
- Review confirm 后进入 confirmed。

验收：

- 新 KU 默认 `pending_review`；
- confirm 后 `user_verified=true`；
- `available_for_agent=true` 只允许在权限检查通过后生效；
- `do_not_use` 不进入默认调用范围。

### 6.5 P0-4 Retrieval Preview / Text-to-SQL Template

目标：

- 实现检索预览；
- 根据 `query_understanding_profile` 判断 intent、keyword、scope 和 output format；
- 根据 `retrieval_strategy_profile` 选择 simple_fact / concept_explanation / timeline / file_lookup / relationship_analysis / summary_synthesis / complex_hybrid 路径；
- 使用 metadata / tag / status / permission filter；
- 写入 RetrievalLog，并记录 `ranking_profile`、`citation_trace_profile` 和 `feedback_signal` 摘要。

验收：

- 未确认 KU 默认不会进入结果；
- Query Explanation 显示 scope、filter、template、vector profile、reranker/merge score 和 fallback reason；
- Retrieval Preview 返回 query_understanding、strategy_route、ranking_summary、citation_trace_summary 和 feedback_actions；
- SQL 模板只允许 SELECT。

### 6.6 P0-RAG Invocation / Evidence / Citation

前置条件：P0-Core、P0-File、P0-AI 基本链路可稳定复盘。

目标：

- 创建 Invocation Request；
- 创建 Retrieval Plan；
- 构建 Evidence Pack；
- 创建 Evidence Items；
- 展示 Citation Preview 和 Query Explanation。
- 展示 Chunk ID、Source/File、页码/段落/text span、citation confidence 和 source reliability。

验收：

- Evidence Pack 可刷新后复盘；
- Citation Preview 能还原 Knowledge Unit、Chunk、Source；
- 预览、摘要和知识卡片不得替代 citation；
- Evidence Pack 可作为 RAG answer 和 evidence-only answer 输入。

### 6.7 P0-RAG Answer / Feedback / Memory Draft

前置条件：Evidence Pack 和 Evidence Items 已能持久化。

目标：

- 保存 Retrieval Feedback；
- 保存 Memory Draft；
- 从 mock answer / retrieval preview 回流 Candidate KU。
- 返回 `implicit_agent` 边界，P0 仅允许隐式单 Agent 的只读规划、内部检索、RAG 问答和草稿生成。

验收：

- Feedback 不直接改变主知识库；
- `feedback_signal` 只影响后续排序建议和诊断，不改写 confirmed knowledge；
- Memory Draft 进入 Review；
- from-answer KU 保留 evidence links。

---

## 7. P0 数据库与迁移建议

P0 采用 **SQLite + sqlite-vec**（详见 `docs/desktop-architecture.md` §4）。

```text
SQLite 3.40+
sqlite-vec（向量索引扩展；可接真实 profile 或 mock fallback）
```

数据文件位置由 Electron 主进程管理，默认在用户数据目录下创建：

```text
macOS:   ~/Library/Application Support/KnowledgeBase/data/knowledge.db
Windows: %APPDATA%/KnowledgeBase/data/knowledge.db
```

推荐保留：

```text
database/migrations
database/views
database/seeds
```

P1 迁移到 PostgreSQL + pgvector 的条件：需要真实 embedding provider 的高性能向量搜索，或需要多设备同步。迁移通过 Repository 抽象层实现。

迁移优先顺序：

P0 必建迁移按四个切片组织，但首批 blocking migration 只覆盖 P0-Z0a；Z0b/Z1/Z2 按 `docs/data-model.md` v0.19-draft 波次补齐。D-080-D085 的调用 profile、Z0a 锚点、feedback policy 和 citation trace 复用现有 retrieval / evidence / answer / feedback JSON 字段，不新增迁移波次。

1. P0-Z0a：users / projects / folders / tags / upload_tasks / files / file_integrity_checks / file_inspection_results / processing_jobs / processing_status_events / sources / parse_tasks / parse_warnings / chunks / knowledge_units / knowledge_unit_chunks / embeddings / review_tasks / retrieval_logs / evidence_packs / evidence_items / ai_answers。
2. P0-Z0b：user_profiles / auth_identities / roles / access_policies / upload_parts / source_descriptions / chunk_quality_checks / knowledge_unit_tags / answer_citations / sensitive_access_grants / audit_logs / system_logs。
3. P0-Z1：quality_events / knowledge_relations / 上传恢复增强 / 完整 File Inspection report。
4. P0-Z2：invocation_requests / retrieval_plans / memories / retrieval_feedback / Provider 型 RAG answer 复盘。

说明：

- `files` 表达物理文件对象，`sources` 表达语义来源；`text_import` 是同一入库管线的无物理文件变体。
- P0-Z0a 的 retrieval log / Evidence Pack / Evidence Item / evidence-only answer 必须持久化，不能只保存在前端临时状态；Invocation / Retrieval Plan / Memory / `retrieval_feedback` 按 D-085 顺延到 P0-Z2。
- `audit_logs` 默认不作为普通 Text-to-SQL 查询对象。
- Repository 抽象层在 P0 只负责隔离业务流程、参数化 SQL 和事务边界，不要求同时实现 SQLite / PostgreSQL 双后端。P1 迁移时再补方言适配和数据迁移工具。

---

## 8. P0 验证命令建议

后续代码阶段建议至少保留这些命令。

### 8.1 API

```bash
cd apps/api
uv run ruff check .
uv run pytest
python -m app.db.migrate  # SQLite 迁移
```

如果不用 `uv`，可以替换为项目实际 Python 包管理器，但验证语义不变：

```text
lint
unit tests
migration apply (SQLite)
```

### 8.2 Web

```bash
cd apps/web
npm run lint
npm run typecheck
npm run build
```

### 8.3 集成验证

建议保留一条 P0 smoke test：

```text
local_user / auth status
upload or text_import
verify file / create source
parse / clean / chunk
extract candidate KU
confirm review
build embedding
hybrid retrieval
evidence pack
RAG answer or evidence-only fallback
```

同时保留调用回流 smoke test：

```text
create invocation
build evidence pack
get citation preview
create answer/fallback
submit feedback
create memory draft
```

---

## 9. API 与 OpenAPI 路线

FastAPI 会自动生成 OpenAPI，但不能只依赖自动生成。

P0 应保证：

- DTO schema 与 `docs/api-design.md` 一致；
- route/service/repository 分层与 `docs/api-implementation-plan.md` 一致；
- Text-to-SQL 模板与 `docs/text-to-sql.md` 一致；
- P0 禁止项在 OpenAPI 中不暴露，或明确标记为 disabled/future；
- contract test 覆盖核心错误码。

首批需要覆盖的错误码：

```text
validation_error
not_found
permission_denied
unsupported_source_origin
review_required
agent_call_not_allowed
mock_only
unsupported_parser
parser_unavailable
ocr_unavailable
asr_unavailable
rag_provider_missing
```

---

## 10. 原型 UI 边界

P0 UI 不做营销首页，直接进入工作台。

P0 推荐页面：

```text
Dashboard
Project List
Project Workspace
Source Detail
Knowledge Unit Detail
Review Queue
Retrieval Preview
Invocation / Evidence Preview
RAG Answer / Evidence Preview
Memory Draft Review
```

P0 UI 必须突出：

- Source / Chunk / Knowledge Unit 的区别；
- Review 状态；
- folder mirror tag；
- Retrieval Preview、Citation Preview 和完整 Query Explanation；
- RAG answer / evidence-only fallback 的来源解释；
- mock / rule-based 标记。

P0 UI 不做：

- 完整创作编辑器；
- 多 Agent 自动任务；
- 复杂图谱可视化；
- 团队权限管理；
- 插件市场；
- 大型仪表盘装饰。

---

## 11. 实现前冻结清单

进入代码前建议冻结（与 `docs/mvp-scope.md` §10 和 `docs/data-model.md` §11 保持一致）。冻结项分为两类：

- **Blocking freeze**：未确认则不进入 P0-Core W1 工程骨架。
- **Non-blocking freeze**：可以用占位或降级方案进入 W1，但正式分发或 P0-File / P0-RAG 可演示前必须确认。

P0-Core W1 的 blocking freeze 只包括：技术栈、P0-Z0a 竖切 schema、P0 核心 API、permission 枚举、上传 / text_import 输入模型、KU 最小字段、Review Action、common error envelope、通用 job/event API、P0 smoke test、开发期数据目录 / Bundle ID 占位。其余冻结项不得阻塞 Core 开工。

P0-Z0a 竖切冻结口径：

```text
local_user / project / folder / tag
→ upload 或 text_import
→ verify / inspect job
→ parse / chunk
→ candidate KU / review confirm
→ embed job
→ retrieval log / evidence pack / evidence-only answer（不调用 LLM）
```

P0-Z0b 补齐账号预埋 schema、分片恢复、source description、citation 明细、sensitive grant 和审计日志；P0-Z1 补齐入库增强，P0-Z2 补齐 invocation / memory / feedback / RAG provider 复盘。完整 P0 仍进入架构范围，但不得把 Z0b/Z1/Z2 对象放入 W1 blocking migration。

### 11.1 技术栈与工程

1. 技术栈：Electron + React + Vite + TypeScript + FastAPI (sidecar) + SQLite + sqlite-vec（P0；D-029 / D-039 / D-040）。
2. **向量与 RAG 存储策略（D-063）**：主库混合——`embeddings` + sqlite-vec + FTS5 + 结构化查询；P0 不引入独立向量数据库；P1 优先 PostgreSQL + pgvector。
3. Repository 抽象层接口契约（详见 `docs/api-implementation-plan.md` §11）。
4. Schema 迁移工具：Alembic + 自动备份 + 失败回滚（D-047）。
5. 桌面安全基线（D-048）+ Keychain Key 存储（D-049）+ AI Provider 抽象（D-050）。
6. 测试金字塔 + P0 fixture（D-054）。
7. P0 smoke test 流程（local_user → upload → verify → parse → chunk → KU → review → embedding → retrieval → evidence → answer/fallback → feedback）。
补充冻结项：**技术选型细化（D-067）** 已确认 Uppy + tus-style upload、SSE、local filesystem + S3-compatible adapter、local_sqlite_worker、PyMuPDF/pdfplumber、PaddleOCR/Whisper、pandas/Pandera、KeyBERT/HanLP/spaCy、bge-m3、bge-reranker-v2 作为 P0 默认或可选开源能力；缺失时必须记录 capability status 和 fallback reason。

补充冻结项：**File Inspection 细化（D-069）** 已确认 libmagic/python-magic、charset-normalizer、qpdf、oletools、EXIF adapter、Pillow、PyMuPDF、openpyxl、FFmpeg 作为 P0 默认或可选本地能力；ClamAV、Docker Sandbox、Docling、LayoutParser、Detectron2、Video-LLaVA 不作为 P0 必装依赖。

### 11.2 数据模型

8. P0 输入：上传文件 + `text_import`，进入同一入库管线。
9. `files` 与 `sources` 分工。
10. upload / receive / integrity / parse / ingest / RAG 状态枚举。
11. File Inspection：`file_inspection_results`、risk_level、risk_flags、preview_status、inspection_status 汇总规则、Parser Router 前置规则。
12. Source Description P0 字段。
13. Knowledge Unit P0 字段（最小集）。
14. Review Action 枚举。
15. Relation Type 枚举（含 `solves`）。
16. Embedding profile registry：P0 默认 `bge_m3_local` 可用则使用真实开源向量；`mock_fixed_384` 仅作 fallback，`dimension` 必须随 profile 记录，不能全局默认为 384。
17. `AIAnswer.output_type` P0 允许 `retrieval_preview` / `mock_answer` / `evidence_only_answer` / `rag_answer`；P0-Z0a 只启用 `evidence_only_answer`，不调用 LLM。
18. 三个只读视图字段（v_knowledge_units_with_tags / v_retrieval_evidence / v_invocation_evidence）。
19. 表分层：P0-Core / P0-File / P0-AI / P0-RAG，并标注 P0-Z0a / Z0b / Z1 / Z2 迁移波次。

### 11.3 权限与 Agent

20. `permission` P0 简化 3 值（`normal / sensitive / do_not_share`）（D-051）。
21. `permission_mode`：`agent_default / user_preview / explicit_sensitive_confirmed`；sensitive 进入 Evidence Pack 必须有未过期、未撤销、scope 匹配且一次性的 `sensitive_access_grant_id`。
22. 桌面单用户假设 + business 表 `user_id` 预埋（D-051）。
23. 账号预埋对象与 `auth_not_enabled_in_p0` 行为。
24. Personal Agent 实体 P0 schema-only 预埋（D-052）。

### 11.4 API 契约

25. Common response / error schema，以 `docs/error-handling-and-observability.md` 为唯一来源。
26. 通用 Job API：`GET /api/jobs/{id}`、`GET /api/jobs/{id}/events`，上传事件 API 仅作别名。
27. P0 业务 API 边界（详见 `docs/api-design.md` §5-§16）。
28. **桌面系统 API 边界**（详见 `docs/api-design.md` §16）：health / system / data-dir / backups / exports / settings / ai-providers / onboarding。
29. 错误码白名单（含 P0 系统层错误码）。

### 11.5 产品包装

30. 应用品牌与 Bundle ID（详见 `docs/desktop-architecture.md` §14.1）：P0-Core W1 前至少敲定开发期占位名；正式品牌、正式 Bundle ID、正式图标在外部分发前冻结。

Blocking freeze 未完成时不建议创建代码工程。Non-blocking freeze 未完成时可以开工，但必须在实现计划中写明占位值、降级路径和替换时机。

---

## 12. 与其他文档的关系

- `docs/mvp-scope.md` 决定 P0 做什么和不做什么。
- `docs/data-model.md` 决定表、字段、关系和冻结门槛（含 §2.8 向量/RAG 主库混合，D-063）。
- `docs/text-to-sql.md` 决定 P0 查询契约。
- `docs/api-design.md` 决定 endpoint 语义。
- `docs/api-implementation-plan.md` 决定 route-level 分层。
- 本文档决定技术栈推荐、原型目录、实施切片和验证命令。

后续如果用户要求“开始实现 P0 原型”，应先确认本文档的技术栈建议，然后按 `docs/p0a-execution-plan.md` 的 P0-Core / P0-File / P0-AI / P0-RAG 周计划创建工程。
