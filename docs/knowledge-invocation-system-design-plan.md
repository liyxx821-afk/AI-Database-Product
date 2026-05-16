# 知识调用系统架构设计计划

版本：v0.10  
日期：2026-05-17  
状态：已同步 D-080，并按 D-081/D-082/D-083 收紧 P0-Z0a/Z2 持久化边界、InvocationProfileSchema v1、feedback_policy 与 FrontendStateContract

## 1. 文档目的

本文档用于设计“AI 个人知识库产品”的第二部分：**知识调用系统**。

知识库构建系统负责把材料转化为可确认、可追溯、可检索的 Knowledge Unit；知识调用系统负责让个人 Agent 在具体任务中安全、准确、可解释地调用这些知识资产。

后文中“建库系统”是“知识库构建系统”的简称。

知识调用系统需要回答的问题是：

```text
用户提出问题、创作任务或决策任务后，系统如何判断该调用哪些知识？
系统如何把自然语言任务转化为结构化查询和检索计划？
系统如何组合 Text-to-SQL、关键词检索、向量检索、标签过滤和关系扩展？
Agent 最终使用了哪些 Knowledge Unit、Chunk、Source 和 Relation？
回答中哪些内容来自证据，哪些内容是模型推理或创作加工？
用户如何把有价值的回答重新沉淀为 Memory 或 Knowledge Unit？
```

本文档当前只做架构设计，不实现代码。

---

## 2. 系统边界

### 2.1 与知识库构建系统的关系

整体产品链路：

```text
个人材料
→ 知识库构建系统
→ 个人知识数据库 / 个人知识库
→ 知识调用系统
→ 问答 / 创作 / 决策 / 复盘
→ 反馈与再沉淀
```

知识库构建系统输出：

- Source；
- Source Description Card；
- Chunk；
- Confirmed Knowledge Unit；
- Tag / Folder / Properties；
- Knowledge Relation；
- Review / Validation 状态；
- Multi-index；
- Processing Status / Parse Warning / Chunk Quality；
- QualityEvent / VersionSnapshot / FeedbackEvent；
- Audit Log。

产品总架构由 `docs/product-architecture.md` 表达。本文档只负责知识调用域，不替代知识库构建系统架构或数据模型草案。

知识调用域依赖知识组织层（详见 `docs/product-architecture.md` Section 4.0 和 5.2）的标签体系、关系图谱和 MOC 结构来限定检索范围和扩展上下文。

知识调用系统输入：

- 用户自然语言任务；
- 当前 Knowledge Space / Project / Folder / Tag 范围；
- 用户权限；
- 已确认知识资产；
- 可检索 Source / Chunk / Knowledge Unit / Relation；
- Metadata / Tag / RetrievalLog / FeedbackEvent；
- Source / Chunk 的处理状态、质量事件和版本状态；
- 历史 AIAnswer / Memory。

### 2.2 当前设计不做的事

当前文档不把知识调用系统直接设计成全自动 Agent 执行平台。

P0 不做：

- 多 Agent 自主规划与工具执行；
- 无人工确认的长期记忆写入；
- 跨应用自动操作；
- 复杂任务编排；
- 图数据库强依赖；
- 无来源回答；
- 未确认知识默认进入 Agent 长期调用。
- 真实线上多用户账号、团队权限、跨应用自动操作、复杂任务编排、图数据库强依赖。
- 真实 Text-to-SQL 模型和多 Agent 工具执行；P0 只保留只读模板、安全校验和查询解释。

---

## 3. 核心定位

知识调用系统不是普通 RAG 问答框。

它更接近：

> Agent Context Assembly System，即个人 Agent 的上下文组装与证据调用系统。

它的核心职责不是“生成一段回答”，而是：

- 判断用户任务需要什么知识；
- 确定检索范围；
- 规划结构化查询和非结构化检索；
- 过滤权限和状态；
- 组装证据包；
- 控制上下文预算；
- 在 P0-Z0a 阶段生成 Citation Preview、Query Explanation 和 `evidence_only_answer`；
- 在 P0-Z2 或显式 Provider 增强路径生成带 citation 的 `rag_answer`；生产级提纲、分析、创作稿和项目复盘生成进入 P1/P2；
- 解释调用路径；
- 将高价值结果送回建库系统进入 Review。

---

## 4. 设计原则

### 4.1 Knowledge Unit 优先于 Chunk

Agent 默认调用对象应优先是：

```text
confirmed Knowledge Unit
+ allowed permission
+ available_for_agent
+ not outdated
+ not do_not_use
```

Chunk 是原文证据片段，Source 是来源材料。它们支撑引用和校验，但不应替代经过确认的 Knowledge Unit。

### 4.2 结构化查询先于向量召回

调用系统不应从全库向量 top-k 开始。

默认顺序应是：

