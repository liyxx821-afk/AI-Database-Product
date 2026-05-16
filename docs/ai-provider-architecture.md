# AI Provider 架构

版本：v0.13
日期：2026-05-17  
状态：P0 开源优先能力注册中心 + Provider 类型边界 + File Inspection capability + 切片前准备 / 结构恢复 capability + Chunking capability + 切片执行 profile adapter 边界 + AI 结构化整理 profile 边界 + D-079 子能力收敛 + D-082 InvocationProfileSchema v1 / D-083 feedback_policy 边界 + Provider fallback 契约 + capability API 对齐 + D-092 Provider manifest

## 1. 文档目的

本文档解决一个核心问题：

> P0 采用开源优先 ProviderRegistry：优先本地 / 开源 parser、embedding、OCR、ASR、LLM、reranker；缺失时降级为 rule-based / mock / evidence-only fallback。商业 Provider 仅作为可选适配。如果 P0 不预埋抽象层，后续切换开源或商业模型时必然返工。

本文档定义：

- Provider 抽象接口契约（file_detection / encoding_detection / security_scan / structure_detection / preview_generation / table_parse / media_probe / parser / OCR / ASR / vision / cleaning / PII / token_counting / structure_recovery / document_layout / table_structure / html_xml_structure / academic_paper_structure / chunk_strategy / semantic_chunking / context_enrichment / chunk_quality_eval / content_understanding / schema_mapping / knowledge_card_generation / classification_tagging / relation_suggestion / embedding / chat / tag / summarization / text-to-sql / rerank）
- API Key 安全存储方案（macOS Keychain、Windows Credential Manager、Linux Secret Service）
- 多 Provider 路由策略（按能力选 provider）
- 降级策略（开源 / 本地 Provider ↔ mock / evidence-only fallback）
- 用户配置 UI 边界（Settings → AI Providers）
- 调用成本和速率统计
- P0 开源优先能力与后续商业 Provider 的过渡路径

本文档不替代：

- `docs/desktop-architecture.md`（§13 安全实践、§15 设置页面）
- `docs/product-architecture.md`（§4.0.1 AI 能力栈定位）
- `docs/data-model.md`（§2.7–2.8：Embedding 表结构及主库混合向量策略，D-063）

RAG 与向量检索依赖 Embedding 输出写入主库后的混合检索路径；**P0–P1 默认不引入独立向量数据库**，与本文档的 Provider 路由正交。

---

## 2. 设计原则

### 2.1 抽象优先于具体

P0 即使运行在 mock / fallback 模式，AI 能力调用也必须通过统一的 Provider 抽象接口，不允许在业务模块中直接 `import openai` 或硬编码单一模型。

### 2.2 能力分离

不同能力（file_detection / parser / OCR / ASR / vision / cleaning / PII / token_counting / structure_recovery / chunk_strategy / context_enrichment / chunk_quality_eval / content_understanding / schema_mapping / knowledge_card_generation / classification_tagging / relation_suggestion / embedding / chat / tag / summarization / text-to-sql / rerank）有独立接口。业务模块只依赖能力接口和 capability status，不直接依赖 PyMuPDF、PaddleOCR、Whisper、OpenAI 等具体实现。

### 2.3 用户控制

所有 AI 调用必须可被用户：

- 启用 / 禁用
- 选择 provider
- 限制调用频率和成本
- 离线时降级为 mock

### 2.4 数据主权

API Key 不上传任何远程服务，存储在系统 Keychain。

发送给 AI provider 的内容必须经过：

- 用户明确同意（首次启用真实 AI 时）
- 敏感字段过滤（permission=do_not_share 的 KU 不发送）
- 日志脱敏（不记录用户原文 + Key 不入日志）

### 2.5 P0 开源优先，缺失时降级

P0 阶段按能力启用本地 / 开源 Provider；缺失时用规则 / mock / recoverable error / evidence-only fallback：

```text
P0-File：parser / OCR / ASR / vision / video adapter 缺失时进入可恢复失败，不丢文件
P0-AI：cleaning / embedding / summarization / tag / ku_extraction 可接本地或开源 Provider
P0-RAG：chat / rerank / text_to_sql 可接本地或开源 Provider，缺失时 evidence-only answer 或 template SQL
P1：商业 Provider、质量评估集、成本统计和更完整路由增强
```

### 2.6 Provider 类型边界

`GET /api/ai-providers` 展示 provider 家族，`GET /api/ai-providers/capabilities` 才是运行时路由单一来源。Provider 类型固定为：

| provider_type | 用途 | 是否用户可配置 | 默认例子 |
|---|---|---|---|
| `system` | 不依赖外部模型的规则能力，如 token 估算、策略选择、规则质量检查 | 否 | `system_rules` |
| `local_adapter` | 本地工具或开源 adapter，如 PyMuPDF、pdfplumber、PaddleOCR、Whisper | 通常否；可在设置中显示安装状态 | `local_parsing` |
| `mock` | 测试、fixture 和 fallback profile，不代表真实模型质量 | 否 | `mock_fixed_384` |
| `commercial` | 需要用户配置 key 的商业或云端 provider | 是 | OpenAI / VoyageAI / Claude |

`mock` 不得作为真实 `chunk_quality_eval` 或 `rag_answer` 能力展示给用户；规则质量检查归属 `system_rules`，商业或本地模型质量评估仅作为增强 provider。

