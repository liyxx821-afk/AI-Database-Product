# MVP 范围说明

版本：v0.13  
日期：2026-05-17  
状态：已按架构图升级为完整 P0 入库、File Inspection、知识切片质量闭环、安全运维横切层、AI 结构化整理 profile、D-079 子字段边界、D-080 知识调用 / implicit_agent / 前端交互契约、D-081-D085 调用持久化边界 / InvocationProfileSchema v1 / feedback_policy，并收紧 P0-Z0a/Z0b 实现竖切

## 1. 文档目的

本文档锁定 AI 个人知识资产系统的 P0 范围。当前 P0 不再只是轻量 `text_import` 建库闭环，而是完整覆盖：

```text
账号预埋
→ 文件上传 / 接收 / 完整性校验
→ 文件解析 / 清洗 / 切片
→ AI 结构化整理
→ Embedding / 向量检索
→ Query Understanding / Retrieval Strategy / Hybrid Retrieval / Citation Trace / RAG
→ Review / Memory / 用户记录
```

P0 仍保持桌面本地优先，不引入独立向量数据库服务。AI 能力采用 **开源优先**：优先使用本地或开源 parser、OCR、ASR、Embedding、Reranker、LLM；商业 Provider 只作为可选适配。

---

## 2. P0 分层

原 P0-A / P0-B 拆分已被本次计划取代。新的 P0 由四个可并行设计、按顺序验收的切片组成：

| 切片 | 目标 | 必须进入 P0 |
|---|---|---|
| P0-Core | 桌面本地骨架、项目空间、用户/权限预埋、主库 Schema、Review、日志与错误 envelope | 是 |
| P0-File | 上传、分片/直传、接收、完整性校验、文件保存、Parser Router、处理状态 | 是 |
| P0-AI | 文件解析、清洗、切片、开源优先 AI 结构化、KU 抽取、Embedding、VectorStore | 是 |
| P0-RAG | Query Understanding、Retrieval Strategy、Hybrid Retrieval、Ranking、Evidence Pack、Citation Trace、Query Explanation、RAG answer / evidence-only fallback、Feedback Signal / Policy、用户记录 | 是 |

P0 不再把文件解析、OCR、多模态、RAG answer 作为 P1 才能出现的能力；但 P0 允许能力降级：

- Parser/AI 未配置时，文件不能丢失，必须进入可恢复状态。
- RAG Provider 未配置时，返回 evidence-only answer。
- sqlite-vec 不可用时，保留 `embeddings` 表和 VectorStore 抽象，运行时降级排序。

### 2.1 P0-Z0a / Z0b / Z1 / Z2 验收波次

完整 P0 是架构范围，工程实现按波次验收：

| 波次 | 验收目标 | 不阻塞项 |
|---|---|---|
| P0-Z0a | 单文件直传或 `text_import` 跑通接收、inspection summary、parse、规则 chunk、KU Review、embedding fallback、rule-based query understanding、strategy route、evidence-only answer | 账号预埋明细 / 完整分片恢复 / 完整 memory / feedback / LLM answer |
| P0-Z0b | 补齐账号预埋 schema、分片恢复、source description、chunk_strategy_profile、context_summary、source_metadata、chunk_quality_checks、citation_trace_profile 明细、sensitive grant、审计日志、前端状态契约 | LLM 质量评估 / 关系网络 |
| P0-Z1 | 强化上传恢复、File Inspection report、parser warning、semantic chunking、结构化 / 多模态 chunk、关系与质量事件 | 完整 LLM RAG answer |
| P0-Z2 | 补齐 invocation plan、RAG answer provider/fallback、memory draft、feedback_signal 回流、LLM chunk 摘要 / 质量评估 / reranker 复核 | P1 多 Agent / 多设备同步 |

P0-Z0a 是代码初始化的最小可演示竖切；P0-Z0b/Z1/Z2 仍属于 P0，但不应进入 W1 blocking migration。

---

## 3. P0 功能范围

### 3.1 用户系统与账号预埋

P0 仍默认创建本地 `local_user`，不实现真实注册登录闭环。但必须预埋以下对象和接口边界：