```text
Scope / Permission / Status filter
→ Text-to-SQL structured query
→ Tag / Folder / Properties filter
→ Knowledge Unit retrieval
→ Chunk evidence retrieval
→ Relation / Backlink expansion
→ Source Description / Source fallback
```

### 4.3 Text-to-SQL 做导航，RAG 做证据补全

Text-to-SQL 负责结构化导航：

- 查项目；
- 查状态；
- 查权限；
- 查标签；
- 查来源；
- 查确认状态；
- 查关系；
- 查时间线；
- 查调用日志。

RAG 负责证据补全：

- 找到相关原文片段；
- 对齐 Source / Chunk；
- 提供引用；
- 支持总结、生成、比较和创作。

### 4.4 输出必须区分证据和推理

Agent 输出应尽量区分：

- 直接来自 Knowledge Unit 的结论；
- 直接来自 Source / Chunk 的证据；
- 由多个证据综合出的推理；
- 面向创作任务的模型加工；
- 知识库没有支持的部分。

### 4.5 调用结果应能反向沉淀

高质量回答、创作提纲、决策理由、复盘结论不应只停留在对话里。

它们应进入：

```text
AIAnswer
→ Save as Memory / Candidate Knowledge Unit
→ Review + Validation
→ Confirmed Knowledge Asset
```

### 4.6 质量、版本和日志信号必须进入解释层

调用系统不只读取 Knowledge Unit 内容，还要读取建库过程留下的质量信号。

Citation Preview / Query Explanation 应能说明：

- Source 是否处于当前可用版本；
- Source / Chunk 是否存在 parse warning；
- Chunk 是否通过切片质量控制；
- 权限、状态和用户确认过滤排除了哪些内容；
- 检索路径中是否使用了历史反馈或质量事件；
- Evidence Pack 是否存在 evidence gaps。

---

## 5. 总体架构

知识调用系统以 10 步流程为基线。D-080 后，这 10 步不再只描述抽象 RAG，而是显式覆盖问题理解、检索策略选择、结果排序、引用溯源、反馈优化、隐式 Agent 和前端交互状态：

```text
1. Task Intake：任务接入
2. Query Understanding：问题理解与范围规划
3. Permission + Policy Gate：权限与调用策略检查
4. Retrieval Strategy Planning：检索策略选择
5. Retrieval Orchestration：检索编排与排序
6. Evidence Pack Building：证据包构建
7. Context Composition：Agent 上下文组装
8. Citation Preview / Query Explanation：引用预览、溯源与查询解释
9. P0 Evidence-only / P0-Z2 Answer / Creation Draft：证据回答、带引用回答或创作草稿
10. Feedback + Memory Loop：反馈与再沉淀
```

完整流程：

```text
User Task
→ Invocation Request
→ Query Understanding Profile
→ Retrieval Strategy Profile
→ SQL / Keyword / Vector / Metadata / Relation / Hybrid Retrieval
→ Candidate Results + Ranking Profile
→ Evidence Pack + Citation Trace Profile
→ Agent Context
→ Citation Preview / Query Explanation / Evidence-only Answer
→ P0-Z2 Provider Answer or Creation Draft（可选）
→ Feedback Signal / Save as Memory / Save as Candidate Knowledge Unit
```

---

## 6. 模块设计

### 6.1 Task Intake 任务接入

目标：

把用户自然语言请求转化为可处理的 Invocation Request。

典型任务类型：

```text
question_answering
summarization
comparison
creation
decision_support
project_review
knowledge_gap_check
source_trace
memory_save
```

Invocation Request 初步字段：

```text
request_id
user_id
workspace_id
agent_id          # P0 default null（隐式主 Agent），P1 写入真实 agent_id
raw_query
task_type
input_context
preferred_output_type
created_at
```

P0 单 Agent 占位规则（详见 `docs/product-architecture.md` §5.4.1）：

- P0 不实现 `agents` 表，所有 Invocation Request 隐式归属"默认主 Agent"。
- 字段 `agent_id` 在 P0-RAG schema 中保留为 nullable，写入值固定 `null`。
- 业务层默认行为：
  - 检索范围 = 用户所有 Project（不按 Agent 限制）。
  - 默认 system prompt = 全局默认（不区分 Agent 偏好）。
  - Memory 与 KU 默认归属"主 Agent"。
- P1 实现 `agents` 表后，通过 Alembic 迁移把所有 P0 历史 `agent_id = null` 的记录批量回填为主 Agent ID。
- 业务代码必须从 W1 起就通过 `current_agent_id_or_null()` 辅助函数读取上下文，避免硬编码 `null`，方便 P1 切换。

### 6.2 Query Understanding 问题理解与范围规划

目标：

判断用户想做什么，以及应该在哪个知识范围内查找。

Scope 维度：

- Knowledge Space；
- Project；
- Folder；
- Tag；
- Source；
- Knowledge Unit type；
- Status；
- Permission；
- Time range；
- Use case。

输出：

