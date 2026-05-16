# Text-to-SQL P0 查询契约

版本：v0.4-draft  
日期：2026-05-17  
状态：P0 只读查询契约草案——已适配 SQLite 方言、修复 evidence_packs.project_id 关联，并按 D-081/D-085 区分 P0-Z0a retrieval_log 锚点与 P0-Z2 持久化调用对象

## 1. 文档目的

本文档把 `docs/data-model.md` 中的数据对象转化为第一版 Text-to-SQL 可查询契约。

P0 不接真实 Text-to-SQL 模型，也不承诺自然语言到 SQL 的自动生成质量。P0 目标是先明确：

- 哪些对象可以被自然语言查询；
- 查询只能如何读取；
- 默认权限、状态和确认过滤是什么；
- 典型问题如何映射到只读 SQL 或规则查询；
- Query Explanation 应如何解释查询依据；
- 检索结果如何进入 Retrieval Preview、Evidence Pack 和 Citation Preview。

本文档是后续 OpenAPI、后端 service、数据库 view 和测试用例的共同约束。

---

## 2. P0 边界

### 2.1 P0 允许

P0 允许：

```text
自然语言问题
→ intent 分类
→ 规则模板 / mock SQL 计划
→ 白名单只读对象
→ 参数化 SELECT
→ 结果解释
→ RetrievalLog / EvidencePack
→ RetrievalPlan summary（P0-Z0a response/log；P0-Z2 persisted）
```

P0 可以使用人工维护的 query template，不需要模型生成 SQL。

### 2.2 P0 不允许

P0 不允许：

- 真实模型自由生成 SQL 后直接执行；
- 任何写入型 SQL；
- 访问未进入白名单的表；
- 绕过项目、权限、状态和用户确认过滤；
- 查询 `audit_logs` 的敏感明细作为普通用户结果；
- 将 SQL 结果伪装为真实 RAG answer。

禁止语句：

```text
INSERT
UPDATE
DELETE
DROP
ALTER
TRUNCATE
CREATE
GRANT
REVOKE
COPY
```

P0 只允许单条参数化 `SELECT` 或可被 service 组合出的等价只读查询。

### 2.2 SQLite 方言适配

P0 使用 SQLite（详见 `docs/desktop-architecture.md` §4），SQL 模板需注意：

- 数组字段（`text[]`、`uuid[]`）存储为 JSON 数组 TEXT，使用 `json_each()` 解构查询。
- 不支持 `ANY()` 操作符，改用 `EXISTS (SELECT 1 FROM json_each(column) WHERE value = :param)`。
- 日期比较使用字符串比较（ISO 8601 格式保证排序正确）。
- `boolean` 存储为 `INTEGER`（0/1），条件中使用 `= 1` 而非 `= true`。
- `jsonb` 函数替换为 SQLite JSON 函数（`json_extract()`、`json_array_length()` 等）。
- P1 迁移 PostgreSQL 时，Repository 抽象层负责方言适配。

---

## 3. 默认调用过滤

Agent 默认调用 Knowledge Unit 时必须满足（逻辑条件清单，落到 SQL 时按 §2.2 方言转换 `= 1` / `= 0`）：

```text
project_id in allowed project scope
user_verified is true
available_for_agent is true
status = confirmed
permission in allowed permission scope    # P0 = ['normal']
```

默认排除：

```text
pending_review
ignored
rejected
merged
split
outdated
archived
do_not_use
do_not_share permission
sensitive permission without explicit consent
```

P0 `permission` 取值统一为 `normal / sensitive / do_not_share`（详见 `docs/data-model.md` §5.5）。Agent 默认调用 `allowed_permissions = ['normal']`，`sensitive` 需用户在 Citation Preview 显式确认后才进入 Evidence Pack，`do_not_share` 任何模式下都不进入 Agent 调用。

特殊模式：

| 模式 | 可读取对象 | 使用场景 |
|---|---|---|
| agent_default | 已确认、可调用、权限允许的知识 | 默认问答 / 调用 |
| review_mode | pending_review、Memory Draft、待确认关系 | Review Queue |
| audit_mode | 审计摘要，不暴露敏感日志细节 | 管理与复盘 |
| draft_mode | 用户当前草稿和未确认候选 | 建库编辑 |
| explicit_research | uncertain / outdated 等弱结论 | 用户明确要求历史比较或研究 |