```text
user_profiles
auth_identities
roles
access_policies
```

P0 行为：

- `GET /api/auth/status` 返回本地用户、认证状态、账号能力是否启用。
- 注册 / 登录 / Token 写接口返回 `auth_not_enabled_in_p0`。
- 权限检查仍使用本地用户上下文，但数据模型保留用户隔离、角色权限、文件访问权限和知识库访问权限字段。

### 3.2 入库系统

P0 的主输入不再只有 `text_import`。`text_import` 是统一入库管线的一种输入方式。

P0 必须支持：

```text
用户选择资料
→ 前端预检查
→ 创建上传任务
→ 小文件直传 / 大文件分片
→ 上传进度反馈
→ 后端接收文件
→ 临时存储 tmp/uploads
→ 完整性校验
→ 文件保存 sources/
→ 生成 file_id
→ 基础信息入库
```

进入 P0 的对象：

```text
upload_tasks
upload_parts
files
file_integrity_checks
file_inspection_results
processing_jobs（物理表可暂用 ingestion_jobs）
processing_status_events
```

### 3.3 文件处理系统

P0 必须支持 Parser Router 和可恢复处理状态。

处理链路：

```text
file_id
→ 完整性校验
→ File Inspection：真实类型识别 / 编码检测 / 安全风险检查 / 结构识别 / 预览生成
→ Parser Router
→ 格式标准化 / 转码
→ 文本抽取 / OCR / ASR / 表格解析 / 图片理解
→ 内容清洗
→ 切片策略判断
→ 文档结构恢复
→ 文本语义 / 结构化内容 / 多模态 transcript 切片
→ 上下文补充
→ 元数据标注与来源绑定
→ chunk quality check
→ Source / Chunk / metadata 入库
```

进入 P0 的对象：

```text
parse_tasks
parse_warnings
chunk_quality_checks
quality_events
```

### 3.4 AI 结构化整理

P0-AI 采用开源优先，未配置 Provider 时可降级为规则 / mock profile / pending review，但模块边界必须存在；`mock` 只验证链路，不代表真实生成、质量评估或语义召回质量。

必须支持：

- 内容理解模块；
- 摘要生成模块；
- 关键概念抽取模块；
- 结构化字段生成模块；
- Knowledge Unit 生成模块；
- 分类与标签管理模块；
- 知识关系构建模块；
- 用户手动修改和 Review。

D-077 将该链路收敛为 `structured_organization` profile，不新增运行时代码表：

```text
content_understanding
→ summary_generation
→ key_concept_extraction
→ schema_mapping
→ knowledge_card_generation
→ classification_tagging
→ relation_suggestion
→ Review
```

P0 默认使用 Pydantic / JSON Schema、Jinja2 / Markdown / YAML Frontmatter、KeyBERT / YAKE、spaCy / HanLP 和规则模板。LLM、LlamaIndex、LangChain Structured Output、Instructor / Guardrails、BGE / Sentence-Transformers、BERTopic、Neo4j、NetworkX、RDFlib 均为可选增强或 P1/P2 adapter。所有候选 KU、标签和关系建议默认 `pending_review`；关系建议不得绕过 Review 写入 confirmed relation。

D-079 补充子字段边界：内容理解需要能记录资料类型、主题、核心观点、重要段落和用途判断；摘要生成区分 QA 摘要、段落摘要、文件摘要、项目摘要和长文压缩；分类与标签管理承载标签生成、层级整理、合并、去重、项目/知识库归属建议；结构化字段生成承载标题、作者/来源、时间、关键词、摘要、标签和项目归属；知识卡片区分概念、人物、项目、文件、灵感和问答卡片；实体候选、三元组候选和关系候选统一写入 `relation_suggestion` 子字段。上述内容都是候选或 derived artifact，必须绑定 Source / Chunk，不能替代 citation。

### 3.5 Embedding / VectorStore

P0 必须保留主库混合策略：

```text
SQLite + embeddings 表 + sqlite-vec + FTS5 + structured filters
```

P0 不引入独立向量数据库服务。P1 如需规模化，优先迁移 PostgreSQL + pgvector。

