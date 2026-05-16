# AGENTS.md — AI 个人知识库产品项目开发说明

## 0. 使用方式

本文件用于指导 Codex 在本仓库中进行产品原型开发、架构整理、文档维护与代码修改。

Codex 在开始任何任务前，应先阅读本文件，并将其作为项目根目录下的长期开发准则。若用户在具体任务中给出更新指令，以用户最新指令为准。

本项目的文档和代码工作应遵循闭环：

```text
先理解仓库与上下文
→ 制定并落地开发计划
→ 按计划实施
→ 每完成阶段同步进度
→ 验证结果
→ 确认实现、验证、进度文档、开发计划文档一致
```

如果任务只是讨论、需求澄清、阅读、评审或用户明确要求“不写代码”，则只做分析和记录，不修改代码。

---

## 1. 项目身份与一句话定位

本项目是一个**面向个人 Agent 的 AI 个人知识资产系统**，服务专业内容创作者。

它不是普通的 AI 聊天工具、AI 笔记软件、文件数据库、网盘、Obsidian 克隆或简单向量库 Demo，而是帮助用户把个人资料、想法、项目经验、对话、笔记、研究记录、图像、文档和跨学科知识，转化为可组织、可验证、可复用、可被个人 Agent 长期调用的知识资产系统。

一句话总结：

> 本项目是面向专业内容创作者的 AI 个人知识库，帮助用户把零散材料转化为结构化、可检索、可溯源、可复用的知识资产，并支撑未来个人 Agent 的长期创作与决策能力。

核心判断：

> 面向未来的 AI 时代，每个人都会拥有自己的个人 Agent，而个人 Agent 的能力基础不是单次对话，而是个人数据库和个人知识库。

需要同时区分两个层面：

- **产品表达层**：个人知识库、知识资产管理、创作辅助系统。
- **技术底座层**：个人数据库、结构化 Schema、Text-to-SQL、RAG、Embedding、全文检索、元数据和来源追踪。

不要把本项目降级为“上传文件然后聊天”。产品核心是：

```text
资料收集 → 知识整理 → 关系建立 → 选题 / 想法生成 → 内容创作 → 作品复盘 → 资产沉淀
```

Codex 应将本项目同时视为：

- 一个产品原型；
- 一个个人 Agent 基础设施实验；
- 一个面向创作者的知识工程实验。

---

## 2. 目标用户

产品面向**专业内容生产者**。

内容生产者指：以知识、创意、经验、技术判断或审美判断为原料，持续生产可传播内容的人。

### 2.1 技术开发者

典型材料：

- 代码片段
- 技术文档
- API 文档
- 项目笔记
- Debug 记录
- 开源项目分析
- 研究论文
- 架构设计记录

核心需求：

- 找回过往技术决策
- 复用代码相关知识
- 连接文档、Issue、实现记录和项目上下文
- 基于来源回答技术问题
- 长期保存项目记忆

### 2.2 设计师

包括空间设计师、视觉设计师、产品设计师、工业设计师、交互设计师、品牌设计师及相关创意实践者。

典型材料：

- 案例研究
- 灵感图片
- 设计参考
- 项目 Brief
- 概念笔记
- 材料与工艺研究
- 设计说明
- 视觉系统
- 图表与汇报材料

核心需求：

- 建立案例库和灵感库
- 组织设计逻辑
- 找回过往项目推理
- 生成设计阐述、概念叙事和汇报结构
- 将视觉参考与语义标签、项目元数据连接起来

### 2.3 影视 / 媒体从业者

典型材料：

- 剧本
- 分镜
- 影像参考
- 导演阐述
- 拍摄方案
- 剪辑逻辑
- 情绪板和视觉风格参考
- 制作笔记

核心需求：

- 管理碎片化创作材料
- 连接参考、镜头、脚本和概念
- 生成 Treatment、脚本、镜头表和视觉方向
- 保存项目风格和制作记忆

### 2.4 自媒体内容创作者

典型材料：

- 选题库
- 爆款内容分析
- 脚本
- 文案草稿
- 账号定位
- 平台数据
- 可复用内容模板
- 系列规划材料

核心需求：

- 建立可复用选题库和脚本库
- 分析平台内容模式
- 维护账号身份和内容策略
- 基于历史资产生成新内容
- 复盘并改进已发布作品

---

## 3. 核心问题

专业内容创作者需要的不是“存文件”。

他们真正的问题是，创作和知识材料分散在多种形态中：

- Markdown 笔记
- PDF
- 图片
- 截图
- 网页摘录
- PPT / Keynote / 演示材料
- 代码文件
- 研究论文
- 项目文档
- 聊天记录
- 设计参考
- 个人观察
- 平台数据

传统文件夹和笔记工具可以保存材料，但常常无法解决：