---

## 4. 可查询对象白名单

### 4.1 P0 业务表

| 对象 | 查询用途 | 暴露方式 |
|---|---|---|
| `projects` | 限定知识空间 | 直接查询 |
| `folders` | 限定主归属和 folder path | 直接查询 |
| `tags` | 标签过滤、namespace 查询 | 直接查询 |
| `sources` | 来源、source_origin、source_type | 直接查询 |
| `source_descriptions` | 资料级摘要和可信度 | 直接查询 |
| `chunks` | 引用片段、source location | 直接查询 |
| `knowledge_units` | 核心知识资产 | 直接查询或视图查询 |
| `knowledge_unit_tags` | KU 与 Tag 关联 | 优先通过视图 |
| `knowledge_unit_chunks` | KU 与 Chunk 证据关联 | 优先通过视图 |
| `knowledge_relations` | 手动关系、支持/反驳等 | 直接查询或视图查询 |
| `review_tasks` | 待确认对象 | review_mode 查询 |
| `retrieval_logs` | 检索记录 | 直接查询 |

### 4.2 P0 调用域对象

| 对象 | 查询用途 | 暴露方式 |
|---|---|---|
| `invocation_requests` | 用户调用请求 | P0-Z2 持久化后直接查询；P0-Z0a 用 `retrieval_logs` / response summary 替代 |
| `retrieval_plans` | 调用计划和 query trace | P0-Z2 持久化后直接查询；P0-Z0a 用 retrieval plan summary 替代 |
| `evidence_packs` | 证据包 | 直接查询 |
| `evidence_items` | 证据项级引用 | 优先通过视图 |
| `answer_citations` | 回答与证据引用 | 直接查询 |
| `ai_answers` | P0 preview / evidence-only / mock answer | 直接查询 |
| `memories` | Memory Draft / Confirmed Memory | P0-Z2 持久化后 review_mode 或 agent_default；Z0a 不要求持久化 |
| `retrieval_feedback` | 检索反馈 | P0-Z2 持久化后直接查询；Z0a 可只保留 `feedback_signal` response summary |

### 4.3 只读视图

P0 优先使用以下只读视图降低 join 复杂度：

```text
v_knowledge_units_with_tags
v_retrieval_evidence
v_invocation_evidence
```

视图是 Text-to-SQL 的主入口。业务表仍可查询，但复杂 join 应尽量封装到视图。

### 4.4 默认不开放对象

| 对象 | P0 处理方式 | 原因 |
|---|---|---|
| `audit_logs` | 默认只返回摘要 | 可能包含敏感操作轨迹 |
| 原始 embedding vector | 不直接暴露 | 向量值本身没有可读解释价值；展示 profile、dimension、score 和来源即可 |
| 密钥 / provider 配置 | 不开放 | 安全边界 |
| 未来 agent tool logs | 不开放 | P0 不做工具执行 |

---

## 5. 只读视图契约

### 5.1 `v_knowledge_units_with_tags`

用途：

- 支持标签、folder、status、permission、available_for_agent 过滤；
- 支持“哪些知识属于某主题 / 用途 / 状态”类问题；
- 降低 `knowledge_units + knowledge_unit_tags + tags` join 复杂度。

建议字段：

```text
knowledge_unit_id
project_id
title
content
knowledge_type
status
importance
permission
user_verified
available_for_agent
primary_folder_id
primary_folder_path
tag_ids
tag_names
tag_namespaces
source_id
source_title
source_origin
created_at
updated_at
```

### 5.2 `v_retrieval_evidence`

用途：

- 支持从 Knowledge Unit 回溯 Source / Chunk；
- 支持 Citation Preview；
- 支持“某来源支撑了哪些知识”类问题。

建议字段：

```text
knowledge_unit_id
knowledge_unit_title
knowledge_unit_status
knowledge_type
project_id
source_id
source_title
source_origin
source_permission
chunk_id
chunk_index
chunk_excerpt
source_location
evidence_role
confidence
citation_label
tag_names
relation_count
```

