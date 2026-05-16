# 错误处理与可观测性

版本：v0.7
日期：2026-05-17  
状态：P0 错误码 + UI 消息 + 诊断报告 + 日志策略草案 + File Inspection 错误码 + 知识切片质量事件 + 安全运维横切层 + D-083 feedback_policy / FrontendStateContract + 事件枚举单一来源 + API envelope 单一来源 + D-092 trace chain

## 1. 文档目的

本文档解决一个核心问题：

> 各文档零散提到错误码（api-design §4.4）、processing_status_events / parse_warnings / system_logs（data-model §3.7）、Citation Preview 错误展示（invocation §4.6），但端到端的错误处理与可观测性策略未统一。具体缺口：错误码命名规范不一致、UI 消息没有标准、诊断报告（用户主动导出）无契约、日志轮转和留存策略缺失、崩溃报告与隐私脱敏的边界没有约定。

本文档定义：

- 错误码命名规范与分层（HTTP / 业务 / 系统）
- 错误响应 envelope 标准
- UI 错误消息映射规则（错误码 → 文案 → 用户可恢复操作）
- 桌面诊断报告契约（用户主动导出）
- 日志分级、轮转、留存与脱敏策略
- 崩溃报告与遥测开关
- 可观测性指标（P1 引入）

`docs/api-design.md` 不再维护另一份错误 envelope，只引用本文 §3。后续 OpenAPI / Pydantic schema 应以本文为准。

本文档不替代：

- `docs/api-design.md` §4 通用响应约定与错误码白名单
- `docs/data-model.md` §3.7 事件类对象分类决策树
- `docs/desktop-architecture.md` §13 安全实践（日志脱敏）
- `docs/ai-provider-architecture.md` §6 网络降级策略

---

## 2. 错误处理设计原则

### 2.1 错误是产品体验的一部分

桌面单用户场景下，错误必须：

- 用户可读（不暴露堆栈、SQL 片段、内部对象 ID）
- 可恢复（明示"重试 / 检查输入 / 联系支持"）
- 可定位（用户能找到错误码并主动导出诊断报告）

### 2.2 错误分层

```text
HTTP 层错误     ：400/404/409/500 等标准状态码
业务层错误码     ：validation_error / not_found / agent_call_not_allowed ...
系统层错误码     ：migration_in_progress / backup_in_progress / data_dir_move_failed ...
Renderer 错误   ：渲染异常 / IPC 通信失败 / sidecar 不可达
原生层错误      ：Electron Main 异常 / 系统 Keychain 不可用
```

### 2.3 永远不让用户面对裸 stack trace

P0 必须保证：

- 任何 sidecar 异常都被 FastAPI 中间件捕获并转化为 `error envelope`
- 任何 Renderer 渲染异常都被 React Error Boundary 捕获
- 任何 Main Process 异常都通过 `uncaughtException` / `unhandledRejection` handler 捕获

---

## 3. 错误响应 Envelope

### 3.1 标准 envelope（与 `docs/api-design.md` §4.3 一致）

```json
{
  "error": {
    "code": "validation_error",
    "message": "title is required",
    "details": {
      "field": "title"
    },
    "request_id": "req_abc123",
    "documentation_url": "https://docs.example.com/errors/validation_error"
  }
}
```

字段约定：

- `code`：snake_case，全局唯一，详见 §4 白名单。
- `message`：英文短描述（不直接展示给用户，作为日志与开发者排查用）。
- `details`：结构化诊断信息，前端按 `code` 反查 UI 文案时使用。
- `request_id`：每次请求生成的 UUID，写入 sidecar 日志 + Renderer 控制台 + 诊断报告。
- `documentation_url`：P1 启用，P0 留空字段。

### 3.1.1 D-092 Trace Chain

`request_id` 只标识一次 HTTP 请求；跨 Electron、FastAPI、worker、SSE 和 RAG 证据链时必须使用 `trace_id` 串联。

P0-Z0a 最小链路：

