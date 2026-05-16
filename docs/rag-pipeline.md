# RAG 与 Embedding 向量检索管线

版本：v0.7-draft  
日期：2026-05-17  
状态：草案——明确 P0-Z0a evidence-only、P0-Z2 RAG answer、embedding profile registry、chunk quality/source metadata 风险、D-080 query / strategy / ranking / citation trace / feedback profile、D-081-D085 调用持久化边界 / InvocationProfileSchema v1 / feedback_policy / Z0a retrieval_log 锚点与 provider fallback

## 1. 文档目的

本文档用于回答一个工程问题：

```text
本项目如何用 Embedding 和向量检索支撑 RAG？
```

结论：

- **Embedding + Vector Index** 构成本项目的向量检索层。
- **RAG** 是调用向量检索、全文检索、结构化过滤和证据组装的流水线。
- **P0 不引入独立向量数据库服务**，而是在主库中建设向量能力：SQLite + `embeddings` 表 + sqlite-vec。
- **P0-RAG 分阶段支持 answer**：P0-Z0a 先生成 `evidence_only_answer` 且不调用 LLM；P0-Z2 或显式 Provider 增强路径再生成 `rag_answer`，不可用时继续 `evidence_only_answer`。
- **D-080-D085 调用 profile**：RAG 入口必须先形成 `query_understanding_profile`、`retrieval_strategy_profile`、`ranking_profile`、`citation_trace_profile` 和 `feedback_policy`；P0-Z0a 只要求在 response / `retrieval_logs` 中保留 summary，并用 `retrieval_log_id` / `evidence_pack_id` 串起 Evidence / Answer；`invocation_requests`、`retrieval_plans`、`memories`、`retrieval_feedback` 进入 P0-Z2 或可选提前实现。
- **InvocationProfileSchema v1**：调用 profile 统一记录 `profile_envelope`、`rewrite_status`、`relation_evidence`、`source_reliability_score` / `source_reliability_label` 和 `fallback_reason`，避免散落 JSON 口径漂移。
- **P1 优先迁移 PostgreSQL + pgvector**，仍保持一库混合；只有当规模、并发或运维确实需要时，才评估 Qdrant / LanceDB / Milvus / Pinecone 等独立向量引擎。

---

## 2. 核心边界

### 2.1 RAG 不是向量数据库

RAG 是 Retrieval-Augmented Generation，即：

```text
检索相关知识
→ 组装证据
→ 构建模型上下文
→ 生成带来源的回答
```

向量数据库或向量索引只是 RAG 的检索通道之一。RAG 不能替代数据库设计，也不能替代权限、来源、Review、引用和查询解释。

### 2.2 Embedding 才是向量检索入口

Embedding 将 Source Description、Chunk、Knowledge Unit 等文本转成向量，支持语义相似度召回。

P0 默认优先使用开源 embedding profile（当前候选 `bge_m3_local`）。当 provider 未安装、被禁用或 runtime probe 失败时，使用 `mock_fixed_384` fallback 验证：

- 向量记录能写入；
- 向量记录能和业务对象关联；
- 检索链路能返回排序结果；
- 检索结果能进入引用和 query explanation。

`mock_fixed_384` 不代表真实语义召回质量。若 P0 配置了开源 embedding provider，可以生成真实向量，但仍必须在 Query Explanation 中标明 provider、profile、dimension、capability_status 和 fallback_reason。

### 2.3 向量库层必须存在，但运行时可降级

P0-Core / P0-AI 必须包含：

- `embeddings` 表；
- `EmbeddingRepository`；
- `VectorStoreService` 或等价向量检索抽象；
- embedding profile registry（至少包含 `bge_m3_local` 与 fallback `mock_fixed_384`）；
- 向量生成 / 失效 / 重建的状态字段；
- Retrieval Preview 中的向量通道解释。

sqlite-vec 运行时如果暂时不可用，可以降级为 deterministic score / keyword ranking，但不能删除 `embeddings` 表、Repository 抽象和向量检索接口。

---

## 3. 分阶段路径

### 3.1 P0-AI：向量检索基础设施

P0-AI 必须把向量检索底座建好。

```text
Source / Chunk / Knowledge Unit
→ 生成 embedding_text
→ 写入 embeddings 表
→ sqlite-vec 可用时写入向量索引
→ Retrieval Preview 调用 keyword + vector profile ranking / fallback ranking
→ 返回 match_reasons / ranking_strategy / query_explanation
```

P0-AI 验收重点：

- 确认后的 Knowledge Unit 才进入默认检索；
- Chunk 负责证据引用，Knowledge Unit 负责知识调用；
- Retrieval Preview 能说明命中了 keyword、tag、metadata 还是 vector；
- fallback vector 被明确标记为 `capability_status=fallback`，不用于语义质量承诺。