### 5.3 `v_invocation_evidence`

用途：

- 支持复盘某次调用使用了哪些证据；
- 支持 Query Explanation；
- 支持 Evidence Pack 的 item 级解释。

建议字段：

```text
retrieval_log_id
request_id
raw_query
task_type
retrieval_plan_id
evidence_pack_id
evidence_item_id
item_type
item_id
evidence_role
rank
score
citation_label
knowledge_unit_id
chunk_id
source_id
source_title
query_trace
evidence_gaps
created_at
```

---

## 6. 查询意图类型

P0 不需要复杂自然语言理解，但需要把常见问题归入稳定 intent。

| intent | 说明 | 主要对象 |
|---|---|---|
| `list_knowledge_units` | 列出知识单元 | `v_knowledge_units_with_tags` |
| `filter_by_tag` | 按标签 / namespace 找知识 | `v_knowledge_units_with_tags` |
| `trace_source` | 从知识追溯来源，或从来源追溯知识 | `v_retrieval_evidence` |
| `review_queue` | 查待确认对象 | `review_tasks` |
| `relation_lookup` | 查知识关系 | `knowledge_relations` |
| `invocation_audit` | 查一次调用用到的证据 | `v_invocation_evidence` |
| `evidence_gap_lookup` | 查证据缺口 | `evidence_packs` / `v_invocation_evidence` |
| `memory_review` | 查 Memory Draft 或长期记忆 | `memories` |
| `recent_activity` | 查近期新增 / 更新 | 业务表 + 时间过滤 |
| `permission_check` | 查敏感或不可调用对象 | 业务表 + permission/status |

---

## 7. 典型问题与查询模板

以下 SQL 是契约示例，不是最终数据库方言。实现时应使用参数化查询。

### 7.1 某项目中有哪些已确认的核心知识？

自然语言：

```text
这个项目里已确认的核心判断有哪些？
```

查询意图：

```text
list_knowledge_units + agent_default filter
```

SQL 模板：

```sql
SELECT
  knowledge_unit_id,
  title,
  knowledge_type,
  importance,
  source_title,
  tag_names,
  updated_at
FROM v_knowledge_units_with_tags
WHERE project_id = :project_id
  AND status = 'confirmed'
  AND user_verified = 1
  AND available_for_agent = 1
  AND permission IN (:allowed_permissions)
ORDER BY importance DESC, updated_at DESC
LIMIT :limit;
```

> SQLite 方言：`boolean` 字段以 `INTEGER`（0/1）存储，条件写 `= 1` / `= 0`（详见 §2.2）。本节所有模板已遵循该约定。

### 7.2 哪些知识来自 PDF 抽取文本？

自然语言：

```text
哪些 Knowledge Unit 来自 extracted_pdf_text？
```

SQL 模板：

```sql
SELECT
  knowledge_unit_id,
  title,
  source_id,
  source_title,
  source_origin
FROM v_retrieval_evidence
WHERE project_id = :project_id
  AND source_origin = 'extracted_pdf_text'
  AND knowledge_unit_status = 'confirmed'
ORDER BY source_title, knowledge_unit_title
LIMIT :limit;
```

### 7.3 哪些知识不能被 Agent 默认调用？

自然语言：

```text
哪些知识被标记为 do_not_use 或不可调用？
```

SQL 模板：

```sql
SELECT
  id AS knowledge_unit_id,
  title,
  status,
  permission,
  available_for_agent,
  updated_at
FROM knowledge_units
WHERE project_id = :project_id
  AND (
    status = 'do_not_use'
    OR available_for_agent = 0
    OR permission NOT IN (:allowed_permissions)
  )
ORDER BY updated_at DESC
LIMIT :limit;
```

### 7.4 某个标签下有哪些可调用知识？

自然语言：

```text
#产品定位 下有哪些可被 Agent 调用的知识？
```

SQL 模板：

