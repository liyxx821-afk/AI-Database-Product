# 桌面应用架构

版本：v0.11
日期：2026-05-17
状态：已同步完整 P0 入库、文件处理、开源优先 AI、P0-RAG 桌面边界、D-092 sidecar 打包验证 spike、D-093 桌面运行时硬化、D-094 P0-Core 工程骨架开工契约、D-098 Knowledge Workspace 页面 IA / 桌面 shell 导航契约、D-109 pseudo-packaged desktop runtime smoke、D-111 feedback export history metadata config 与 D-116 knowledge export history metadata config

## 1. 文档目的

本文档解决一个核心问题：

> 产品定位为桌面软件，当前技术架构是 React + FastAPI sidecar + SQLite 本地数据库。如何让 P0 产出一个用户可以双击启动的桌面应用，而不是需要手动启动多个服务的开发环境？

本文档定义：

- 桌面框架选型（Electron）
- 后端部署模式（FastAPI 作为 Electron sidecar）
- 数据库部署模式（SQLite 内嵌）
- 前后端通信方式
- 打包与分发策略
- 文件系统集成
- 离线能力边界
- 桌面 UX 约束
- 数据可移植性

---

## 2. 桌面框架选型：Electron

### 2.1 选型结论

P0 采用 **Electron** 作为桌面框架。

### 2.2 选型理由

| 维度 | Electron | Tauri | 裸 Web |
|---|---|---|---|
| 前端复用 | React + TypeScript 直接复用 | React 直接复用 | 需要浏览器 |
| 后端集成 | Node.js 主进程 + Python sidecar 成熟方案 | Rust 主进程 + Python sidecar 较复杂 | 不适用 |
| 数据库集成 | better-sqlite3 原生绑定成熟 | rusqlite 需要 Rust 桥接 | 不适用 |
| 打包分发 | electron-builder / electron-forge 成熟 | tauri-bundler 成熟但社区较小 | 不适用 |
| 对标产品 | Obsidian、VS Code、Notion Desktop、Logseq | Signal Desktop | - |
| Bundle 大小 | ~100MB+ | ~10MB+ | 0 |
| 社区与生态 | 极成熟 | 快速成长中 | - |
| P0 风险 | 低 | 中（Python 集成复杂） | 高（非桌面体验） |

Electron 的缺点（Bundle 大、内存占用高）在 P0 阶段可接受。P2 阶段如需优化 Bundle 和性能，可评估 Tauri 迁移。

### 2.3 版本建议

```text
Electron: 最新 stable（33+）
electron-builder: 最新 stable
Node.js: 20 LTS+
```

---

## 3. 整体部署架构

### 3.1 架构图

```text
┌─────────────────────────────────────────────────┐
│                 Electron App                     │
│                                                  │
│  ┌──────────────┐     ┌───────────────────────┐ │
│  │  Main Process │     │   Renderer Process    │ │
│  │  (Node.js)    │     │   (React + Vite)      │ │
│  │               │     │                       │ │
│  │  - App 生命周期│     │  - Knowledge Workspace│ │
│  │  - Sidecar 管理│     │  - 建库工作台         │ │
│  │  - 系统托盘   │◄───►│  - 调用工作台         │ │
│  │  - 快捷键     │ IPC │  - 知识组织面板       │ │
│  │  - 文件对话框 │     │  - 系统管理           │ │
│  │  - 自动更新   │     │                       │ │
│  └──────┬───────┘     └───────────────────────┘ │
│         │                                        │
│  ┌──────▼───────┐                               │
│  │  FastAPI      │                               │
│  │  Sidecar      │                               │
│  │  (Python)     │                               │
│  │               │                               │
│  │  - 业务逻辑   │     ┌───────────────────────┐ │
│  │  - 解析切片   │────►│   SQLite Database     │ │
│  │  - 检索引擎   │     │   (本地文件)           │ │
│  │  - Mock AI    │     │   + sqlite-vec        │ │
│  └──────────────┘     └───────────────────────┘ │
│                                                  │
│  ┌──────────────────────────────────────────────┐│
│  │  本地文件系统                                 ││
│  │  - 原始 Source 文件                           ││
│  │  - 数据库文件 (.db)                           ││
│  │  - 用户配置                                   ││
│  │  - 日志文件                                   ││
│  └──────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

### 3.2 进程模型

| 进程 | 角色 | 技术 | 生命周期 |
|---|---|---|---|
| Main Process | Electron 主进程，管理窗口、托盘、快捷键、sidecar | Node.js / TypeScript | 随应用启动/关闭 |
| Renderer Process | 用户界面 | React + TypeScript（Vite 构建） | 随窗口创建/销毁 |
| API Sidecar | 业务逻辑和数据访问 | Python / FastAPI | 由 Main Process 管理，随应用启动/关闭 |

### 3.3 Sidecar 管理策略

Main Process 负责管理 FastAPI sidecar 的生命周期：

```text
App 启动
→ Main Process 启动
→ 启动 FastAPI sidecar（child_process.spawn）
→ 等待 sidecar health check 成功
→ 创建 Renderer 窗口
→ Renderer 通过 localhost 连接 sidecar API