### 3.2 P0-RAG：证据链与回答

P0-RAG 在已确认知识和向量检索可用后实现：

```text
Invocation Request（Z0a response/log summary；Z2 persisted）
→ Query Understanding Profile
→ Retrieval Strategy Profile
→ Retrieval Plan（Z0a response/log summary；Z2 persisted）
→ Hybrid Retrieval
→ Ranking Profile
→ Evidence Pack
→ Citation Trace / Citation Preview
→ Query Explanation
→ RAG Answer / evidence-only answer
→ Feedback Signal / Memory Draft
```

P0-RAG 必须让用户看到：

- 检索范围；
- 使用了哪些结构化过滤；
- 向量检索是否参与；
- 证据来自哪些 Source / Chunk / Knowledge Unit；
- 选择了哪条 retrieval strategy route；
- 排序分数组成：hybrid score、metadata 权重、`source_reliability_score`、feedback weight；
- citation 能否回到 Chunk ID、Source/File、页码/段落/text span；
- 哪些证据强，哪些只是推理线索。
- P0-Z0a 默认只生成 evidence-only answer，不调用 LLM；P0-Z2 或显式 Provider 增强路径生成带引用 RAG answer，Provider 缺失时返回 evidence-only answer。

### 3.3 P1：质量增强与规模化

P1 增强：

- 更稳定的 embedding / reranker / LLM provider；
- 检索质量评估集；
- embedding 重建任务；
- 成本、延迟和失败率记录。

P1 默认优先：

```text
PostgreSQL + pgvector + full-text + JSONB + relational schema
```

不要在没有规模证据前拆成独立向量服务。

---

## 4. 数据对象

### 4.1 Embedding owner

P0 支持三类 embedding：

| owner_type | 用途 |
|---|---|
| source_description | 资料级粗召回，帮助 Agent 先判断是否值得深入读取 |
| chunk | 证据片段召回，服务 citation 和 source-grounded answer |
| knowledge_unit | 知识资产召回，服务创作、问答和长期记忆调用 |

### 4.2 embeddings 表关键字段

详见 `docs/data-model.md` §6.12。实现时至少保留：

| 字段 | 作用 |
|---|---|
| owner_type / owner_id | 绑定业务对象 |
| embedding_profile | 区分 mock / provider profile |
| model_id | 记录模型或 mock 名称 |
| dimension | 向量维度 |
| vector | SQLite BLOB / sqlite-vec 格式 |
| content_hash | 判断是否需要重建 |
| embedding_text | 生成向量的文本快照或摘要 |
| status | pending / ready / stale / failed |
| error_message | 记录生成失败原因 |

### 4.3 embedding_text 生成策略

P0 可以使用确定性规则：

```text
source_description:
title + summary + keywords + user_note

chunk:
section_title + content + source title

knowledge_unit:
title + type + content + tags + source title
```

P1 接入真实模型后，embedding_text 必须保持可重建、可解释、可哈希。

---

## 5. Hybrid Retrieval

RAG 不应只做全库向量 top-k。默认检索顺序：

```text
1. query_understanding_profile：intent / `rewrite_status` / keyword / scope / constraint / output format
2. retrieval_strategy_profile：按问题类型路由到 BM25、vector、metadata、file index、`relation_evidence` 或 hybrid
3. scope filter：project / folder / source / permission
4. status filter：默认只读 confirmed / 可调用知识
5. structured filter：type / tags / dates / source_origin
6. keyword retrieval：SQLite FTS5 / BM25
7. vector retrieval：sqlite-vec / pgvector
8. relation evidence：只读 confirmed relation 或 relation_suggestion evidence
9. ranking_profile：hybrid score + metadata 权重 + source_reliability_score / source_reliability_label + feedback weight；reranker 缺失时 fallback
10. evidence assembly：组装 Source / Chunk / KU 引用
11. citation_trace_profile：还原 Chunk ID / Source / File / page / paragraph / text span
12. query explanation：说明检索路径、排序、fallback 和证据空缺
```

问题类型路由：

| question_type | P0 route |
|---|---|
| `simple_fact` | FTS5 / BM25 + metadata filter |
| `concept_explanation` | sqlite-vec vector search + metadata filter |
| `timeline` | metadata filter + time fields |
| `file_lookup` | source / file index |
| `relationship_analysis` | confirmed relation / relation_suggestion evidence |
| `summary_synthesis` | hybrid search + Evidence Pack |
| `complex_hybrid` | keyword + vector + metadata + relation evidence |

P0-AI 至少完成 3-7，并在结果中返回 `match_reasons` 与基础 `ranking_strategy`。

