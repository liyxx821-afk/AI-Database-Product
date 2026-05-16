# 知识库构建系统架构设计计划

版本：v1.3  
日期：2026-05-16  
状态：已完成架构优化——对齐 P0 开源优先 Provider、P0-Z0a/Z0b、ProcessingJob、知识切片质量闭环、AI 结构化整理 profile 和 fallback 契约

## 1. 文档目的

本文档用于设计“个人 AI 数据库产品”的第一部分：**知识库构建系统**。

后文中“建库系统”是“知识库构建系统”的简称。

本阶段只讨论和记录架构，不实现代码。

知识库构建系统的目标是把用户的零散材料转化为结构化、可确认、可追溯、可检索、可被个人 Agent 调用的个人知识资产。

它需要回答的问题是：

```text
用户的材料如何进入系统？
系统如何记录文件接收、格式校验、任务队列和处理状态？
系统如何理解材料？
系统如何清洗内容、控制切片质量并记录异常？
系统如何提取 Knowledge Unit？
AI 推荐的分类如何被用户确认？
系统如何生成 Source Description Card？
系统如何建立三类 embedding 和多索引？
确认后的知识如何存储、索引和追踪来源？
这些结构如何为未来 Text-to-SQL 和 Agent 调用服务？
```

---

## 2. 产品拆分：知识库构建系统与知识调用系统

整个产品可以分为两个部分：

```text
个人材料
→ 知识库构建系统
→ 个人知识数据库 / 个人知识库
→ 知识调用系统 / Agent 调用系统
→ 问答 / 创作 / 决策 / 复盘
```

### 2.1 知识库构建系统

知识库构建系统负责“把材料变成知识资产”。

核心职责：

- 接收材料；
- 接收文件或文本并反馈接收状态；
- 校验格式、创建处理任务队列和记录处理事件；
- 保存来源；
- 解析、清洗和标准化内容；
- 生成 Source Description Card；
- 执行切片策略、切片质量控制和切片结果存储；
- 通过手动、规则或 Mock 提取 Candidate Knowledge Unit；
- 调用知识组织层推荐标签、属性、schema match、关系、MOC 和分类映射；
- 支持用户确认与质量验证；
- 写入数据库和多索引；
- 保留来源、版本、状态、质量事件和审计记录；
- 执行写入型数据维护操作（更新文件/切片/元数据/向量/关系、删除资料、索引重建），这些操作必须受 Review 或明确用户动作约束。

### 2.2 知识调用系统 / Agent 调用系统

知识调用系统 / Agent 调用系统负责“使用知识资产完成任务”。

核心职责：

- 自然语言提问；
- Text-to-SQL 查询结构化知识；
- RAG 检索非结构化内容；
- 根据权限、项目、标签和状态筛选上下文；
- 生成带来源的回答；
- 支持创作、总结、复盘和决策；
- 将有价值结果重新沉淀为 Knowledge Unit 或 Memory。

### 2.3 知识组织层

知识组织层是共享底座之上、建库域与调用域之间的独立能力层（详见 `docs/product-architecture.md` Section 4.0）。

建库系统调用知识组织层的以下能力：

- 标签推荐（Folder-Tag Mirroring + topic/discipline/use/status 标签）；
- 分类映射（五轴分类 + Schema Match）；
- 关系推荐（P0 手动关系 + P1 AI 推荐）；
- MOC 归属（P0 占位）；
- 重复检测和冲突检测（服务 Review 流程）。

在本文档中，步骤 5–7（AI 结构化整理、分类映射、Embedding/关系/MOC）是建库域调用知识组织层能力的实施过程。代码层 P0 仍在建库流程中内联执行，但架构上这些能力属于知识组织层。

### 2.4 当前文档边界

本文档只设计知识库构建系统，不代表完整产品总架构。

知识调用系统只在以下方面被纳入考虑：

- 知识库构建系统需要为 Text-to-SQL 准备清晰 Schema；
- Knowledge Unit 需要可被 Agent 检索和引用；
- 来源、权限、状态、标签和关系需要可供 Agent 使用；
- 审计日志需要记录未来 Agent 调用路径。

完整产品总架构应由以下文档共同表达：

- `docs/product-architecture.md`：产品总架构，说明一个产品如何由知识构建域、知识组织层、知识调用域、共享底座和横切支撑层组成；
- `docs/architecture-design-plan.md`：知识库构建系统架构；
- `docs/knowledge-invocation-system-design-plan.md`：知识调用系统架构；
- `docs/development-plan.md`：整体开发计划、阶段边界和两套系统的数据接口；
- `docs/data-model.md`、`docs/text-to-sql.md`、`docs/api-design.md`、`docs/api-implementation-plan.md` 与 `docs/technical-stack-and-prototype-plan.md`：两套系统共享的数据模型、查询契约、API 边界、route-level 实施映射和原型技术栈边界。
- `docs/mvp-scope.md`：P0 / P1 / P2 / 暂缓范围和验收标准。

---

## 3. 建库系统设计原则

### 3.1 Source 不等于 Knowledge Unit

Source 是原始来源，例如一份 PDF、一段对话、一篇 Markdown、一张截图或一个网页摘录。

Knowledge Unit 是从 Source 中提取出来的可复用知识资产。

系统不能把文件保存成功等同于建库成功。