1. 理解材料的语义意义；
2. 建立材料之间的关系；
3. 保存项目上下文；
4. 支持有来源依据的 AI 生成；
5. 将旧材料转化为未来可复用资产；
6. 跨项目复用知识；
7. 展示答案、建议或创作内容来自哪里。

因此，本项目的重点是**知识资产化**，不是文件存储。

---

## 4. 项目核心原则

### 4.1 知识库优先于数据库

不要只把本项目理解为“个人数据库产品”。

数据库是底层存储和查询方式，产品真正要构建的是个人知识库。

区别：

```text
数据库：关注数据如何存储、字段如何设计、内容如何检索。
知识库：关注知识如何形成、分类、关联、确认、调用和更新。
```

开发时应优先围绕“知识”建模，而不是围绕“文件”建模。

### 4.2 知识单元优先于文件

知识库的最小管理对象不是文件，而是 **Knowledge Unit，知识单元**。

一个 Knowledge Unit 可以是：

- 一个概念
- 一个观点
- 一个原则
- 一个方法
- 一个事实
- 一个证据
- 一个案例
- 一个问题
- 一个假设
- 一个偏好
- 一个项目决策
- 一个任务
- 一个模板

原始文件、图片、PDF、网页、对话记录只是 Source。系统要从 Source 中提取 Knowledge Unit。

文件是容器，知识单元才是可复用、可检索、可引用、可组织的操作层。

### 4.3 AI 不应完全自动建库

AI 的角色是辅助用户建立知识库，而不是替用户独断地决定知识结构。

正确流程：

```text
AI 发现 → AI 推荐 → 用户确认 / 修改 → 系统固化 → Agent 调用
```

任何重要知识、长期记忆、核心分类、知识关系，都应该支持用户确认、修改、忽略、合并、拆分、设为过期、设为不可调用。

### 4.4 产品核心不是聊天

AI Chat 只是调用入口，不是产品核心。

产品核心能力是：

- 知识提取
- 知识分类
- 知识确认
- 知识关联
- 知识状态管理
- 知识调用机制
- 知识沉淀与更新

不要把 MVP 做成简单的：

```text
上传文件 → 问答
```

而应做成：

```text
输入资料 / 想法
→ AI 提取知识单元
→ AI 推荐分类、标签、链接、属性
→ 用户确认
→ 进入个人知识库
→ Agent 基于知识库回答 / 生成 / 辅助决策
→ 有价值内容再次沉淀为知识
```

### 4.5 来源可追溯是核心功能

AI 输出只要声称来自用户知识库，就必须尽量展示证据来源。

对于问答、总结和生成，应展示：

- 使用了哪些 Knowledge Unit；
- 来自哪些 Source / Document；
- 相关 chunk 或段落；
- 为什么这些来源相关；
- 哪些部分是直接证据，哪些部分是模型推理。

避免让没有证据的幻觉看起来像来自用户知识库。

### 4.6 创作者工作流优先

本项目不是企业文档归档系统。

产品应支持创作者真实工作流，例如：

- “帮我找这个设计方向的参考”
- “总结我之前做过的研究”
- “根据我的材料生成汇报结构”
- “找出知识库里相关案例”
- “把我的笔记变成脚本”
- “比较旧项目逻辑和新 Brief”
- “从已完成作品中提取可复用洞察”
- “帮我判断哪些内容应该沉淀为长期记忆”

---

## 5. Obsidian-inspired 组织逻辑

本项目借鉴 Obsidian 的知识组织逻辑，但不是复制 Obsidian。

需要保留并产品化以下结构：

1. Folder
2. Tag
3. Link
4. Backlink
5. Properties
6. MOC / Map of Content

### 5.1 Folder

Folder 负责“知识放在哪里”。

在本产品中，Folder 更接近：

- Project Space
- Knowledge Space
- 工作场景
- 主知识空间

Folder 用于限定 Agent 检索范围。

例如：

```text
AI个人知识库产品/
孤山国立艺专MR项目/
Queer理论研究/
空间设计方法/
Archive/
Inbox/
```

### 5.2 Tag

Tag 负责“知识属于什么主题、类型、状态或用途”。

Tag 用于横向组织知识，支持一条知识拥有多个归属。

例如：

```text
#个人Agent
#个人知识库
#Obsidian
#产品定位
#核心判断
#已确认
#商业叙事
```

### 5.3 Link

Link 负责“知识之间有什么关系”。

不要只做“相关链接”，应尽量支持关系类型：

- supports
- contradicts
- derived_from
- example_of
- part_of
- depends_on
- similar_to
- used_for
- updates
- replaces

### 5.4 Backlink

Backlink 负责发现“哪些知识引用了当前知识”。

它可用于概念总结、主题回溯、知识脉络梳理和上下文补全。