App 关闭
→ Renderer 窗口关闭
→ Main Process 发送 SIGTERM 到 sidecar
→ 等待 sidecar 优雅退出
→ App 退出
```

Sidecar 崩溃恢复：

- Main Process 监听 sidecar 进程退出事件
- 自动重启 sidecar（最多 3 次）
- 重启失败时提示用户

### 3.4 Python Runtime 打包

P0 阶段推荐将 Python 环境和 FastAPI 应用通过以下方式打包：

| 方案 | 优点 | 缺点 | P0 推荐 |
|---|---|---|---|
| PyInstaller 打包为单一可执行文件 | 用户无需安装 Python | 打包复杂度中等 | 推荐 |
| 内嵌 Python 发行版 (python-build-standalone) | 完整 Python 环境 | 体积较大 | 备选 |
| 要求用户安装 Python | 最简单 | 用户体验差 | 仅开发阶段 |

P0 开发阶段可以先要求本地 Python 环境，P0 发布前使用 PyInstaller 打包。

### 3.5 D-092 Sidecar 打包验证 Spike

W1 必须做一次最小打包验证，避免只在开发态 `uvicorn --reload` 下成立。

最小链路：

```text
Electron main
→ packaged 或 pseudo-packaged FastAPI sidecar
→ temporary app data dir
→ dynamic local port
→ /api/health
→ graceful shutdown
```

验收：

- Python runtime 路径、资源路径和 app data 路径在打包形态下可解析；
- sidecar 日志写入本地日志目录，不写入源码目录；
- 端口冲突时可换端口或返回 `sidecar_port_unavailable`；
- 应用退出时 sidecar 被清理，不残留后台进程；
- 本 spike 不要求正式签名、自动更新、完整安装器或正式品牌资源。

### 3.6 D-109 Pseudo-Packaged Desktop Runtime Smoke

D-109 将 D-092 / D-095 的最小打包态验证落成可运行 smoke，但仍不等同于正式打包、签名或安装器。

当前 smoke 边界：

```text
pnpm build shared packages / desktop preload / desktop main / renderer
→ Vite preview serves built renderer on 127.0.0.1
→ Electron launches apps/desktop-main/dist/main.js
→ Main loads apps/desktop-preload/dist/preload.js
→ Main starts FastAPI sidecar on dynamic 127.0.0.1 port
→ Renderer uses preload bridge to fetch protected sidecar API
→ Main writes redacted result and stops sidecar
→ script verifies sidecar pid is gone
```

验收：

- `smoke:p0-desktop-runtime` 必须使用 build 产物，不通过 `desktop-main dev` 间接重跑 build；
- Renderer 不允许硬编码 API base、token、Node fs 或 SQLite path，只能通过 preload bridge 获取 runtime config；
- 无 token 访问受保护 API 必须失败，带 bridge token 必须成功；
- smoke result 只能包含 token length / presence，不写出 token 明文；
- sidecar 只允许 `127.0.0.1` 绑定；FastAPI CORS 只允许本地 `127.0.0.1:<port>` renderer 来源；
- Electron 退出前必须等待 sidecar 退出，必要时强制终止并记录 forced 状态。

### 3.7 D-093 Sidecar 本地安全通信

P0 虽然只在本机运行，但 `localhost` 端口仍可能被其他本机进程访问。D-093 要求 sidecar 通信增加本地会话保护：

```text
Electron Main
→ 选择 127.0.0.1 dynamic_port
→ 生成 local_session_token
→ spawn FastAPI sidecar，并通过环境变量或启动参数传入 token
→ health check 使用 token
→ preload 暴露 api base 和受控请求能力
→ typed fetch wrapper 注入 X-Local-Session-Token / X-Trace-Id
```

约束：

- sidecar 只绑定 `127.0.0.1`，不监听 `0.0.0.0` 或局域网地址；
- Renderer 不保存长期 token，不硬编码端口；
- token 只在当前应用会话有效，sidecar 重启后轮换；
- token 不进入日志、诊断包、崩溃报告或持久配置；
- FastAPI middleware 对缺失、错误或过期 token 返回 `sidecar_auth_failed`；
- 端口冲突、sidecar 启动失败和 token 校验失败必须进入主进程状态栏与诊断报告。

### 3.8 D-094 P0-Core 启动状态机

D-094 要求桌面工程骨架先实现统一 runtime state，再进入上传、解析、RAG 或聊天业务。状态机由 Electron Main 维护，FastAPI sidecar 和 Renderer 只能消费或报告子系统状态。

```text
booting
→ sidecar_starting
→ sidecar_ready
→ db_checking
→ migration_running?
→ worker_starting
→ ready | degraded | recovery_required
→ shutting_down
```

状态定义：

| runtime_state | 含义 |
|---|---|
| `booting` | Electron Main 启动，尚未选择端口和数据目录 |
| `sidecar_starting` | Main 正在启动 FastAPI sidecar |
| `sidecar_ready` | sidecar health 已通过 local token 校验 |
| `db_checking` | sidecar 正在检查 app data dir、SQLite 文件和 `quick_check` |
| `migration_running` | schema migration 或 restore/backup 锁定中 |
| `worker_starting` | `local_sqlite_worker` 初始化和 heartbeat 建立中 |
| `ready` | sidecar、DB、worker、Provider summary、vector channel 均达到可用或可解释 fallback |
| `degraded` | 至少一个非阻塞子系统降级，但工作台可加载 |
| `recovery_required` | DB integrity、migration、sidecar auth 或数据目录错误阻止继续写入 |
| `shutting_down` | 应用退出，sidecar 和 worker 正在优雅关闭 |

约束：

- Renderer 不得在 `ready` 或带解释的 `degraded` 前把主工作台标记为 ready；
- shell 加载后底部 runtime status bar 必须始终可见；
- `degraded` 必须说明子系统：`sidecar / db / worker / provider / vector`；
- `recovery_required` 默认禁用写操作，并提供诊断导出入口；
- runtime state 必须进入 `GET /api/system/runtime`、Main 日志和诊断包。

---

## 4. 数据库部署：SQLite

### 4.1 选型结论

P0 采用 **SQLite** 作为本地数据库，配合 **sqlite-vec** 支持 mock 向量检索。

### 4.2 选型理由

| 维度 | SQLite | PostgreSQL | 内嵌 PostgreSQL |
|---|---|---|---|
| 安装成本 | 零（内嵌） | 用户需安装 | 打包复杂 |
| 桌面适配 | 原生支持 | 需要服务进程 | 需要管理 |
| 跨平台 | 完美 | 需配置 | 风险较高 |
| P0 本地 / 开源 embedding + fallback | sqlite-vec 足够 | pgvector 过重 | 过重 |
| 全文检索 | FTS5 内建 | pg_trgm / tsquery | 同左 |
| 结构化查询 | SQL 完整 | SQL 完整 | 同左 |
| JSONB | JSON 函数支持 | 原生 JSONB | 同左 |
| 并发写入 | WAL 模式单写多读 | 多写多读 | 同左 |
| P1 迁移 | 通过 Repository 抽象层迁移 | 原地 | 原地 |

### 4.3 P0 限制与 P1 迁移路径

P0 SQLite 的限制：

- 不支持 `ARRAY` 类型：使用 JSON 数组或逗号分隔文本替代
- 不支持 `UUID` 原生类型：使用 TEXT 存储
- 不支持 `TIMESTAMPTZ`：使用 TEXT (ISO 8601) 或 INTEGER (Unix timestamp)
- 向量搜索能力弱于 pgvector：P0 使用本地 / 开源 embedding 或 mock fallback，不影响链路验证
- 并发写入受限：桌面单用户场景可接受

P1 迁移到 PostgreSQL 的条件和路径：

```text
条件：
- 需要真实 embedding provider + pgvector 高性能向量搜索
- 需要多设备同步或云服务
- 需要更强的并发写入