### 3.2 Chunk 不等于 Knowledge Unit

Chunk 是为了检索和引用而切分的文本片段。

Knowledge Unit 是经过提取、分类、确认后可长期复用的知识对象。

一个 Knowledge Unit 可以来自一个或多个 Chunk；一个 Chunk 也可能产生多个 Knowledge Unit。

### 3.3 Source Description 不等于 Source 原文

Source Description Card 是资料级摘要和元数据卡，用于帮助 Agent 先判断资料是否值得深入读取。

它应包含摘要、关键词、学科轴、可信度、权限、状态、是否可供 Agent 调用等信息。

Source Description 不替代 Source 原文，也不替代 Knowledge Unit。

### 3.4 AI 只做推荐，用户负责确认

建库系统应默认采用：

```text
AI 发现 → AI 推荐 → 用户确认 / 修改 → 系统固化 → Agent 可调用
```

AI 可以推荐：

- Knowledge Unit；
- type；
- tag；
- properties；
- relation；
- MOC 归属；
- 合并、拆分、过期或冲突提示。

但长期知识、核心分类、敏感内容和 Agent 默认可调用内容，应支持用户确认。

### 3.5 一切知识必须可追溯

每条 Knowledge Unit 都应能追溯到：

- 原始 Source；
- Source Description；
- 相关 Chunk；
- 创建方式；
- AI 提取理由；
- 用户确认状态；
- 修改历史；
- 可调用权限。

### 3.6 Schema 服务 Text-to-SQL

建库系统不是只为向量检索准备数据，也要为未来 Text-to-SQL 准备结构化字段。

因此，以下字段不应只埋在不可控文本里：

- 项目 / 知识空间；
- 文件夹；
- 标签；
- 知识类型；
- 状态；
- 权限；
- 来源；
- 时间；
- 关系；
- 用户确认状态；
- AI 置信度；
- 可调用用途。

---

## 4. 总体架构

建库系统以 9 步流程为基线：

```text
1. 资料接入 Source Ingestion
2. 文件接收与状态反馈 File Receiving + Status Feedback
3. 文件格式校验与任务队列 Format Validation + Processing Queue
4. 解析、清洗与切片 Parsing + Cleaning + Chunking
5. AI 结构化整理 AI Structured Organization
6. 分类映射、Schema 匹配与语义对齐 Classification + Schema Match + Semantic Grounding
7. Embedding、多索引、关系与 MOC Embedding + Multi-index + Relation + MOC
8. 用户确认与质量验证 Human Review + Validation
9. 正式入库、版本、检索调用与反馈沉淀 Commit + Version + Retrieval + Feedback
```

完整流程：

```text
Input Material
→ Source
→ File Receiving / Status Feedback
→ Format Validation / Processing Queue
→ Parsed Source
→ Source Description
→ Cleaned Text
→ Chunk + Chunk Quality Check
→ Candidate Knowledge Unit
→ AI Structured Organization
→ Classification / Schema Match / Semantic Grounding
→ Embedding / Multi-indexing
→ Relations / MOC
→ Review Item + Validation
→ Confirmed Knowledge Unit
→ Database + Full-text Index + Vector Index + Metadata Index + Tag/Folder Index + Relation Index + Version + Audit Log
→ Retrieval + Feedback
```

### 4.1 开源 RAG / GraphRAG 借鉴边界

LightRAG、Microsoft GraphRAG、Neo4j GraphRAG 和 LlamaIndex GraphRAG 提醒本项目：长期知识调用不能只依赖 chunk 向量相似度，还需要来源、关系、主题摘要、结构化字段和多索引协同。

但本项目的第一目标是建库系统，不是直接复制一个 GraphRAG 引擎。因此吸收边界如下：

| 阶段 | 吸收内容 | 不做内容 |
|---|---|---|
| P0 | relation 表、relation index 占位、MOC 占位、Source / Chunk / Knowledge Unit 引用链、Hybrid Retrieval、Evidence Pack、Citation、RAG answer / evidence-only fallback | 自动实体关系抽取、community detection、Global Search、Neo4j / LightRAG 依赖 |
| P1 | AI 推荐关系、用户确认关系、relation expansion retrieval、reranker 质量增强 | 未确认关系自动进入 Agent 默认调用 |
| P2 | community summary、主题级 / 项目级 Global Search、DRIFT-like search、图数据库或 LightRAG 后端评估 | 用图谱自动替代用户确认建库 |

架构原则：

- GraphRAG 的 `text units` 可类比 Chunk，但 Chunk 仍只是证据片段，不是 Knowledge Unit。
- GraphRAG 的实体 / 关系抽取可作为 P1 推荐能力，但必须进入 Review。
- community summary 可作为未来 MOC / 项目摘要能力，而不是 P0 必交付。
- Neo4j 适合复杂图查询，但 MVP 先使用 SQLite 关系表、FTS5 和 sqlite-vec 向量链路；PostgreSQL + pgvector 只作为 P1 迁移选项。
- LightRAG 可作为 P2 检索引擎候选，不作为 P0 架构依赖。

### 4.2 P0 开源优先 Provider 与降级策略

P0 采用开源优先 ProviderRegistry。为了先验证完整入库与知识处理闭环，系统优先使用本地 / 开源解析器、Embedding、OCR、ASR、LLM / Reranker；Provider 缺失时使用可替换的规则、Mock 或 evidence-only fallback：