```text
trace_id
→ request_id
→ job_id
→ event_seq
→ retrieval_log_id
→ evidence_pack_id
→ ai_answer_id
```

约束：

- Renderer 发起用户动作时创建或继承 `trace_id`；
- FastAPI middleware 将 `trace_id` 写入日志上下文；
- ProcessingJob、processing_status_events、retrieval_logs、evidence_packs、ai_answers 都保留或可关联到同一 `trace_id`；
- SSE 的 `event_seq` 与 `trace_id` 一起进入诊断报告；
- 诊断报告按 `trace_id` 聚合，但不得包含用户原文、API Key 或未脱敏本地私密路径。

### 3.2 HTTP 状态码映射

| HTTP | 含义 | 典型业务码 |
|---|---|---|
| 400 | 请求字段不合法 | validation_error / invalid_permission_value |
| 401 | 未授权 | unauthorized（P1） |
| 403 | 权限不足 | permission_denied / agent_call_not_allowed / api_key_must_use_ipc |
| 404 | 对象不存在 | not_found |
| 409 | 资源冲突 | duplicate_resource / review_required |
| 422 | 业务规则不满足 | unsupported_source_origin / mock_only / agent_not_supported_in_p0 / provider_capability_unavailable |
| 429 | 限流 | rate_limited（P1） |
| 500 | 服务端异常 | internal_error |
| 503 | 暂不可用 | migration_in_progress / backup_in_progress / database_busy / ai_provider_unavailable / data_dir_move_failed |

### 3.3 错误码命名规范

- 全部 snake_case
- 名词或动宾短语，避免完整句子
- 不暴露内部表名 / 字段名 / 实现细节
- 同一类错误共享前缀（如 `ai_provider_*`、`backup_*`、`migration_*`）
- 弃用错误码不直接删除，标记为 `deprecated`，至少保留一个版本

---

## 4. P0 错误码白名单（统一聚合）

业务层（详见 `docs/api-design.md` §4.4）：

```text
validation_error
not_found
permission_denied
unsupported_source_origin
review_required
agent_call_not_allowed
mock_only
invalid_permission_value
duplicate_resource
provider_capability_unavailable
provider_fallback_used
unsupported_parser
parser_unavailable
file_detection_unavailable
file_blocked_by_risk_policy
preview_unavailable
ocr_unavailable
asr_unavailable
rag_provider_missing
upload_part_missing
upload_hash_mismatch
integrity_check_failed
file_quarantined
```

系统层：

```text
internal_error
database_busy
migration_in_progress
backup_in_progress
ai_provider_unavailable
data_dir_move_failed
agent_not_supported_in_p0
api_key_must_use_ipc
sidecar_unreachable          # 仅 Renderer / Main 层使用
sidecar_starting             # 启动期间所有业务请求降级该码
```

Renderer / Main 层（不走 HTTP，但纳入诊断报告）：

```text
ipc_timeout
ipc_invalid_payload
keychain_unavailable
file_picker_cancelled
file_read_error
file_write_error
unsupported_platform
```

---

## 5. UI 错误消息映射

### 5.1 映射规则

前端维护 `apps/web/src/i18n/errors/{locale}.json`，按 `code` 反查文案。映射规则：