路径：
- Repository 抽象层已隔离 SQL 方言差异
- 使用 Alembic 管理迁移脚本，支持双数据库目标
- 数据导出为标准格式后导入 PostgreSQL
```

### 4.4 数据文件位置

```text
macOS:   ~/Library/Application Support/KnowledgeBase/
Windows: %APPDATA%/KnowledgeBase/
Linux:   ~/.config/KnowledgeBase/

目录结构：
├── data/
│   ├── knowledge.db          (主数据库)
│   ├── knowledge.db-wal      (WAL 日志)
│   └── knowledge.db-shm      (共享内存)
├── sources/                   (原始 Source 文件)
├── exports/                   (导出文件)
├── logs/                      (应用日志)
└── config.json                (用户配置与轻量 history metadata)
```

用户可以在设置中自定义数据目录。

### 4.5 D-093 SQLite 数据保护

桌面软件的核心风险不是并发量，而是本地用户数据损坏、迁移失败或路径混乱。P0-Z0a 数据库初始化必须包含：

| 保护项 | P0 要求 |
|---|---|
| WAL | 启动后设置 `PRAGMA journal_mode=WAL` |
| busy timeout | 设置 `PRAGMA busy_timeout`，避免短暂写锁直接变成失败 |
| foreign keys | 设置 `PRAGMA foreign_keys=ON` |
| user_version | 使用 SQLite `user_version` 或 migration table 对齐 Alembic revision |
| integrity check | 启动时执行轻量 `PRAGMA quick_check`；失败进入只读恢复状态 |
| migration lock | migration / restore 期间禁止业务写入，API 返回 `migration_in_progress` |
| pre-migration backup | migration / restore 前复制 `.db`、`.db-wal`、`.db-shm` 到 `backups/` |
| single writer | 写入型重任务通过 `local_sqlite_worker` 串行化 |

数据目录规则：

- 数据库、WAL、上传缓存、source 文件、preview、backup 和日志只写入 app data dir；
- packaged app 不得写入源码目录或应用安装目录；
- 数据目录迁移必须先完成备份，再切换配置；
- 如果完整恢复失败，必须保留原目录并给出 `data_dir_move_failed` 或 `database_integrity_failed`。

---

## 5. 前后端通信

### 5.1 P0 通信方式

Renderer Process 通过 **localhost HTTP** 连接 FastAPI sidecar：

```text
Renderer (React)
  → typed fetch wrapper
  → http://127.0.0.1:{dynamic_port}/api/...
  → headers: X-Local-Session-Token / X-Trace-Id
  → FastAPI sidecar 处理
  → 返回 JSON 响应
```

端口分配：

- Sidecar 启动时动态选择可用端口
- Main Process 通过 secure preload 将 API base 与本地会话 token 注入 Renderer
- 页面组件不得直接拼接 URL 或调用裸 `fetch`

### 5.2 Electron IPC 使用场景

部分操作需要通过 Electron IPC（Main Process 代理），而非直接调 API：

| 操作 | 通道 | 原因 |
|---|---|---|
| 打开文件对话框 | IPC → Main | 需要原生文件对话框 |
| 拖放文件导入 | IPC → Main → API | 需要读取本地文件路径 |
| 系统通知 | IPC → Main | 需要原生通知 API |
| 全局快捷键 | Main → IPC → Renderer | 需要系统级快捷键注册 |
| 剪贴板读取 | IPC → Main | 需要系统剪贴板 API |
| 窗口管理 | IPC → Main | 多窗口创建和管理 |
| 自动更新 | Main 自管理 | electron-updater |

### 5.3 Preload 安全

使用 `contextBridge` 暴露安全 API，不直接暴露 Node.js 能力：

```text
contextIsolation: true
nodeIntegration: false
sandbox: true（P0 可选）
```

### 5.4 D-094 Preload API Surface

D-094 的首批 preload API 只暴露桌面运行时骨架所需能力：

```ts
getRuntimeConfig()
getRuntimeStatus()
onRuntimeStatusChange(listener)
openFileDialog()
exportDiagnostics()
```

约束：

- 不暴露 `require`、`fs`、`child_process`、数据库连接或 Node 全局对象；
- `getRuntimeConfig()` 只返回当前会话需要的 API base、feature flags 和脱敏配置，不返回长期 token；
- `onRuntimeStatusChange()` 只传递 runtime state 与子系统摘要，不传用户原文或本地私密路径；
- `openFileDialog()` 由 Main 代理，Renderer 只获得用户确认后的文件句柄/路径摘要；
- `exportDiagnostics()` 只触发脱敏诊断包生成，不能把数据库文件、API Key 或完整私密路径交给 Renderer。

### 5.5 D-098 桌面 Shell 与内部路由

D-098 固定 Knowledge Workspace 的桌面 shell：应用首屏进入 `/dashboard`，左侧导航到 8 个主页面，底部 runtime status bar 在所有页面保持可见。该路由只属于 Renderer 内部状态，不新增 sidecar endpoint。

```text
Electron Main ready/degraded
→ Renderer shell mounted
→ left navigation
   ├── /dashboard
   ├── /import
   ├── /library
   ├── /search
   ├── /ask
   ├── /graph
   ├── /outputs
   └── /settings