P0-RAG 完成 1-2、8-12，形成 Evidence Pack、Citation Preview、Query Explanation。P0-Z0a 基于这些证据生成 `evidence_only_answer`；P0-Z2 或显式 Provider 增强路径生成 `rag_answer`，Provider 缺失时生成 `evidence_only_answer`。

---

## 6. API 与服务边界

实现阶段建议保留以下服务边界：

| 服务 | 职责 |
|---|---|
| `EmbeddingService` | 生成 embedding_text、调用 mock / provider、计算 content_hash |
| `EmbeddingRepository` | 持久化 embeddings 表 |
| `VectorStoreService` | 封装 sqlite-vec / pgvector / fallback ranking |
| `QueryUnderstandingService` | 生成 `query_understanding_profile`；不需要改写时写 `rewrite_status=not_needed`，需要改写但 Provider 缺失时才写 fallback |
| `RetrievalStrategyService` | 生成 `retrieval_strategy_profile`，把问题类型路由到 P0 检索通道 |
| `RetrievalPreviewService` | P0-RAG 检索预览 |
| `RetrievalPlanService` | P0-Z0a 生成 response / retrieval log summary；P0-Z2 持久化 `retrieval_plans` |
| `RankingService` | 生成 `ranking_profile`；区分 `source_reliability_score` 与 `source_reliability_label`；reranker 缺失时回退 hybrid score |
| `EvidencePackService` | P0-RAG 组装证据 |
| `CitationTraceService` | 生成 `citation_trace_profile`；禁止用预览/摘要/卡片替代 citation |
| `FeedbackSignalService` | 保存 `feedback_signal` 和 `feedback_policy`；只影响排序建议和诊断，不自动改写 confirmed knowledge |
| `RagAnswerService` | P0-Z0a 生成 evidence-only answer；P0-Z2 或显式 Provider 增强路径生成带引用回答，Provider 缺失时生成 evidence-only fallback |

P0 不要求暴露完整 embedding 管理 UI，但内部必须有重建入口。API 草案保留：

```text
POST /api/embeddings/rebuild
POST /api/retrieval/preview
POST /api/rag/answers
```

---

## 7. 不做什么

P0 不做：

- 纯向量数据库 Demo；
- 不经过 Review 的自动长期记忆；
- 全库向量 top-k 直接喂给模型；
- 没有来源引用的 RAG answer；
- 独立部署 Milvus / Pinecone / Qdrant / Weaviate；
- 用 LightRAG / GraphRAG 替代当前数据模型；
- GraphRAG / Learning-to-Rank 作为 P0 运行时强依赖；
- 反馈自动改写 confirmed Knowledge Unit、confirmed relation 或 source truth；
- 多 Agent 自主执行、外部 API 工具调用或 WebSocket 必需通道；
- 真实 embedding 质量承诺。

---

## 8. 验收标准

P0-AI 必须验证：

- 创建 Source、Chunk、Knowledge Unit 后能生成 `embeddings` 记录；
- confirmed Knowledge Unit 能参与 Retrieval Preview；
- 未确认、`do_not_use` 或权限不允许的知识不会默认进入检索；
- sqlite-vec 可用时走向量检索；
- sqlite-vec 不可用时仍通过 `VectorStoreService` 降级，不绕开向量层抽象；
- 检索结果包含 `match_reasons`、`ranking_strategy` 和基础 `query_explanation`；
- 文档明确标注 fallback vector 不代表真实语义质量，真实 provider 必须标明 profile 与 dimension。
- D-080 路由场景中 simple_fact、concept_explanation、timeline、file_lookup、relationship_analysis、summary_synthesis、complex_hybrid 均有 deterministic fallback。

P0-RAG 必须验证：

- Evidence Pack 能引用 Source / Chunk / Knowledge Unit；
- Citation Preview 能展示证据来源、`source_metadata`、parse warning、chunk quality 风险和 `citation_trace_profile`；
- Query Explanation 能说明 query_understanding、retrieval_strategy、结构化过滤、关键词检索、向量检索、ranking_profile 和 fallback 是否参与。
- `feedback_signal` 能记录错误引用、缺失来源、有用/无用等反馈，并通过 `feedback_policy` 限定 local_only / current_project / capped_weight；不改写 confirmed knowledge。
- `implicit_agent` 只保留隐式单 Agent、只读规划、内部检索和带 citation 回答。
- P0-Z0a 生成 `evidence_only_answer` 且不调用 LLM；P0-Z2 或显式 Provider 增强路径可生成 `rag_answer`，Provider 缺失时生成 `evidence_only_answer`。

P1 必须验证：

- 真实 embedding provider 的召回质量；
- RAG answer 的 citation accuracy；
- Reranker 是否提升结果质量；
- embedding 重建和模型切换不会破坏旧数据。