D-082 的 `InvocationProfileSchema v1` 是业务 profile envelope，不要求把每个工具名都升级为 Provider capability。ProviderRegistry 只登记会影响路由和降级决策的能力，例如 query rewrite、rerank、LLM answer、embedding、parser、OCR、ASR。`rewrite_status=not_needed` 是规则判断结果，不应被记录为 LLM Provider fallback；只有“需要改写但 Provider 缺失/失败”才写 `capability_status=fallback|unavailable` 和 `fallback_reason`。

每次启用新 Provider 必须经过 mock / open-source baseline 对比测试。

### 2.7 D-092 Provider Manifest

ProviderRegistry 必须由 manifest 驱动，不允许每个 service 自己散写 import、probe 和 fallback。

manifest 最小字段：

```yaml
provider_key:
capability:
provider_type: system | local_adapter | mock | commercial
extra_group:
import_path:
probe_function:
default_enabled:
disable_reason:
fallback_provider_key:
user_visible:
```

约束：

- lazy-load、capability probe、Settings 展示、测试 fixture 都读取 manifest；
- `extra_group` 对应 `pyproject.toml` optional dependency group；
- `import_path` 只能由 ProviderRegistry probe 使用，业务 service 不直接导入；
- `fallback_provider_key` 必须指向 `system_rules`、`mock_fixed_384` 或 evidence-only 等已登记 fallback；
- `user_visible=false` 的 mock / system provider 不作为真实 AI 能力对用户承诺。

---

## 3. AI 能力清单

### 3.1 P0 / P1 能力对照

| 能力 | P0 实现 | 默认 / 候选 Provider | 主要服务 |
|---|---|---|---|
| file_detection | 真实类型识别；缺失时扩展名/MIME/文件头 fallback | libmagic / python-magic | File Inspection / Parser Router |
| encoding_detection | 文本编码检测与修复提示 | charset-normalizer、chardet optional | 文本入库、乱码恢复 |
| security_scan | 本地静态风险检查；不执行未知文件 | qpdf、oletools、EXIF adapter；ClamAV/Docker optional | 风险阻断、隔离、恢复动作 |
| structure_detection | 基础文档结构识别 | PyMuPDF、pdfplumber、openpyxl；Unstructured/Docling/LayoutParser optional | Parser Router、预览、Review |
| preview_generation | 派生预览资产；失败不阻塞解析 | Pillow、PyMuPDF、openpyxl、FFmpeg | 文件详情、Review UI |
| table_parse | 表格结构抽取 | pdfplumber；Camelot/Tabula/Polars optional | 表格 Source / Chunk |
| media_probe | 媒体元数据和封面 | FFmpeg、PySceneDetect optional | 视频/音频预处理 |
| parser | Parser Router + recoverable failure | text/Markdown 内置、PyMuPDF、pdfplumber、Unstructured/Docling/Tika optional | 文件解析、Source 文本生成 |
| ocr | 开源 OCR；缺失时 `ocr_unavailable` | PaddleOCR、Tesseract fallback | 扫描 PDF、图片文字 |
| asr | 开源 ASR；缺失时 `asr_unavailable` | Whisper、FunASR optional | 音频、会议转录、视频字幕 |
| vision | 可选图片理解；缺失时仅保留文件和 OCR 结果 | CLIP、BLIP-2、Florence-2、商业多模态 optional | 图片描述、图向量、场景/布局提示 |
| video | 可选视频预处理；缺失时可恢复失败 | FFmpeg、PySceneDetect optional | 抽帧、元数据、场景切分 |
| cleaning | 规则/开源清洗 | pandas、Pandera、Polars/DuckDB optional | 去重、空值、类型修复、标准化、异常检测 |
| pii | 可选敏感信息识别 | Presidio optional | 发送 Provider 前的敏感内容过滤 |
| token_counting | chunk token 预算与长度边界 | tiktoken；规则估算 fallback | ChunkBuildService、context budget |
| structure_recovery | 文档层级、段落、表格、图注位置恢复 | PyMuPDF、pdfplumber、openpyxl；python-docx/Unstructured/Tika/GROBID/BeautifulSoup/lxml optional | 切片前准备层、Source Detail |
| document_layout | 基础版面信息与 OCR/布局检查 | PyMuPDF、PaddleOCR/OpenCV optional；LayoutParser P1 | OCR 与版面识别检查 |
| table_structure | 表格结构识别与行列范围 | pdfplumber、openpyxl；Camelot/Tabula optional | 结构化内容切片 |
| html_xml_structure | HTML/XML 文档结构恢复 | BeautifulSoup/lxml optional | 网页摘录 / XML Source 的 P1 adapter |
| academic_paper_structure | 学术论文题名、作者、摘要、章节、参考文献结构 | GROBID optional | 学术 PDF 增强解析 |
| chunk_strategy | 规则 + 文档结构优先；缺失时 P0-Z0a 仍可按长度切片 | heading / paragraph / parser structure rules | 选择 `chunk_strategy_profile` |
| semantic_chunking | 可选语义切片；缺失时规则切片 | embedding semantic chunking、本地 LLM optional | 长文本、主题混杂、语义边界判断 |
| context_enrichment | 规则上下文补充；P0-Z2 可 LLM 增强 | heading path、source metadata、LLM summary optional | `context_summary`、章节/页码/图表说明 |
| chunk_quality_eval | 规则质量检查；LLM/reranker 仅增强 | rule checks、LLM evaluator、reranker optional | `chunk_quality_checks` 和质量风险说明 |
| embedding | 开源 / 本地优先；缺失时 `mock_fixed_384` | bge-m3、bge-large-zh、E5-Mistral、jina-embeddings-v3、OpenAI/Voyage optional | Source Description / Chunk / KU 向量化 |
| chat | 本地 / 开源 LLM 优先；缺失时 evidence-only answer | Ollama / llama.cpp / vLLM / OpenAI / Claude optional | RAG Answer / 创作输出 |
| summarization | 规则拼装或开源 LLM | 本地 LLM / GPT / Claude optional | Source Description Card / KU 摘要 |
| tag_suggestion | KeyBERT / HanLP / spaCy / 规则或开源 LLM | KeyBERT、HanLP、spaCy、本地 LLM | KU 标签推荐 |
| text_to_sql | 模板 SQL + 安全校验 | template planner；Vanna/LlamaIndex SQL/LangChain SQL/DB-GPT P1 eval | 自然语言查询知识库 |
| rerank | 可选开源 reranker；缺失时 merge score | bge-reranker-v2、jina-reranker、Cohere optional | 检索结果重排序 |
| ku_extraction | 用户手动 + 开源 / 规则 / mock 候选 | 本地 LLM / GPT / Claude optional | 从 Source 自动抽取 KU |
| content_understanding | 规则主题识别 + 可选 LLM 理解 | system_rules、本地 LLM optional | KU 候选主题、上下文理解 |
| schema_mapping | Pydantic / JSON Schema 字段映射 | Pydantic、JSON Schema；LangChain Structured Output / Instructor optional | KU 字段完整性与格式约束 |
| knowledge_card_generation | 模板化知识卡片 | Jinja2、Markdown、YAML frontmatter；LLM optional | 候选知识卡片展示与 Review |
| classification_tagging | 规则 / 关键词 / NLP 标签候选 | KeyBERT、YAKE、HanLP、spaCy；BERTopic optional | KU 分类、标签候选与一致性检查 |
| relation_suggestion | P0 默认 `system_rules` stub，增强 provider optional | relation_rules；本地 LLM / GPT / Claude optional | 推荐 KU 之间关系候选，默认进入 Review |