→ bottom runtime status bar always visible
```

| 页面 | Shell 要求 | Runtime / API 要求 |
|---|---|---|
| `/dashboard` | 默认首屏；展示最近导入、知识概览、最近检索/问答摘要 | 只能消费 runtime、provider、source/retrieval/answer summary |
| `/import` | 支持拖拽区、文件选择、进度和解析状态；P1/P2 导入入口必须标注 disabled reason | 文件选择走 Main/IPC；上传/解析状态走 typed fetch + SSE |
| `/library` | 文件/知识库管理页；展示分类树、文档列表和筛选状态 | 不直接读文件系统；只消费 Source/File/KU/Review API |
| `/search` | 智能搜索页；展示 Query Explanation、Evidence Pack、Citation Trace | 不在 UI 拼 evidence；只展示 API 返回的 retrieval/citation summary |
| `/ask` | 问答页；必须区别 evidence-only 与 provider answer | Provider/fallback 状态来自 response；无证据时显示不可答原因 |
| `/graph` | 可解释关系视图；数据不足显示空态 | P0 不要求 GraphRAG、图数据库或纯装饰图 |
| `/outputs` | 生成结果入口；草稿和导出都必须显示 evidence/citation 绑定 | 无 evidence 时禁用生成/导出或进入 pending review |
| `/settings` | 账号、存储、AI 模型、外观、导入导出、runtime/provider 状态 | API Key 写入走 Main/Keychain；settings API 不传密钥 |

约束：

- Renderer 不得在 `ready` 或带解释的 `degraded` 前启用业务写操作。
- 页面级 loading、empty、degraded、recoverable_error、done 状态必须可从 runtime status、job snapshot、provider capability 或 API response summary 还原。
- `/graph` 与 `/outputs` 在 P0 数据不足时必须展示 disabled reason；不得生成无来源内容或无证据关系。
- 微信、网盘、Obsidian、Notion 导入入口可以作为占位，但必须标记为 P1/P2，不得在 P0 文案中承诺已可用。

---

## 6. 打包与分发

### 6.1 打包工具

推荐 **electron-builder**。

### 6.2 目标平台

| 平台 | 格式 | P0 优先级 |
|---|---|---|
| macOS (arm64) | .dmg | P0 优先 |
| macOS (x64) | .dmg | P0 |
| Windows (x64) | .exe / .msi (NSIS) | P0 |
| Linux | .AppImage / .deb | P1 |

### 6.3 自动更新

P0 可暂不实现自动更新。P1 使用 `electron-updater` + GitHub Releases 或自建更新服务。

### 6.4 代码签名

P0 开发阶段可跳过代码签名。正式分发前需要：

- macOS: Apple Developer ID + notarization
- Windows: EV Code Signing Certificate

---

## 7. 文件系统集成

### 7.1 P0 支持

| 功能 | P0 | P1 | 说明 |
|---|---|---|---|
| 拖放文件到窗口创建上传任务 | 支持 | - | 进入 Upload / File Processing 管线 |
| 文件选择对话框导入 | 支持 | - | 原生文件对话框 |
| Source 引用本地文件路径 | 支持 | - | `files.storage_path` / `sources.source_path` 分工保存 |
| 数据目录自定义 | 支持 | - | 设置中选择数据存储目录 |
| 导出 Knowledge Unit 为 Markdown | 支持 | - | 单条或批量导出 |
| 文件夹监听自动导入 | 不做 | P1 | 监听指定文件夹新增文件 |
| Obsidian Vault 导入 | 不做 | P1 | 解析 .md 文件和 YAML frontmatter |
| 系统级文件关联 | 不做 | P2 | 双击 .md 文件用本应用打开 |

### 7.2 拖放导入流程

```text
用户拖放文件到应用窗口
→ Renderer 接收 drop 事件，获取文件路径和基础元数据
→ Renderer 通过 IPC 请求 Main Process 读取文件或创建文件句柄
→ Main Process 调用 sidecar `POST /api/uploads` 创建上传任务
→ 小文件直传；大文件按 `PUT /api/uploads/{id}/parts/{part_no}` 分片
→ `POST /api/uploads/{id}:complete` 触发完整性校验
→ Sidecar 生成 `file_id`、保存文件、创建 Source / parse task
→ Renderer 订阅上传、接收、解析和切片状态反馈
```

---

## 8. 离线能力边界

### 8.1 P0 离线支持

核心知识库操作在无网络环境下必须正常运行：

| 功能 | 离线可用 | 说明 |
|---|---|---|
| 创建 Project / Folder | 是 | 纯本地操作 |
| Upload / text_import 导入 | 是 | 纯本地操作 |
| Source / Chunk 生成 | 是 | 本地 parser / 规则处理，不依赖网络 |
| Knowledge Unit 创建和确认 | 是 | 纯本地操作 |
| Review 操作 | 是 | 纯本地操作 |
| P0-RAG Retrieval / Evidence / Citation | 是 | 本地全文检索 + sqlite-vec / fallback |
| RAG answer / evidence-only fallback | 是 | 本地或开源 Provider 可用时 answer；缺失时 evidence-only |
| Tag / Relation 管理 | 是 | 纯本地操作 |
| P0 AI 能力 | 是 | 开源 Provider 优先；缺失时规则/mock 不需要网络 |

### 8.2 需要网络的功能（P1+）

| 功能 | 阶段 | 说明 |
|---|---|---|
| 商业 embedding provider | 可选 | 作为开源 / 本地 Provider 的可选增强 |
| 真实 Text-to-SQL 模型 | P1 | P0 保留只读模板与安全校验 |
| 商业 RAG answer provider | 可选 | P0 可用本地/开源 LLM，商业 API 不作为必需条件 |
| 自动更新检查 | P1 | 检查 GitHub Releases |
| 云备份/同步 | P2 | 可选的远程存储 |

可选联网能力在离线时应降级为 P0 本地 / mock / evidence-only 能力或提示用户网络不可用。

---

## 9. 桌面 UX 约束

### 9.1 窗口与布局

| 约束 | 说明 | P0 |
|---|---|---|
| 主窗口 | Knowledge Workspace，P0 支持入库、文件状态、Review、检索、证据和 RAG fallback 工作台 | 支持 |
| 窗口大小记忆 | 记住上次关闭时的窗口大小和位置 | 支持 |
| 多窗口 | 支持打开多个 Knowledge Unit 详情窗口 | P1 |
| 分屏布局 | 左侧导航 + 中间内容 + 右侧面板 | 支持 |
| 响应式 | 窗口缩小时面板可折叠 | 支持 |

### 9.2 系统集成

| 约束 | 说明 | P0 |
|---|---|---|
| 系统托盘 | 后台常驻，点击唤起窗口 | P1 |
| 全局快捷键 | 快速唤起应用或输入想法 | P1 |
| 深色模式 | 跟随系统主题 | 支持 |
| 原生菜单栏 | 文件/编辑/视图/帮助等标准菜单 | 支持 |
| 原生右键菜单 | 复制/粘贴/删除等上下文菜单 | 支持 |

### 9.3 交互模式

| 约束 | 说明 | P0 |
|---|---|---|
| 文件拖放 | 拖放文件到窗口创建 Source | 支持 |
| 键盘导航 | Tab / Arrow 键导航 | 支持 |
| 快捷键 | Cmd/Ctrl+N 新建、Cmd/Ctrl+F 搜索等 | 支持 |
| 剪贴板导入 | 检测剪贴板文本，提示导入 | P1 |
| 本地通知 | 后台任务完成时系统通知 | P1 |

### 9.4 性能预期

| 指标 | P0 目标 | 说明 |
|---|---|---|
| 冷启动时间 | < 5 秒 | 包含 sidecar 启动 |
| 页面切换 | < 200ms | 渲染进程内导航 |
| 检索响应 | < 1 秒 | 本地数据库查询 |
| Source 导入 | < 3 秒（2000 字文本） | 包含切片和 mock embedding |
| 数据库大小 | 支持 10,000+ Knowledge Unit | SQLite 可轻松处理 |

---

## 10. 数据可移植性

### 10.1 导出格式

| 格式 | 内容 | P0 |
|---|---|---|
| Markdown | 单条 Knowledge Unit 导出为 .md，含 YAML frontmatter（type、tags、status） | 支持 |
| JSON | 单条或批量 Knowledge Unit 导出为结构化 JSON | 支持 |
| 知识库完整备份 | 整个数据库 + Source 文件打包为 .zip | 支持 |
| CSV | Knowledge Unit 列表导出为 CSV | P1 |

### 10.2 备份与还原

```text
备份：
- 用户在设置中选择"导出知识库"
- 系统将 SQLite 数据库文件 + sources/ 目录打包为 .zip
- 用户选择保存位置

