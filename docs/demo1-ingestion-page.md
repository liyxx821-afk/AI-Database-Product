# Demo 1：知识入库预处理页面

## 分支与路径

- 分支名：`demo1-ingestion-page`
- 网页路径：`/demo1-ingestion`
- 本地访问：`http://127.0.0.1:5173/demo1-ingestion`

## 运行命令

项目使用 `pnpm@10.26.1`。如果本机没有直接安装 `pnpm`，可通过 Corepack 执行：

```powershell
$env:COREPACK_NPM_REGISTRY='https://registry.npmmirror.com'
corepack pnpm install --ignore-scripts
corepack pnpm dev:desktop
```

如果只用普通浏览器访问 Vite 页面，需要单独启动 FastAPI，并给 renderer 配置 API 地址：

```powershell
$env:OPENAI_API_KEY='your-api-key'
$env:VITE_KB_API_BASE_URL='http://127.0.0.1:8765/api'
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8765 --app-dir apps/api
corepack pnpm --filter @knowledgebase-dev/renderer dev -- --host 127.0.0.1
```

在 `corepack pnpm dev:desktop` 模式下，Electron bridge 会自动把 sidecar API 地址和本地 token 提供给前端，前端不会接触外部模型 API key。

## 外部模型配置

Demo 1 默认使用 OpenAI Responses API：

- 默认模型：`gpt-5.4-mini`；
- 最小配置：`OPENAI_API_KEY`；
- 默认 base URL：`https://api.openai.com/v1`；
- 默认 endpoint：`/responses`。

也可以使用 OpenAI-compatible Chat Completions：

- `KB_AI_API_KEY`：外部模型 API key；
- `KB_AI_BASE_URL`：OpenAI-compatible base URL，例如 `https://api.openai.com/v1` 或其他兼容服务的 `/v1` 地址；
- `KB_AI_MODEL`：模型名；
- `KB_AI_ENDPOINT`：可选，`responses` 或 `chat_completions`。

如果上述环境变量缺失，页面仍会显示 source、metadata、解析文本、清洗文本和 chunk，但 Candidate KU 区域不会生成假数据，而会显示模型未配置或调用失败信息。

## 功能说明

该页面验证真实“知识入库预处理”链路：

```text
文本 / 文件资料进入系统
→ 来源记录 source
→ 内容解析
→ 文本清洗
→ 400 字 chunk 切片，50 字 overlap
→ OpenAI-compatible 外部模型语义分析
→ pending Candidate KU
→ 页面预览
→ 用户确认写入本地 SQLite
```

当前支持：

- 文本输入模式；
- 真实文件上传解析：支持 `.txt`、`.text`、`.md`、`.markdown`、`.csv`、`.tsv`、`.json`、`.log`、`.html`、`.htm`；
- 文件内容由前端读取后发送到后端，后端完成文件类型判断、文本解码和解析；
- `.html/.htm` 会去除 script/style/tag 并进行 HTML entity decode；
- 暂不支持 PDF / Word / OCR；遇到 `.pdf/.docx` 等格式会返回 `demo1_file_type_unsupported`，不会假解析；
- 生成资料进入系统记录：`file_name`、`input_type`、`received_at`、`raw_text_length`、`process_status`；
- 生成 source 记录：`source_id`、`file_name`、`input_type`、`created_at`、`status`、`raw_text_length`、`clean_text_length`、`chunk_count`、`candidate_ku_count`；
- 内容解析：文本框输入直接进入 parsed；文件上传由后端解析器生成 parsed text；
- 文本清洗：Unicode 规范化、BOM/零宽字符移除、控制字符移除、明显乱码清理、连续空格合并、多余空行合并、首尾空格清理；
- 显示清洗前后字数变化；若文本本身干净，显示“清洗前后无明显变化”；
- 基于清洗文本生成 chunk，每个 chunk 包含 `chunk_id`、`source_id`、`chunk_index`、`content`、`char_count`、`chunk_type`、`start_offset`、`end_offset`；
- chunk 切分当前不是模型能力，而是确定性规则：400 字固定窗口，50 字 overlap；
- 调用外部模型为每个 chunk 生成 Candidate KU；
- Candidate KU 字段包含 `ku_id`、`source_id`、`chunk_id`、`title`、`summary`、`keywords`、`tags`、`status`、`confidence`、`quality_note`、`content_type`；
- Candidate KU 固定为 `pending`，仅代表待确认候选材料；
- 页面提供“预处理预览”和“确认写入本地库”两个动作；
- commit 后写入现有本地 SQLite：`sources`、`chunks`、`knowledge_units`、`review_tasks`；
- 展示完整处理状态：`received`、`source_created`、`parsed`、`cleaned`、`chunked`、`candidate_generated`、`completed`。

## 当前限制

- 只支持文本输入和文本类文件上传；
- 不做 PDF、Word、OCR；
- 不做 RAG，不做向量检索，不做最终知识确认；
- 暂未接入外部文档深度解析服务；当前真实解析能力为后端内置文本/HTML 解析；
- Candidate KU 是待确认材料，后续 Demo 2 才做 schema matching、标签优化、实体关系抽取和人工确认；
- 模型输出会做基础字段校验和标签/关键词清洗，但不代表最终知识结构化质量；
- 模型未配置或调用失败时不生成假的 Candidate KU。

## 测试方式

1. 配置 `OPENAI_API_KEY`；如使用其他兼容服务，再配置 `KB_AI_API_KEY`、`KB_AI_BASE_URL`、`KB_AI_MODEL`；
2. 启动 `corepack pnpm dev:desktop`；
3. 打开 `/demo1-ingestion`；
4. 输入短文本并点击“预处理预览”；
5. 检查页面是否显示 source、metadata、解析文本、清洗文本、chunk、Candidate KU、处理状态；
6. 点击“确认写入本地库”；
7. 检查页面显示 `commit_status: committed`、`job_id` 和 review task 结果；
8. 上传 `.md/.txt/.html` 文件，确认后端解析文本并展示 parser profile；
9. 上传 `.pdf` 文件，确认页面显示 unsupported 错误，不生成假解析；
10. 输入 800-1000 字文本，确认多个 chunk 都有对应 Candidate KU；
11. 浏览器控制台应无报错。

## 验收方式

- 输入“我是一个大学生。”时，仍应生成 pending Candidate KU，confidence 较低，quality_note 提示信息密度较低；
- 输入 200 字以上艺术史文本时，应生成非机械复制的标题、摘要、关键词和标签；
- 输入 800-1000 字文本时，应生成多个 chunk 和多个 Candidate KU，source 中的 `chunk_count` 与 `candidate_ku_count` 正确；
- 模型未配置或调用失败时，页面明确显示错误，不生成前端假 KU；
- 点击“确认写入本地库”后，SQLite 中应有对应 source、chunk、knowledge unit 和 review task。