### 5.5 Properties

Properties 负责给知识提供机器可读的结构化字段。

示例：

```yaml
type: core_claim
project: AI个人知识库产品
status: confirmed
importance: high
source: conversation
use_for:
  - product_positioning
  - technical_architecture
  - business_pitch
```

Properties 应用于 Agent 的低成本检索、过滤、排序与上下文组装。

### 5.6 MOC

MOC，即 Map of Content，负责把某个主题或项目组织成知识地图。

例如：

```text
AI个人知识库产品 MOC
├── 核心判断
├── 产品定位
├── Obsidian 逻辑
├── 分类标准
├── 扎根式分类
├── Agent 检索机制
└── MVP 设计
```

---

## 6. 分类体系与知识生长机制

### 6.1 Personal Knowledge Classification Standard v0.1

分类对象是 Knowledge Unit，不是文件。

第一版分类体系包含八个维度：

```text
1. Space：知识空间
2. Type：知识类型
3. Tag：主题标签
4. Use：调用用途
5. Status：知识状态
6. Source：知识来源
7. Relation：知识关系
8. Permission：权限 / 敏感性
```

### 6.2 固定层与生长层

分类体系应采用：

```text
基础框架自上而下，具体分类自下而上。
```

固定层：

- Space
- Type
- Status
- Source
- Permission
- Use

生长层：

- Tag
- Concept
- Relation
- MOC
- Personal Category

固定层保证 Agent 检索稳定，生长层保证知识库适应用户真实知识活动。

### 6.3 基础学科底座 Discipline Backbone

面向未来跨学科知识背景，知识库应以基础学科作为底层坐标系，再在其上生长出跨学科主题、个人项目和应用场景。

第一版基础学科建议：

```text
1. 形式科学
2. 自然科学
3. 生命科学
4. 社会科学
5. 人文学科
6. 工程与技术
7. 艺术与设计
```

注意：

- 基础学科不应作为唯一文件夹。
- 跨学科知识通常属于多个学科。
- 学科更适合做 Properties / Tag / Ontology，而不是唯一存放位置。

推荐五轴分类模型：

```text
学科轴：它来自哪些学科？
问题轴：它回答什么问题？
方法轴：它使用什么方法？
对象轴：它研究什么对象？
应用轴：它可以用在哪里？
```

### 6.4 Folder-Tag Mirroring 文件夹—标签镜像机制

这是本项目的重要机制。

核心规则：

> 当文件夹 A 存在时，系统自动生成一个与之对应的标准标签 #A。放入文件夹 A 的知识单元，自动继承 #A 标签。

更严格的规则：

```text
Folder → Tag：必然成立
Tag → Folder：可选成立
```

即：

> 所有文件夹都应生成对应标签，但不是所有标签都必须生成文件夹。

Folder 表达：

- 主要安放位置
- 主归属
- 默认上下文

Tag 表达：

- 多重归属
- 跨学科关系
- 横向检索
- 语义关联

如果知识单元放在：

```text
/工程与技术/AI/Agent
```

系统自动继承：

```text
#工程与技术
#工程与技术/AI
#工程与技术/AI/Agent
```

同时用户或 AI 可以追加：

```text
#信息科学/知识组织
#设计学/交互设计
#认知科学/记忆
```

系统内部应使用完整命名空间，避免同名冲突：

```text
#学科/工程与技术/AI
#项目/AI个人知识库产品
#主题/AI
```

标签类型需要区分：

```text
folder_tag：由文件夹自动生成
topic_tag：用户或 AI 添加的主题标签
status_tag：状态标签
use_tag：用途标签
```

### 6.5 扎根式知识分类引擎 Grounded Classification Engine

分类标准不应完全由系统预设，也不应完全自由生长。

推荐机制：

```text
开放编码 → 主轴编码 → 选择性编码 → 持续比较 → 分类稳定
```

产品化为：

| 扎根理论 | 产品机制 |
|---|---|
| 开放编码 | AI 从资料中提取初级标签和知识单元 |
| 主轴编码 | AI 发现标签之间的关系 |
| 选择性编码 | 形成核心主题和 MOC |
| 持续比较 | 新知识与旧知识比较、合并、区分 |
| 理论饱和 | 某类知识结构逐渐稳定 |

功能应包括：

- 从新资料中提取候选知识单元
- 生成开放标签
- 检测新旧标签重复
- 发现标签之间的关系
- 推荐合并、拆分或升级分类
- 自动生成 MOC
- 提示哪些分类已经稳定

---

## 7. 核心技术概念

### 7.1 Text-to-SQL

本项目的核心技术主线是 **Text-to-SQL**。

个人 Agent 不是只依赖对话上下文或向量召回工作，而是需要把自然语言问题转化为对个人数据库的结构化查询，从而调用用户长期积累的知识资产。