还原：
- 用户在设置中选择"导入知识库"
- 系统解压 .zip 到数据目录
- 系统验证数据库完整性
- 系统展示导入摘要（项目数、KU 数、Source 数）
```

### 10.3 Obsidian 互通（P1）

P1 支持：

- 导入 Obsidian Vault（.md 文件 + 双向链接 + YAML frontmatter）
- 导出为 Obsidian 兼容格式（.md + `[[wikilink]]` + tags）
- 保留文件夹结构映射

### 10.4 数据主权声明

- 所有数据默认存储在用户本地设备
- 应用不会未经用户同意上传任何数据
- 用户可以随时导出或删除全部数据
- 数据库文件是标准 SQLite 格式，用户可用第三方工具直接读取

---

## 11. P0 工程目录

结合桌面架构，P0 推荐目录调整为：

```text
├── electron/
│   ├── main.ts                (Electron 主进程)
│   ├── preload.ts             (预加载脚本，contextBridge)
│   ├── sidecar.ts             (FastAPI sidecar 生命周期管理)
│   ├── ipc-handlers.ts        (IPC 消息处理)
│   └── updater.ts             (P1 自动更新)
├── apps/
│   ├── web/                   (React 前端，Renderer 进程)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── features/
│   │   │   ├── services/
│   │   │   ├── types/
│   │   │   └── utils/
│   │   ├── package.json
│   │   └── vite.config.ts
│   └── api/                   (FastAPI 后端，Sidecar)
│       ├── app/
│       │   ├── api/
│       │   ├── modules/
│       │   ├── repositories/
│       │   ├── db/
│       │   └── main.py
│       ├── tests/
│       └── pyproject.toml
├── database/
│   ├── migrations/
│   ├── views/
│   └── seeds/
├── scripts/
│   ├── dev/                   (开发启动脚本)
│   ├── build/                 (打包脚本)
│   └── validation/
├── docs/
├── package.json               (根 monorepo 配置)
└── electron-builder.yml       (打包配置)
```

### 11.1 开发模式

```text
开发时：
1. npm run dev:api     → 启动 FastAPI dev server (uvicorn --reload)
2. npm run dev:web     → 启动 Vite dev server
3. npm run dev:electron → 启动 Electron，连接 Vite dev server

生产构建：
1. npm run build:api   → PyInstaller 打包 FastAPI
2. npm run build:web   → Vite 构建静态文件
3. npm run build:electron → electron-builder 打包为 .dmg / .exe
```

---

## 12. Schema 演进与数据迁移

桌面应用最严峻的挑战之一是：**用户从 v0.1 升级到 v0.5 时，本地 SQLite 数据库的 schema 变更必须无损迁移**，否则用户多年积累的知识资产可能在升级中丢失。

### 12.1 迁移工具选型

P0 推荐 **Alembic**（SQLAlchemy 官方迁移工具）。

| 工具 | 优点 | 缺点 | P0 推荐 |
|---|---|---|---|
| Alembic | Python 生态标准、支持 SQLite/PostgreSQL 双后端、autogenerate 可生成迁移 | SQLite ALTER TABLE 限制需用 batch_alter_table | 推荐 |
| yoyo-migrations | 纯 SQL 迁移、轻量 | 社区较小、与 SQLAlchemy 生态弱 | 备选 |
| 自写脚本 | 完全可控 | 维护成本高、无社区基础 | 不推荐 |

P1 迁移到 PostgreSQL 时，Alembic 直接复用，仅需切换 driver。

### 12.2 迁移脚本组织

```text
database/migrations/
├── versions/
│   ├── 001_p0_core_schema.py        (用户 / 项目 / 标签 / 权限预埋)
│   ├── 002_p0_file_schema.py        (upload / files / integrity / processing status)
│   ├── 003_p0_ai_schema.py          (parse / chunks / KU / embeddings / review)
│   ├── 004_p0_rag_schema.py         (retrieval / evidence / answers / memory)
│   └── ...
├── env.py                            (Alembic 配置)
├── script.py.mako                    (迁移模板)
└── alembic.ini                       (迁移工具配置)
```

命名约定：`{4 位序号}_{下划线分隔描述}.py`。

### 12.3 SQLite ALTER TABLE 限制应对

SQLite 不支持 `ALTER TABLE DROP COLUMN`、`ALTER TABLE ALTER COLUMN`、`ALTER TABLE RENAME COLUMN`（3.25 之前）等。复杂迁移使用 Alembic 的 `batch_alter_table`：

```python
def upgrade():
    with op.batch_alter_table('knowledge_units') as batch_op:
        batch_op.drop_column('legacy_field')
        batch_op.add_column(sa.Column('new_field', sa.Text()))
```

batch 模式会创建临时表 → 复制数据 → 删除原表 → 重命名临时表，对应用透明。

### 12.4 应用启动迁移流程

```text
应用启动
→ Main Process 启动
→ Main Process 启动 sidecar
→ Sidecar 检测当前数据库 schema 版本（alembic_version 表）
→ 比较代码内的 head 版本
→ 如果版本一致：直接启动
→ 如果版本不一致：
   1. 弹出 UI 提示："正在升级知识库结构（v0.3 → v0.5），请勿关闭应用"
   2. 创建数据库备份 → ~/Library/Application Support/KnowledgeBase/backups/{timestamp}.db
   3. 执行 alembic upgrade head
   4. 验证完整性（运行 PRAGMA integrity_check + 关键表 SELECT COUNT）
   5. 成功 → 关闭提示 → 启动主界面
   6. 失败 → 回滚到备份 → 提示用户并提供错误日志路径
