# Demo 1：知识入库预处理页面

## 分支与路径

- 分支名：`demo1-ingestion-page`
- 网页路径：`/demo1-ingestion`
- 本地访问：`http://127.0.0.1:5173/demo1-ingestion`

## 运行命令

项目使用 `pnpm@10.26.1`。如果本机没有直接安装 `pnpm`，通过 Corepack 执行：

```powershell
$env:COREPACK_NPM_REGISTRY='https://registry.npmmirror.com'
corepack pnpm install --ignore-scripts
corepack pnpm dev:desktop
```

桌面模式推荐在 `/settings` 页面填写 DashScope / 百炼 API Key。后端会用 Windows DPAPI 加密保存密钥，后续 Demo 1 自动读取，不需要每次启动都重新设置环境变量。

普通浏览器调试时，需要单独启动后端并给 renderer 配置 API 地址；如不走设置页，也可以继续用环境变量临时覆盖模型配置：

```powershell
$env:KB_AI_API_KEY='your-dashscope-api-key'
$env:KB_AI_BASE_URL='https://dashscope.aliyuncs.com/compatible-mode/v1'
$env:KB_AI_MODEL='qwen-plus'
$env:KB_AI_VISION_MODEL='qwen-vl-ocr-latest'
$env:VITE_KB_API_BASE_URL='http://127.0.0.1:8765/api'
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8765 --app-dir apps/api
corepack pnpm --filter @knowledgebase-dev/renderer dev -- --host 127.0.0.1
```

API Key 只由后端进程读取；不会写入 `.env`、代码、日志、前端或 `config.json` 明文字段。

## 模型配置

Demo 1 默认使用阿里云百炼 / DashScope 的 OpenAI-compatible Chat Completions：

- 文本语义清洗与 Candidate KU：`qwen-plus`
- 图片、截图、扫描 PDF OCR：`qwen-vl-ocr-latest`
- 默认 base URL：`https://dashscope.aliyuncs.com/compatible-mode/v1`
- 默认 endpoint：`/chat/completions`

兼容环境变量：

- `KB_AI_API_KEY` 或 `OPENAI_API_KEY`
- `KB_AI_BASE_URL` 或 `OPENAI_BASE_URL`
- `KB_AI_MODEL` 或 `OPENAI_MODEL`
- `KB_AI_VISION_MODEL`
- `KB_AI_ENDPOINT`，可选：`chat_completions` 或 `responses`

产品化设置：

- `/settings` 页面新增“模型配置 / AI Provider”。
- `GET /api/settings/ai-model` 只返回 provider、base URL、模型名、密钥状态和最近测试结果，不返回明文 API Key。
- `PATCH /api/settings/ai-model` 保存 provider / 模型配置；传入 API Key 时后端加密保存。
- `POST /api/settings/ai-model:test` 用当前配置测试文本模型和 OCR 模型。
- `DELETE /api/settings/ai-model/key` 删除本机加密保存的 API Key。
- 环境变量优先级高于本机保存配置，便于开发和 CI 覆盖。

模型未配置或调用失败时，页面必须显示明确错误，不生成假的 Candidate KU。

## 功能说明

Demo 1 验证完整入库预处理链路：

```text
上传或输入
→ 文件类型识别
→ 真实解析 / OCR
→ 规则清洗
→ 模型语义清洗
→ 400 字 chunk 切片，50 字 overlap
→ qwen-plus 生成 pending Candidate KU
→ 页面预览
→ 用户确认写入本地 SQLite
```

当前支持：

- 文本输入。
- 文本类文件：`.txt`、`.text`、`.md`、`.markdown`、`.csv`、`.tsv`、`.json`、`.log`。
- HTML：`.html`、`.htm`，后端会去除 `script/style/tag` 并 decode HTML entity。
- 可复制文本 PDF：PyMuPDF 提取文本，`parser_kind=pdf_text`。
- 扫描 PDF：PyMuPDF 将无文本页渲染为 PNG，再调用 `qwen-vl-ocr-latest`，`parser_kind=pdf_ocr`。
- 混合 PDF：可复制文本页直接提取，无文本页 OCR，`parser_kind=pdf_mixed`。
- 图片 / 截图：`.png`、`.jpg`、`.jpeg`、`.webp`、`.bmp`，调用 `qwen-vl-ocr-latest`，`parser_kind=image_ocr`。

页面展示：

- 资料进入系统记录。
- source 信息。
- metadata：`parser_kind`、`parser_status`、`parser_warnings`、`page_count`、`parsed_page_count`、`ocr_page_count`、`skipped_page_count`、`ocr_model_name`。
- 解析文本、规则清洗文本、模型语义清洗文本。
- chunk 列表。
- pending Candidate KU。
- Source Flow 处理状态。
- Current File 当前文件面板。

## 当前限制

- 单文件 Demo，不做多文件批量队列。
- 文件大小上限为 5 MB。
- 扫描 PDF OCR 默认最多处理 10 页；超出页数会记录 warning 并跳过后续页。
- 不做 Office 文档解析，不做音频 / 视频。
- 不做 RAG、向量检索或最终知识确认。
- Candidate KU 是待确认候选材料；Demo 2 才做 schema matching、标签优化、实体关系抽取和人工确认。

## 测试方式

命令验证：

```powershell
.\.venv\Scripts\python.exe -m pytest apps/api/tests/test_demo1_ingestion.py
.\.venv\Scripts\python.exe -m ruff check apps/api scripts
corepack pnpm --filter @knowledgebase-dev/api-types build
corepack pnpm --filter @knowledgebase-dev/renderer typecheck
corepack pnpm --filter @knowledgebase-dev/renderer build
```

浏览器验收：

1. 打开 `http://127.0.0.1:5173/demo1-ingestion`。
2. 输入“我是一个大学生。”，点击“预处理预览”。
3. 上传可复制文本 PDF，确认 `parser_kind=pdf_text`。
4. 上传扫描 PDF，确认 `parser_kind=pdf_ocr`、`ocr_model_name=qwen-vl-ocr-latest`。
5. 上传混合 PDF，确认 `parser_kind=pdf_mixed`。
6. 上传中文截图，确认 `parser_kind=image_ocr`。
7. 检查 source、metadata、解析文本、清洗文本、chunk、Candidate KU、处理状态全部显示。
8. 浏览器 console 无 error。

## 验收标准

- 短文本也必须进入完整链路，并生成 pending Candidate KU。
- 200 字以上文本应由模型生成非机械复制的标题、摘要、关键词和标签。
- 800-1000 字文本应切成多个 chunk，并为每个 chunk 生成 Candidate KU。
- 可复制 PDF、扫描 PDF、混合 PDF、图片 / 截图都能真实解析，不伪造文本。
- OCR 或模型失败时显示明确错误码，不生成假结果。
- 点击“确认写入本地库”后，SQLite 中能查到对应 `source`、`chunks`、`knowledge_units`、`review_tasks`。