### 3.2 D-076：工具名只进入 adapter / profile，不泛化为 capability

D-076 收敛后的原则是：`ProviderRegistry` 只暴露会影响路由、降级和用户可见状态的能力；具体工具名优先写入 `profile`、`provider_key`、`provider_version` 或 adapter 配置，不把每个工具都升级成新的 capability。

| 工具 / adapter | 归属 capability | profile 用途 | P0 边界 |
|---|---|---|---|
| LangChain RecursiveCharacterTextSplitter | `chunk_strategy` / `semantic_chunking` | P1 文本切分 adapter | 不进入 P0 默认依赖；缺失时回到规则切片 |
| LlamaIndex Node Parser / SentenceSplitter | `chunk_strategy` / `semantic_chunking` | P1 节点切分 adapter | 不新增 endpoint 或表 |
| sentence-transformers / BGE / text2vec | `semantic_chunking` / `embedding` | 语义相似度和边界增强 | P0 可无此依赖，记录 `fallback_reason` |
| CLIP / BLIP / Florence | `vision` | 图片描述、图文向量和多模态 chunk hint | 不替代 OCR / Source citation |
| Table Transformer | `table_structure` | 表格区域检测增强 | P2；P0 仍用 pdfplumber / openpyxl |
| Prompt Template / Transformers / reranker | `context_enrichment` / `chunk_quality_eval` | 上下文补充、质量复核和 rerank 增强 | P0-Z2 或 P1/P2 增强，不阻塞 Z0a/Z0b |

因此 `GET /api/ai-providers/capabilities` 继续返回 `token_counting`、`structure_recovery`、`document_layout`、`table_structure`、`chunk_strategy`、`semantic_chunking`、`context_enrichment`、`chunk_quality_eval` 等能力状态；`chunk_execution_profile`、`chunk_type`、`adapter_key` 等执行细节由 chunk metadata 和 job summary 表达。

### 3.3 D-077：AI 结构化整理工具进入 profile，只有路由决策进入 capability

D-077 的边界与 D-076 相同：工具名不等于 Provider capability。只有会影响路由、降级、用户可见状态或质量检查的能力进入 `ProviderRegistry`；其余写入 `structured_organization.profile`、`provider_key`、`provider_version` 或 adapter 配置。