Text-to-SQL 在本项目中的作用：

- 把用户自然语言需求映射到结构化 Schema；
- 查询项目、文档、知识单元、标签、状态、来源、关系、时间线等结构化信息；
- 支持统计、过滤、排序、聚合和跨表关系查询；
- 与 RAG 结合，为生成回答提供可解释的结构化证据；
- 让用户理解 Agent 查询了什么、为什么这样查询、结果来自哪里。

Text-to-SQL 不应替代 RAG、Embedding 和全文搜索，而应与它们组合：

```text
自然语言问题
→ 意图识别
→ Schema / 权限 / 查询范围判断
→ Text-to-SQL 查询结构化知识
→ 关键词 + 向量混合检索非结构化内容
→ Link / Backlink 扩展关系上下文
→ 组装证据
→ LLM 生成带来源答案
```

实现 Text-to-SQL 时必须注意：

- 默认只读查询，避免自然语言直接触发破坏性 SQL；
- 明确可查询 Schema，不允许模型自由猜表；
- 对生成 SQL 做校验、解释和日志记录；
- 保留查询结果、来源和引用路径；
- 涉及敏感知识时必须遵守 Permission 字段；
- 用户应能看到或理解 Agent 的查询依据。

### 7.2 RAG

RAG 是 Retrieval-Augmented Generation。

在本产品中，RAG 用于让 AI 基于用户自己的知识库回答问题或生成内容。

基本流程：

1. 用户提出问题或创作任务；
2. 系统检索相关 Knowledge Unit / Chunk；
3. 检索结果进入模型上下文；
4. 模型生成答案；
5. 答案引用来源。

RAG 不是魔法，而是一个产品工作流，包含 ingestion、chunking、indexing、retrieval、ranking、prompt construction、answer generation 和 source display。

### 7.3 Embedding

Embedding 将文本或其他内容转化为向量，用于计算语义相似度。

Embedding 适合：

- 找到语义相似笔记；
- 检索相关 chunk；
- 连接隐含相关概念；
- 支持模糊搜索；
- 发现潜在关系。

Embedding 不适合替代：

- 精确过滤；
- 项目级组织；
- 用户确认分类；
- 版本控制；
- 来源归因；
- 权限控制；
- 结构化统计查询。

### 7.4 Vector Database

向量数据库或向量索引用于存储 embedding 并支持语义搜索。

早期推荐架构：

- PostgreSQL 作为主数据库；
- pgvector 支持向量搜索；
- JSONB 保存扩展元数据；
- 原始文件使用本地存储或对象存储；
- 必要时增加全文搜索；
- 只有在知识关系复杂到确有需要时，再考虑图数据库或独立向量数据库。

不要在 MVP 阶段过早引入复杂向量数据库。

### 7.5 Metadata

Metadata 是本项目的关键结构。

每个 Document、Knowledge Unit 或 Chunk 应尽量保留：

- Source file
- File type
- Project / Space
- Collection / Folder
- Section
- Page number
- Author
- Created time
- Updated time
- Version
- User-defined tags
- AI-suggested tags
- Confirmation status
- Sensitivity / Permission
- Usage context
- Citation pointer

Metadata 支持过滤、溯源、复盘、权限控制和检索控制。

### 7.6 Chunk

Chunk 是从较大文档中切分出的语义片段，主要服务检索和引用。

每个 Chunk 应包含：

- Chunk ID
- Original text
- Embedding
- Metadata
- Source pointer
- Order / position in source
- Parent document ID
- Project / Space ID
- Tags
- Version information

Chunking 应平衡语义完整性和检索精度。

避免：

- chunk 太短导致失去意义；
- chunk 太长导致检索不准；
- chunk 没有来源；
- chunk 没有元数据。

### 7.7 Tag

Tag 是显式语义索引。

Tag 可以来自：

- 用户手动输入；
- AI 建议；
- 项目模板；
- 系统分类规则；
- Folder-Tag Mirroring。

AI 生成标签只有在生成逻辑清晰、稳定、可审查、可编辑时才可被信任。

Tag 不等同于 Embedding。

应同时使用：

- Tag：显式、结构化、可控语义索引；
- Embedding：隐式、连续、相似度语义表示；
- Full-text search：精确关键词和短语检索；
- Metadata：结构化过滤和来源追踪；
- SQL：结构化查询、聚合和关系检索。

---

## 8. MVP 范围

第一版 MVP 不要做全能 Agent，不要一开始做复杂团队协作或多模态全覆盖。

### 8.1 MVP 核心闭环

第一版可用产品流应是：

