# Demo 1：知识入库预处理页面

## 分支与路径

- 分支名：`demo1-ingestion-page`
- 网页路径：`/demo1-ingestion`
- 本地访问：`http://127.0.0.1:5173/demo1-ingestion`

## 运行命令

项目使用 `pnpm@10.26.1`。如果本机没有直接安装 `pnpm`，可通过 Corepack 执行：

```powershell
$env:COREPACK_NPM_REGISTRY='https://registry.npmmirror.com'
corepack pnpm install --frozen-lockfile --ignore-scripts
corepack pnpm --filter @knowledgebase-dev/runtime-contracts build
corepack pnpm --filter @knowledgebase-dev/shared-config build
corepack pnpm --filter @knowledgebase-dev/api-types build
corepack pnpm --filter @knowledgebase-dev/renderer dev
```

访问：

```text
http://127.0.0.1:5173/demo1-ingestion
```

## 功能说明

该页面用于展示最小“知识入库预处理”流程，所有逻辑都在浏览器端完成。

当前支持：

- 输入或粘贴文本；
- 清洗文本：去掉首尾空格、合并多余空行、合并连续空格、去掉明显乱码字符；
- 文本质量判断：清洗后文本少于 50 字时，不生成 Candidate KU；
- 生成 Source 信息：`source_id`、来源类型、解析状态；
- 生成基础 metadata：上传时间、原文字数、清洗后字数、chunk 数、候选 KU 数；
- 按 400 字切分 chunk，并保留 50 字重叠；
- 短文本仍可生成 1 个 chunk，并在 chunk 区域标记为“短文本 chunk”；
- 为每个 chunk 生成 `chunk_id`、`source_id`、字数和内容；
- 对 50 字以上文本，基于 chunk 模拟生成 Candidate KU：标题、摘要、关键词、系统标签；
- Candidate KU 仅作为初步候选材料，后续由 Demo 2 进行 schema 匹配、标签优化、实体关系抽取和人工确认；
- 展示处理状态：等待输入、处理中、完成。

## 当前限制

- 不接真实数据库；
- 不做真实文件上传或文件解析；
- 不做 PDF、Word、OCR；
- 不做真实 AI 知识结构化；
- 不生成 RAG 问答；
- Candidate KU 的标题、摘要和关键词均为前端模拟生成；
- 标签只保留固定系统标签：`#demo1`、`#入库预处理`、`#candidate-ku`。

## 测试方式

1. 启动 renderer dev server；
2. 打开 `/demo1-ingestion`；
3. 在文本框中粘贴短文本或一段包含空行、多余空格或乱码符号的长文本；
4. 点击“开始处理”；
5. 检查页面是否显示：
   - 文件名；
   - source 信息；
   - 基础 metadata；
   - 解析文本（原始输入）；
   - 清洗文本；
   - chunk 列表；
   - 候选知识单元；
   - 处理状态。
6. 输入“我是一个大学生。”时，应只生成短文本 chunk，并显示“文本过短，暂不生成候选知识单元。”。
7. 输入 200 字以上文本时，应生成候选 KU、关键词和固定系统标签。

## 验收方式

输入文本并点击“开始处理”后，页面应完整显示上述信息，浏览器控制台无报错。