| 能力 | P0 实现方式 | P1 扩展 |
|---|---|---|
| Source Description | 标题、首段、heading_path、source_origin 拼装 + 用户可编辑；可接开源 summarizer | 更强摘要和关键术语抽取 |
| Candidate Knowledge Unit | 用户手动创建 + 开源 / 规则 / Mock 候选 | 更高质量 AI 自动抽取 |
| Tag / Type / Properties | 开源 / 规则 / Mock 推荐 + 用户确认 | AI 推荐和解释增强 |
| Embedding | 开源 Provider 优先；P0 默认候选为 `bge_m3_local`，缺失时才 fallback 到 deterministic `mock_fixed_384`（dimension=384） | 真实 embedding provider 质量评估 |
| Text-to-SQL | Schema + 示例查询 / mock 查询 | 真实 Text-to-SQL 模型 |
| RAG Answer | Provider 可用时带引用回答；缺失时 evidence-only answer | 引用准确率评估与多 Provider 路由 |

P0 mock embedding 只用于验证 SQLite 存储、索引、过滤和 retrieval preview 链路，不代表真实语义召回质量。

### 4.3 PDF 代码层模块分期

`个人智能数据库.pdf` 提供了更细的代码层模块清单。建库系统吸收其中与入库、文件处理、AI 结构化整理、存储和维护相关的模块，但必须按 P0 / P1 / P2 分期落地。

| PDF 模块 | 进入位置 | P0 边界 | 后续扩展 |
|---|---|---|---|
| 资料上传子系统 | Source Intake | Upload / File Processing + `text_import` 同一入库管线 | 批量导入、监听导入 |
| 文件接收与状态反馈系统 | Source Registry / Processing Events | received / processing / failed 等状态事件 | 任务进度、重试、用户通知 |
| 文件格式校验 / 任务队列 | Ingestion Job | P0 记录状态、hash、风险和可恢复失败 | 更完整后台队列、重试策略 |
| 文件解析系统 | Parsing | Parser Router + 开源优先解析器；不承诺生产级全格式质量 | 更强 PDF、DOCX、PPT、网页、代码解析 |
| 内容清洗与标准化系统 | Cleaning | 基础空白、段落、标题和异常符号处理 | OCR 纠错、图文错位修复、多版本清洗 |
| 知识切片系统 | Chunking | 标题 / 段落 / 长度规则，保留来源位置 | 多模态切片、策略配置、切片质量模型 |
| AI 结构化整理系统 | Candidate KU / Classification | 开源优先 Provider + 规则 / Mock fallback；所有结果进 Review | 内容理解、关键信息抽取、schema 匹配、metadata 生成 |
| 标签生成 / 分类整理 | Tagging / Properties | folder mirror tag + 规则 / Mock 推荐 | 自动标签、标签合并、层级整理 |
| 实体关系提取 | Relation | P0 只做 manual relation 和占位 | P1/P2 AI 推荐关系，必须进入 Review |
| 数据库持续更新 / 版本管理 | Commit / Audit | P0 记录 audit log 和必要版本契约 | 快照、回滚、差异对比、重建索引 |
| 日志 / 异常 / 安全 / 性能成本 | 横切支撑层 | P0 记录必要日志、错误和权限过滤 | 生产级监控、成本统计、安全治理 |

因此，PDF 是模块边界清单，不是 P0 必交付清单。

---

## 5. 模块设计

### 5.1 材料输入层 Source Intake

目标：

接收用户输入的原始材料，并创建可追踪的 Source。

工程 P0 输入类型：

```text
upload_file
text_import
```

`source_origin` 可选值：

```text
markdown
plain_text
manual_note
pasted_conversation
extracted_pdf_text
extracted_web_text
extracted_code_doc
extracted_ocr_text
```

注意：

- `text_import` 是无物理文件输入变体，不再是唯一入口。
- 文件上传、接收、完整性校验、文件保存和 Parser Router 进入 P0。
- PDF、Office、图片、音频、视频、表格等走开源优先 parser / OCR / ASR / multimodal adapter；Provider 缺失时必须返回可恢复状态，不丢原文件。
- 网页自动抓取、Obsidian Vault 双向导入、生产级全格式解析质量仍后置。

输入层不负责理解知识，只负责接收、校验、保存入口信息。PDF 中的“资料上传子系统”和“文件接收与状态反馈系统”在 P0 落实为 Upload API、文件状态字段和处理状态事件。

输出：

- Source draft；
- 原始内容或文件路径；
- 基础元数据；
- ingest status；
- processing status event。

关键字段：

```text
source_id
source_type
original_filename
raw_content_path
content_hash
created_at
created_by
ingest_status
```

P0 状态事件建议：

```text
received
validated
queued
processing
failed
completed
```

### 5.2 来源管理层 Source Registry

目标：

把所有原始材料登记为可追溯对象。

职责：

- 记录 Source 基本信息；
- 保存原始内容或对象存储路径；
- 计算 hash，避免重复导入；
- 维护 Source 状态；
- 记录 Source 与 Project / Knowledge Space 的关系。

Source 状态建议：

```text
uploaded
received
validated
queued
processing
parsed
chunked
extracted
reviewing
indexed
failed
archived
```

设计原则：