### 3.6 RAG 与用户记录

P0-RAG 必须支持：

```text
Invocation Request（Z0a 为 response/log summary；Z2 持久化）
→ Query Understanding Profile
→ Retrieval Strategy Profile
→ Retrieval Plan（Z0a 为 response/log summary；Z2 持久化）
→ Hybrid Retrieval
→ Ranking Profile
→ Evidence Pack
→ Citation Trace / Citation Preview
→ Query Explanation
→ RAG Answer 或 evidence-only fallback
→ Feedback Signal / Memory Draft / Candidate KU Draft
→ Review
```

P0 检索路由必须明确：

- 简单事实：FTS5 / BM25 + metadata filter。
- 概念解释：sqlite-vec 向量检索 + metadata filter。
- 时间线：metadata filter + 时间字段。
- 文件定位：source / file index。
- 关系分析：只读 confirmed relation 或 relation_suggestion evidence，不运行 GraphRAG。
- 总结归纳和复杂综合：hybrid search；reranker 缺失时回退混合分数。

P0 Agent 边界是 `implicit_agent`：允许对话上下文、意图理解、只读任务规划、内部检索、RAG 问答和带引用草稿；不允许多 Agent、自主执行、外部 API 工具调用或绕过 Review 写入 confirmed knowledge。

用户记录进入 P0：

- 上传记录；
- 检索记录；
- 问答记录；
- 用户反馈；
- Memory Draft；
- RAG answer / evidence-only answer。
- feedback_signal 记录：点击、收藏、有用/无用、错误引用、缺失来源和降权来源；只影响后续排序建议，不自动改写知识真值。

---

## 4. P0 不做

P0 明确不做：

- 真实团队协作与多租户后台；
- 线上账号注册登录生产闭环；
- 云同步和云备份；
- 自动网页爬取；
- Obsidian Vault 双向同步；
- 多 Agent 自主规划和工具执行；
- 外部 API 工具调用和生产级任务编排；
- Neo4j / LightRAG / GraphRAG 作为运行时强依赖；
- Learning-to-Rank 平台；
- 独立向量数据库服务；
- WebSocket 作为必需状态通道；
- 商业闭源模型作为必需条件。

注意：PDF、Office、OCR、ASR、图片理解、RAG answer 已进入 P0，但采用开源优先 + 可恢复降级，不承诺所有格式在第一版达到生产级解析质量。

---

## 5. P0 验收标准

P0 至少应满足：

1. 本地 `local_user` 自动创建，`GET /api/auth/status` 可解释账号能力状态。
2. 用户可创建 Project / Folder，Folder-Tag Mirroring 生效。
3. 用户可上传文件，看到上传进度、接收状态和失败原因。
4. 小文件可直传，大文件可分片；hash 不一致时进入 `integrity_failed`。
5. 文件保存到本地 `sources/`，临时分片在完成或失败后可清理。
6. Parser Router 能根据 File Inspection 的 `detected_mime_type`、`file_signature`、`risk_level`、结构识别结果和扩展名选择 parser。
7. 不支持的文件格式返回 `unsupported_parser`，文件记录仍可恢复。
8. 解析输出能生成 Source、Source Description、Chunk。
9. Chunk 有 `chunk_strategy_profile`、`context_summary`、`source_metadata`、质量状态和 warning。
10. 系统能生成或辅助生成 Candidate Knowledge Unit。
11. KU 默认进入 Review，确认后才能进入默认调用范围。
12. Embedding 记录写入 `embeddings` 表，并通过 VectorStore 抽象参与检索。
13. Hybrid Retrieval 能组合权限、状态、标签、全文、向量、metadata、source/file index 和关系证据。
14. Retrieval / RAG 响应能展示 `query_understanding_profile`、`retrieval_strategy_profile`、`ranking_profile`、`citation_trace_profile`、`feedback_policy` 和 `feedback_actions`。
15. P0-Z0a 只返回 evidence-only answer，不调用 LLM；P0-Z2 或显式 Provider 增强路径在开源 Provider 可用时生成 RAG answer，不可用时仍返回 evidence-only answer。
16. Evidence Pack、Citation、Query Explanation 可刷新后复盘，citation 能回到 Chunk / Source / File / text span，并区分 `source_reliability_score` 与 `source_reliability_label`。
17. `/api/system/status` 可返回日志、异常监控、数据安全、性能成本和稳定性本地摘要；P0 不要求外部 APM 或云遥测。
18. 上传记录、检索记录、问答记录和反馈记录可查询。
19. Parser / AI / RAG Provider 不可用时不丢文件，状态可恢复。
20. P0 前端能展示上传进度、AI 思考、检索失败、无权限、网络异常、空结果、citation 和反馈按钮状态。