```sql
SELECT
  knowledge_unit_id,
  title,
  knowledge_type,
  tag_names,
  source_title
FROM v_knowledge_units_with_tags
WHERE project_id = :project_id
  AND EXISTS (
    SELECT 1 FROM json_each(tag_names) WHERE value = :tag_name
  )
  AND status = 'confirmed'
  AND user_verified = 1
  AND available_for_agent = 1
  AND permission IN (:allowed_permissions)
ORDER BY importance DESC, updated_at DESC
LIMIT :limit;
```

> SQLite 不支持 PostgreSQL 的 `ANY(array)`，数组字段使用 `EXISTS (SELECT 1 FROM json_each(column) WHERE value = :param)`（详见 §2.2）。

### 7.5 某个 Source 支撑了哪些知识？

自然语言：

```text
这个 Source 支撑了哪些 Knowledge Unit？
```

SQL 模板：

```sql
SELECT
  knowledge_unit_id,
  knowledge_unit_title,
  knowledge_type,
  chunk_id,
  chunk_excerpt,
  source_location,
  citation_label
FROM v_retrieval_evidence
WHERE source_id = :source_id
ORDER BY knowledge_unit_title, chunk_index
LIMIT :limit;
```

### 7.6 某次调用使用了哪些证据？

自然语言：

```text
这次调用使用了哪些 Knowledge Unit、Chunk 和 Source？
```

SQL 模板：

```sql
SELECT
  evidence_pack_id,
  evidence_item_id,
  item_type,
  evidence_role,
  rank,
  citation_label,
  knowledge_unit_id,
  chunk_id,
  source_id,
  source_title
FROM v_invocation_evidence
WHERE request_id = :request_id
ORDER BY rank ASC, evidence_item_id ASC;
```

### 7.7 哪些 Evidence Pack 有证据缺口？

自然语言：

```text
哪些调用存在 evidence gaps？
```

SQL 模板：

```sql
SELECT
  ep.id AS evidence_pack_id,
  ep.retrieval_log_id,
  ep.request_id,
  ep.evidence_gaps,
  ep.created_at
FROM evidence_packs ep
LEFT JOIN retrieval_logs rl ON ep.retrieval_log_id = rl.id
LEFT JOIN invocation_requests ir ON ep.request_id = ir.id
WHERE COALESCE(rl.project_id, ir.project_id) = :project_id
  AND ep.evidence_gaps IS NOT NULL
  AND json_array_length(ep.evidence_gaps) > 0
ORDER BY ep.created_at DESC
LIMIT :limit;
```

> 注意：`evidence_packs` 本身不含 `project_id`。P0-Z0a 通过 `retrieval_log_id → retrieval_logs.project_id` 关联；P0-Z2 启用 `invocation_requests` 后可通过 `request_id → invocation_requests.project_id` 关联。

### 7.8 哪些 Memory 仍待确认？

自然语言：

```text
哪些 Memory Draft 还在 pending_review？
```

SQL 模板：

```sql
SELECT
  id AS memory_id,
  project_id,
  memory_type,
  content,
  source_answer_id,
  created_at
FROM memories
WHERE project_id = :project_id
  AND status = 'pending_review'
ORDER BY created_at DESC
LIMIT :limit;
```

### 7.9 哪些关系是用户手动确认的？

自然语言：

```text
哪些 Knowledge Relation 是用户手动确认的？
```

SQL 模板：

```sql
SELECT
  id AS relation_id,
  from_knowledge_unit_id,
  to_knowledge_unit_id,
  relation_type,
  reason,
  created_at
FROM knowledge_relations
WHERE project_id = :project_id
  AND created_by = 'user'
  AND confirmed_by_user = 1
ORDER BY created_at DESC
LIMIT :limit;
```

### 7.10 最近一周新增了哪些高重要性知识？

自然语言：

```text
最近一周新增了哪些 high importance 的已确认知识？
```

SQL 模板：

```sql
SELECT
  id AS knowledge_unit_id,
  title,
  knowledge_type,
  importance,
  created_at
FROM knowledge_units
WHERE project_id = :project_id
  AND status = 'confirmed'
  AND importance = 'high'
  AND created_at >= :start_time
  AND permission IN (:allowed_permissions)
ORDER BY created_at DESC
LIMIT :limit;
```