| 模块 | P0 capability / profile | 工具写入位置 | P0 边界 |
|---|---|---|---|
| 内容理解 | `content_understanding` / `p0_rule_structuring_v1` | LLM、LlamaIndex、BGE/Sentence-Transformers、spaCy/HanLP 写入 profile | LLM 缺失时用规则主题识别并写 `fallback_reason` |
| 摘要生成 | `summarization` / `p0_summary_template_v1` | LLM、LangChain、LlamaIndex、Transformers/BART/T5 写入 profile | 只生成候选摘要，不覆盖 Source 原文 |
| 关键概念抽取 | `tag_suggestion` / `p0_key_concept_rules_v1` | KeyBERT、YAKE、spaCy/HanLP、BGE 写入 profile | 概念进入 Review，不能自动固化为标签 |
| 结构化字段生成 | `schema_mapping` / `p0_schema_mapping_v1` | Pydantic、JSON Schema、LangChain Structured Output、Instructor/Guardrails 写入 profile | P0 默认 Pydantic + JSON Schema |
| 知识卡片生成 | `knowledge_card_generation` / `p0_knowledge_card_template_v1` | Jinja2、Markdown、YAML Frontmatter、LLM 写入 profile | 卡片必须包含 source/chunk pointer |
| 分类与标签管理 | `classification_tagging` / `p0_classification_tagging_v1` | LLM、KeyBERT、BERTopic、BGE、Pydantic 写入 profile | 标签建议 pending review，可合并、回滚 |
| 知识关系构建 | `relation_suggestion` / `p0_relation_suggestion_stub_v1` | LLM、Neo4j、NetworkX、spaCy/HanLP、RDFlib 写入 profile | P0 只生成关系候选和 review task，不写 confirmed relation |

结构化整理质量检查固定为 `topic_understanding`、`summary_quality`、`concept_extraction`、`schema_mapping`、`card_normalization`、`tag_consistency`、`relation_suggestion`。P0-Z0a/Z0b 的检查结果写入 `knowledge_units.metadata_json.structured_organization`、`processing_status_events` 和 `review_tasks`；`quality_events` 到 P0-Z1 后再作为质量治理事件写入，不新增专用检查表。

D-079 进一步约束：标签生成、标签合并、标签去重、项目归属、知识库归属、实体识别、三元组抽取都不升级为新的 P0 顶级 capability。它们分别写入 `classification_tagging`、`schema_mapping` 和 `relation_suggestion` 的 profile 子字段。只有影响路由、降级和用户可见状态的能力保留在 ProviderRegistry；实体候选和 triple candidates 先作为 `relation_suggestion.result` 的可审查材料，外部图数据库、复杂关系抽取模型和 GraphRAG runtime 继续保持 P1/P2 adapter。

### 3.4 能力归属（Building AI / Invocation AI）

按 `docs/product-architecture.md` §4.0.1 划分：

| 能力 | 归属 |
|---|---|
| parser / OCR / ASR / vision / video | P0-File + P0-AI |
| cleaning / pii | P0-AI + Provider 安全边界 |
| embedding | 共享（建库写入 + 调用读取） |
| content_understanding / schema_mapping / knowledge_card_generation / classification_tagging | Building AI |
| summarization | Building AI |
| tag_suggestion | Building AI |
| ku_extraction | Building AI |
| relation_suggestion | Building AI |
| chat | Invocation AI |
| text_to_sql | Invocation AI |
| rerank | Invocation AI |

---

## 4. Provider 抽象接口

### 4.1 接口契约（Python 示例）

```python
from typing import Protocol, Optional
from dataclasses import dataclass

@dataclass
class CapabilityStatus:
    capability: str
    provider_key: str
    provider_version: str | None
    profile: str | None
    status: str  # available / fallback / unavailable / disabled / error
    blocking: bool = False
    recoverable: bool = True
    fallback_profile: str | None = None
    fallback_reason: str | None = None
    next_action: str | None = None

@dataclass
class ParseResult:
    text_path: str | None
    normalized_text: str | None
    metadata: dict
    warnings: list[dict]
    status: CapabilityStatus

class ParserProvider(Protocol):
    async def parse(self, file_path: str, *, mime_type: str, profile: Optional[str] = None) -> ParseResult:
        ...

class OcrProvider(Protocol):
    async def recognize(self, file_path: str, *, language: Optional[str] = None) -> ParseResult:
        ...

class AsrProvider(Protocol):
    async def transcribe(self, file_path: str, *, language: Optional[str] = None) -> ParseResult:
        ...

class VisionProvider(Protocol):
    async def describe(self, file_path: str, *, profile: Optional[str] = None) -> dict:
        ...

class DataCleaningProvider(Protocol):
    async def clean_text(self, text: str, *, source_metadata: dict) -> dict:
        ...

class SensitiveInfoProvider(Protocol):
    async def detect(self, text: str, *, permission: str) -> list[dict]:
        ...

@dataclass
class EmbeddingResult:
    vector: list[float]
    dimension: int
    model: str
    profile: str  # bge_m3_local / mock_fixed_384 / openai_text_embedding_3_small / ...
    is_mock: bool
    status: CapabilityStatus | None = None

class EmbeddingProvider(Protocol):
    async def embed(self, text: str, *, profile: Optional[str] = None) -> EmbeddingResult:
        ...

    async def embed_batch(self, texts: list[str], *, profile: Optional[str] = None) -> list[EmbeddingResult]:
        ...

    @property
    def supported_profiles(self) -> list[str]:
        ...

    @property
    def is_available(self) -> bool:
        ...

@dataclass
class ChatMessage:
    role: str  # system / user / assistant
    content: str

@dataclass
class ChatResult:
    content: str
    model: str
    is_mock: bool
    usage: dict  # tokens, cost 等

class ChatProvider(Protocol):
    async def chat(
        self,
        messages: list[ChatMessage],
        *,
        max_tokens: int = 1024,
        temperature: float = 0.7,
        stream: bool = False,
    ) -> ChatResult:
        ...

    @property
    def is_available(self) -> bool:
        ...

class SummarizationProvider(Protocol):
    async def summarize(self, text: str, *, max_length: int = 200) -> str:
        ...

class TagSuggestionProvider(Protocol):
    async def suggest_tags(
        self,
        content: str,
        *,
        existing_tags: list[str] = None,
        namespace: str = 'topic',
    ) -> list[str]:
        ...

class TextToSqlProvider(Protocol):
    async def plan_query(
        self,
        natural_language: str,
        schema_context: dict,
        *,
        scope: dict,
    ) -> dict:  # {sql, intent, why_this_query}
        ...

class RerankProvider(Protocol):
    async def rerank(
        self,
        query: str,
        candidates: list[dict],
        *,
        top_k: int = 10,
    ) -> list[dict]:
        ...
```