- Source 可以存在但尚未形成 Knowledge Unit；
- Source 失败不应污染知识库；
- Source 删除需要处理相关 Chunk、Knowledge Unit 和引用关系。
- Source 状态应能支撑 Citation Preview / Query Explanation 展示处理质量和版本信号。

### 5.3 来源说明与元数据建档 Source Description Card

目标：

为每份资料生成资料级说明卡，让 Agent 先读来源说明，再决定是否深入读取全文、Chunk 或 Knowledge Unit。

作用：

- 降低 Agent 检索和上下文成本；
- 保存来源摘要、关键词、可信度、权限和版本；
- 支持资料级 embedding；
- 为 Text-to-SQL 提供可查询的来源字段。

字段建议：

```text
source_description_id
source_id
user_id
project_id
summary
key_terms
discipline_axis
source_reliability
description_text
permission
available_for_agent
metadata_json
embedding_id
embedding_status
created_at
updated_at
```

设计原则：

- Source Description 不替代 Source 原文；
- Source Description 不替代 Knowledge Unit；
- Source Description 可进入资料级检索和过滤；
- `available_for_agent` 必须受权限和用户确认策略约束。

### 5.4 解析标准化层 Parsing & Normalization

目标：

把不同格式材料转化为统一的结构化文本和文档结构。

不同输入的解析策略：

| 输入类型 | 标准化目标 |
|---|---|
| 文本 | 段落、标题、时间、用户输入上下文 |
| 对话 | 发言人、轮次、时间、上下文块 |
| Markdown | 标题层级、段落、列表、代码块、链接 |
| PDF | 页码、段落、标题、脚注、图片占位 |
| 图片 | OCR 文本、图像描述、视觉元数据 |
| 代码 | 文件路径、函数、注释、代码块 |

输出：

- normalized_text；
- structure tree；
- source metadata；
- parse warnings。

子模块拆分：

```text
File Receiving
Format Validation
Processing Job Queue
Parsing
Content Cleaning
Exception Handling
```

P0-File / P0-AI 要求 Parser Router、基础格式识别、完整性校验、文本解析和基础内容清洗。复杂后台队列可先轻量实现，但状态必须落在 `files`、ProcessingJob（物理表可暂用 `ingestion_jobs`）、`parse_tasks` 和 `processing_status_events`，保证失败可恢复。ProcessingJob 必须支持 Source 创建前的 inspect / preview、固定状态机、SSE 续读和重复请求幂等复用。

注意：

- 第一版不应追求全格式完美解析；
- 应先把文本 / Markdown / 对话打通；
- 解析失败应能显示原因，并允许用户重新处理。

### 5.5 Chunk 切分层 Chunking

目标：

把标准化文本切分成适合检索、引用和知识提取的 Chunk。

Chunk 设计原则：

- 保留语义完整性；
- 保留来源位置；
- 保留顺序；
- 不丢失标题和上下文；
- 支持回溯到 Source。
- 支持切片质量控制和异常回溯。

Chunk 字段建议：

```text
chunk_id
source_id
content
chunk_index
heading_path
page_number
start_offset
end_offset
metadata_json
created_at
```

切片子模块：

```text
输入接收模块
文档图像识别结果消费
切片策略配置模块
文档结构恢复模块
文本语义切片模块
结构化内容切片模块
多模态内容切片模块
上下文补充模块
元数据标注模块
来源绑定模块
切片质量检查模块
```

P0 切片质量检查可先记录：

- `length_bounds`：chunk 是否过长或过短；
- `semantic_integrity`：chunk 是否能独立表达完整知识点；
- `topic_mix`：是否混入多个主题；
- `context_sufficient`：离开原文后是否仍可理解；
- `source_traceability`：是否保留 source_id / file_id / page / section / paragraph / table / figure；
- `noise_duplicate`：是否包含重复、水印、乱码或明显噪声；
- `readability` / `searchability`：是否可读、可检索、可进入 Citation Preview。

切分策略：

- 文本 / Markdown：按标题、段落和长度混合切分；
- 对话：按主题段或轮次窗口切分；
- PDF：按页码、标题和段落切分；
- 代码：按文件、函数、类或注释区块切分。

MVP 策略：

```text
按标题和段落优先；
过长段落再按长度切分；
每个 chunk 保留 heading_path、source_id 和 source_description_id。
P0-Z0b 起每个 chunk 还应保留 `chunk_strategy_profile`、`context_summary` 和 `source_metadata`。
默认 500-800 tokens，overlap 80-150 tokens。
```

### 5.6 Knowledge Unit 提取层

目标：

从 Source / Chunk 中提取可复用的知识单元。

这是建库系统的核心模块。

Knowledge Unit 可以是：

- concept；
- claim；
- fact；
- method；
- principle；
- case；
- evidence；
- decision；
- preference；
- question；
- task；
- template。

提取结果默认是候选状态：

```text
pending_review
```

提取时应保留：

- 内容；
- 标题；
- 类型建议；
- 来源 Chunk；
- AI 置信度；
- 提取理由；
- 可能的重复项；
- 是否需要用户确认。

MVP 提取目标：

```text
用户输入一段 500-2000 字材料；
系统提取 3-5 条候选 Knowledge Unit；
每条包含 title、type、content、source、confidence、reason。
```

#### AI 结构化整理边界（Building AI）