```text
用户上传 / 输入 / 导入材料
→ 系统生成 Source
→ 系统解析内容
→ 系统切分 Chunk
→ AI 提取 Knowledge Unit
→ AI 推荐分类 / Tag / Link / Properties
→ 用户确认或修改
→ 系统存储 Knowledge Unit
→ 系统建立 embedding 和索引
→ 系统支持 Text-to-SQL / 关键词 / 语义 / 混合检索
→ Agent 基于已确认知识回答
→ 回答显示 Knowledge Unit 和 Source 引用
→ 用户可将有价值回答保存为长期记忆
```

### 8.2 P0 功能

优先实现：

1. 用户可以创建知识空间 / 项目空间；
2. 用户可以输入文本、粘贴对话、上传基础文件；
3. 系统可以生成 Source；
4. 系统可以从 Source 中提取 Knowledge Unit；
5. 系统可以推荐 type、tags、properties、links；
6. 用户可以确认、修改、忽略 Knowledge Unit；
7. 系统支持 Folder-Tag Mirroring；
8. 系统支持基础检索：Folder + Tag + Properties + Keyword / Vector / SQL；
9. Agent Chat 可以基于已确认知识回答；
10. 回答应显示使用了哪些 Knowledge Unit 和 Source；
11. 用户可以保存有价值回答为 Memory；
12. 用户可以管理、修正或删除 Memory。

### 8.3 P1 功能

之后实现：

- Backlink 面板
- MOC 自动生成与编辑
- 标签合并 / 重命名
- 文件夹改名与镜像标签同步
- 知识状态管理
- 关系类型可视化
- Markdown / Obsidian 导入导出
- PDF / 文档解析增强
- 项目概览生成
- 回答内容一键沉淀为 Knowledge Unit

### 8.4 暂缓功能

暂缓：

- 完整多 Agent 自动执行
- 复杂社交功能
- 团队协作权限系统
- Rhino / BIM / 复杂设计文件解析
- 插件市场
- 私有部署
- 复杂知识图谱推理
- 全自动网页爬取
- 企业级知识管理套件

### 8.5 MVP 应避免

不要过度构建第一版。

避免：

- 纯聊天界面，没有知识结构；
- 纯笔记应用逻辑；
- 纯向量数据库 Demo；
- 无来源 AI 生成；
- AI 答案没有引用；
- 无控制的自动记忆积累；
- 让用户无法确认 AI 分类或长期记忆。

---

## 9. 推荐技术方向

如果仓库尚未确定技术栈，建议采用务实 MVP 架构。

### 9.1 Frontend

推荐：

- React
- TypeScript
- Vite 或 Next.js
- Tailwind CSS
- Component-based UI

前端应优先支持：

- 清晰的信息架构；
- 上传和知识管理流程；
- 搜索与检索 UI；
- 来源展示；
- 标签编辑；
- 项目 / 知识空间组织；
- Agent 查询解释和引用展示。

### 9.2 Backend

推荐：

- Node.js / TypeScript 或 Python / FastAPI；
- REST 或轻量 API 层；
- 清晰的 service 模块；
- 后台任务队列可选使用 BullMQ、Celery 或 Redis Queue。

后端应支持：

- 文件摄取；
- 文本解析；
- Chunking；
- Knowledge Unit 提取；
- Metadata 抽取；
- Embedding 生成；
- Text-to-SQL 查询；
- 混合检索；
- RAG 生成；
- 来源引用和查询日志。

### 9.3 Database

推荐：

- PostgreSQL；
- pgvector；
- JSONB metadata；
- 必要时使用 PostgreSQL full-text search。

不要在 MVP 阶段为了“AI 感”引入过重的数据基础设施。

### 9.4 Storage

推荐：

- 本地存储用于早期原型；
- 后续抽象到 S3、Cloudflare R2、MinIO 或其他对象存储。

### 9.5 AI Layer

AI 层必须模块化，不要把单一模型供应商深度硬编码到产品逻辑中。

至少预留清晰接口：

- Embedding model
- Chat / generation model
- Tagging model
- Summarization model
- Text-to-SQL model / planner
- Reranking model

---

## 10. 数据模型方向

Codex 应优先维护清晰、可扩展、可被 Text-to-SQL 查询的数据模型。

### 10.1 User

字段建议：

- id
- name
- created_at

### 10.2 KnowledgeSpace / Project

字段建议：

- id
- user_id
- name
- description
- parent_id
- created_at
- updated_at
- metadata_json

### 10.3 Source / Document

字段建议：

- id
- user_id
- project_id / space_id
- title
- file_type
- source_type
- source_path
- original_filename
- content_hash
- created_at
- updated_at
- metadata_json

### 10.4 Chunk

字段建议：

- id
- document_id / source_id
- project_id / space_id
- content
- embedding
- chunk_index
- section_title
- page_number
- metadata_json
- created_at
- updated_at

### 10.5 KnowledgeUnit