```text
intent
query_rewrite
extracted_keywords
scope_filters
constraints
required_evidence_level
expected_answer_shape
needs_sql
needs_semantic_search
needs_keyword_search
needs_relation_evidence
needs_summary_chain
needs_file_lookup
confidence
```

`query_understanding_profile` 建议结构：

```yaml
query_understanding_profile:
  intent: simple_fact | concept_explanation | relationship_analysis | summary_synthesis | timeline | file_lookup | complex_hybrid
  query_rewrite:
    rewritten_query: string | null
    provider_key: rule | local_llm | commercial_llm | null
    capability_status: available | fallback | unavailable | disabled | error
    fallback_reason: llm_unavailable | low_confidence | not_needed | null
  extracted_keywords:
    exact_terms: [string]
    entities: [string]
    project_hints: [string]
    time_hints: [string]
  scope_filters:
    project_ids: [uuid]
    source_ids: [uuid]
    tag_ids: [uuid]
    time_range: {from: string | null, to: string | null}
  constraints:
    permission_mode: agent_default | user_preview | explicit_sensitive_confirmed
    output_format: answer | evidence_only | outline | table | summary | citation_preview
  confidence: 0.0-1.0
```

设计原则：

- 如果用户指定项目或文件夹，必须优先尊重；
- 如果没有指定范围，系统应使用当前工作上下文或提示用户选择；
- 默认只调用已确认、可调用、权限允许的知识；
- 任何扩大范围的检索都应在解释层可见；
- P1 多 Agent 上线后，Scope 计算先取 Agent 默认范围（`agents.default_project_scope`），再叠加用户指定范围。P0 跳过此步骤。
- P0 默认使用规则、关键词和当前项目上下文完成理解；LLM query rewrite 只作为可选 Provider，缺失时必须记录 `fallback_reason=llm_unavailable`，不能阻塞检索。
- 低置信度意图识别不得自动扩大检索范围；应返回澄清提示或使用 `complex_hybrid` 保守路线。

### 6.3 Permission + Policy Gate 权限与调用策略检查

目标：

在检索前先确定哪些知识不能被调用。

过滤条件（P0 桌面单用户简化的 `permission` 3 值约定，详见 `docs/data-model.md` §5.5）：

```text
permission IN ('normal')                         # Agent 默认调用
status != do_not_use
status != archived unless explicitly requested
user_verified = true for default agent calls
available_for_agent = true
```

特殊情况：

- `pending_review` 可在草稿搜索中出现，但必须标识为未确认；
- `uncertain` 可用于研究比较，但不能作为强结论；
- `outdated` 只能用于历史回顾、版本比较或明确要求；
- `permission = sensitive` 可被检索，但进入 Evidence Pack / Citation Preview 前需要用户显式确认，并校验一次性 `sensitive_access_grant_id` 的过期、撤销、scope 和复用状态；
- `permission = do_not_share` 不进入任何 Agent 调用，只允许用户手动查看。

P1 进入多用户 / 团队 / 多设备场景时，本节再扩展为 6 值（`public/private/project_internal/sensitive/restricted/do_not_share`），按用户上下文映射。

### 6.4 Retrieval Strategy Planner 检索策略规划器

目标：

把用户任务转化为可执行的多通道检索计划。

Retrieval Plan 初步字段：

```text
plan_id
request_id
query_intent
query_understanding_profile
retrieval_strategy_profile
scope_filters
sql_plan
keyword_plan
vector_plan
relation_plan
rerank_plan
context_budget
expected_sources
quality_filters
version_policy
risk_flags
```

`retrieval_strategy_profile` 固定表达“为什么走这条检索路径”：

```yaml
retrieval_strategy_profile:
  route: bm25 | vector | metadata_filter | file_index | relation_evidence | summary_chain | hybrid
  route_reason: simple_fact | concept_explanation | timeline | file_lookup | relationship_analysis | summary_synthesis | complex_hybrid
  channels:
    keyword: enabled | disabled
    vector: enabled | fallback | disabled
    metadata: enabled | disabled
    relation: enabled | fallback | disabled
    summary_chain: enabled | fallback | disabled
  fallback_reason: vector_unavailable | graph_not_in_p0 | reranker_unavailable | provider_missing | null
```

查询规划顺序：

```text
1. 先确定结构化过滤字段
2. 再决定是否需要 Text-to-SQL
3. 再决定 keyword search 和 vector search 的组合
4. 再决定是否沿 relation / backlink 扩展
5. 最后决定上下文预算和引用数量
```

Text-to-SQL 第一版应只允许：

```text
SELECT
```

禁止由自然语言直接触发：

```text
INSERT
UPDATE
DELETE
DROP
ALTER
```

检索策略路由表：