→ Renderer 加载主界面
```

### 12.5 备份与回滚策略

**自动备份触发条件**：

- 每次 schema 迁移前
- 每次大版本升级前（v0.x → v0.y）
- 用户在设置中手动触发"立即备份"

**备份保留策略**：

- 默认保留最近 5 次自动备份 + 所有手动备份
- 用户可在设置中调整保留数量
- 超过 30 天的自动备份自动清理（保留至少 3 个）

**回滚操作**：

- 设置 → 数据管理 → 备份历史
- 用户选择某个备份 → 系统提示"回滚将覆盖当前数据，是否先备份当前数据库？"
- 回滚执行：当前数据库 → `~/Library/Application Support/KnowledgeBase/data/before-rollback-{timestamp}.db` → 备份 → 当前数据库

### 12.6 跨大版本升级

用户可能直接从 v0.1 跳级升级到 v0.5。Alembic 默认按序执行所有中间迁移：

```text
当前版本 v0.1（alembic_version = abc123）
→ 检测到 head 版本是 ghi789（v0.5）
→ 自动执行 abc123 → def456 → ghi789 的所有迁移
→ 中间任何一步失败 → 回滚到 v0.1 备份
```

测试矩阵必须覆盖：

- v0.1 → v0.2 单步升级
- v0.1 → v0.5 跳级升级
- v0.1 → 中间失败 → 回滚验证

### 12.7 与 Electron 自动更新的协同

P1 引入 Electron 自动更新（`electron-updater`）后，更新流程：

```text
应用检测到新版本
→ 后台下载新版本
→ 用户确认安装
→ 应用退出 + 安装新版本
→ 启动新版本
→ Sidecar 检测到 schema 不匹配
→ 自动备份 + 执行迁移
→ 启动主界面
```

关键约束：

- 数据迁移失败不应阻塞应用启动（应启动并提示用户回滚）
- 备份文件大小过大时（>1GB）应提示用户预留磁盘空间
- 自动更新不应删除旧版本备份（保留用户回滚通道）

### 12.8 Schema 版本与应用版本的关系

应用版本（SemVer，如 v0.2.0）和 Schema 版本（Alembic revision）独立维护：

- 应用版本变更不一定触发 schema 迁移（如纯 UI 更新）
- Schema 迁移可以在 patch 版本中发生（v0.2.0 → v0.2.1）
- 应用启动检测的是 schema 版本，不是应用版本
- CHANGELOG 中应明确标注哪些版本包含 schema 迁移

---

## 13. Electron 安全实践

参考 [Electron Security Checklist](https://www.electronjs.org/docs/latest/tutorial/security)，P0 必须满足以下安全基线：

### 13.1 安全基线（P0 必须）

| 项 | 配置 | 说明 |
|---|---|---|
| `contextIsolation` | `true` | 隔离 preload 与 renderer 的 JS 上下文 |
| `nodeIntegration` | `false` | Renderer 不能访问 Node.js API |
| `sandbox` | `true` | Renderer 进程沙箱化 |
| `webSecurity` | `true` | 启用同源策略 |
| `allowRunningInsecureContent` | `false` | 禁止 HTTPS 页面加载 HTTP 资源 |
| `experimentalFeatures` | `false` | 禁用实验性 Web 特性 |
| `enableRemoteModule` | `false` | 禁用 remote 模块（已 deprecated） |

### 13.2 Content Security Policy

Renderer HTML 必须设置 CSP：

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  connect-src 'self' http://127.0.0.1:*;
  font-src 'self';
  object-src 'none';
  frame-ancestors 'none';
">
```

P0 限制：

- 仅允许 Renderer 调用 `127.0.0.1:*`（sidecar）和 `self`（应用资源）
- 禁止外部 HTTP 请求（P1 接入真实 AI 时再扩展 connect-src）
- 禁止 `eval` 和 `unsafe-inline` 脚本

### 13.3 Preload 暴露面收敛

`contextBridge` 只暴露必要 API，不暴露完整模块：

```typescript
contextBridge.exposeInMainWorld('app', {
  fs: {
    readDroppedFile: (path: string) => ipcRenderer.invoke('fs:readDroppedFile', path),
  },
  dialog: {
    openFilePicker: () => ipcRenderer.invoke('dialog:openFilePicker'),
  },
  notification: {
    show: (title: string, body: string) => ipcRenderer.invoke('notification:show', title, body),
  },
  config: {
    getDataDir: () => ipcRenderer.invoke('config:getDataDir'),
  },
});
```

不暴露：

- `fs` 整个模块
- `child_process`
- `path`、`os`、`process` 等 Node.js API
- 任意 IPC 通道（必须列白名单）

### 13.4 IPC 输入校验

Main Process 处理 IPC 消息时必须校验：

```typescript
ipcMain.handle('fs:readDroppedFile', async (event, filePath: string) => {
  // 1. 校验类型
  if (typeof filePath !== 'string') throw new Error('invalid_path');

  // 2. 校验路径合法性（防止路径穿越）
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(allowedRootDir)) throw new Error('path_outside_allowed_dir');

  // 3. 校验文件类型和大小
  const stat = await fs.stat(resolved);
  if (stat.size > MAX_FILE_SIZE) throw new Error('file_too_large');

  return await fs.readFile(resolved, 'utf-8');
});
```

### 13.5 sidecar API Key 与敏感数据

P0 sidecar 不需要 API Key（mock AI），但 P1 引入真实 AI 后：

- API Key **不存储**在 SQLite 数据库中
- API Key 存储在系统 Keychain（详见 `docs/ai-provider-architecture.md`）
- API Key 在 sidecar 启动时从 Main Process 通过 IPC 注入到环境变量
- API Key 不写入日志、不写入崩溃报告

### 13.6 文件系统访问限制

Renderer 通过 IPC 访问文件系统时：

- 只能读取用户主动选择/拖放的文件
- 只能写入应用数据目录及其子目录
- 不能列出任意目录
- 不能删除应用数据目录之外的文件

