# 开源 RAG / GraphRAG 调研记录

版本：v0.1  
日期：2026-05-08  
状态：已完成 LightRAG 与 GraphRAG 方向的第一轮架构吸收

## 1. 文档目的

本文档记录对 LightRAG、Microsoft GraphRAG、Neo4j GraphRAG 和 LlamaIndex GraphRAG 的第一轮调研结论。

本项目吸收这些开源方案的目标不是直接复制一个 RAG 引擎，而是判断哪些机制能服务“个人知识建库系统”：

- 如何从文本中构建关系；
- 如何把 chunk、实体、关系、摘要和来源连接起来；
- 如何区分局部检索与全局理解；
- 如何为未来 Agent 调用系统提供可解释证据；
- 如何避免在工程 P0 阶段引入过重的自动图谱和 RAG 生成系统。

## 2. 调研对象

| 项目 | 参考链接 | 与本项目相关的重点 |
|---|---|---|
| LightRAG | [HKUDS/LightRAG](https://github.com/HKUDS/LightRAG) | 图增强 RAG、实体关系抽取、混合检索、服务化和多存储后端 |
| Microsoft GraphRAG | [GraphRAG Query Engine](https://microsoft.github.io/graphrag/query/overview/) / [Indexing Dataflow](https://microsoft.github.io/graphrag/index/default_dataflow/) | text units、实体、关系、community reports、Local / Global / DRIFT Search |
| Neo4j GraphRAG | [Neo4j GraphRAG for Python](https://neo4j.com/docs/neo4j-graphrag-python/current/index.html) | 属性图数据库、Cypher、图构建 pipeline、向量索引与图检索结合 |
| LlamaIndex GraphRAG | [GraphRAG Implementation with LlamaIndex V2](https://docs.llamaindex.ai/en/stable/examples/cookbooks/GraphRAG_v2/) | PropertyGraph、三元组抽取、community summary、可组合 pipeline |

## 3. LightRAG 调研结论

LightRAG 更接近一个图增强 RAG 引擎，而不是一个完整的个人知识建库产品。

可借鉴点：

- 图增强检索不应只依赖 chunk 向量相似度，应把实体、关系、文本片段和摘要共同纳入检索。
- LightRAG 对 LLM、embedding、reranker 和存储后端有明确配置边界，说明 RAG 工程需要模块化 AI Layer。
- LightRAG server 提供 API 和 Web UI，说明 RAG 能力最终应被产品化为可操作服务，而不是隐藏在脚本里。
- LightRAG 强调 embedding 模型和向量维度在建索引前就需要确定，这对本项目的数据模型冻结有直接启发。

不直接采用的点：

- 不在工程 P0 中引入 LightRAG 作为核心依赖。
- 不把 LightRAG 的自动实体关系抽取等同于本项目的 Knowledge Unit 建库。
- 不用 LightRAG 替代 Human Review + Validation。

对本项目的架构影响：

- P0 继续保持 `text_import → Source → Source Description → Chunk → Knowledge Unit → Review → Retrieval Preview`。
- P1 可参考 LightRAG 增加 relation-aware retrieval、reranker 和图增强检索服务。
- P2 才评估是否将 LightRAG 作为可替换检索引擎或实验后端。

## 4. GraphRAG 调研结论

Microsoft GraphRAG 的核心启发是：对大规模文本集合，普通向量 RAG 很难回答“整体结构、主题脉络、跨文档关系”类问题，因此它通过文本单元、实体关系、社区发现和社区摘要来支持从局部到全局的查询。

可借鉴点：

- `text units` 类似本项目的 Chunk，但 GraphRAG 会进一步抽取实体、关系和 claim，并将其连接到来源文本。
- `community reports` 可以对应本项目未来的 MOC / 主题摘要 / 项目知识地图。
- Local Search 适合回答围绕具体实体、概念或知识点的问题。
- Global Search 适合回答“这个资料集合整体说明了什么”之类的问题。
- DRIFT Search 提醒我们：局部检索可以结合社区信息扩展起点，而不是只按 top-k chunk 召回。

不直接采用的点：

- 不在工程 P0 中引入自动社区发现、全量图谱构建或 Global Search。
- 不把自动抽取的实体关系直接写成用户确认知识。
- 不把 GraphRAG 的 answer generation 放进建库系统 P0。

对本项目的架构影响：

- P0 只保留 `knowledge_relations`、relation index 和 MOC 占位。
- P1 增加 relation expansion retrieval，用已确认 Knowledge Unit 和用户确认关系扩展检索上下文。
- P2 再设计 MOC community summary / Global Search，用于项目级、主题级和创作者复盘型问题。

## 5. Neo4j 与 LlamaIndex 的启发

Neo4j GraphRAG 说明图数据库适合处理实体、关系、路径、邻居扩展和结构化图查询。LlamaIndex GraphRAG 则说明 GraphRAG 可以作为可组合 pipeline 构建：chunk → 三元组抽取 → PropertyGraph → 社区摘要 → 查询引擎。

对本项目的判断：

- MVP 不优先引入 Neo4j。P0 使用 SQLite + FTS5 + sqlite-vec 向量通道 + 关系表足以支撑第一版建库闭环；PostgreSQL + pgvector 留作 P1 迁移选项。
- 关系表 `knowledge_relations` 应先设计清楚，后续如果图查询复杂，再迁移或同步到 Neo4j。
- LlamaIndex 的 pipeline 思路可参考，但不能替代本项目的用户确认、权限、来源审计和 Knowledge Unit 状态管理。

## 6. 对建库系统的阶段边界

### 6.1 工程 P0

P0 目标仍然是清晰建库闭环：

```text
text_import
→ Source
→ Source Description
→ Chunk
→ 手动 / 规则 / Mock Candidate Knowledge Unit
→ Classification / Tags / Properties
→ Human Review + Validation
→ Confirmed Knowledge Unit
→ Retrieval Preview with citations
```

P0 可以保留的 GraphRAG 相关能力：

- `knowledge_relations` 表；
- 手动 relation；
- relation index 占位；
- MOC 字段或视图占位；
- citation-ready retrieval；
- 检索结果显示 Source / Chunk / Knowledge Unit 来源。

P0 明确不做：

- 自动实体关系抽取；
- 自动知识图谱构建；
- community detection；
- community summary；
- Global Search；
- DRIFT Search；
- 完整 RAG answer endpoint；
- Neo4j / 独立图数据库依赖。

### 6.2 P1

P1 可加入：

- AI 推荐 relation，但默认需要用户确认；
- relation expansion retrieval；
- reranker；
- 基于已确认 Knowledge Unit 的主题聚合；
- 半自动 MOC；
- RAG answer with citations。

### 6.3 P2

P2 再评估：

- GraphRAG community summary；
- 项目级 / 主题级 Global Search；
- Neo4j 或其他图数据库；
- LightRAG 作为可替换检索引擎；
- 自动图谱可视化和图谱维护工具。

## 7. 当前结论

开源 GraphRAG 方案对本项目最重要的启发不是“马上引入图数据库”，而是：

> 建库系统必须从第一天区分 Source、Chunk、Knowledge Unit、Relation、MOC 和 Review 状态；否则未来 Agent 无法进行可解释、可控、可追溯的知识调用。

因此，本项目应坚持：

- P0 做干净的数据模型、来源追踪、人工确认和检索预览；
- P1 做关系扩展检索与带引用问答；
- P2 做社区摘要、全局检索和更复杂的图增强 RAG。