| 问题类型 | P0 默认路线 | P1/P2 增强 | 边界 |
|---|---|---|---|
| 简单事实问题 | FTS5 / BM25 + metadata filter | query rewrite | 不调用 LLM 也必须可返回 Evidence |
| 概念解释问题 | sqlite-vec / embedding + keyword merge | reranker / semantic query expansion | embedding 缺失时回退关键词 + metadata |
| 关系分析问题 | confirmed relation / relation suggestion evidence | GraphRAG / 图数据库 | P0 不启用 GraphRAG runtime |
| 总结归纳问题 | multi-document retrieval + evidence-only summary template | summary chain / LLM answer | P0-Z0a 只返回证据摘要 |
| 时间线问题 | time metadata filter + keyword | Text-to-SQL planner | 时间字段缺失要进入 evidence gaps |
| 文件定位问题 | files / sources / source_path index | 文件内容聚类 | 返回文件来源而不是生成结论 |
| 复杂综合问题 | hybrid search | LTR / multi-step agent | P0 不做自主多步工具执行 |

### 6.5 Retrieval Orchestrator 检索编排器

目标：

执行 Retrieval Plan，并将多种结果合并成候选证据。

检索通道：

```text
structured_sql
metadata_filter
tag_filter
folder_filter
full_text_search
knowledge_unit_vector_search
chunk_vector_search
source_description_search
quality_signal_filter
version_state_filter
relation_evidence
backlink_expansion
```

推荐默认策略：

```text
1. SQL / metadata / tag / status 先过滤
2. Knowledge Unit 向量检索找知识层语义匹配
3. Chunk 向量检索找原文证据
4. keyword search 补充精确术语
5. confirmed relation / relation suggestion evidence 补充上下文
6. rerank 后输出 Evidence Candidate
```

P0 检索通道收敛：

- Keyword：SQLite FTS5 / BM25，负责文件名、标题、人名、项目名、术语等精确命中。
- Vector：`embeddings` + sqlite-vec，负责概念解释和语义相近内容；provider 缺失时保留 fallback 分数。
- Metadata：项目、时间、标签、文件类型、权限、状态、source reliability 等过滤。
- Relation：P0 只读 confirmed relation 和 relation suggestion evidence；GraphRAG / Neo4j / NebulaGraph 仍为 P1/P2。
- Hybrid：合并关键词、向量、metadata 和 relation 结果，输出统一 candidate list。

`ranking_profile` 建议记录：

```yaml
ranking_profile:
  merge_strategy: weighted_sum | reciprocal_rank_fusion | rule_merge
  weights:
    keyword_score: number
    vector_score: number
    metadata_match: number
    source_reliability_score: number
    recency: number
    feedback_weight: number
  reranker:
    provider_key: bge_reranker_v2 | jina_reranker | null
    capability_status: available | fallback | unavailable | disabled | error
    fallback_reason: reranker_unavailable | not_configured | null
  dedupe_strategy: source_chunk_dedupe | mmr | none
```

Reranker 缺失时必须回退 `hybrid merge score`，不得把未重排结果伪装成 cross-encoder rerank。

### 6.6 Evidence Pack Builder 证据包构建器

目标：

把零散检索结果组织成 Agent 可使用、用户可检查的证据包。

Evidence Pack 初步字段：

```text
evidence_pack_id
request_id
knowledge_units
chunks
sources
source_descriptions
relations
query_trace
ranking_scores
permission_notes
parse_warnings
chunk_quality_notes
source_version_notes
quality_event_notes
evidence_gaps
created_at
```

`citation_trace_profile` 建议记录：

```yaml
citation_trace_profile:
  source_binding_status: bound | partial | missing
  citation_targets:
    knowledge_unit_ids: [uuid]
    chunk_ids: [uuid]
    source_ids: [uuid]
    file_ids: [uuid]
  source_locations:
    - source_id: uuid
      chunk_id: uuid | null
      page_number: integer | null
      section_title: string | null
      text_span: string | null
  citation_confidence: 0.0-1.0
  source_reliability_label: official | user_confirmed | uploaded | ai_generated | unknown
```

预览、摘要、知识卡片只能辅助用户理解 Evidence Pack，不能替代 Source / Chunk / Knowledge Unit citation。

证据包应包含：

- 命中的 Knowledge Unit；
- 支撑这些知识的 Chunk；
- 原始 Source；
- Source Description；
- 相关关系；
- 检索路径；
- 排序理由；
- 权限过滤结果；
- 处理状态、parse warning、chunk quality 和版本说明；
- 未找到证据的空缺说明。

### 6.7 Context Composer 上下文组装器

目标：

把 Evidence Pack 转成适合模型使用的上下文。

上下文顺序建议：

```text
1. System policy / task instruction
2. User task
3. Scope and constraints
4. Confirmed Knowledge Units
5. Supporting Chunks
6. Source metadata
7. Processing quality / version notes
8. Relations / Backlinks
9. Evidence gaps
10. Output requirements
```

上下文预算策略：

- Knowledge Unit 优先于完整 Chunk；
- 高置信度、已确认、高相关的知识优先；
- Source Description 可作为资料级压缩摘要；
- Chunk 只放入必要证据片段；
- 存在 parse warning 或 chunk quality 风险的证据必须显式标记；
- 关系扩展必须受预算和相关性控制；
- 不确定或未确认内容必须带状态标识。