> **AI 能力栈归属**：本模块中的所有 AI 能力属于 Building AI（建库侧 AI），详见 `docs/product-architecture.md` Section 4.0.1。Building AI 的输出必须进入 Review 流程。

PDF 中的 AI 结构化整理系统在 D-077 中收敛为 profile 化执行链，可拆为：

- 内容理解；
- 摘要生成；
- 关键概念抽取；
- 结构化字段生成 / schema mapping；
- 知识卡片生成；
- 分类与标签整理；
- 知识关系构建；
- 质量校验；
- 人工干预与迭代。

工程 P0 通过开源优先 ProviderRegistry 接入 AI 能力；缺失时以手动、规则和 Mock 方式验证数据流。P0 默认工具是 Pydantic / JSON Schema、Jinja2 / Markdown / YAML Frontmatter、KeyBERT / YAKE、spaCy / HanLP 和规则模板；LLM、LlamaIndex、LangChain Structured Output、Instructor / Guardrails、BGE / Sentence-Transformers、BERTopic、Neo4j、NetworkX、RDFlib 只作为增强 adapter。P1/P2 再增强内容理解、自动抽取、实体关系提取、知识卡片生成和结构化输出质量，并且必须进入 Review。

质量检查固定写入 `topic_understanding`、`summary_quality`、`concept_extraction`、`schema_mapping`、`card_normalization`、`tag_consistency`、`relation_suggestion`。关系建议只创建 review task，不直接写 confirmed relation。

Building AI 与 Invocation AI 的区分原则：如果 AI 能力服务于"把材料变成知识资产"的过程，属于 Building AI；如果 AI 能力服务于"用知识资产完成用户任务"的过程，属于 Invocation AI。两层共享底层模型接口，但独立管理 Prompt 策略和评估标准。

### 5.7 分类映射与语义对齐 Classification Mapping + Semantic Grounding

> **架构归属**：本模块的能力在产品总架构中属于知识组织层（详见 `docs/product-architecture.md` Section 4.0 和 5.2）。建库域在 KU 提取后调用这些能力。P0 代码层内联执行，P1 开始独立为可复用 service。

目标：

让 Knowledge Unit 进入可组织、可检索、可解释的知识结构。

该层负责推荐：

- type；
- semantic tags；
- folder mirror tags；
- properties；
- schema match；
- relations；
- MOC 归属；
- discipline / problem / method / object / application 五轴分类；
- alias / synonym 同义词映射；
- value illustration 概念说明；
- domain context 领域语境说明。

推荐结果必须区分：

```text
AI suggested
User confirmed
System generated
```

#### 5.6.1 Tag

标签类型：

```text
folder_tag
topic_tag
status_tag
use_tag
discipline_tag
system_tag
custom_tag
```

要求：

- 支持命名空间；
- 支持置信度；
- 支持推荐理由；
- 支持用户确认；
- 支持合并和重命名。

#### 5.6.2 Properties

Properties 是 Text-to-SQL 的重要基础。

第一版建议字段：

```yaml
type:
status:
importance:
space:
primary_folder:
source_type:
permission:
use_for:
discipline_axis:
problem_axis:
method_axis:
object_axis:
application_axis:
user_verified:
ai_confidence:
```

#### 5.6.3 Relation

关系类型建议：

```text
supports
contradicts
derived_from
example_of
part_of
depends_on
similar_to
used_for
updates
replaces
solves
```

与 `docs/data-model.md` §5.9 保持一致。关系推荐应谨慎，默认需要用户确认。

P0 已确认支持手动关系和关系索引占位。AI 自动关系抽取、GraphRAG 式实体关系抽取和跨文档关系推断放入 P1 或 P2，且必须经过 Review。

Relation 与 MOC 的分期：

```text
P0：manual relation / relation index placeholder / MOC placeholder
P1：AI suggested relation / relation expansion retrieval / semi-auto MOC
P2：community summary / Global Search / graph database evaluation
```

### 5.8 用户确认与质量验证 Human Review + Validation

目标：

防止 AI 自动污染知识库，让用户控制长期知识资产。

Review Item 是用户确认工作流的核心对象。

用户可操作：

- 确认；
- 编辑；
- 忽略；
- 合并；
- 拆分；
- 设为核心知识；
- 标记不确定；
- 标记冲突；
- 标记过期；
- 设为 do_not_use；
- 请求补充来源；
- 请求重新分类；
- 修改权限；
- 修改用途；
- 修改来源引用。

质量验证包括：

```text
source_check        来源是否存在
citation_check      引用是否可追溯
parse_check         解析是否存在警告或失败
chunk_quality_check 切片是否完整、可引用、可回溯
type_check          知识类型是否正确
duplicate_check     是否重复
conflict_check      是否与已有知识冲突
permission_check    是否有权限风险
retrieval_check     是否能被正确检索
agent_use_check     Agent 是否能正确调用
version_check       是否引用当前可用版本
```

确认后的结果：

```text
candidate Knowledge Unit
→ confirmed Knowledge Unit
→ default callable by Agent
```

未确认内容：

- 可以保留在待审池；
- 不应默认进入 Agent 长期调用范围；
- 可参与局部草稿搜索，但必须标识为 AI 建议或未确认。

### 5.9 Embedding / 多索引 / 存储 / 审计层

目标：