```json
{
  "validation_error": {
    "title": "请检查输入",
    "message": "字段 {{field}} 不符合要求：{{detail}}",
    "actions": [
      { "type": "retry", "label": "返回修改" }
    ]
  },
  "not_found": {
    "title": "对象不存在",
    "message": "请刷新当前视图后重试",
    "actions": [
      { "type": "refresh", "label": "刷新" }
    ]
  },
  "review_required": {
    "title": "需要先确认",
    "message": "此 Knowledge Unit 未经 Review，无法进入 Agent 调用",
    "actions": [
      { "type": "navigate", "label": "去 Review 队列", "to": "/review" }
    ]
  },
  "migration_in_progress": {
    "title": "正在升级数据库",
    "message": "升级完成后将自动恢复，可能需要 1-2 分钟",
    "actions": [
      { "type": "wait", "label": "稍候" }
    ]
  },
  "backup_in_progress": {
    "title": "正在备份",
    "message": "请等待当前备份完成后再操作",
    "actions": [
      { "type": "wait", "label": "稍候" }
    ]
  },
  "ai_provider_unavailable": {
    "title": "AI 服务不可用",
    "message": "已自动降级为本地 mock 模式，结果将标注 mock badge",
    "actions": [
      { "type": "navigate", "label": "检查 AI 配置", "to": "/settings/ai-providers" },
      { "type": "dismiss", "label": "继续" }
    ]
  },
  "file_blocked_by_risk_policy": {
    "title": "文件已被阻断",
    "message": "检测到高风险内容，默认不会进入解析",
    "actions": [
      { "type": "navigate", "label": "查看检查报告", "to": "/files/{{file_id}}/inspection" }
    ]
  },
  "preview_unavailable": {
    "title": "预览不可用",
    "message": "预览工具不可用，文件仍可继续入库",
    "actions": [
      { "type": "dismiss", "label": "继续" }
    ]
  },
  "sidecar_unreachable": {
    "title": "后端进程未响应",
    "message": "正在尝试重启后端进程，请稍候",
    "actions": [
      { "type": "restart", "label": "强制重启" },
      { "type": "diagnostics", "label": "导出诊断报告" }
    ]
  },
  "api_key_must_use_ipc": {
    "title": "请通过设置页面配置 API Key",
    "message": "为安全起见，API Key 不能直接通过命令行或 API 提交",
    "actions": [
      { "type": "navigate", "label": "去设置", "to": "/settings/ai-providers" }
    ]
  }
}
```

### 5.2 文案原则

- 标题 ≤ 12 字，名词或问题，不用感叹号
- 描述 ≤ 50 字，告诉用户"是什么 / 为什么 / 怎么办"
- 不用"出错了 / 失败了 / 系统异常" 这类无意义短语
- 不暴露错误码（错误码隐藏在诊断面板）
- 至少提供 1 个可操作 action

### 5.3 全局错误展示位置

- Toast：非阻断性、可关闭，3-5 秒自动消失（如 validation_error）
- Banner：操作期间一直可见（如 ai_provider_unavailable / sidecar_starting）
- Modal：阻断操作，必须用户确认（如 migration_in_progress）
- Status Bar：sidecar 健康状态、AI Provider 状态常驻底栏

---

## 6. 桌面诊断报告

### 6.1 触发方式

用户可在以下位置主动导出诊断报告：

- 设置 → 关于 → 导出诊断报告
- 任意错误 Modal 内的"导出诊断报告"按钮
- About 页面右键菜单

### 6.2 API 契约

```text
POST /api/system/diagnostics:export
```

请求：

```json
{
  "target_path": "/path/to/save/diagnostics.zip",
  "include_recent_logs": true,
  "include_recent_audit": true,
  "include_settings_snapshot": true,
  "include_db_stats": true,
  "anonymize": true
}
```

响应：

```json
{
  "data": {
    "export_id": "diag_xxx",
    "filename": "knowledge-diagnostics-2026-05-12-1530.zip",
    "size_bytes": 234567,
    "contents": [
      "app-info.json",
      "settings-redacted.json",
      "logs/sidecar-last-7d.log",
      "logs/main-last-7d.log",
      "logs/renderer-last-7d.log",
      "db-stats.json",
      "recent-audit-last-100.json",
      "system-info.json"
    ]
  }
}
```

### 6.3 诊断报告必含内容

| 文件 | 描述 | 脱敏 |
|---|---|---|
| `app-info.json` | 应用版本、schema 版本、平台、启动时间 | 否 |
| `settings-redacted.json` | 用户设置（移除任何 path 中的用户名） | 是 |
| `logs/sidecar-last-7d.log` | 最近 7 天 sidecar 日志 | 是（详见 §7.4） |
| `logs/main-last-7d.log` | 最近 7 天 Electron Main 日志 | 是 |
| `logs/renderer-last-7d.log` | 最近 7 天 Renderer 控制台日志 | 是 |
| `db-stats.json` | 表行数、数据库大小、迁移版本 | 否 |
| `recent-audit-last-100.json` | 最近 100 条 audit log（隐去具体内容） | 是 |
| `system-info.json` | OS 版本、内存、CPU、磁盘空间 | 否 |
| `errors-summary.json` | 最近 7 天错误码分布统计 | 否 |