Node.js / TypeScript 项目可映射为同样的接口。

`CapabilityStatus.status` 是唯一权威状态，不再使用 `available: bool` 作为跨模块契约：

| status | 含义 | P0 行为 |
|---|---|---|
| available | 当前 provider/profile 可用 | 走真实 adapter |
| fallback | 当前能力使用 fallback profile 或规则实现 | 继续流程，但必须写 `fallback_reason` |
| unavailable | provider 缺失、模型未安装或运行时探测失败 | 保留文件/任务，进入可恢复状态 |
| disabled | 用户或策略禁用 | 不自动重试，提示配置入口 |
| error | provider 调用异常 | 根据 `recoverable` 判断重试或失败 |

`blocking=true` 表示没有该能力就不能继续当前阶段，例如无 parser 且格式无法内置解析；`blocking=false` 表示可以走 evidence-only、merge score 或 mock fallback 继续闭环。

### 4.2 Provider 注册与选择

应用启动时构建 provider registry：

```python
class ProviderRegistry:
    def get_parser_provider(self, *, mime_type: str, file_extension: str) -> ParserProvider:
        ...

    def get_ocr_provider(self) -> OcrProvider:
        ...

    def get_asr_provider(self) -> AsrProvider:
        ...

    def get_vision_provider(self) -> VisionProvider:
        ...

    def get_data_cleaning_provider(self) -> DataCleaningProvider:
        ...

    def get_sensitive_info_provider(self) -> SensitiveInfoProvider:
        ...

    def get_embedding_provider(self) -> EmbeddingProvider:
        # 按用户配置返回 provider
        # 默认按优先级：用户首选 → 备用 → mock
        ...

    def get_chat_provider(self) -> ChatProvider:
        ...

    def get_summarization_provider(self) -> SummarizationProvider:
        ...

    # ...

    def list_capabilities(self) -> list[CapabilityStatus]:
        # 返回 parser / OCR / ASR / chunking / structure recovery / embedding / rerank / LLM 等能力可用性
        ...
```

业务模块通过 registry 获取 provider，不直接依赖具体实现：

```python
async def create_source_description(source_id: str, text: str, registry: ProviderRegistry):
    summarizer = registry.get_summarization_provider()
    summary = await summarizer.summarize(text, max_length=200)
    # ...
```

### 4.3 Provider 实现矩阵

| Provider / Adapter | file inspect | parser | OCR | ASR | cleaning | embedding | chat | tag | text_to_sql | rerank | P0 口径 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| MagicDetectionProvider | ✓ | - | - | - | - | - | - | - | - | - | libmagic/python-magic；可 fallback |
| CharsetProvider | ✓ | - | - | - | - | - | - | - | - | - | charset-normalizer；chardet optional |
| StaticSecurityProvider | ✓ | - | - | - | - | - | - | - | - | - | qpdf/oletools/EXIF；不执行文件 |
| PreviewProvider | ✓ | - | - | - | - | - | - | - | - | - | Pillow/PyMuPDF/openpyxl/FFmpeg；可缺失 |
| BuiltInTextProvider | - | ✓ | - | - | - | - | - | - | - | - | P0 必备 |
| PyMuPDFProvider | ✓ | ✓ | - | - | - | - | - | - | - | - | P0 PDF 默认 |
| PdfplumberProvider | ✓ | ✓ | - | - | - | - | - | - | - | - | P0 表格默认 |
| TokenCountingProvider | - | - | - | - | - | - | - | - | - | - | tiktoken；缺失时规则估算 fallback |
| StructureRecoveryProvider | ✓ | ✓ | - | - | - | - | - | - | - | - | PyMuPDF/pdfplumber/openpyxl；P1 可接 python-docx/Unstructured/Tika/GROBID/BeautifulSoup/lxml |
| PaddleOCRProvider | - | - | ✓ | - | - | - | - | - | - | - | P0 开源优先，可缺失 |
| WhisperProvider | - | - | - | ✓ | - | - | - | - | - | - | P0 开源优先，可缺失 |
| PandasPanderaProvider | - | - | - | - | ✓ | - | - | - | - | - | P0 清洗默认 |
| KeyBERT / HanLP / spaCy | - | - | - | - | - | - | - | ✓ | - | - | P0 标签默认候选 |
| LocalEmbeddingProvider | - | - | - | - | - | ✓ | - | - | - | - | bge-m3 优先，可缺失 |
| MockProvider | - | - | - | - | - | ✓ | ✓ | ✓ | ✓ | ✓ | P0 最终降级 |
| RuleBasedProvider | ✓ | - | - | - | ✓ | - | - | ✓ | ✓ | - | P0 fallback |
| LocalLLMProvider | - | - | - | - | - | ✓ | ✓ | ✓ | ✓ | ✓ | P0/P1 可选本地 |
| OpenAIProvider | - | - | - | - | ✓ | ✓ | ✓ | ✓ | - | 商业可选 |
| AnthropicProvider | - | - | - | - | - | ✓ | ✓ | ✓ | - | 商业可选 |
| VoyageProvider | - | - | - | - | ✓ | - | - | - | - | 商业可选 |
| CohereProvider | - | - | - | - | - | - | - | - | ✓ | 商业可选 |