第一版 Knowledge Unit 可以使用以下字段：

```yaml
id:
title:
type:
content:
space:
primary_folder:
folder_mirror_tags:
semantic_tags:
discipline_axis:
problem_axis:
method_axis:
object_axis:
application_axis:
status:
importance:
source:
source_id:
chunk_ids:
relations:
use_for:
permission:
created_at:
updated_at:
user_verified:
ai_confidence:
metadata_json:
```

`type` 建议第一版支持：

```text
concept
claim
fact
method
principle
case
evidence
decision
preference
question
task
template
```

`status` 建议第一版支持：

```text
raw
extracted
pending_review
confirmed
uncertain
conflicting
outdated
archived
do_not_use
```

`permission` 建议第一版支持：

```text
public
private
project_internal
sensitive
restricted
do_not_share
```

### 10.6 Tag

字段建议：

- id
- name
- namespace
- description
- tag_type
- created_by
- created_at

### 10.7 KnowledgeUnitTag / ChunkTag

字段建议：

- knowledge_unit_id 或 chunk_id
- tag_id
- confidence
- confirmed_by_user
- reason
- created_by

### 10.8 KnowledgeRelation

字段建议：

- id
- from_knowledge_unit_id
- to_knowledge_unit_id
- relation_type
- confidence
- confirmed_by_user
- reason
- created_at

### 10.9 RetrievalLog

字段建议：

- id
- user_id
- query
- query_intent
- generated_sql
- retrieved_chunk_ids
- retrieved_knowledge_unit_ids
- ranking_scores
- filters_json
- created_at

### 10.10 AIAnswer

字段建议：

- id
- user_id
- query
- answer
- cited_chunk_ids
- cited_knowledge_unit_ids
- generated_sql
- created_at
- saved_to_memory

### 10.11 Memory

字段建议：

- id
- user_id
- project_id / space_id
- content
- source_type
- source_id
- tags
- created_at
- updated_at
- user_confirmed
- permission

---

## 11. 检索与 Agent 读取机制

不要只依赖全库向量检索。

推荐检索流程：

```text
用户问题
→ 判断项目 / 文件夹范围
→ 读取 Schema、Properties、Permission 约束
→ 必要时生成 Text-to-SQL 查询结构化数据
→ 使用 Tag 筛选语义维度
→ 进行关键词 + 向量混合检索
→ 沿 Link 扩展相关知识
→ 读取 Backlink 补充语境
→ 组装上下文
→ LLM 基于证据回答
→ 展示 Knowledge Unit、Source、SQL / 检索路径和引用
```

各组织形式的作用：

| 形式 | 解决的问题 | 对检索的作用 |
|---|---|---|
| Folder | 在哪里找 | 限定范围 |
| Tag | 找什么 | 语义筛选 |
| Properties | 按什么条件找 | 结构化约束 |
| SQL | 如何查询结构化关系 | 精确过滤、聚合、排序 |
| Embedding | 语义上接近什么 | 相似度召回 |
| Full-text search | 精确出现了什么词 | 关键词召回 |
| Link | 沿什么关系找 | 关系扩展 |
| Backlink | 谁引用了它 | 语境补全 |
| MOC | 如何整体理解 | 主题导航 |

---

## 12. 预期产品模块

Codex 应围绕以下模块组织产品。

### 12.1 Ingestion Module

负责：

- 上传材料；
- 导入 Markdown；
- 导入 PDF / 文档；
- 导入文本笔记和对话；
- 保存原始文件；
- 创建 Source / Document 记录。

### 12.2 Parsing and Chunking Module

负责：

- 抽取文本；
- 切分文档；
- 保留文档结构；
- 保留页码、章节、标题信息；
- 创建 Chunk 记录。

### 12.3 Knowledge Extraction Module

负责：

- 从 Source / Chunk 中提取 Knowledge Unit；
- 区分事实、观点、方法、案例、问题、偏好等类型；
- 保存 AI 置信度和用户确认状态。

### 12.4 Metadata Module

负责：

- 存储结构化元数据；
- 允许元数据编辑；
- 支持项目 / 文件夹 / 集合组织；
- 支持检索过滤。

### 12.5 Tagging Module

负责：

- AI 推荐标签；
- 手动标签；
- 标签置信度；
- 标签解释；
- 标签确认状态；
- 标签命名空间；
- 标签合并、重命名和规范化。

### 12.6 Embedding and Indexing Module

负责：

- 创建 embedding；
- 内容变更后更新 embedding；
- 存储向量；
- 支持语义搜索；
- 与全文索引和结构化索引协同。

### 12.7 Text-to-SQL Module

负责：

- 维护可查询 Schema 描述；
- 将自然语言问题转为只读 SQL；
- 校验 SQL 安全性；
- 解释 SQL 查询意图；
- 保存查询日志；
- 将查询结果转化为可引用证据。