### 13.7 崩溃报告与日志脱敏

应用日志和崩溃报告默认存储在本地：

```text
~/Library/Application Support/KnowledgeBase/logs/
├── app-{date}.log          (Main Process)
├── sidecar-{date}.log      (Sidecar)
├── renderer-{date}.log     (Renderer)
└── crash-reports/          (崩溃报告)
```

脱敏规则：

- API Key 不记录（如必须记录则脱敏为 `sk-***xxx`）
- 用户输入的 KU content 不记录到日志
- Source 原文不记录到日志
- 文件路径中的用户名脱敏（`/Users/<user>/`）

P1 引入崩溃报告自动上报时必须用户明确同意。

### 13.8 P1+ 安全增强

| 项 | 阶段 | 说明 |
|---|---|---|
| 应用代码签名 | P1 | macOS Developer ID + notarization；Windows EV Code Signing |
| 自动更新签名校验 | P1 | electron-updater 校验更新包签名 |
| 数据库文件加密 | P2 评估 | SQLCipher 或操作系统级加密（用户敏感场景） |
| 远程崩溃报告 | P1 | 用户同意后上传到 Sentry 或自建服务 |
| 端到端加密备份 | P2 | 云备份场景下的客户端加密 |

---

## 14. 产品包装规范

### 14.1 应用品牌

| 项 | 推荐 | 说明 |
|---|---|---|
| 应用名（中文） | 待定（建议 "Knowledge"、"知识方舟"、"思汇"等中性名） | 需用户确认 |
| 应用名（英文） | 待定（建议与中文名对应） | 需用户确认 |
| Bundle ID（macOS） | `com.knowledge-base.app`（占位） | 需正式确定 |
| App ID（Windows） | `com.knowledge-base.app`（占位） | 需正式确定 |
| 应用描述 | "AI 个人知识资产系统 / Personal Knowledge Asset System" | 中英文双语 |
| 主色调 | 待 UI 阶段确定 | 建议中性专业色调（避免炫彩） |

P0-Core W1 可用稳定开发期占位名（如 `KnowledgeBaseDev`），并同步到数据目录、Bundle ID、Product ID 和 Keychain service。正式外部分发前必须确定品牌并制定占位名迁移方案。

### 14.2 应用图标规范

| 平台 | 格式 | 尺寸 | 说明 |
|---|---|---|---|
| macOS | .icns | 16/32/64/128/256/512/1024 | 支持 Retina |
| Windows | .ico | 16/24/32/48/64/128/256 | 多尺寸 ICO |
| Linux | .png | 16/22/24/32/48/64/128/256/512 | 标准 PNG |

P0-Core / P0-File 可用临时图标（设计风格统一即可），P1 进入用户测试前应替换为正式品牌图标。

### 14.3 版本号策略