### 6.4 诊断报告不含

- 用户原始文档内容（Source / Chunk 文本）
- Knowledge Unit 内容
- API Key（即使脱敏的也不含，Keychain 不读）
- 完整数据库文件
- 已确认 Memory 内容

### 6.5 用户可视的隐私声明

导出诊断报告前必须弹出确认对话框：

```text
诊断报告将包含：
  - 应用版本、平台信息、错误日志（脱敏）
  - 最近 7 天的操作审计（已隐去内容）
  - 数据库统计（不含原文）

不会包含：
  - 你的笔记、知识、文档原文
  - 你的 API Key
  - 完整数据库文件

诊断报告保存在你选择的位置，不会自动上传。
```

---

## 7. 日志策略

### 7.1 日志分层

```text
Main Process 日志    ：electron 主进程行为（启动、IPC、sidecar 生命周期）
Renderer 日志        ：React 渲染异常、IPC 调用
Sidecar 日志         ：FastAPI 请求、异常、SQL 查询（开发模式）
SQL 慢查询日志       ：> 200ms 的查询单独写一个文件
Audit Log（DB 表）    ：业务关键操作（创建 KU、Review confirm 等）
```

### 7.2 日志位置

```text
macOS:    ~/Library/Logs/KnowledgeBase/
Windows:  %APPDATA%/KnowledgeBase/logs/
Linux:    ~/.config/KnowledgeBase/logs/
```

文件命名：

```text
main-{YYYY-MM-DD}.log
renderer-{YYYY-MM-DD}.log
sidecar-{YYYY-MM-DD}.log
sql-slow-{YYYY-MM-DD}.log
crash-{YYYY-MM-DD-HHmmss}.log
```

### 7.3 日志级别

| 级别 | 用途 | 默认开启 |
|---|---|---|
| DEBUG | 详细执行轨迹（SQL、请求体） | 否（仅开发模式） |
| INFO | 关键事件（启动、关闭、迁移、备份） | 是 |
| WARN | 非阻断异常（mock 降级、重试） | 是 |
| ERROR | 业务/系统错误 | 是 |
| FATAL | 进程崩溃前最后日志 | 是 |

### 7.4 日志脱敏规则

写入磁盘前必须脱敏：

```text
- API Key（任何匹配 sk-[A-Za-z0-9]+ 或 Bearer * 的串）→ ***REDACTED***
- 用户原文（≥ 100 字符的 Source/Chunk/KU.content 字段）→ "[redacted: 1234 chars]"
- 文件绝对路径中的用户名 → /Users/$USER/... → /Users/***/...
- 邮箱、手机号（如出现） → ***@***
```

详见 `docs/desktop-architecture.md` §13.7。

### 7.5 日志轮转

| 文件 | 保留策略 |
|---|---|
| {channel}-{date}.log | 按天分文件，保留 30 天 |
| sql-slow-{date}.log | 按天分文件，保留 14 天 |
| crash-*.log | 永久保留（直到用户手动删除） |

实现工具：

- Python sidecar 使用 `logging.handlers.TimedRotatingFileHandler`
- Electron Main / Renderer 使用 `electron-log` 配置 `maxDays`

### 7.6 单文件最大体积

- 单文件 > 100MB 时切割（防止单个错误风暴爆盘）
- 总日志目录 > 500MB 时主动报警（Status Bar 提示 + 设置页面建议清理）

---

## 8. 崩溃报告与遥测

### 8.1 P0 立场

P0 **默认关闭**所有远程上报：

- 不上传崩溃报告
- 不上传使用统计
- 不上传错误码统计