---

## 6. 验证用例

### 6.1 入库验证

输入：上传一个 Markdown / PDF / 图片文件。

预期：

- 创建 `upload_task`、`file`、`ingestion_job`。
- 完成 hash 校验。
- 生成 Source / Chunk。
- 若 parser 不可用，进入可恢复失败状态，不删除文件。

### 6.2 AI 结构化验证

输入：解析后的 500-2000 字材料。

预期：

- 生成 Source Description。
- 生成多个 Chunk。
- 生成或手动创建 3-5 条 Candidate KU。
- 至少 1 条 KU 被确认。
- 确认后的 KU 有 source、chunk、tag、status、permission、embedding、audit log。

### 6.3 RAG 验证

用户提出：

```text
这个项目里已经确认的核心判断有哪些？请展示来源。
```

预期：

- 生成 invocation response summary；P0-Z2 再持久化 Invocation Request。
- 生成 query_understanding_profile 和 retrieval_strategy_profile。
- 生成 retrieval plan summary，并选择 simple_fact / concept_explanation / timeline / file_lookup / relationship_analysis / summary_synthesis / complex_hybrid 路由；P0-Z2 再持久化 Retrieval Plan。
- 返回 Evidence Pack。
- Evidence Items 指向 Confirmed KU、Chunk、Source。
- Evidence Items 返回 citation_trace_profile，可追踪 file、page/section、paragraph/text span。
- P0-Z0a 可生成 evidence-only answer；P0-Z2 或显式 Provider 增强路径 Provider 可用时生成 RAG answer，没有 Provider 时生成 evidence-only answer。
- Query Explanation 展示 query understanding、`rewrite_status`、strategy route、结构化过滤、关键词检索、向量检索、ranking summary、feedback_signal / feedback_policy summary 和证据空缺。

### 6.4 回流验证

用户将 RAG answer 或 evidence-only answer 保存为 Candidate KU 或 Memory Draft。

预期：

- 创建 Review Task。
- 新内容状态为 `pending_review`。
- 不直接进入默认 Agent 调用范围。

---

## 7. 冻结条件

进入工程实现前至少冻结：

- P0 四切片：P0-Core / P0-File / P0-AI / P0-RAG。
- `files` 与 `sources` 分工：`files` 是物理文件对象，`sources` 是语义来源对象。
- 上传状态、接收状态、解析状态、完整性状态、RAG 状态枚举。
- 用户系统账号预埋：auth disabled behavior、role/access policy 字段。
- Parser Router 输入输出契约。
- 开源优先 ProviderRegistry：parser、embedding、reranker、LLM、OCR、ASR。
- `embeddings` 表 + VectorStore 抽象不可省略。
- RAG answer / evidence-only fallback 输出类型。
- 错误码：`auth_not_enabled_in_p0`、`unsupported_parser`、`integrity_check_failed`、`parser_unavailable`、`ocr_unavailable`、`asr_unavailable`、`rag_provider_missing`。
- 性能基线：1K KU 检索 < 1 秒；文件上传必须有进度；Parser/AI 失败可恢复。

---

## 8. 当前结论

MVP 第一阶段的目标升级为证明完整知识处理平台成立：

```text
可上传
→ 可校验
→ 可解析
→ 可切片
→ 可结构化
→ 可确认
→ 可向量检索
→ 可 RAG 引用
→ 可回流
```

只要这条链路成立，后续真实账号、多设备同步、生产级云服务、GraphRAG 和多 Agent 执行才有可靠基础。