P0 必须实现能力注册、状态探测和 fallback contract；具体本地 / 开源 adapter 可以按安装环境逐步启用。禁止把 P0 降级为“只存在 MockProvider + RuleBasedProvider”的抽象空壳：文件解析、上传状态、清洗、Embedding、RAG fallback 都必须有可执行或可恢复的默认路径。

---

## 5. API Key 安全存储

### 5.1 存储方案

**绝对不允许**：

- 存储在 SQLite 数据库
- 存储在配置文件（`config.json` 等）
- 写入日志或崩溃报告
- 通过 IPC 明文传输到 Renderer

**正确方案**：使用操作系统级密钥管理服务。

| 平台 | 服务 | Node.js 库 | Python 库 |
|---|---|---|---|
| macOS | Keychain | `keytar` / `@napi-rs/keyring` | `keyring` |
| Windows | Credential Manager | `keytar` / `@napi-rs/keyring` | `keyring` |
| Linux | Secret Service / libsecret | `keytar` / `@napi-rs/keyring` | `keyring` |

推荐：Electron 主进程使用 `keytar` 或 `@napi-rs/keyring`（更现代），Python sidecar 使用 `keyring`。

### 5.2 存储约定

Keychain 中的 service / account 命名约定：

```text
service: com.knowledge-base.app
account: ai_provider:{provider_id}:{key_type}

例如：
- ai_provider:openai:api_key
- ai_provider:openai:org_id
- ai_provider:anthropic:api_key
- ai_provider:local_llm:endpoint  # 本地 LLM 通常不需要 key，但 endpoint 也存 keychain
```

### 5.3 Key 注入流程

```text
应用启动
→ Main Process 启动
→ Main Process 从 Keychain 读取所有已配置的 Provider Key
→ Main Process 启动 sidecar 时通过环境变量注入
   - OPENAI_API_KEY=sk-***
   - ANTHROPIC_API_KEY=sk-ant-***
   - LOCAL_LLM_ENDPOINT=http://localhost:11434
→ Sidecar 启动后立即读取环境变量并构建 provider 实例
→ 环境变量在 sidecar 进程内存中保留，不写入文件
→ Renderer 永远不接触原始 Key（只接收 "已配置 / 未配置" 状态）
```

### 5.4 用户配置流程

设置 → AI Providers → OpenAI 配置：

```text
1. 用户输入 API Key
2. Renderer 通过 IPC 发送到 Main Process（仅此一次明文）
3. Main Process 调用 keytar.setPassword 存储到 Keychain
4. Main Process 通过 IPC 通知 sidecar 重新加载 Key
5. Renderer 显示 "已配置"，但 Key 不再返回 Renderer
6. 用户后续只能看到 "已配置 / 修改 / 移除"，看不到原始 Key
```

### 5.5 Key 显示与编辑

UI 不直接显示已存储的 Key（即使脱敏）。用户修改 Key 时：

- 输入新 Key → 完全替换旧 Key
- 不提供 "查看当前 Key" 功能（防止屏幕录制 / 偷窥）
- 提供 "测试连接" 功能（用 Key 调用 provider 的 health endpoint）

### 5.6 卸载行为

用户卸载应用时：

- macOS / Linux：Keychain 中的 Key 默认保留（系统行为），用户可手动删除
- Windows：Credential Manager 同上
- 应用提供"完全清除数据"选项，包括清除 Keychain 条目

---

## 6. 网络降级策略

### 6.1 降级触发条件

| 条件 | 降级行为 |
|---|---|
| 用户在设置中禁用真实 AI | 强制使用 MockProvider |
| 网络不可达 | 降级为 MockProvider，UI 提示"当前离线" |
| Provider API Key 未配置 | 降级为 MockProvider，UI 提示"未配置 API Key" |
| Provider API 返回 401 / 403 | 降级 + UI 提示"Key 失效，请重新配置" |
| Provider API 返回 429（限流） | 退避重试 → 失败后降级 + UI 提示 |
| Provider API 超时 | 重试一次 → 失败后降级 |
| 用户设置成本上限触发 | 降级 + UI 提示"已达成本上限" |

### 6.2 降级用户感知

降级必须明显提示，不能静默：

- 检索结果的每条记录标注 `is_mock: true`
- Citation Preview 顶部条提示"当前为离线模式 / 降级模式"
- 设置 → AI Providers 显示每个 provider 的健康状态

### 6.3 降级与升级回切

网络恢复或 Key 重新配置后：

- 不自动回切已经降级的 in-flight 请求
- 新的请求自动使用真实 provider
- UI 提示"已恢复在线模式"

### 6.4 离线优先模式

用户可在设置中开启"离线优先"：

- 所有 AI 调用强制使用 MockProvider，即使网络可用
- 适合敏感数据场景或无网环境
- 切换到在线模式需要用户显式确认

---