将确认后的知识写入稳定数据库和索引系统。

建议 P0-AI / P0-RAG 存储结构：

- SQLite：主数据；
- SQLite FTS5：关键词检索；
- sqlite-vec：真实 profile 或 fallback profile 的向量链路验证；
- SQLite JSON 函数：扩展元数据；
- 本地文件 / 应用数据目录：原始 Source 或导入文本；
- Audit log：记录重要变更。

P1 若引入真实 embedding provider、高性能向量检索或多设备同步，再评估 PostgreSQL + pgvector 迁移。

索引对象：

- Source；
- Source Description；
- Chunk；
- Knowledge Unit；
- Tag；
- Relation；
- Metadata；
- Review 状态。

必须区分三类 embedding：

```text
Source Description Embedding：用于资料级检索
Chunk Embedding：用于原文证据检索
Knowledge Unit Embedding：用于知识语义检索
```

至少规划六类索引：

```text
原文索引
全文关键词索引
向量索引
metadata 索引
tag / folder 索引
relation 索引
```

审计记录应包括：

- 谁创建；
- 何时创建；
- AI 推荐了什么；
- 用户确认了什么；
- 修改了哪些字段；
- 是否影响 Agent 可调用范围；
- 来源是否变化。
- 处理状态、质量事件、版本快照和异常记录是否影响检索或引用。

### 5.10 知识持续优化机制 Knowledge Optimization

> **架构归属**：知识持续优化属于知识组织层的能力（详见 `docs/product-architecture.md` Section 4.0），由建库域的 Review 机制约束。所有优化操作必须生成 ReviewTask，不允许静默修改已确认知识。

目标：

在知识库增长过程中，持续改善已确认知识的质量、一致性和可检索性。

#### 触发条件

| 触发条件 | 说明 | P0 | P1/P2 |
|---|---|---|---|
| 新资料入库后相似检测 | 新 KU 与已有 KU 高度相似时触发 | 文档定义 | 规则触发 |
| 标签合并或重命名 | 标签体系变更时，受影响 KU 需要重新标记 | 文档定义 | 规则触发 |
| 用户反馈 outdated/conflicting | 用户标记某条知识过时或冲突 | 文档定义 | 用户手动触发 |
| 定期批量质量检查 | 按时间或项目定期检查知识质量 | 文档定义 | P2 定时任务 |
| 调用反馈驱动 | 多次 bad_citation 或 wrong 反馈指向同一 KU | 文档定义 | P2 AI 分析 |

#### 操作类型

| 操作 | 说明 | Review 要求 |
|---|---|---|
| `merge_duplicates` | 合并重复知识单元 | 必须生成 ReviewTask |
| `update_relations` | 基于新证据调整关系 | 必须生成 ReviewTask |
| `retag` | 标签规范化（合并同义标签、调整层级） | 必须生成 ReviewTask |
| `regrade` | 重新评估 importance / confidence | 必须生成 ReviewTask |
| `deprecate` | 将过时知识标记为 outdated | 必须生成 ReviewTask |
| `rechunk` | 基于更好的切片策略重新切分 Source | 必须生成 ReviewTask |

#### Review 约束

所有优化操作的核心原则：

```text
优化推荐 → 生成 ReviewTask → 用户确认 / 修改 / 忽略 → 系统执行
```

- 任何优化操作不能静默修改已确认（`status = confirmed`）的 Knowledge Unit。
- 优化推荐可以来自规则（P1）或 AI（P2），但执行必须经过 Review。
- `review_tasks.target_type` 需要支持优化相关的值（见 data-model 扩展）。
- 优化操作必须记录 audit log，包含 before/after 状态。

#### P0 边界

P0 只在文档中定义触发条件、操作类型和 Review 约束的枚举和规则。不实现运行时自动检测或触发逻辑。P1 实现规则触发 + 用户手动触发。P2 实现 AI 推荐优化。

---

## 6. 核心数据对象

### 6.1 KnowledgeSpace

表示用户的知识空间、项目空间或主要工作上下文。

作用：

- 限定知识范围；
- 支持项目化组织；
- 支持 Agent 查询范围控制。

### 6.2 Folder

表示主要安放位置。

作用：

- 提供主归属；
- 限定默认上下文；
- 触发 Folder-Tag Mirroring。

### 6.3 Source

表示原始材料。

作用：

- 保存来源；
- 支持追溯；
- 支持重新解析；
- 支持引用和证据链。

### 6.4 SourceDescription

表示资料级说明卡。

作用：

- 保存资料摘要、关键词、学科轴、可信度、权限和可调用状态；
- 支持资料级检索；
- 帮助 Agent 先判断是否深入读取全文或 Chunk；
- 降低上下文消耗。

### 6.5 Chunk

表示检索和引用片段。

作用：

- 服务 RAG；
- 服务引用展示；
- 为 Knowledge Unit 提取提供材料边界。

### 6.6 KnowledgeUnit

表示最小可复用知识资产。

作用：

- 被用户确认；
- 被 Agent 调用；
- 被 Text-to-SQL 查询；
- 被标签、属性、关系和 MOC 组织。

### 6.6.1 KnowledgeUnitChunk

表示 Knowledge Unit 与 Chunk 的证据关联。

作用：