### 12.8 Retrieval Module

负责：

- SQL 查询；
- Keyword search；
- Semantic search；
- Metadata filtering；
- Hybrid retrieval；
- Reranking；
- Context budget control；
- Link / Backlink 扩展。

### 12.9 RAG Answering Module

负责：

- 基于检索结果构建 prompt；
- 生成答案；
- 展示引用；
- 区分证据和推理；
- 支持追问。

### 12.10 Creation Assistance Module

负责：

- 将知识转成提纲；
- 生成脚本；
- 生成设计叙事；
- 生成文章草稿；
- 生成汇报结构；
- 生成研究总结；
- 生成可复用模板。

### 12.11 Memory Management Module

负责：

- 保存有价值 AI 输出；
- 让用户决定什么成为长期记忆；
- 编辑记忆；
- 删除记忆；
- 展示记忆来源；
- 防止无控制的记忆污染。

---

## 13. UX 要求

产品应像专业创作者的知识驾驶舱，而不是通用聊天机器人。

重要页面：

1. Dashboard
2. Project / Knowledge Space list
3. Knowledge library
4. Document / Source detail
5. Chunk / Knowledge Unit detail
6. Upload / import page
7. Tag management page
8. Search page
9. RAG Q&A page
10. Text-to-SQL query explanation panel
11. Memory management page
12. Creation workspace
13. MOC / knowledge map page

重要 UI 原则：

- 清楚展示来源；
- 清楚展示标签；
- 清楚展示项目上下文；
- AI 建议必须可编辑；
- 区分用户确认知识与 AI 建议知识；
- 不要把结构藏在纯聊天界面背后；
- 检索结果必须可检查；
- 回答引用必须可追踪；
- SQL / 检索路径应尽量可解释；
- 知识应可复用、可沉淀、可更新。

---

## 14. 文档要求

当 Codex 创建或修改项目文档时，应在相关情况下维护：

- `README.md`
- `AGENTS.md`
- `docs/development-plan.md`
- `docs/progress.md`
- `docs/product-positioning.md`
- `docs/user-research.md`
- `docs/information-architecture.md`
- `docs/technical-architecture.md`
- `docs/rag-pipeline.md`
- `docs/text-to-sql.md`
- `docs/data-model.md`
- `docs/mvp-scope.md`
- `docs/design-principles.md`
- `docs/dev-log.md`

文档原则：

- 以中文为主，除非现有仓库明确采用英文；
- 使用清晰标题；
- 使用结构化列表；
- 保持产品经理级别的清晰度；
- 必要时使用技术术语；
- 描述具体功能和边界；
- 避免没有实现意义的口号；
- 避免夸大承诺；
- 说明每个功能如何服务内容创作者；
- README 保持项目入口概览，详细内容下沉到 `docs/`。

---

## 15. 开发规范

### 15.1 任务开始前

Codex 应先：

1. 阅读本文件；
2. 理解用户目标、边界和是否允许修改代码；
3. 检查仓库结构；
4. 查找 README、package.json、pyproject.toml、requirements.txt、pnpm-lock、AGENTS.md 等开发说明；
5. 判断这是小修复、增量功能、架构调整、纯讨论还是 review；
6. 不确定技术栈时，先生成项目结构建议或开发计划，不要盲目新建复杂工程；
7. 优先修改已有文件，不做无必要重构。

### 15.2 计划与进度文档

任何中等以上复杂度的开发任务，先更新或创建：

- `docs/development-plan.md`
- `docs/progress.md`

要求：

- `development-plan.md` 写清目标、范围、目录影响、分阶段任务、验证方式、风险；
- `progress.md` 记录已完成内容、验证结果、当前阻塞、与计划差异；
- 每完成一个阶段就更新进度；
- 停止前确认计划文档、进度文档、真实实现和验证结果一致。

如果是极小修改，可以简化，但仍要先做最小范围任务计划。

### 15.3 架构与目录管理

涉及新增模块、重构或较大功能扩展时，先展示或更新目录结构图，再实施。

前端项目默认参考结构可按实际裁剪：

```text
src/
├── assets/
├── components/
├── features/
├── hooks/
├── services/
├── store/
├── utils/
└── constants/
```

如果是 Electron、Node 工具、脚本工程或混合项目，应明确区分：

```text
electron/
src/
scripts/
config/
docs/
```

任何新增文件都必须：

- 在架构中有明确位置；
- 有清晰职责；
- 与现有模块边界一致；
- 被真实引用或可执行验证。

### 15.4 代码风格

如已有项目规范，遵守现有规范。

如无规范，默认：