## 7. 多 Provider 路由策略

### 7.1 用户级配置

设置 → AI Providers → 默认选择：

```text
默认 Parser Provider：[Built-in text / PyMuPDF / pdfplumber ▼]
默认 OCR Provider：[PaddleOCR（未安装时 disabled）▼]
默认 ASR Provider：[Whisper（未安装时 disabled）▼]
默认 Embedding Provider：[bge-m3 local / mock_fixed_384 fallback ▼]
默认 Chat Provider：[Local LLM / evidence-only fallback ▼]
默认 Summarization Provider：[Rule-based / Local LLM ▼]
默认 Tag Suggestion Provider：[KeyBERT + HanLP/spaCy / Rule-based ▼]
默认 Text-to-SQL Provider：[Template planner ▼]
默认 Rerank Provider：[bge-reranker-v2 / merge score fallback ▼]
```

### 7.2 项目级覆盖（P1+）

每个 Project 可以覆盖默认 provider：

```text
项目 "敏感研究" → 强制使用 LocalLLMProvider（不上云）
项目 "公开博客" → 使用默认（OpenAI）
```

实现方式：`projects.metadata_json` 增加 `ai_provider_overrides` 字段。

### 7.3 Agent 级覆盖（P1+）

Personal Agent 可以指定专属 provider：

```text
研究助手 Agent → Anthropic Claude
创作助手 Agent → OpenAI GPT-4o
```

实现方式：`agents.metadata_json` 增加 `provider_preferences` 字段。

### 7.4 自动 Fallback 链

每个能力配置 fallback 链：

```text
Embedding：
1. bge-m3 local profile
2. jina-embeddings-v3 或 bge-large-zh（可选）
3. OpenAI / VoyageAI（商业可选）
4. MockProvider `mock_fixed_384`（最终降级）

Chat：
1. LocalLLMProvider（Ollama / llama.cpp / vLLM）
2. OpenAI / Anthropic（商业可选）
3. evidence-only answer（最终降级，不伪造模型回答）

Parser：
1. Built-in text / Markdown
2. PyMuPDF / pdfplumber
3. Unstructured / Docling / Tika（可选）
4. `unsupported_parser` / `parser_unavailable`（最终可恢复失败）
```

Provider Registry 按链顺序尝试，失败则下一个。

---

## 8. 调用成本与速率统计

### 8.1 调用记录

每次真实 AI 调用记录到 `ai_call_logs`（P1 新增表）：

```text
ai_call_logs
├── id (uuid)
├── user_id (uuid)
├── provider (text)             -- openai / anthropic / local_llm
├── capability (text)            -- embedding / chat / summarization / ...
├── model (text)                 -- text-embedding-3-small / claude-3-5-sonnet / ...
├── input_tokens (integer)
├── output_tokens (integer)
├── cost_usd (numeric)
├── latency_ms (integer)
├── success (boolean)
├── error_message (text nullable)
├── related_object_type (text)   -- source / chunk / knowledge_unit / invocation_request
├── related_object_id (uuid)
└── created_at (timestamptz)
```

### 8.2 成本上限配置

设置 → AI Providers → 成本控制：

```text
每日成本上限：[$5.00] [无限制 □]
每月成本上限：[$50.00] [无限制 □]
单次调用 token 上限：[8000]
警告阈值：达到 80% 时弹出提示
```

### 8.3 速率限制

应用层速率限制（防止短时间内大量调用）：

```text
每分钟最多调用次数：[60]
并发调用数：[5]
```

### 8.4 用户可见的统计面板

设置 → AI Providers → 使用统计：

```text
今日：12 次调用，$0.34
本月：243 次调用，$8.21
本月按 Provider 分布：
  - OpenAI Embedding：156 次，$2.14
  - Anthropic Chat：87 次，$6.07
按 Capability 分布：
  - embedding：156 次
  - chat：62 次
  - summarization：25 次
```

---

## 9. P0 → P1 过渡路径

### 9.1 P0 阶段（开源优先 + fallback）

- 实现 ProviderRegistry、MockProvider、RuleBasedProvider 和本地 / 开源 Provider adapter contract
- P0 默认工具栈：libmagic/python-magic、charset-normalizer、qpdf/oletools/EXIF adapter、Pillow/PyMuPDF/openpyxl/FFmpeg preview、Built-in text/Markdown、PyMuPDF、pdfplumber、tiktoken/规则 token 估算、pandas、Pandera、KeyBERT、HanLP/spaCy、bge-m3、bge-reranker-v2；缺失时记录 `capability_status` 与 `fallback_reason`
- OCR / ASR / video / vision adapter 可随环境启用，缺失时进入 `ocr_unavailable` / `asr_unavailable` / recoverable parse warning
- 所有业务模块通过 ProviderRegistry 调用 AI 能力
- Keychain 集成用于可选商业 Provider，不阻塞 P0
- RAG Provider 缺失时返回 `evidence_only_answer`
- 调用侧 profile 必须写入 `provider_key`、`capability_status`、`fallback_reason`，但 `feedback_policy` 属于系统本地策略，不作为 Provider capability
- Query rewrite 缺失不必然是 fallback；当规则判断 `rewrite_status=not_needed` 时应记录为正常路径

### 9.2 P1.0：Embedding / Parser 质量增强