### 6.8 Answer / Creation Engine 生成引擎

> **AI 能力栈归属**：本模块及 6.1–6.7 中涉及的 AI 能力（意图识别、查询规划、Text-to-SQL、RAG 回答、创作输出、Reranking）属于 Invocation AI（调用侧 AI），详见 `docs/product-architecture.md` Section 4.0.1。Invocation AI 的输出必须区分证据和推理，引用来源必须可追溯。

目标：

基于 Agent Context 生成回答、提纲、脚本、研究总结、设计叙事或决策建议。

输出类型：

```text
answer
summary
outline
script
brief
comparison_table
decision_memo
research_synthesis
project_review
knowledge_gap_report
```

生成原则：

- 不把无证据推理伪装成知识库结论；
- 对知识库无法支持的内容明确说明；
- 创作任务可以加工，但要标出使用了哪些知识资产；
- 决策任务应区分事实、判断、建议和风险；
- 复盘任务应保留项目时间线和来源。
- P0-Z0a 默认只输出 `evidence_only_answer`，不调用 LLM。
- P0-Z2 或显式 Provider 增强路径才允许 `rag_answer`；所有生成内容都必须绑定 Evidence Pack 和 Citation。
- 内容生成模块在 P0 只产出 evidence-bound 草稿或 Review payload，不自动写 confirmed Memory / Knowledge Unit；生产级创作稿、决策建议和项目复盘生成进入 P1/P2。

### 6.9 Citation + Explanation Layer 引用与解释层

目标：

让用户知道 Agent 为什么这样回答。

应展示：

- 使用了哪些 Knowledge Unit；
- 每条 Knowledge Unit 来自哪些 Source / Chunk；
- SQL 查询或结构化过滤条件；
- 使用了哪些标签、文件夹、状态和权限过滤；
- 是否使用 relation / backlink 扩展；
- 是否存在 parse warning、chunk quality 风险或版本差异；
- 哪些反馈事件或质量事件影响了排序和解释；
- 哪些证据是直接支持，哪些只是相关背景；
- 哪些内容缺少知识库证据。

输出中至少应保留：

```text
cited_knowledge_unit_ids
cited_chunk_ids
cited_source_ids
generated_sql
retrieval_plan_summary
processing_quality_summary
source_version_summary
evidence_gap_notes
```

溯源展示必须支持：

- Chunk ID 定位；
- Source / File / source_path 定位；
- 页码、章节、段落或 text span 回显；
- 引用可信度和 source reliability；
- 用户反馈中标记的 bad citation / missing source。

### 6.10 Feedback + Memory Loop 反馈与再沉淀

目标：

把一次调用的价值重新送回建库系统。

用户操作：

```text
save_as_memory
save_as_candidate_knowledge_unit
mark_answer_useful
mark_answer_wrong
request_more_sources
request_narrower_scope
request_retrieval_explanation
flag_bad_citation
mark_source_missing
favorite_evidence
downrank_source
```

沉淀流程：

```text
AIAnswer
→ Memory Draft / Candidate Knowledge Unit
→ Review Item
→ Validation
→ Confirmed Memory / Confirmed Knowledge Unit
```

原则：

- AI 输出不能无确认直接成为长期记忆；
- 保存回答时必须保留引用和生成上下文；
- 用户修正应反向更新检索偏好、标签或知识状态；
- 错误回答应产生可追踪的质量事件；
- 有用 / 无用、缺少来源、错误引用等反馈应记录为 feedback event，供后续 Query Explanation 和排序策略复盘。
- `feedback_signal` 只能影响后续排序建议和解释，不得静默修改 confirmed knowledge、citation 或 source truth。
- Learning-to-Rank 只作为 P2 评估；P0 仅记录反馈和派生权重摘要。

`feedback_signal` 建议结构：

```yaml
feedback_signal:
  signal_type: click | favorite | useful | not_useful | bad_citation | missing_source | downrank_source
  target_type: evidence_pack | evidence_item | ai_answer | citation | knowledge_unit | source
  ranking_effect: positive | negative | neutral
  applies_to_next_retrieval: true | false
  feedback_policy:
    storage_scope: local_only
    effect_scope: current_project | current_knowledge_space | global_user_profile
    weight_cap: number
    retention_days: integer | null
    requires_review_for_global_weight: true | false
```

---

## 7. 核心数据对象

### 7.1 InvocationRequest

表示一次用户知识调用请求。

P0-Z0a 可以只在 API response summary 与 `retrieval_logs` 中表达 invocation 摘要；`invocation_requests` 作为持久表进入 P0-Z2，或作为提前实现的可选增强，不是 Z0a blocking 条件。

作用：