设置页面（详见 `docs/desktop-architecture.md` §15.4）提供 opt-in 开关，默认全部为 OFF：

```yaml
telemetry:
  crash_reports: false       # 默认 OFF
  usage_stats: false         # 默认 OFF
  error_stats: false         # 默认 OFF
```

### 8.2 本地崩溃记录

即使不上传，仍在本地记录崩溃：

- Main Process 崩溃 → 写入 `crash-{timestamp}.log`，下次启动时弹窗"上次异常关闭，导出诊断报告？"
- Renderer 崩溃 → React Error Boundary 显示 fallback UI + 一键导出诊断
- Sidecar 崩溃 → Main Process 检测到 sidecar 进程退出码非 0 时记录 + 自动重启 + Status Bar 提示

### 8.3 P1 远程崩溃上报（可选）

P1 可考虑集成 Sentry 或自建上报：

- 必须 opt-in
- 必须脱敏（与 §7.4 一致）
- 必须显示发送内容预览
- 必须支持随时关闭

---

## 9. 安全与运维横切层

P0 的安全与运维能力是本地可解释状态，不是远程 telemetry。默认从 `audit_logs`、`system_logs`、`processing_status_events`、`chunk_quality_checks`、`parse_warnings`、`feedback_events` 派生。

### 9.1 P0 本地模块

| 模块 | 事件来源 | 必须覆盖 |
|---|---|---|
| 日志模块 | `audit_logs`, `system_logs`, `processing_status_events` | 用户操作、登录/账号 disabled、文件处理、AI 调用、权限变更、错误 |
| 异常监控模块 | `processing_status_events`, `system_logs` | 上传失败、解析失败、检索失败、RAG answer fallback、feedback 记录失败、系统报错、队列停滞 |
| 数据安全模块 | `access_policies`, `sensitive_access_grants`, `system_logs` | 权限控制、访问控制、敏感信息检测、备份、恢复、删除、隐私设置 |
| 性能成本模块 | `system_logs.metadata_json` | API 耗时、慢查询、AI 调用估算成本、存储占用、高资源任务 |
| 系统稳定性模块 | health check, job heartbeat, rate-limit event | 服务健康、任务队列、失败任务重试、接口限流、本地告警 |

`GET /api/system/status` 返回这些模块的摘要。摘要只读本地数据库和进程状态，不上传远程服务。

### 9.2 P0 保留事件类型

`processing_status_events.event_type` 以 `docs/data-model.md` §6.16 的保留枚举为唯一来源。本节只列出安全运维关心的事件子集：

```text
chunk_strategy_selected
chunk_context_enriched
chunk_quality_warning
chunk_quality_failed
upload_failed
parse_failed
retrieval_failed
rag_answer_fallback
feedback_record_failed
queue_stalled
high_resource_task
rate_limited
ops_alert
```

D-083 要求前端状态只读取 `FrontendStateContract` 摘要：upload / file_processing / chunking / extraction / embedding / retrieval / rag_answer / citation / feedback 都必须能区分 `idle / running / success / warning / failed / recoverable`，并展示可恢复动作。

`system_logs.log_type` 保留：

```text
user_action
auth
file_processing
ai_call
permission_change
error
performance
security
```

质量信号仍以专用表为准：parse warning 写 `parse_warnings`，chunk 质量写 `chunk_quality_checks`；只有影响系统稳定、用户恢复动作或诊断报告时，才同步写 `system_logs` 摘要。

### 9.3 P1 可观测性指标

P0 不实现 Prometheus / Sentry / Grafana 这类外部指标采集。P1 可引入：

| 指标 | 类型 | 用途 |
|---|---|---|
| `sidecar_request_duration_seconds{route}` | Histogram | API 性能 |
| `retrieval_response_time_seconds{type}` | Histogram | 检索性能 |
| `ai_provider_call_total{provider,capability,status}` | Counter | AI 调用计数 |
| `ai_provider_call_cost_usd{provider}` | Counter | AI 成本 |
| `knowledge_unit_count{status}` | Gauge | KU 数量 |
| `audit_log_event_total{action}` | Counter | 关键事件计数 |
| `sidecar_restart_total` | Counter | sidecar 稳定性 |
| `database_size_bytes` | Gauge | 数据库体积 |

