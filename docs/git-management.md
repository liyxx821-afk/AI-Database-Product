# Git 管理说明

版本：v0.2  
日期：2026-05-17  
状态：本地 Git 管理规范；已绑定 GitHub private remote

## 1. 当前状态

本项目已初始化为本地 Git 仓库，默认分支为 `main`。

远程仓库：

- `origin`: `https://github.com/ChenchenChen001/ai-database-product.git`
- GitHub 页面：`https://github.com/ChenchenChen001/ai-database-product`
- 可见性：private

当前仓库仍处于**产品与架构文档阶段**，主要跟踪：

- `AGENTS.md`
- `README.md`
- `docs/**/*.md`
- `个人智能数据库.pdf`
- Git 管理文件：`.gitignore`、`.gitattributes`

当前不包含运行时代码、migration、OpenAPI 文件或构建产物。

## 2. 本仓库的 Git 目标

Git 在本项目中用于：

- 保存架构文档的阶段性快照；
- 追踪 D-066 之后的关键决策变更；
- 在进入 P0-Z0a 工程代码前保留清晰基线；
- 防止本地临时文件、数据库、日志、上传资料、模型权重和密钥进入版本库；
- 后续支持远程备份、分支开发和 Pull Request review。

## 3. 忽略规则

`.gitignore` 已覆盖：

- macOS 和编辑器临时文件；
- `.env`、证书、私钥和本地凭证；
- Python / FastAPI 运行缓存；
- Node / Electron / Vite 构建产物；
- 未来桌面原型生成的 `data/`、`tmp/`、`uploads/`、`sources/`、`previews/`、`logs/`、`backups/`；
- SQLite、本地索引和向量文件；
- 大模型权重与生成缓存。

明确保留：

- `*.pdf` 源文件；
- `docs/**`；
- `README.md`；
- `AGENTS.md`。

如果后续新增需要版本管理的非 Markdown 资产，应先确认是否为源资产，而不是运行时生成物。

## 4. 行尾与二进制文件

`.gitattributes` 已设置：

- 文本文件统一使用 LF；
- Markdown 使用 `diff=markdown`；
- PDF、图片、本地数据库文件按二进制处理。

## 5. 推荐提交策略

建议采用小而清晰的提交：

```text
docs: add project background brief
docs: align D-085 invocation boundary
chore: initialize git management
feat(core): add FastAPI health endpoint
test(rag): add evidence-only answer contract
```

提交类型建议：

| 类型 | 用途 |
|---|---|
| `docs` | 文档、架构、计划、说明书 |
| `chore` | Git、配置、工具链、无业务行为变化 |
| `feat` | 新功能 |
| `fix` | 缺陷修复 |
| `test` | 测试、fixture、验证脚本 |
| `refactor` | 不改变行为的结构调整 |
| `build` | 构建、依赖、打包相关 |

## 6. 分支策略

当前单人文档阶段可以直接在 `main` 上工作，但进入代码实现后建议使用短分支：

```text
docs/background-brief
docs/d086-git-management
feat/p0-core-skeleton
feat/p0-file-inspection
feat/p0-rag-evidence-only
fix/chunk-quality-contract
```

合并回 `main` 前应确认：

- 文档索引已同步；
- `docs/development-plan.md` 与 `docs/progress.md` 反映真实状态；
- 相关验证命令已执行；
- 没有 `.env`、数据库、日志、上传文件、模型权重等误入暂存区。

## 7. 首次提交策略

首个文档基线提交应包含：

```text
git add .gitignore .gitattributes AGENTS.md README.md docs/ 个人智能数据库.pdf
git status --short
git commit -m "chore: initialize project documentation baseline"
```

如果后续不希望 PDF 继续进入 Git，可在下一次变更中移出版本库并改用外部资料链接；在提交前排除 PDF 的命令为：

```text
git restore --staged 个人智能数据库.pdf
```

或在提交前把 PDF 迁移到外部资料库，并改用文档链接引用。

## 8. 远程仓库

当前已配置 GitHub private repo：

```text
ChenchenChen001/ai-database-product
```

远程用途：

- 私有备份当前产品与架构文档；
- 作为后续 P0-Z0a 工程代码的基线仓库；
- 在需要时支持分支开发、Pull Request review 和跨设备同步。

后续公开或转移仓库前应再次确认：

- 仓库是否公开；
- `个人智能数据库.pdf` 是否允许公开；
- 文档中是否包含私人信息、API key、邮箱、路径或敏感业务内容；
- 是否需要 Git LFS 管理大型资产。

当前 `个人智能数据库.pdf` 约 5MB，未触发 GitHub 单文件限制；本机未安装 Git LFS，后续如加入大型设计资产、模型权重、视频或数据包，应先安装并配置 Git LFS，或继续放在版本库外。

## 9. 日常检查命令

常用命令：

```bash
git status --short
git diff -- README.md docs/
git diff --stat
git log --oneline --decorate -n 10
git ls-files
```

检查忽略文件：

```bash
git status --short --ignored
```

检查是否误入敏感文件：

```bash
git status --short
rg -n "API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE KEY|BEGIN .*KEY" .
```

## 10. 禁止事项

默认不要：

- 提交 `.env` 或密钥；
- 提交本地 SQLite 数据库；
- 提交用户上传资料目录；
- 提交模型权重；
- 提交日志、缓存和构建产物；
- 在未确认前推送到公开仓库；
- 在未确认前执行破坏性命令，如 `git reset --hard`、`git clean -fd`、强制推送。