- 保存原始问题；
- 标记任务类型；
- 关联用户、项目和上下文；
- 作为 RetrievalPlan、EvidencePack 和 AIAnswer 的上游对象。

### 7.2 RetrievalPlan

表示系统准备如何查询知识库。

P0-Z0a 可以只在 `retrieval_logs.filters_json`、`retrieval_logs.ranking_scores` 和 response summary 中保存 `query_understanding_profile`、`retrieval_strategy_profile`、`ranking_profile`、`citation_trace_profile`；`retrieval_plans` 持久化进入 P0-Z2。

作用：

- 保存 SQL、关键词、向量、关系扩展等计划；
- 支持调用解释；
- 支持复盘检索质量；
- 支持后续优化检索策略。

### 7.3 EvidencePack

表示供 Agent 使用的证据集合。

作用：

- 连接 Knowledge Unit、Chunk、Source 和 Relation；
- 保留排名分数；
- 标明证据强弱；
- 标明检索空缺；
- 作为生成上下文的来源。

### 7.4 AgentContext

表示最终传给模型的上下文。

作用：

- 控制上下文预算；
- 组织知识、证据和任务指令；
- 明确状态和权限；
- 保证模型能区分证据、背景和输出要求。

### 7.5 AIAnswer

表示一次 Agent 输出。

作用：

- 保存回答内容；
- 保存引用；
- 保存生成 SQL 和检索路径；
- 支持用户反馈；
- 支持保存为 Memory 或 Candidate Knowledge Unit。

### 7.6 Memory

表示从回答、用户确认或长期偏好中沉淀出的记忆。

作用：

- 支持长期个人 Agent；
- 保存用户偏好、项目判断、创作风格和已确认结论；
- 必须保留来源、确认状态和权限。

---

## 8. P0 / P1 / P2 分期

### 8.1 P0：可解释检索、证据包与引用预览

P0 目标：

```text
用户提出问题
→ 系统限定范围和权限
→ 检索已确认 Knowledge Unit
→ 检索支撑 Chunk
→ 返回 Evidence Pack
→ 展示 Citation Preview、Query Explanation 和 evidence-only answer
→ 将需要沉淀的内容送入 Review
```

P0 能力：

- Invocation response summary；`invocation_requests` 持久化在 P0-Z2 补齐；
- 基础 `query_understanding_profile`：intent、query rewrite fallback、关键词、范围、约束和输出格式；
- `retrieval_strategy_profile`：按问题类型选择 FTS5/BM25、向量、metadata、file index、relation evidence 或 hybrid search；
- `ranking_profile`：hybrid score、source reliability、recency、feedback weight 和 reranker fallback；
- `citation_trace_profile`：Chunk / Source / File / text span / source reliability 溯源；
- `feedback_signal`：点击、收藏、有用/无用、错误引用、缺失来源；
- 权限和状态过滤；
- 结构化 metadata / tag / folder filter；
- Knowledge Unit 检索；
- Chunk 证据检索；
- Evidence Pack 结构化输出；
- Citation Preview；
- Query Explanation；
- 处理状态、parse warning、chunk quality、source version 和 evidence gaps 的解释展示；
- 引用展示；
- RetrievalLog；
- AIAnswer 在 P0-Z0a 固定为 `evidence_only_answer`，不调用 LLM；P0-Z2 或显式 Provider 增强路径允许 `rag_answer`，缺失时仍 fallback；
- Save as pending Memory / Candidate Knowledge Unit。

P0 暂不要求：

- 真实 Text-to-SQL 模型；
- 自动复杂 SQL 规划；
- P0-Z0a 的 LLM answer；
- 无 Evidence Pack 的真实 RAG answer；
- 生产级 GraphRAG runtime；
- 生产级创作稿、决策建议或项目复盘生成；
- GraphRAG Global Search；
- 自动 community summary；
- 多 Agent 工具执行；
- 未确认知识默认调用。

### 8.2 P1：带引用 RAG 与关系扩展

P1 加入：

- 真实 RAG answer with citations；
- relation expansion retrieval；
- reranker；
- AI 推荐补充查询；
- 问答追问链；
- Memory 管理面板；
- 召回质量反馈；
- Text-to-SQL mock / rule-based planner 到真实模型的过渡评估。

### 8.3 P2：全局知识理解与项目级复盘

P2 再评估：

- community summary；
- Global Search；
- DRIFT-like search；
- MOC / project knowledge map 自动总结；
- Neo4j 或 LightRAG 作为可替换检索后端；
- 多任务 Agent 调用；
- 跨项目知识迁移；
- 创作风格长期建模。

### 8.4 AI 智能体系统 P0 边界

D-080 后，AI 智能体系统在 P0 只作为“隐式单 Agent + 只读调用编排”存在：