P1 指标暴露方式：

- 本地：`GET /api/system/metrics`（Prometheus 文本格式），仅 localhost 可访问
- UI：设置 → 关于 → 性能面板

---

## 10. 与 audit_logs / processing_status_events 的边界

`docs/data-model.md` §3.7 已定义事件类对象决策树。本节澄清错误处理与事件分类的边界：

| 场景 | 写到哪 | 出现在诊断报告？ |
|---|---|---|
| 用户点击"创建 KU" → 写入数据库 | `audit_logs` | 默认包含（隐去内容） |
| 用户导入 PDF → 解析失败 | `parse_warnings` + `processing_status_events` | 否（业务事件，非系统错误） |
| 用户点击"创建 KU" → 数据库 locked | sidecar 日志 + `system_logs` | 是 |
| Renderer 崩溃 | `crash-*.log` | 是 |
| AI Provider API 调用失败 | `system_logs` + `quality_events`（若影响质量） | 是 |
| chunk 质量检查失败 | `chunk_quality_checks` + `processing_status_events` | 否（除非导致 job 失败） |
| 接口限流 | `system_logs(log_type=performance)` + `processing_status_events`（如关联 job） | 是 |
| 用户给 retrieval 打"准确"标签 | `feedback_events` | 否（业务事件） |

规则：

- **业务事件**（用户主观行为、KU 状态流转、reviewer 操作）→ 进业务表
- **系统错误**（异常、降级、崩溃、迁移）→ 进系统日志 + 诊断报告
- **质量信号**（parse warning、chunk quality）→ 进各自专用表，不重复进 system_logs

---

## 11. 与其他文档的关系

```text
docs/error-handling-and-observability.md（本文档）
└── 错误码 / UI 消息 / 诊断报告 / 日志 / 崩溃 / P1 指标

docs/api-design.md
└── §4 错误响应 envelope（被本文档 §3 引用）
└── §16 桌面系统 API（包含 /api/system/diagnostics:export）

docs/data-model.md
└── §3.7 事件分类决策树（被本文档 §10 引用）

docs/desktop-architecture.md
└── §13 安全实践（日志脱敏）+ §15 设置页面（遥测开关）

docs/ai-provider-architecture.md
└── §6 网络降级策略（被本文档 §5 UI 消息引用）

docs/testing-strategy.md
└── 错误码测试 + Sidecar 崩溃恢复 E2E
```

---

## 12. 当前结论

```text
错误响应：统一 envelope（code + message + details + request_id）
错误码：snake_case，HTTP / 业务 / 系统 三层分离
UI 消息：i18n 映射 + Toast/Banner/Modal/StatusBar 四种展示
诊断报告：用户主动导出 + 脱敏 + 不含原文 + 不自动上传
日志：分层 + 日轮转 + 30 天保留 + 关键字段脱敏
崩溃：本地记录 + 自动重启 + 一键导出诊断
P0 遥测：默认全 OFF，opt-in
P1 指标：sidecar 暴露 Prometheus，UI 显示性能面板
```

错误处理与可观测性是产品体验的最后一公里，但 P0-Core 不应因此扩大成完整运维系统。

P0-Core 必须跑通：

- 错误响应 envelope。
- 核心错误码白名单。
- UI 消息映射（Toast / Banner 至少一种可用）。
- 基础本地日志。

P0-File / P0-AI / P0-RAG 继续补：

- 诊断报告 zip。
- 完整日志脱敏导出。
- 日志 30 天轮转。
- Error Boundary 全覆盖。

这些能力不应阻塞 Upload / text_import → File → Source → Parse → Chunk → KU → Review → Embedding → Retrieval → Evidence → Answer/Fallback 的 Core 验收。