- 扩展本地 embedding profile（jina-embeddings-v3、E5-Mistral、bge-large-zh）
- 评估 OpenAI / VoyageAI（仅作为可选商业 embedding）
- 增强 Unstructured / Docling / LayoutParser / Detectron2 结构识别质量
- 评估 ClamAV daemon、Docker Sandbox、Camelot、Tabula、Polars、Video-LLaVA
- 暴露设置 UI（Embedding / Parser / OCR / ASR capability 状态）
- 实现网络降级
- 引入 `ai_call_logs` 表

### 9.3 P1.1：建库辅助 AI

- 实现 ChatProvider 接口（OpenAI + Anthropic）
- 实现 summarization、tag_suggestion 真实化
- 暴露完整 AI Provider 设置 UI
- 实现成本上限

### 9.4 P1.2：调用域 AI 增强

- 增强 RAG Answer with Citations 的质量评估和 provider 路由
- 实现真实 Text-to-SQL
- 评估 Vanna / LlamaIndex SQL / LangChain SQL Agent / DB-GPT，但仍必须通过只读 SQL 校验
- 商业 Provider 只作为可选适配

### 9.5 P1.3：高级能力

- 实现 Rerank Provider
- 实现 ku_extraction 自动抽取
- 实现 relation_suggestion
- 评估 LlamaIndex / LangChain / LangGraph 作为 adapter，不替代 P0 Evidence Pack 数据模型

### 9.6 P2：本地 LLM 优先

- 优化 LocalLLMProvider（Ollama / LM Studio 集成）
- 提供"离线优先"高级配置
- 评估 Apple MLX / Core ML 集成（macOS）

---

## 10. 评估与对比测试

### 10.1 P0 → P1 切换基线

每次启用一个新的真实 Provider，必须经过：

- mock baseline 数据集回归测试（同样输入下 mock vs 真实输出）
- 至少 50 条样本人工评估（标注：好 / 一般 / 差）
- 成本评估（每千次调用预计成本）
- 延迟评估（P50 / P95）

### 10.2 多 Provider 对比

P1+ 可同时启用多个 provider 做对比：

- A/B 测试模式：同样输入分别调用两个 provider，比较输出
- 用户可在 Citation Preview 中看到 "本次回答来自 Provider X，备选 Provider Y"

### 10.3 评估数据集

`docs/testing-strategy.md` 维护一份 AI 能力评估数据集：

- 50 条 Source Description 输入 + 期望摘要
- 100 条 KU 抽取场景 + 期望 KU
- 50 条检索查询 + 期望 KU 排名
- 30 条 RAG Answer 场景 + 期望引用

---

## 11. 安全与合规

### 11.1 数据发送策略

发送给 AI Provider 的内容必须：

- 不包含 `permission=do_not_share` 的 KU
- 不包含 `permission=sensitive` 的 KU（除非用户显式确认）
- 用户原文进入 prompt 前提示"本次调用将发送以下内容到 [Provider]"
- 提供"预览将发送内容"功能

### 11.2 Provider 服务条款

不同 Provider 有不同的数据使用政策（是否用于训练、是否保留）：

- 设置页面显示每个 Provider 的服务条款链接
- 默认勾选"OpenAI 不用于训练"等隐私选项（如 Provider 支持）
- 用户首次启用每个 Provider 时弹出条款摘要

### 11.3 出口管控（P2）

部分场景需要：

- 区分"完全本地"（仅 LocalLLM）和"允许云端"
- 项目级或文件夹级强制本地策略

---

## 12. 与其他文档的关系

```text
docs/ai-provider-architecture.md（本文档）
└── AI Provider 抽象、Key 存储、降级、成本、过渡路径

docs/desktop-architecture.md
└── §13 安全实践（Key 不入日志）+ §15 设置页面（AI Provider 配置）

docs/product-architecture.md
└── §4.0.1 AI 能力栈定位（Building AI / Invocation AI）

docs/data-model.md
└── §3.5 P1 扩展对象（ai_call_logs 由本文档定义）

docs/testing-strategy.md
└── AI 能力评估数据集和对比测试（被本文档 §10 引用）

docs/mvp-scope.md
└── P0 开源优先 Provider 与 fallback 边界（被本文档 §9.1 引用）
```

---

## 13. 当前结论

```text
P0：开源优先 ProviderRegistry；file inspection / parser / OCR / ASR / vision / cleaning / PII / embedding / rerank / LLM 能力都必须有 capability status 和 fallback contract
P0 默认：libmagic/python-magic + charset-normalizer + qpdf/oletools/EXIF + Pillow/PyMuPDF/openpyxl/FFmpeg preview + PyMuPDF/pdfplumber + pandas/Pandera + KeyBERT/HanLP/spaCy + bge-m3/bge-reranker-v2 optional；缺失时 mock / recoverable error / evidence-only fallback
P1.0：Embedding / parser / OCR / ASR 质量增强
P1.1：建库辅助 AI 质量增强（summarization + tag）
P1.2：调用域 AI 质量增强（RAG answer + text-to-sql）
P1.3：高级能力（rerank + extraction）
P2：本地 LLM 优先（Ollama / MLX / Core ML）

API Key：系统 Keychain，绝不入数据库或日志
降级策略：网络/Key/成本任一不可用 → 降级 mock + UI 提示
路由策略：用户级 → 项目级 → Agent 级 → fallback 链
```

抽象层在 P0 就位，P1 切换真实 AI 时不返工。