| 模块 | P0 行为 | P1/P2 行为 |
|---|---|---|
| 对话模块 | 保存当前对话上下文、历史 AIAnswer / Evidence Pack 引用 | 多轮长期会话记忆、Agent 私有记忆 |
| 意图理解模块 | `query_understanding_profile` + 低置信度澄清 | LLM Router / 多意图拆解 |
| 任务规划模块 | 只生成只读 retrieval / evidence plan 和 query explanation | 多步 Agent Planner / 工具选择 / 执行检查 |
| 工具调用模块 | 仅调用内部知识库、只读数据库模板、文件/source 定位和 evidence builder | 外部 API、文件系统写操作、跨应用自动化 |
| RAG 问答模块 | evidence-only answer；Provider 可用时带引用 answer | 多 provider 评估、事实检查链 |
| 内容生成模块 | summary / outline / table / rewrite 草稿，进入 Review | 报告、PPT、项目方案等生产级生成 |

P0 不实现多 Agent、自主工具执行、外部 API 调用、跨应用操作或未确认长期记忆写入。

### 8.5 前端交互系统 P0 契约

前端系统默认 Electron + React + Vite + TypeScript，不切换 Vue / Next / SaaS Web。P0 页面与交互契约：

| 前端模块 | P0 页面 / 交互 | 状态与异常 |
|---|---|---|
| 页面模块 | AI 工作台首页、项目选择、上传资料、文件管理、知识库、对话/RAG、数据可视化入口、设置页 | 当前项目、上传状态、检索结果、对话上下文、页面缓存 |
| 图形系统 | 信息卡片、文件列表、知识单元卡、引用卡、标签、图谱节点 | Loading Skeleton、空状态、质量 warning |
| 交互系统 | 拖拽上传、搜索输入、Chat UI、Citation 展开、Feedback 按钮、图谱拖拽 | 上传失败、检索失败、AI answer fallback、无权限、网络异常 |
| 动效系统 | 上传进度、AI 思考、页面切换、图谱展开、成功/失败反馈 | SSE 默认，WebSocket P1 |
| 接口请求 | fetch/Axios API client + SSE | Toast、Error Boundary、Auth Guard |

前端展示不得把 evidence-only answer 包装成真实 LLM 回答；必须显示 provider/fallback 状态和 citation/evidence 来源。

---

## 9. 与数据模型和 API 的关系

后续数据模型 v0.1 应为知识调用系统预留以下对象或表：

```text
invocation_requests
retrieval_plans
evidence_packs
evidence_items
ai_answers
answer_citations
memories
retrieval_feedback
feedback_events
quality_events
version_snapshots
processing_status_events
parse_warnings
chunk_quality_checks
v_invocation_evidence
```

P0-RAG 约束：

- `evidence_packs` 应能持久化一次调用使用的 Knowledge Unit、Chunk、Source 和查询路径；
- `evidence_items` 应能持久化每条证据的对象类型、证据角色、排名和引用关系；
- `answer_citations` 同时服务 Citation Preview 和 RAG answer / evidence-only answer；P0-Z0a 可先用 Evidence Item citation label 生成证据摘要，Z0b 再补齐 citation 明细表；
- `sensitive_access_grants` 是一次性授权对象，不改变长期权限策略；
- `ai_answers.output_type` 在 P0 允许 `retrieval_preview` / `mock_answer` / `evidence_only_answer` / `rag_answer`；P0-Z0a 只启用 `evidence_only_answer`，不调用 LLM；
- `v_invocation_evidence` 用于把 InvocationRequest、EvidencePack、KnowledgeUnit、Chunk、Source 和 Citation 连接为只读查询视图。
- `feedback_events`、`quality_events`、`parse_warnings` 和 `chunk_quality_checks` 用于支撑 Citation Preview / Query Explanation 的质量说明，进入 P0-RAG 可复盘链路；复杂 `version_snapshots` 可留到 P1+。
- `processing_status_events` 属于 P0-File / P0-AI 状态时间线；UI 可从它或当前状态字段派生展示。
- D-080 profile 不新增表：`query_understanding_profile`、`retrieval_strategy_profile`、`ranking_profile`、`citation_trace_profile` 和 `feedback_signal` 写入 `retrieval_plans` / `retrieval_logs` / `evidence_packs` / `evidence_items` / `ai_answers` / `feedback_events` 的 JSON 字段或响应摘要。