---

## 8. Query Explanation 契约

每次 Text-to-SQL 或 mock 查询计划都应能解释：

```json
{
  "query_intent": "list_knowledge_units",
  "scope": {
    "project_id": "project_id",
    "folder_ids": [],
    "tag_ids": []
  },
  "policy": {
    "mode": "agent_default",
    "allowed_permissions": ["normal"],
    "excluded_status": ["pending_review", "archived", "do_not_use"]
  },
  "used_objects": [
    "v_knowledge_units_with_tags"
  ],
  "generated_sql_kind": "template_select",
  "is_mock": true,
  "why_this_query": "用户询问已确认核心知识，系统按项目、确认状态、权限和可调用状态过滤 Knowledge Unit。",
  "evidence_gaps": []
}
```

P0 Query Explanation 不需要展示完整 SQL 给普通用户，但需要保存到 `retrieval_logs`；P0-Z2 持久化 `retrieval_plans` 后再同步写入 `retrieval_plans.query_trace`，用于复盘。

---

## 9. SQL 安全检查

执行前必须检查：

1. SQL 类型必须是 `SELECT`。
2. 只能访问白名单对象。
3. 必须包含 `project_id` 或等价 scope。
4. Agent 默认查询必须包含 status、permission、user_verified、available_for_agent 过滤。
5. 必须使用参数化变量，不拼接用户原文。
6. 必须设置 `LIMIT`，P0 默认上限 50，硬上限 100。
7. 禁止多语句。
8. 禁止访问原始 embedding vector 字段，除非是内部检索 service。
9. 查询失败应记录错误摘要，不保存敏感 SQL 片段到用户可见内容。
10. 查询结果进入 Evidence Pack 前必须重新执行证据对象存在性检查。

---

## 10. 与 Retrieval / Evidence 的关系

P0 Text-to-SQL 不独立返回最终答案，而是服务三类链路：

### 10.1 Retrieval Preview

```text
POST /api/retrieval/preview
→ query_intent
→ template SELECT / mock plan
→ RetrievalLog
→ results + Query Explanation
```

### 10.2 Invocation Evidence Pack

```text
POST /api/retrieval/preview
→ retrieval_logs
→ Text-to-SQL template / mock plan summary
→ evidence_packs(retrieval_log_id)
→ EvidenceItem
→ Citation Preview
```

P0-Z2 启用持久化调用对象后，可扩展为 `POST /api/invocations → POST /api/invocations/{request_id}/retrieval-plan → POST /api/invocations/{request_id}/evidence-pack`。Z0a 不要求这些对象存在。

### 10.3 Feedback / Memory Draft

```text
Evidence Pack
→ Citation Preview
→ 用户反馈 useful / not_useful / missing_source
→ Memory Draft 或 Candidate Knowledge Unit
→ Review
```

Text-to-SQL 只负责结构化导航，不绕过 Review 写入长期知识。

---

## 11. 验收标准

本文档可进入实现前，应满足：

1. P0 可查询对象白名单明确。
2. 只读视图字段边界明确。
3. 默认权限、状态、确认过滤明确。
4. 至少 10 个典型问题有查询意图和 SQL 模板。
5. SQL 安全规则明确拒绝写入和非白名单对象。
6. Query Explanation 有稳定字段。
7. Text-to-SQL 输出能进入 RetrievalLog、RetrievalPlan 和 EvidencePack。
8. 明确 P0 不接真实模型。
9. `audit_logs` 默认不作为普通 Text-to-SQL 查询对象。
10. 文档与 `docs/data-model.md`、`docs/api-design.md` 和 `docs/mvp-scope.md` 保持一致。

---

## 12. 后续扩展

P1 可新增：

- 真实 Text-to-SQL planner；
- SQL AST 校验器；
- schema linking；
- few-shot query examples；
- 查询结果 rerank；
- answer generation with citations；
- 用户可见 SQL 解释面板；
- 查询模板管理。

P2 可评估：

- 跨项目查询；
- 交互式 Text-to-SQL 修正；
- benchmark / eval set；
- BIRD / Spider 风格复杂 SQL 评估；
- 多轮数据库助手。