采用 [SemVer](https://semver.org/lang/zh-CN/)（语义化版本）：

```text
v{MAJOR}.{MINOR}.{PATCH}[-{PRE_RELEASE}]
```

- `MAJOR`：不兼容的 API 或数据模型变更（v1.0.0、v2.0.0）
- `MINOR`：向后兼容的新功能（v0.1.0 → v0.2.0）
- `PATCH`：向后兼容的 bug 修复（v0.1.0 → v0.1.1）
- `PRE_RELEASE`：预发布版本（v0.1.0-alpha、v0.1.0-beta.1、v0.1.0-rc.1）

P0-Core 起步版本：`v0.1.0-alpha`。

应用版本与 Schema 版本独立维护（详见 §12.8）。

### 14.4 标准菜单结构

#### macOS 菜单

```text
[App Name]
├── 关于 [App Name]
├── 首选项... (Cmd+,)
├── 服务 ►
├── 隐藏 [App Name] (Cmd+H)
├── 隐藏其他 (Opt+Cmd+H)
├── 显示全部
└── 退出 (Cmd+Q)

文件 File
├── 新建项目 (Cmd+N)
├── 新建知识单元 (Shift+Cmd+N)
├── 导入材料... (Cmd+O)
├── 导出知识单元... (Shift+Cmd+E)
├── 备份知识库... (Cmd+B)
└── 关闭窗口 (Cmd+W)

编辑 Edit
├── 撤销 / 重做
├── 剪切 / 复制 / 粘贴
├── 全选
└── 查找 (Cmd+F)

视图 View
├── 建库工作台
├── Review 队列
├── 检索
├── 知识组织
└── 切换深色模式

窗口 Window
├── 最小化 (Cmd+M)
├── 缩放
└── 全屏 (Ctrl+Cmd+F)

帮助 Help
├── 用户指南
├── 键盘快捷键
├── 反馈与支持
└── 检查更新...
```

#### Windows / Linux 菜单

类似结构，但 macOS 的"应用菜单"内容（关于、首选项、退出）合并到"文件"或"帮助"菜单。

### 14.5 桌面平台分发清单

| 项 | macOS | Windows | Linux |
|---|---|---|---|
| 安装包格式 | .dmg | .exe (NSIS) / .msi | .AppImage / .deb |
| 安装位置 | /Applications | C:\Program Files | /opt 或 /usr/local |
| 数据目录 | ~/Library/Application Support/{App Name} | %APPDATA%\{App Name} | ~/.config/{App Name} |
| 卸载行为 | 拖到废纸篓（提示是否保留数据） | 控制面板卸载（提示是否保留数据） | apt remove / 手动删除 |
| 自启动 | LaunchAgent（用户可选） | 注册表（用户可选） | systemd user service |

P0 不强制实现自启动；P1 在设置中提供选项。

### 14.6 隐私与许可

- 隐私政策文档（中英文双语）
- 开源许可证（如选择开源）：MIT / Apache 2.0 / GPL 等
- 第三方依赖许可清单（npm 和 pip 包）
- 用户数据声明：默认全部本地，不上传

P0-Core 可暂用占位文档；正式分发前必须完成。

---

## 15. 用户首次体验（Onboarding）

桌面创作者类工具的首次体验决定留存。Onboarding 不是营销页面，而是引导用户走完一遍真实流程。

### 15.1 Onboarding 设计原则

- 不超过 5 步
- 每步都是真实操作（不是说明文字）
- 完成后用户已有第一个项目和第一条 KU
- 全程可跳过（但默认引导）
- 不强制注册账号（P0 单用户本地）

### 15.2 P0 Onboarding 流程

```text
首次启动
→ 欢迎页（30 秒内）
   - "欢迎使用 Knowledge"
   - "本应用帮助你把零散材料转化为可信知识资产"
   - "所有数据存储在本地，由你完全控制"
   - 按钮：[开始使用] [跳过引导]

→ 步骤 1：选择数据目录（30 秒）
   - 显示默认路径：~/Library/Application Support/Knowledge/
   - [使用默认] [自定义...]

→ 步骤 2：创建第一个项目（1 分钟）
   - 输入项目名称（默认 "我的第一个项目"）
   - 选择 kb_type（默认 project_kb）
   - 输入项目描述（可选）
   - [创建]

→ 步骤 3：导入第一段材料（2 分钟）
   - 引导文案："粘贴或输入一段 200-1000 字的材料"
   - 提供示例：[使用示例文本] [我有自己的材料]
   - 用户输入后系统自动切片
   - 显示切片结果（让用户看到 Source → Chunk）

→ 步骤 4：创建第一条知识单元（2 分钟）
   - 引导文案："从切片中提取一条核心知识"
   - 自动建议：选中某个 Chunk → "把这段标记为知识单元"
   - 用户选择 knowledge_type（默认 claim）
   - 用户输入 title 和 content
   - [创建并确认]

→ 步骤 5：完成
   - "你已创建了第一条知识资产！"
   - "现在可以继续导入材料、创建 KU，或者尝试检索"
   - [进入主界面] [查看用户指南]
```

### 15.3 示例材料库

P0 内置 3-5 段示例材料供新用户体验：

- 一段产品想法（500 字）
- 一段研究笔记（800 字）
- 一段会议纪要（600 字）
- 一段代码评论（400 字，技术开发者场景）
- 一段设计灵感（700 字，设计师场景）

每段材料附带预期切片数和示例 KU。

### 15.4 设置页面（Settings）

Onboarding 之后的设置页面应包含：

| 分组 | 设置项 | P0 | P1 |
|---|---|---|---|
| 通用 | 语言（中文 / 英文） | P0 | D-106 已实现为 `zh-CN / en-US`，默认中文 |
| 通用 | 深色模式（跟随系统 / 浅色 / 深色） | P0 | - |
| 通用 | 启动行为（启动时打开上次项目） | P0 | - |
| 数据 | 数据目录位置 | P0 | - |
| 数据 | 自动备份频率（每天 / 每周 / 关闭） | P0 | - |
| 数据 | 备份保留数量 | P0 | - |
| 数据 | 导出 / 导入知识库 | P0 | - |
| AI Provider | OpenAI / Anthropic / 本地 LLM 配置 | - | P1 |
| AI Provider | API Key 管理 | - | P1 |
| AI Provider | 默认模型选择 | - | P1 |
| 隐私 | 崩溃报告自动上报 | - | P1 |
| 隐私 | 使用统计上报（匿名） | - | P1 |
| 关于 | 应用版本 + 数据库 schema 版本 | P0 | - |
| 关于 | 检查更新 | - | P1 |
| 关于 | 开源许可 / 隐私政策 | P0 | - |

D-106 后，语言偏好通过 `GET /api/settings` 与 `PATCH /api/settings` 读写，由 FastAPI sidecar 原子更新 app data 下的 `config.json`，不进入 SQLite migration。D-111 后，feedback diagnostics export history 写入同一个 `config.json.feedback_export_history`，但只保存最近 20 条 filename / format / record_count / generated_at / filters / summary totals / content_sha256 / redaction flags，不保存导出正文、source text、answer text、local token、DB path 或完整本地路径。D-116 后，knowledge export history 写入 `config.json.knowledge_export_history`，只保存最近 20 条 export kind、filename、format、record_count、generated_at、filters、summary、content_sha256 和 redaction flags，不保存 Markdown / JSON / ZIP 正文、KU 正文、source text、local token、DB path 或完整本地路径。Renderer 在 Electron 环境下只通过 preload bridge + typed fetch wrapper 调用设置、反馈和导出 API；普通浏览器无 bridge 时只允许 session fallback，并展示 degraded 状态。

### 15.5 帮助系统

P0 内置的帮助内容：

- 键盘快捷键速查表（按 `?` 唤起）
- 5 个核心概念说明（Source / Chunk / KU / Review / Tag），每个 1-2 段
- "如何创建第一个项目"步骤说明
- "如何理解检索结果"说明
- 反馈渠道（邮箱 / Issue 链接）

P1 扩展为完整用户指南（外链官网或内置 Markdown）。

---

## 16. 与其他文档的关系

```text
docs/desktop-architecture.md（本文档）
└── 桌面框架、部署、IPC、打包、文件系统、离线、UX、可移植性、Schema 迁移、安全、产品包装、Onboarding

docs/product-architecture.md
└── 产品总架构（前端体验层已明确桌面定位，本文档补充工程实现）

docs/technical-stack-and-prototype-plan.md
└── 技术栈选型（数据库调整为 SQLite，目录结构引用本文档）

docs/p0a-execution-plan.md
└── P0-Core / P0-File / P0-AI / P0-RAG 6 周执行计划（依赖本文档的 §11 工程目录和 §12 迁移工具）

docs/ai-provider-architecture.md
└── P0 开源优先 ProviderRegistry 与可选商业 Provider 接入路径（依赖本文档的 §13 安全实践和 §15 设置页面）

docs/api-design.md / docs/api-implementation-plan.md
└── API 设计不变，通信方式从浏览器直连改为 Renderer → localhost sidecar
```

---

## 17. 当前结论

桌面应用架构的核心决策：

```text
框架：Electron
后端：FastAPI 作为 sidecar（child_process 管理）
数据库：SQLite + sqlite-vec（P0 本地内嵌，P1 可选迁移 PostgreSQL）
通信：Renderer → localhost HTTP → sidecar API
打包：electron-builder + PyInstaller
数据：本地存储，用户完全控制
离线：P0 核心功能全部离线可用
```

这套架构确保用户可以双击安装、双击启动、离线使用，同时保留 P1 向云服务或 PostgreSQL 迁移的能力。

补充能力（v0.2 新增）：

```text
Schema 迁移：Alembic + 自动备份 + 失败回滚 + 跨大版本支持
安全基线：contextIsolation + sandbox + CSP + IPC 输入校验 + 日志脱敏
产品包装：SemVer 版本 + 标准菜单 + 跨平台分发 + 隐私声明
首次体验：5 步 Onboarding + 示例材料 + 设置页面 + 内置帮助
```