需要复用建库系统对象：

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
review_tasks
retrieval_logs
audit_logs
```

API 方向：

```text
Invocation APIs
Retrieval Plan APIs
Evidence Pack APIs
Citation Preview APIs（P0-RAG）
Query Explanation APIs（P0-RAG）
Feedback / Memory Draft APIs（P0-RAG）
RAG Answer APIs（P0-Z0a evidence-only；P0-Z2 Provider answer / fallback）
Memory Management APIs（P1）
```

---

## 10. UX 要求

知识调用系统不应只是一个聊天框。

关键界面：

1. Query / Creation Workspace；
2. Scope Selector；
3. Retrieval Explanation Panel；
4. Evidence Pack Viewer；
5. Citation Inspector；
6. SQL / Query Trace Panel；
7. Related Knowledge Panel；
8. Memory Save Review；
9. Answer Feedback Panel。

核心体验要求：

- 用户能看到检索范围；
- 用户能看到引用来源；
- 用户能看到哪些知识被调用；
- 用户能看到哪些证据缺失；
- 用户能保存有价值输出；
- 用户能纠正错误调用；
- 用户能排除某些知识不再被 Agent 使用。

---

## 11. 验收清单

后续每次更新本文档，应检查：

- 是否清楚区分 Knowledge Unit、Chunk、Source、Memory 和 AIAnswer？
- 是否说明 Text-to-SQL 与 RAG 的分工？
- 是否避免全库向量 top-k 作为默认检索路径？
- 是否明确权限、状态和用户确认对调用范围的影响？
- 是否说明 Evidence Pack 的组成？
- 是否说明输出中的证据、推理和创作加工边界？
- 是否保留引用展示和查询解释？
- 是否说明调用结果如何进入 Review 后再沉淀？
- 是否明确 P0 / P1 / P2 边界？
- 是否与建库系统数据对象保持一致？
- 是否记录并解释 `query_understanding_profile`、`retrieval_strategy_profile`、`ranking_profile`、`citation_trace_profile` 和 `feedback_signal`？
- 是否明确 P0 是隐式单 Agent、只读内部工具调用，不做多 Agent 自主执行？
- 是否说明前端的上传、检索、RAG、citation、反馈和异常状态如何展示？

---

## 12. 风险与待确认

### 12.1 产品风险

- 如果调用系统过早变成聊天框，会弱化知识结构。
- 如果解释层过重，用户可能不愿使用。
- 如果未确认知识默认进入调用，会污染个人 Agent。
- 如果保存 Memory 过于容易，会形成长期记忆噪音。
- 如果引用展示不清楚，用户难以信任回答。

### 12.2 技术风险

- Text-to-SQL 生成错误 SQL 可能导致错误答案或权限风险。
- 多通道检索结果合并和排序需要逐步调优。
- Relation expansion 可能带入弱相关知识。
- 上下文预算控制不当会丢失关键证据。
- Evidence Pack 和 AIAnswer 如果不持久化，后续难以复盘。
- 如果 query rewrite、reranker 或 GraphRAG 不可用却没有 fallback 状态，用户会误判结果质量。
- 如果前端只展示聊天气泡而隐藏 Evidence / Citation / Query Explanation，产品会退化为普通聊天框。

### 12.3 待确认问题

- Text-to-SQL 第一版用规则模板、mock，还是接真实模型？
- Evidence Pack 的第一版持久化粒度是调用级、证据项级，还是同时保留两层？
- `AIAnswer.output_type` 草案已采用 `retrieval_preview` / `mock_answer` / `rag_answer`，需要确认是否足够覆盖 P0 和 P1。
- Memory 与 Knowledge Unit 的边界如何定义？
- Agent 调用是否允许使用 `pending_review` 知识作为弱证据？
- Citation 展示粒度到 Knowledge Unit 即可，还是必须到 Chunk / Source location？
- relation expansion 的默认深度是 1 跳，还是按任务类型调整？
- feedback_signal 是否只作为排序权重建议，还是 P1 后进入 Learning-to-Rank 训练数据？

---

## 13. 当前推荐的下一步

建议后续按以下顺序继续优化：

1. 定义 `InvocationRequest` 最小字段集。
2. 定义 `RetrievalPlan` 最小字段集和典型计划模板。
3. 定义 `EvidencePack` 结构和引用展示规则。
4. 定义 `AIAnswer` 与 `Memory` 的边界。
5. 评审 P0 Citation Preview、Query Explanation 和 `AIAnswer.output_type` 规则。
6. 评审 `docs/text-to-sql.md` 中的 P0 可查询对象、只读视图、典型 SQL 模板和 Query Explanation。
7. 评审 `docs/data-model.md` 中的调用系统对象、`evidence_items` 和 `v_invocation_evidence`。
8. 评审 `docs/api-design.md` 中 Invocation、Retrieval Plan、Evidence Pack、Citation Preview、Query Explanation 和 Feedback / Memory Draft API。
9. 评审 `docs/api-implementation-plan.md` 中 Invocation / Evidence / Feedback 的 route-level 实施映射。

---

## 14. 当前架构结论

知识调用系统第一版不应追求全自动 Agent。

更合理的目标是：

> 让 Agent 能在明确范围、明确权限、明确证据的前提下，调用已确认的个人知识资产，并把回答、引用、查询路径和后续沉淀流程完整记录下来。

因此，知识调用系统第一阶段的核心链路是：

```text
Invocation Request
→ Retrieval Plan
→ Evidence Pack
→ Agent Context
→ Citation Preview / Query Explanation
→ Feedback / Memory Review
```

这条链路应成为后续 Agent 问答、创作辅助、项目复盘和长期个人记忆系统的基础。