- TypeScript 优先于 JavaScript；
- 后端优先使用类型标注；
- 数据模型应清晰命名；
- 函数应短小，避免大段业务逻辑堆叠；
- 关键业务逻辑应添加简洁注释；
- 不要在代码中硬编码 API Key；
- 不要提交 `.env`、密钥、私人数据；
- 模型供应商、存储、检索、Embedding、Text-to-SQL 应保持可替换接口。

### 15.5 测试与验证

修改代码后，应尽可能运行：

- lint
- typecheck
- unit tests
- build
- relevant scripts
- smoke test
- 启动验证

若仓库没有测试，应在最终说明中写明“未发现可运行测试”。

### 15.6 Git 行为

除非用户明确要求：

- 不要创建新分支；
- 不要主动提交 commit；
- 不要删除重要文件；
- 不要大规模重构；
- 不要改动与任务无关的文件。

如用户明确要求 Codex 提交，则应运行测试后提交，并保持工作区干净。

### 15.7 Code Review 模式

如果用户要求 review：

- 先给 findings，按严重程度排序；
- 明确文件位置；
- 说明风险与原因；
- 最后给简短总结；
- 如果未发现明确缺陷，应直接说明，并指出剩余风险或测试缺口。

---

## 16. 命名建议

项目内部推荐使用：

```text
Personal Knowledge Base
Personal Knowledge Database
Knowledge Asset
Knowledge Unit
Source
Chunk
Knowledge Space
Folder-Tag Mirroring
Grounded Classification Engine
Text-to-SQL
RAG
MOC
Agent Context
Source-Grounded Answer
```

需要谨慎或避免作为主定位使用：

```text
File Manager
Simple RAG Chatbot
Second Brain Clone
Generic ChatGPT Wrapper
Cloud Disk
Pure Vector Database Demo
```

这些名称会削弱项目重点。

---

## 17. 非目标

本项目不主要是：

- 通用 ChatGPT wrapper；
- 简单云盘；
- 普通笔记软件；
- 纯 Obsidian 克隆；
- 纯向量数据库 Demo；
- 泛企业文档管理系统；
- 社交内容平台；
- 团队协作套件；
- 无用户控制的全自动记忆系统。

---

## 18. 当前最重要的开发目标

当前阶段最重要的不是做完整产品，而是实现一个最小可验证原型：

> AI 能把输入内容转化为 Knowledge Unit，并通过 Folder / Tag / Properties / Link / Text-to-SQL / RAG 组织和调用，最后让 Agent 基于已确认知识进行可追溯回答。

第一阶段衡量标准：

1. 用户输入一段项目想法；
2. 系统能提取 3–5 条 Knowledge Unit；
3. 系统能推荐 type、tag、properties、links；
4. 用户能确认或修改；
5. 系统能生成一个基础 MOC；
6. 用户用自然语言提问时，系统能用 Text-to-SQL 查询结构化知识；
7. Agent 能结合结构化查询结果和非结构化检索结果回答；
8. 回答能显示来源、Knowledge Unit、Source 和调用路径。

最高优先级任务：

1. 明确产品定位；
2. 定义目标用户场景；
3. 设计 MVP 工作流；
4. 定义信息架构；
5. 定义数据模型和可查询 Schema；
6. 设计 Text-to-SQL 调用边界；
7. 原型化输入 → 解析 → chunk → Knowledge Unit → tag → retrieve → answer with sources；
8. 建立简单但可信的 UI；
9. 记录 RAG pipeline；
10. 记录 metadata / tag / chunk / Knowledge Unit / SQL query 的关系。

---

## 19. 输出风格

当 Codex 写项目文档时，应使用：

- 清晰中文标题；
- 结构化列表；
- 产品经理级别的清晰度；
- 必要技术术语；
- 具体功能描述；
- 避免空泛营销语言；
- 避免夸大承诺；
- 解释每个功能如何服务内容创作者。

当 Codex 写代码时，应：

- 保持文件组织清晰；
- 使用可读命名；
- 只在逻辑不明显处添加注释；
- 避免不必要依赖；
- 保持类型安全；
- 偏向简单、可测试、可迁移模块；
- 保持标签、元数据、chunk、embedding、SQL 查询、RAG 证据链概念清晰分离。

---

## 20. 产品底层总结

本项目的底层逻辑可以压缩为：

> 以个人数据库作为个人 Agent 的长期上下文底座，以基础学科作为稳定坐标，以 Knowledge Unit 作为最小知识资产，以 Obsidian 的 Folder、Tag、Link、Backlink 和 Properties 作为组织逻辑，以 Text-to-SQL 连接自然语言与结构化知识，以 RAG 和 Embedding 处理非结构化语义召回，以扎根式分类作为知识生长机制，以文件夹—标签镜像机制解决多重归属问题，最终构建一个可被个人 Agent 长期调用、可追溯、可确认、可复用的 AI 个人知识库系统。