- 支持一个 Knowledge Unit 来自多个 Chunk；
- 支持一个 Chunk 支撑多个 Knowledge Unit；
- 保存 evidence_role、quote_text 和 confidence；
- 为 Citation Preview 和 Text-to-SQL 证据查询提供稳定 join 边界。

### 6.7 Tag

表示显式语义索引。

作用：

- 横向组织知识；
- 支持过滤；
- 支持用户可理解的分类；
- 与 folder mirror、status、use、discipline 等不同语义区分。

### 6.8 Property

表示机器可读结构化字段。

作用：

- 支持筛选；
- 支持排序；
- 支持 Text-to-SQL；
- 支持权限、状态、时间、重要性等精确控制。

### 6.9 KnowledgeRelation

表示知识之间的关系。

作用：

- 支持关系扩展；
- 支持 Backlink；
- 支持 MOC；
- 支持创作者回溯知识脉络。

### 6.10 ReviewItem

表示 AI 推荐到用户确认之间的工作流对象。

作用：

- 保留候选知识；
- 记录推荐理由；
- 记录用户确认动作；
- 防止未确认知识直接污染主库；
- 记录 source_check、citation_check、duplicate_check、permission_check 等质量验证结果。

### 6.11 AuditLog

表示建库过程中的关键事件记录。

作用：

- 支持来源追踪；
- 支持版本回溯；
- 支持系统可信度；
- 支持未来 Agent 调用解释。

### 6.12 EmbeddingRecord

表示可重建、可版本化的 embedding 记录。

作用：

- 统一承载 Source Description、Chunk 和 Knowledge Unit 三类 embedding；
- 保存 embedding_profile、model_id、dimension、content_hash 和 embedding_status；
- 支持 mock embedding 到真实 embedding 的后续重建；
- 避免在 data-model v0.1 中把 vector 列散落到多个业务表后难以迁移。

---

## 7. MVP 建库流程

第一版 MVP 应优先打通文本输入到确认入库。

### 7.1 用户流程

```text
1. 用户创建 Knowledge Space
2. 用户创建 Folder，系统生成 folder mirror tag
3. 用户通过 text_import 输入材料，并选择 source_origin
4. 系统创建 Source
5. 系统记录接收、校验、排队和处理状态
6. 系统解析、清洗并标准化内容
7. 系统生成 Source Description Card
8. 系统切分 Chunk 并记录切片质量检查
9. 用户手动创建 Knowledge Unit，或系统用规则 / Mock 生成候选 Knowledge Unit
10. 系统推荐 type / tags / properties / schema match / relations
11. 系统按 P0 embedding profile registry 生成 Source Description / Chunk / Knowledge Unit embedding
12. 用户逐条确认、修改或忽略，并完成质量验证
13. 系统写入确认后的 Knowledge Unit
14. 系统建立全文索引、向量索引、metadata 索引、tag/folder 索引和 relation 索引
15. 系统记录来源、处理状态、确认状态、验证结果、版本和审计日志
16. 用户提问时，系统返回检索预览，展示 tag + metadata + vector 命中的来源和可引用证据
17. 用户可将检索结果或后续回答沉淀为新的候选 Knowledge Unit
```

### 7.2 MVP 成功标准

第一阶段衡量标准：

1. 用户输入一段项目想法；
2. 系统创建可追溯 Source；
3. 系统生成 Source Description Card；
4. 系统切出可追踪 Chunk；
5. 用户可手动创建，或系统用规则 / Mock 生成 3-5 条候选 Knowledge Unit；
6. 每条 Knowledge Unit 都有 type、source、reason、confidence；
7. 系统推荐 tags、properties 和 folder mirror tags；
8. 系统生成至少 Chunk / Knowledge Unit mock embedding，并预留 Source Description embedding；
9. 用户可以确认、修改、忽略或请求重新分类；
10. 确认后的知识进入主库；
11. 每条知识可回溯到 Source / Source Description / Chunk；
12. 检索预览至少支持 metadata / tag / status filter + vector search；
13. Citation Preview / Query Explanation 能显示处理状态、parse warning、chunk quality 和 evidence gaps；
14. 数据结构可被未来 Text-to-SQL 查询。

### 7.3 MVP 不做

第一版暂不追求：

- 多格式完美解析；
- 原生 PDF / OCR / 网页抓取 / DOCX / PPT 解析；
- 真实任务队列和生产级异步处理；
- 全自动网页爬取；
- 复杂知识图谱推理；
- 自动实体关系抽取；
- community detection / community summary；
- GraphRAG Global Search / DRIFT-like search；
- Neo4j 或 LightRAG 引擎依赖；
- 商业闭源 AI 作为必需依赖、生产级真实 embedding 质量评估和真实 reranker 质量评估；
- 完整 Agent 自主执行；
- 团队协作；
- 复杂权限系统；
- 大规模知识迁移；
- 全量 Obsidian 双向同步。

---

## 8. Text-to-SQL 适配设计

建库系统需要从第一天起为 Text-to-SQL 做准备。

### 8.1 为什么建库系统要考虑 Text-to-SQL

未来个人 Agent 需要回答的不只是“语义相似内容有哪些”，还包括：

- 我上个月确认了哪些设计方法？
- 某个项目里有哪些未确认的知识单元？
- 哪些知识来自 PDF，且状态是 uncertain？
- 哪些标签经常和某个学科轴一起出现？
- 某个创作主题引用了哪些 Source？
- 哪些 Source Description 的可信度较低但仍被 Agent 调用了？
- 哪些 Knowledge Unit 被标记为 do_not_use？

这些问题需要结构化查询，而不是只靠向量检索。

### 8.2 对建库 Schema 的要求

Schema 应满足：

- 表名和字段名稳定、语义清楚；
- 核心对象之间关系明确；
- 状态、权限、确认状态、来源、时间独立字段化；
- 标签和属性可查询；
- AI 建议与用户确认可区分；
- 查询日志可保存；
- 敏感内容可被过滤。

### 8.3 第一版可查询对象

建议第一版明确支持查询：

- KnowledgeSpace；
- Folder；
- Source；
- SourceDescription；
- Chunk；
- KnowledgeUnit；
- KnowledgeUnitChunk；
- Tag；
- KnowledgeUnitTag；
- KnowledgeRelation；
- ReviewItem；
- RetrievalLog；
- AuditLog。

### 8.4 SQL 安全边界

未来接入 Text-to-SQL 时，默认策略应是：

- 只生成 SELECT；
- 禁止自然语言直接触发 DELETE / UPDATE / INSERT；
- SQL 执行前做语法和权限校验；
- 用户可以看到查询解释；
- 查询结果必须保留来源；
- 敏感权限字段必须参与过滤。

---

## 9. 推荐目录方向

本阶段不写代码，但后续如果进入原型开发，可参考以下目录方向。

```text
src/
├── features/
│   ├── ingestion/
│   ├── parsing/
│   ├── source-descriptions/
│   ├── chunking/
│   ├── knowledge-units/
│   ├── classification/
│   ├── relations/
│   ├── review/
│   ├── indexing/
│   ├── retrieval/
│   └── text-to-sql/
├── services/
│   ├── storage/
│   ├── ai/
│   ├── database/
│   └── retrieval/
├── components/
│   ├── source/
│   ├── review/
│   ├── knowledge-unit/
│   └── tags/
├── utils/
└── constants/
```

如果选择 Next.js / full-stack TypeScript，可进一步拆分：

```text
app/
components/
lib/
server/
db/
docs/
```

如果选择 Python 后端 + 前端分离：

```text
frontend/
backend/
├── app/
│   ├── ingestion/
│   ├── parsing/
│   ├── chunking/
│   ├── extraction/
│   ├── classification/
│   ├── review/
│   ├── indexing/
│   └── text_to_sql/
docs/
```

实际目录应以后续技术栈确认和仓库形态为准。

---

## 10. 后续迭代议题

### 10.1 产品问题

- 第一版主要用户是否先聚焦“创作者”还是“开发者 + 设计师”？
- 建库系统第一版是否需要项目空间，还是先从单一知识空间开始？
- 用户确认界面是逐条卡片式，还是表格批处理式？
- AI 推荐的知识单元如何显示可信度和来源？
- 用户如何发现重复知识？

### 10.2 技术问题

- 是否接受 `docs/technical-stack-and-prototype-plan.md` 推荐的 Electron + React + Vite + TypeScript、FastAPI sidecar、SQLite + sqlite-vec 作为 P0 原型技术栈？
- Embedding 是否在用户确认前生成，还是确认后生成？
- Text-to-SQL 第一版是内置 mock，还是接真实模型？
- Source 原始文件存本地还是先抽象对象存储接口？
- relation expansion retrieval 是 P1 基础能力，还是 Agent 调用系统能力？
- community summary / Global Search 是否需要独立图数据库支撑？

### 10.3 信息架构问题

- Folder、Knowledge Space、Project 三者是否合并？
- Tag namespace 第一版如何设计？
- MOC 是自动生成，还是先人工编辑？
- Knowledge Unit 与 Chunk 是强绑定还是可多对多？
- Properties 是否允许用户自定义 Schema？

### 10.4 风险问题

- AI 提取质量不足会影响建库可信度；
- 过多字段会让 MVP 变复杂；
- 过少结构会削弱 Text-to-SQL；
- 未确认知识进入 Agent 调用会污染回答；
- Source / Chunk / Knowledge Unit 边界不清会导致后续难以维护。

---

## 11. 建议的下一步讨论顺序

后续建议按以下顺序继续优化：

1. 明确第一版输入类型；
2. 明确 Knowledge Unit 字段最小集；
3. 明确用户确认界面流程；
4. 明确标签和 Properties 的第一版字段；
5. 明确 Source / Chunk / Knowledge Unit 的关系；
6. 明确 Text-to-SQL 第一版可查询 Schema；
7. 明确 MVP 技术栈；
8. 再进入原型开发计划。

---

## 12. 当前架构结论

建库系统的第一版不应追求“什么都能导入、什么都能自动理解”。

更合理的目标是：

> 先把一段文本或 Markdown 转化为可确认的 Knowledge Unit，并确保每条知识都有来源、类型、标签、属性、状态、权限和审计记录。只要这条链路成立，个人数据库、Text-to-SQL、RAG 和个人 Agent 调用系统才有可靠基础。

因此，建库系统第一阶段的核心不是文件解析能力，而是：

```text
Source → Chunk → Knowledge Unit → Review → Confirmed Knowledge Asset
```

这条链路应该成为后续所有架构优化和原型开发的主线。
