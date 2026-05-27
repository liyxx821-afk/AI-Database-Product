import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import Uppy from "@uppy/core";
import {
  Archive,
  AlertCircle,
  Bookmark,
  Bot,
  Boxes,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Clipboard,
  Download,
  FileCheck,
  FileInput,
  FileText,
  Gauge,
  GitBranch,
  MessageSquare,
  RefreshCw,
  Search,
  Settings,
  Save,
  ThumbsDown,
  ThumbsUp,
  Upload,
  XCircle,
  Trash2,
  type LucideIcon
} from "lucide-react";
import type {
  CitationAnnotationListResponse,
  CitationAnnotationBatchRequest,
  CitationAnnotationBatchResponse,
  CitationAnnotationPatchRequest,
  CitationAnnotationRecord,
  CitationAnnotationRequest,
  CitationCompareResponse,
  EvidenceItemRecord,
  EvidencePackDetail,
  FeedbackDiagnosticsSummary,
  FeedbackEventRecord,
  FeedbackExportHistoryRecord,
  GraphPreviewResponse,
  KnowledgeExportHistoryRecord,
  FeedbackRequest,
  FileRecord,
  FolderRecord,
  AIModelSettingsResponse,
  AIModelTestResponse,
  KnowledgeRelationCreateRequest,
  KnowledgeRelationPatchRequest,
  KnowledgeRelationRecord,
  KnowledgeExportResponse,
  KnowledgeUnitRecord,
  MemoryDraftRecord,
  MemoryDraftRequest,
  ProjectRecord,
  ReviewTask,
  SourceRecord,
  TagRecord,
  TextToSqlPreviewResponse
} from "@knowledgebase-dev/api-types";
import { appIdentity, defaultRendererRoute } from "@knowledgebase-dev/shared-config";
import { uploadFile } from "../services/fileApi";
import { useRuntimeStore } from "../stores/runtimeStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useFileStore } from "../stores/fileStore";
import { useSourceStore } from "../stores/sourceStore";
import { useReviewStore } from "../stores/reviewStore";
import { useRetrievalStore } from "../stores/retrievalStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useFeedbackMemoryStore } from "../stores/feedbackMemoryStore";
import { useOrganizationStore } from "../stores/organizationStore";
import { useKnowledgeExportStore } from "../stores/exportsStore";
import { useTextToSqlStore } from "../stores/textToSqlStore";
import { useRelationsStore } from "../stores/relationsStore";
import { hasBridge } from "../services/apiClient";
import {
  deleteAIModelKey,
  getAIModelSettings,
  patchAIModelSettings,
  testAIModelSettings
} from "../services/settingsApi";
import {
  commitDemo1Ingestion,
  previewDemo1Ingestion,
  type Demo1IngestionResult as Demo1ApiIngestionResult
} from "../services/demo1Api";
import { listKnowledgeUnits } from "../services/knowledgeApi";
import type {
  FeedbackDiagnosticsFilters,
  FeedbackExportFormat,
  FeedbackRankingEffect,
  FeedbackSortOrder
} from "../services/feedbackMemoryApi";
import type {
  KnowledgeExportKind,
  KnowledgeUnitExportFormat
} from "../services/exportsApi";
import { resolveErrorCode } from "../utils/errors";
import { supportedLanguages, translate, type LanguageCode, type MessageKey } from "../services/i18n";
import type { UiState } from "../types/uiState";

type RouteKey =
  | "/dashboard"
  | "/demo1-ingestion"
  | "/import"
  | "/library"
  | "/search"
  | "/ask"
  | "/graph"
  | "/outputs"
  | "/settings";

type RouteConfig = {
  path: RouteKey;
  labelKey: MessageKey;
  icon: LucideIcon;
  summaryKey: MessageKey;
};

type UploadQueueItem = {
  id: string;
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  message: string;
  uploadId?: string;
  fileId?: string | null;
};

type DemoChunk = {
  chunkId: string;
  sourceId: string;
  chunkIndex: number;
  content: string;
  charCount: number;
  chunkType: "very_short_chunk" | "short_chunk" | "normal_chunk" | "long_chunk";
  startOffset: number;
  endOffset: number;
  chunkBasis: "semantic_clean_text" | "rule_clean_text";
};

type DemoCandidateKnowledgeUnit = {
  kuId: string;
  sourceId: string;
  chunkId: string;
  title: string;
  summary: string;
  keywords: string[];
  tags: string[];
  status: "pending";
  qualityNote: string;
  confidence: number;
  contentType: "very_short_text" | "short_note" | "paragraph_note" | "long_chunk";
};

type DemoIngestionResult = {
  apiResult: Demo1ApiIngestionResult;
  receivedFile: DemoReceivedFileRecord;
  source: DemoSourceRecord;
  metadata: {
    rawLength: number;
    cleanedLength: number;
    chunkCount: number;
    candidateKnowledgeUnitCount: number;
    parserKind: string;
    parserStatus: string;
    parserWarnings: string[];
    pageCount: number | null;
    imageCount: number | null;
    ocrModelName: string | null;
    parsedPageCount: number | null;
    ocrPageCount: number | null;
    skippedPageCount: number | null;
  };
  parsed: DemoParsedTextRecord;
  semanticParsing: DemoSemanticParsingRecord;
  ruleCleaning: DemoRuleCleaningRecord;
  semanticCleaning: DemoSemanticCleaningRecord;
  cleaning: DemoCleaningRecord;
  chunkBasis: "semantic_clean_text" | "rule_clean_text";
  chunks: DemoChunk[];
  candidateKnowledgeUnits: DemoCandidateKnowledgeUnit[];
  candidateKuMessage: string;
  pipelineStatuses: DemoPipelineStatus[];
  modelStatus: Demo1ApiIngestionResult["metadata"]["model_status"];
  modelName: string | null;
  modelErrorCode: string | null;
  modelErrorMessage: string | null;
  persisted: boolean;
  jobId: string | null;
  reviewTaskIds: string[];
  parserProfile: string;
  fileSizeBytes: number | null;
};

type DemoProcessingStatus = "idle" | "processing" | "committing" | "completed" | "error";

type DemoReceivedFileRecord = {
  fileName: string;
  inputType: "text" | "file";
  receivedAt: string;
  rawTextLength: number;
  processStatus: string;
  fileSizeBytes: number | null;
};

type DemoSourceRecord = {
  sourceId: string;
  fileName: string;
  inputType: "text" | "file";
  createdAt: string;
  status: string;
  rawTextLength: number;
  cleanTextLength: number;
  chunkCount: number;
  candidateKuCount: number;
};

type DemoParsedTextRecord = {
  content: string;
  status: "parsed";
  note: string;
};

type DemoCleaningRecord = {
  content: string;
  status: "cleaned";
  beforeCharCount: number;
  afterCharCount: number;
  note: string;
};

type DemoSemanticParsingRecord = {
  status: string;
  summary: string;
  titles: string[];
  paragraphNotes: string[];
  possibleToc: string[];
  citations: string[];
  noiseBlocks: string[];
};

type DemoRuleCleaningRecord = DemoCleaningRecord & {
  operations: string[];
};

type DemoSemanticCleaningRecord = DemoCleaningRecord & {
  cleaningReport: string;
  noiseFindings: string[];
  qualityScore: number;
  fallbackReason: string | null;
};

type DemoPipelineStatusKey =
  | "received"
  | "source_created"
  | "parsed"
  | "cleaned"
  | "chunked"
  | "candidate_generated"
  | "completed";

type DemoPipelineStatus = {
  key: DemoPipelineStatusKey;
  label: string;
  state: "done" | "loading" | "empty" | "error";
};

type FeedbackFilterValue = FeedbackRequest["feedback_type"] | "all";
type FeedbackTargetFilterValue = "evidence_pack" | "ai_answer" | "evidence_item" | "all";
type FeedbackRankingEffectFilterValue = FeedbackRankingEffect | "all";
type FeedbackCommentFilterValue = "all" | "with_comment" | "without_comment";

const routes: RouteConfig[] = [
  { path: "/dashboard", labelKey: "route.dashboard", icon: Gauge, summaryKey: "route.dashboard.summary" },
  {
    path: "/demo1-ingestion",
    labelKey: "route.demo1Ingestion",
    icon: FileText,
    summaryKey: "route.demo1Ingestion.summary"
  },
  { path: "/import", labelKey: "route.import", icon: Upload, summaryKey: "route.import.summary" },
  { path: "/library", labelKey: "route.library", icon: Archive, summaryKey: "route.library.summary" },
  { path: "/search", labelKey: "route.search", icon: Search, summaryKey: "route.search.summary" },
  { path: "/ask", labelKey: "route.ask", icon: MessageSquare, summaryKey: "route.ask.summary" },
  { path: "/graph", labelKey: "route.graph", icon: GitBranch, summaryKey: "route.graph.summary" },
  { path: "/outputs", labelKey: "route.outputs", icon: FileInput, summaryKey: "route.outputs.summary" },
  { path: "/settings", labelKey: "route.settings", icon: Settings, summaryKey: "route.settings.summary" }
];

const relationTypes: KnowledgeRelationCreateRequest["relation_type"][] = [
  "supports",
  "contradicts",
  "derived_from",
  "example_of",
  "part_of",
  "depends_on",
  "similar_to",
  "used_for",
  "updates",
  "replaces"
];

function currentPath(): RouteKey {
  const hashRoute = window.location.hash.startsWith("#/")
    ? (window.location.hash.slice(1) as RouteKey)
    : null;
  if (hashRoute && routes.some((route) => route.path === hashRoute)) return hashRoute;
  const path = window.location.pathname as RouteKey;
  return routes.some((route) => route.path === path) ? path : defaultRendererRoute;
}

export function App() {
  const [activePath, setActivePath] = useState<RouteKey>(currentPath());
  const runtime = useRuntimeStore();
  const workspace = useWorkspaceStore();
  const refreshOrganization = useOrganizationStore((state) => state.refresh);
  const refreshSettings = useSettingsStore((state) => state.refresh);
  const refreshMemories = useFeedbackMemoryStore((state) => state.refreshMemories);
  const t = useT();

  useEffect(() => {
    runtime.refresh();
    workspace.refresh();
    refreshOrganization();
    refreshSettings();
    refreshMemories();
  }, []);

  useEffect(() => {
    const syncRoute = () => setActivePath(currentPath());
    window.addEventListener("popstate", syncRoute);
    window.addEventListener("hashchange", syncRoute);
    return () => {
      window.removeEventListener("popstate", syncRoute);
      window.removeEventListener("hashchange", syncRoute);
    };
  }, []);

  const activeRoute = useMemo(
    () => routes.find((route) => route.path === activePath) ?? routes[0],
    [activePath]
  );

  function navigate(path: RouteKey) {
    setActivePath(path);
    if (window.location.protocol === "file:") {
      window.location.hash = path;
      return;
    }
    window.history.pushState(null, "", path);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <Boxes aria-hidden="true" size={22} />
          <div>
            <div className="brand-title">{appIdentity.appName}</div>
            <div className="brand-meta">{t("app.meta")}</div>
          </div>
        </div>
        <nav className="nav-list" aria-label={t("nav.label")}>
          {routes.map((route) => {
            const Icon = route.icon;
            const active = activePath === route.path;
            return (
              <button
                key={route.path}
                className={`nav-button ${active ? "is-active" : ""}`}
                title={t(route.summaryKey)}
                type="button"
                onClick={() => navigate(route.path)}
              >
                <Icon aria-hidden="true" size={18} />
                <span>{t(route.labelKey)}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="workspace">
        <header className="workspace-header">
          <div>
            <div className="route-path">{activeRoute.path}</div>
            <h1>{t(activeRoute.labelKey)}</h1>
            <p className="route-summary">{t(activeRoute.summaryKey)}</p>
          </div>
          <button className="icon-command" type="button" title={t("action.refresh")} onClick={() => runtime.refresh()}>
            <Bot aria-hidden="true" size={18} />
            <span>{t("action.refresh")}</span>
          </button>
        </header>
        <BridgeNotice />
        <RoutePanel path={activePath} />
      </main>

      <footer className="runtime-bar">
        <StatusPill label={t("status.bridge")} value={hasBridge() ? "available" : "degraded"} />
        <StatusPill
          label={t("status.runtime")}
          value={runtime.status?.runtime_state ?? (runtime.errorCode ? "degraded" : "loading")}
        />
        <StatusPill label={t("status.vector")} value={runtime.status?.vector.status ?? "unknown"} />
        <StatusPill label={t("status.workspace")} value={workspace.state} />
      </footer>
    </div>
  );
}

function useT() {
  const language = useSettingsStore((state) => state.language);
  return useMemo(
    () => (key: MessageKey, values?: Record<string, string | number>) => translate(language, key, values),
    [language]
  );
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="status-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const stateLabelKeys: Partial<Record<string, MessageKey>> = {
  available: "state.available",
  degraded: "state.degraded",
  done: "state.done",
  empty: "state.empty",
  loading: "state.loading",
  not_ready: "state.notReady",
  ready: "state.ready",
  recoverable_error: "state.recoverableError",
  unavailable: "state.unavailable",
  unknown: "state.unknown"
};

function StateChip({ state, label }: { state: string; label?: string }) {
  const t = useT();
  const key = stateLabelKeys[state];
  const safeStateClass = state.replace(/[^a-zA-Z0-9_-]/g, "_");
  return (
    <span className={`state-chip state-${safeStateClass}`} title={state}>
      {label ?? (key ? t(key) : state)}
    </span>
  );
}

function BridgeNotice() {
  const t = useT();
  if (hasBridge()) return null;
  return (
    <section className="workspace-notice state-degraded" aria-live="polite">
      <AlertCircle aria-hidden="true" size={16} />
      <div>
        <strong>{t("shell.bridgeDegradedTitle")}</strong>
        <span>{t("shell.bridgeDegradedBody")}</span>
      </div>
    </section>
  );
}

function RoutePanel({ path }: { path: RouteKey }) {
  const t = useT();
  switch (path) {
    case "/dashboard":
      return <DashboardPage />;
    case "/demo1-ingestion":
      return <DemoIngestionPage />;
    case "/import":
      return <ImportPage />;
    case "/library":
      return <LibraryPage />;
    case "/search":
      return <SearchPage />;
    case "/ask":
      return <AskPage />;
    case "/graph":
      return <GraphPage />;
    case "/outputs":
      return <OutputsPage />;
    case "/settings":
      return <SettingsPage />;
  }
}

function DemoIngestionPage() {
  const [inputText, setInputText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processingStatus, setProcessingStatus] = useState<DemoProcessingStatus>("idle");
  const [result, setResult] = useState<DemoIngestionResult | null>(null);
  const [demoErrorCode, setDemoErrorCode] = useState<string | null>(null);
  const [textMode, setTextMode] = useState(false);
  const [selectedFilePreviewUrl, setSelectedFilePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const inputCharCount = countTextChars(inputText);
  const canPreview = Boolean(inputText.trim() || selectedFile);
  const isBusy = processingStatus === "processing" || processingStatus === "committing";
  const sourceTags = collectDemoSourceTags(result);
  const currentSummary =
    result?.candidateKnowledgeUnits[0]?.summary ||
    result?.semanticParsing.summary ||
    "投入资料后，系统会在这里显示解析摘要、标签和候选知识。";
  const previewText =
    result?.parsed.content ||
    inputText ||
    "文件预览会在解析完成后显示。PDF 显示提取文本，图片和截图显示 OCR 文本。";
  const selectedFileKind = selectedFile ? getDemoFileKind(selectedFile) : null;
  const demoError = getDemoErrorDetails(demoErrorCode);
  const displayStatuses = productizeDemoPipelineStatuses(
    result?.pipelineStatuses ?? createDemoPipelineStatuses(processingStatus),
    processingStatus
  );

  useEffect(() => {
    if (!selectedFile || !selectedFile.type.startsWith("image/")) {
      setSelectedFilePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setSelectedFilePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  async function processText() {
    const rawText = inputText;
    setProcessingStatus("processing");
    setDemoErrorCode(null);
    try {
      const apiResult = selectedFile
        ? await previewDemo1Ingestion({
            file_name: selectedFile.name,
            input_type: "file",
            file_content_base64: await fileToBase64(selectedFile),
            content_type: selectedFile.type || "application/octet-stream",
            project_id: "default-space"
          })
        : await previewDemo1Ingestion({
            file_name: createDemoFileName(),
            input_type: "text",
            raw_text: rawText,
            project_id: "default-space"
          });
      setResult(mapDemoApiResult(apiResult));
      setProcessingStatus("completed");
    } catch (error) {
      setDemoErrorCode(resolveErrorCode(error, "demo1_preview_failed"));
      setProcessingStatus("error");
    }
  }

  function setFileForDemo(file: File | null) {
    setSelectedFile(file);
    if (file) {
      setInputText("");
      setTextMode(false);
    }
    setResult(null);
    setDemoErrorCode(null);
    setProcessingStatus("idle");
  }

  function handleDemoFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFileForDemo(event.target.files?.[0] ?? null);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setFileForDemo(event.dataTransfer.files?.[0] ?? null);
  }

  async function commitResult() {
    if (!result || result.persisted || !result.candidateKnowledgeUnits.length) return;
    setProcessingStatus("committing");
    setDemoErrorCode(null);
    try {
      const committed = await commitDemo1Ingestion(result.apiResult);
      setResult(mapDemoApiResult(committed));
      setProcessingStatus("completed");
    } catch (error) {
      setDemoErrorCode(resolveErrorCode(error, "demo1_commit_failed"));
      setProcessingStatus("error");
    }
  }

  return (
    <section className="demo-product-shell">
      <section className="demo-product-hero">
        <div className="demo-product-title">
          <span className="mini-badge">Demo 1</span>
          <h2>投入资料 / Source Ingestion</h2>
          <p>
            资料进入系统后，会完成来源记录、内容解析、文本清洗、知识切片和
            pending Candidate KU 生成。模型调用在后端完成，前端不保存 API Key。
          </p>
        </div>

        <div
          className="demo-source-drop"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept=".txt,.text,.md,.markdown,.csv,.tsv,.json,.log,.html,.htm,.pdf,.png,.jpg,.jpeg,.webp,.bmp,text/*,application/json,application/pdf,image/png,image/jpeg,image/webp,image/bmp"
            onChange={handleDemoFileChange}
          />
          <div className="demo-source-cloud">
            <div className="demo-source-core">
              <strong>投入第一份资料</strong>
              <span>Add your first source</span>
              <div className="demo-source-actions">
                <button
                  className="icon-command"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload aria-hidden="true" size={16} />
                  <span>投入资料 Add source</span>
                </button>
                <button
                  className="icon-command"
                  type="button"
                  onClick={() => {
                    setTextMode(true);
                    setSelectedFile(null);
                    setResult(null);
                    setDemoErrorCode(null);
                  }}
                >
                  <FileText aria-hidden="true" size={16} />
                  <span>写下一个想法 Capture an idea</span>
                </button>
              </div>
            </div>
          </div>
          <p className="demo-privacy-note">你的资料仅你看见，已加密保存</p>
          <p className="section-note">支持文本、PDF、图片和截图。也可以把文件拖到这里。</p>
        </div>

        {(textMode || inputText || selectedFile) && (
          <div className="demo-source-compose">
            {selectedFile ? (
              <div className="inline-actions">
                <StatusPill label="file_name" value={selectedFile.name} />
                <StatusPill label="file_size" value={formatBytes(selectedFile.size)} />
                <StatusPill label="file_type" value={selectedFile.type || "unknown"} />
                <StatusPill label="parser" value={selectedFileKind?.parserKind ?? "unknown"} />
                <button className="icon-command" type="button" onClick={() => setFileForDemo(null)}>
                  <XCircle aria-hidden="true" size={16} />
                  <span>清除文件</span>
                </button>
              </div>
            ) : (
              <textarea
                className="memory-textarea demo-textarea"
                value={inputText}
                placeholder="粘贴一段笔记、对话或研究摘录。"
                onChange={(event) => setInputText(event.target.value)}
              />
            )}
            <div className="inline-actions">
              <StatusPill label="处理状态" value={formatDemoStatus(processingStatus)} />
              <StatusPill label="当前字数" value={String(inputCharCount)} />
              <StatusPill label="模型状态" value={result?.modelStatus ?? "not_ready"} />
              <button
                className="icon-command"
                type="button"
                disabled={!canPreview || isBusy}
                onClick={processText}
              >
                <FileInput aria-hidden="true" size={16} />
                <span>预处理预览 Preview</span>
              </button>
            </div>
          </div>
        )}

        {demoErrorCode ? (
          <div className="row-note demo-error-note">
            <AlertCircle aria-hidden="true" size={15} />
            <span>
              {demoError.title}：{demoError.description}
            </span>
            {["demo1_ocr_model_unconfigured", "demo1_model_unconfigured"].includes(demoErrorCode) ? (
              <a className="icon-command" href="/settings">
                <Settings aria-hidden="true" size={15} />
                <span>去配置模型</span>
              </a>
            ) : null}
          </div>
        ) : null}
        {result?.modelErrorCode ? (
          <div className="row-note demo-error-note">
            <AlertCircle aria-hidden="true" size={15} />
            <span>
              {result.modelErrorCode}: {result.modelErrorMessage}
            </span>
          </div>
        ) : null}
      </section>

      <section className="demo-product-flow page-frame">
        <div className="section-title-row">
          <div>
            <h2>资料流 / Source Flow</h2>
            <p className="section-note">从资料进入系统到生成待确认候选知识。</p>
          </div>
          <StateChip state={processingStatus === "error" ? "error" : result ? "done" : "empty"} />
        </div>
        <div className="demo-flow-lane">
          {displayStatuses.map((status, index) => (
            <article className={`demo-flow-node is-${status.state}`} key={status.key}>
              <span>{index + 1}</span>
              <strong>{status.label}</strong>
              <small>{status.key}</small>
            </article>
          ))}
        </div>
      </section>

      <aside className="demo-current-file">
        <div className="section-title-row">
          <div>
            <h2>当前文件</h2>
            <p>Current file</p>
          </div>
          <StateChip state={result ? "done" : selectedFile || inputText ? "ready" : "empty"} />
        </div>
        <div className="demo-current-file-head">
          <FileCheck aria-hidden="true" size={34} />
          <div>
            <strong>{result?.receivedFile.fileName ?? selectedFile?.name ?? "尚未投入资料"}</strong>
            <span>
              {selectedFile?.type || result?.metadata.parserKind || "No source selected"}
            </span>
          </div>
        </div>
        <div className="tag-select-row">
          {sourceTags.length ? (
            sourceTags.map((tag) => (
              <span className="mini-badge" key={tag}>
                {tag}
              </span>
            ))
          ) : (
            <span className="mini-badge">等待标签</span>
          )}
        </div>
        <article className="demo-current-card">
          <h3>摘要 Summary</h3>
          <p>{currentSummary}</p>
        </article>
        <article className="demo-current-card">
          <h3>处理状态 Processing</h3>
          <div className="demo-current-metrics">
            <StatusPill label="parser" value={result?.metadata.parserKind ?? "not_ready"} />
            <StatusPill
              label="status"
              value={result?.metadata.parserStatus ?? (demoErrorCode ? demoError.title : formatDemoStatus(processingStatus))}
            />
            <StatusPill label="chunks" value={String(result?.metadata.chunkCount ?? 0)} />
            <StatusPill label="candidate KU" value={String(result?.metadata.candidateKnowledgeUnitCount ?? 0)} />
            {result?.metadata.pageCount != null ? (
              <StatusPill label="pages" value={String(result.metadata.pageCount)} />
            ) : null}
            {result?.metadata.ocrModelName ? (
              <StatusPill label="OCR" value={result.metadata.ocrModelName} />
            ) : null}
            {result?.metadata.parsedPageCount != null ? (
              <StatusPill label="parsed pages" value={String(result.metadata.parsedPageCount)} />
            ) : null}
            {result?.metadata.ocrPageCount != null ? (
              <StatusPill label="OCR pages" value={String(result.metadata.ocrPageCount)} />
            ) : null}
            {result?.metadata.skippedPageCount != null ? (
              <StatusPill label="skipped pages" value={String(result.metadata.skippedPageCount)} />
            ) : null}
          </div>
        </article>
        <article className="demo-current-card">
          <h3>文件预览 File Preview</h3>
          {selectedFilePreviewUrl ? (
            <img className="demo-file-preview-image" src={selectedFilePreviewUrl} alt={selectedFile?.name ?? "uploaded image"} />
          ) : selectedFile && !result ? (
            <p className="section-note">
              {selectedFileKind?.description ?? "已选择文件，点击预处理后显示解析文本。"}
            </p>
          ) : null}
          <pre>{previewText.slice(0, 900)}</pre>
        </article>
        <div className="demo-current-actions">
          <button className="icon-command" type="button" onClick={() => scrollToDemoSection("demo-parsed")}>
            查看解析文本
          </button>
          <button className="icon-command" type="button" onClick={() => scrollToDemoSection("demo-candidates")}>
            查看候选知识
          </button>
          <button className="icon-command" type="button" onClick={() => scrollToDemoSection("demo-details")}>
            查看处理详情
          </button>
          <button
            className="icon-command"
            type="button"
            disabled={!result || result.persisted || !result.candidateKnowledgeUnits.length || isBusy}
            onClick={commitResult}
          >
            <Save aria-hidden="true" size={16} />
            <span>确认写入本地库</span>
          </button>
        </div>
      </aside>

      <section className="demo-product-main">
        <section className="page-frame" id="demo-candidates">
          <div className="section-title-row">
            <div>
              <h2>待确认知识 / Candidate KU</h2>
              <p className="section-note">
                Candidate KU 是基于 chunk 自动提出的候选材料，后续进入 Demo 2 做结构化和人工确认。
              </p>
            </div>
            <StateChip state={result?.candidateKnowledgeUnits.length ? "done" : "empty"} />
          </div>
          <div className="demo-ku-card-grid">
            {result?.candidateKnowledgeUnits.length ? (
              result.candidateKnowledgeUnits.map((unit) => (
                <article className="demo-ku-card" key={unit.kuId}>
                  <div className="section-title-row compact-title-row">
                    <h3>{unit.title}</h3>
                    <StateChip state="loading" label={unit.status} />
                  </div>
                  <p>{unit.summary}</p>
                  <div className="tag-select-row">
                    {unit.keywords.map((keyword) => (
                      <span className="mini-badge" key={`${unit.kuId}-${keyword}`}>
                        {keyword}
                      </span>
                    ))}
                    {unit.tags.map((tag) => (
                      <span className="mini-badge" key={`${unit.kuId}-${tag}`}>
                        {tag.startsWith("#") ? tag : `#${tag}`}
                      </span>
                    ))}
                  </div>
                  <div className="demo-ku-trace">
                    <StatusPill label="confidence" value={unit.confidence.toFixed(2)} />
                    <StatusPill label="content_type" value={unit.contentType} />
                    <StatusPill label="chunk_id" value={unit.chunkId} />
                  </div>
                  <p className="section-note">{unit.qualityNote}</p>
                </article>
              ))
            ) : (
              <EmptyState message="预处理后，这里会显示待确认候选知识。" />
            )}
          </div>
        </section>

        <section className="page-frame" id="demo-parsed">
          <div className="section-title-row">
            <h2>解析文本 / Parsed Text</h2>
            {result ? <StateChip state="done" label={result.semanticParsing.status} /> : null}
          </div>
          {result?.parsed.content ? (
            <>
              <p className="section-note">{result.parsed.note}</p>
              <article className="panel">
                <h3>模型解析摘要</h3>
                <p>{result.semanticParsing.summary}</p>
              </article>
              <pre className="demo-original-text">{result.parsed.content}</pre>
            </>
          ) : (
            <EmptyState message="尚未处理文本。" />
          )}
        </section>

        <section className="page-frame" id="demo-details">
          <div className="section-title-row">
            <h2>处理详情 / Technical Details</h2>
          </div>
          <details className="demo-detail-block" open={Boolean(result)}>
            <summary>Source 与 metadata</summary>
            {result ? (
              <div className="panel-grid">
                <Metric label="raw_text_length" value={result.metadata.rawLength} />
                <Metric label="clean_text_length" value={result.metadata.cleanedLength} />
                <Metric label="chunk_count" value={result.metadata.chunkCount} />
                <Metric label="candidate_ku_count" value={result.metadata.candidateKnowledgeUnitCount} />
                <StatusPill label="source_id" value={result.source.sourceId} />
                <StatusPill label="parser_profile" value={result.parserProfile} />
                <StatusPill label="chunk_basis" value={result.chunkBasis} />
                <StatusPill label="model" value={`${result.modelName ?? "not_configured"} / ${result.modelStatus}`} />
                <ListPanel title="解析警告" items={result.metadata.parserWarnings} empty="未返回解析警告。" />
              </div>
            ) : (
              <EmptyState message="尚未生成 metadata。" />
            )}
          </details>
          <details className="demo-detail-block">
            <summary>规则清洗与语义清洗</summary>
            {result?.cleaning.content ? (
              <>
                <div className="panel-grid">
                  <article className="panel">
                    <h3>规则清洗</h3>
                    <p>{result.ruleCleaning.note}</p>
                    <p>{result.ruleCleaning.operations.join(", ")}</p>
                  </article>
                  <article className="panel">
                    <h3>模型语义清洗</h3>
                    <p>{result.semanticCleaning.cleaningReport}</p>
                    <p>quality_score: {result.semanticCleaning.qualityScore.toFixed(2)}</p>
                  </article>
                </div>
                <pre className="demo-original-text">{result.cleaning.content}</pre>
              </>
            ) : (
              <EmptyState message="尚未生成清洗文本。" />
            )}
          </details>
          <details className="demo-detail-block">
            <summary>Chunk 列表</summary>
            <div className="file-table">
              {result?.chunks.length ? (
                result.chunks.map((chunk) => (
                  <article className="demo-chunk-row" key={chunk.chunkId}>
                    <div className="section-title-row compact-title-row">
                      <h3>{chunk.chunkId}</h3>
                      <div className="inline-actions">
                        <StatusPill label="source_id" value={chunk.sourceId} />
                        <StatusPill label="index" value={String(chunk.chunkIndex)} />
                        <StatusPill label="chars" value={String(chunk.charCount)} />
                        <StatusPill label="basis" value={chunk.chunkBasis} />
                      </div>
                    </div>
                    <p>{chunk.content}</p>
                  </article>
                ))
              ) : (
                <EmptyState message="尚未生成 chunk。" />
              )}
            </div>
          </details>
        </section>
      </section>
    </section>
  );
}

function mapDemoApiResult(apiResult: Demo1ApiIngestionResult): DemoIngestionResult {
  return {
    apiResult,
    receivedFile: {
      fileName: apiResult.received_file.file_name,
      inputType: apiResult.received_file.input_type,
      receivedAt: apiResult.received_file.received_at,
      rawTextLength: apiResult.received_file.raw_text_length,
      processStatus: apiResult.received_file.process_status,
      fileSizeBytes: apiResult.received_file.file_size_bytes
    },
    source: {
      sourceId: apiResult.source.source_id,
      fileName: apiResult.source.file_name,
      inputType: apiResult.source.input_type,
      createdAt: apiResult.source.created_at,
      status: apiResult.source.status,
      rawTextLength: apiResult.source.raw_text_length,
      cleanTextLength: apiResult.source.clean_text_length,
      chunkCount: apiResult.source.chunk_count,
      candidateKuCount: apiResult.source.candidate_ku_count
    },
    metadata: {
      rawLength: apiResult.metadata.raw_length,
      cleanedLength: apiResult.metadata.cleaned_length,
      chunkCount: apiResult.metadata.chunk_count,
      candidateKnowledgeUnitCount: apiResult.metadata.candidate_ku_count,
      parserKind: apiResult.metadata.parser_kind,
      parserStatus: apiResult.metadata.parser_status,
      parserWarnings: apiResult.metadata.parser_warnings,
      pageCount: apiResult.metadata.page_count,
      imageCount: apiResult.metadata.image_count,
      ocrModelName: apiResult.metadata.ocr_model_name,
      parsedPageCount: apiResult.metadata.parsed_page_count,
      ocrPageCount: apiResult.metadata.ocr_page_count,
      skippedPageCount: apiResult.metadata.skipped_page_count
    },
    parsed: {
      content: apiResult.parsed.content,
      status: "parsed",
      note: apiResult.parsed.note
    },
    semanticParsing: {
      status: apiResult.semantic_parsing.status,
      summary: apiResult.semantic_parsing.summary,
      titles: apiResult.semantic_parsing.titles,
      paragraphNotes: apiResult.semantic_parsing.paragraph_notes,
      possibleToc: apiResult.semantic_parsing.possible_toc,
      citations: apiResult.semantic_parsing.citations,
      noiseBlocks: apiResult.semantic_parsing.noise_blocks
    },
    ruleCleaning: {
      content: apiResult.rule_cleaning.content,
      status: "cleaned",
      beforeCharCount: apiResult.rule_cleaning.before_char_count,
      afterCharCount: apiResult.rule_cleaning.after_char_count,
      note: apiResult.rule_cleaning.note,
      operations: apiResult.rule_cleaning.operations
    },
    semanticCleaning: {
      content: apiResult.semantic_cleaning.content,
      status: "cleaned",
      beforeCharCount: apiResult.semantic_cleaning.before_char_count,
      afterCharCount: apiResult.semantic_cleaning.after_char_count,
      note: apiResult.semantic_cleaning.note,
      cleaningReport: apiResult.semantic_cleaning.cleaning_report,
      noiseFindings: apiResult.semantic_cleaning.noise_findings,
      qualityScore: apiResult.semantic_cleaning.quality_score,
      fallbackReason: apiResult.semantic_cleaning.fallback_reason
    },
    cleaning: {
      content: apiResult.cleaning.content,
      status: "cleaned",
      beforeCharCount: apiResult.cleaning.before_char_count,
      afterCharCount: apiResult.cleaning.after_char_count,
      note: apiResult.cleaning.note
    },
    chunkBasis: apiResult.chunk_basis,
    chunks: apiResult.chunks.map((chunk) => ({
      chunkId: chunk.chunk_id,
      sourceId: chunk.source_id,
      chunkIndex: chunk.chunk_index,
      content: chunk.content,
      charCount: chunk.char_count,
      chunkType: chunk.chunk_type,
      startOffset: chunk.start_offset,
      endOffset: chunk.end_offset,
      chunkBasis: chunk.chunk_basis
    })),
    candidateKnowledgeUnits: apiResult.candidate_knowledge_units.map((unit) => ({
      kuId: unit.ku_id,
      sourceId: unit.source_id,
      chunkId: unit.chunk_id,
      title: unit.title,
      summary: unit.summary,
      keywords: unit.keywords,
      tags: unit.tags,
      status: unit.status,
      qualityNote: unit.quality_note,
      confidence: unit.confidence,
      contentType: unit.content_type
    })),
    candidateKuMessage: apiResult.candidate_ku_message,
    pipelineStatuses: apiResult.pipeline_statuses.map((status) => ({
      key: status.key as DemoPipelineStatusKey,
      label: status.label,
      state: status.state
    })),
    modelStatus: apiResult.metadata.model_status,
    modelName: apiResult.metadata.model_name,
    modelErrorCode: apiResult.model_error_code,
    modelErrorMessage: apiResult.model_error_message,
    persisted: apiResult.persisted,
    jobId: apiResult.job_id,
    reviewTaskIds: apiResult.review_task_ids,
    parserProfile: apiResult.metadata.parser_profile,
    fileSizeBytes: apiResult.metadata.file_size_bytes
  };
}

function ListPanel({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <article className="panel">
      <h3>{title}</h3>
      {items.length ? (
        <ul className="compact-list">
          {items.map((item) => (
            <li key={`${title}-${item}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>{empty}</p>
      )}
    </article>
  );
}

function cleanDemoText(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[�]+/g, "")
    .replace(/锟斤拷/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitTextIntoDemoChunks(text: string, sourceId: string): DemoChunk[] {
  if (!text.trim()) return [];
  const maxChunkChars = 400;
  const overlapChars = 50;
  const chars = Array.from(text);
  const chunks: DemoChunk[] = [];
  let start = 0;
  let index = 1;

  while (start < chars.length) {
    const end = Math.min(start + maxChunkChars, chars.length);
    const content = chars.slice(start, end).join("");
    if (content) {
      const charCount = countTextChars(content);
      chunks.push({
        chunkId: `${sourceId}-chunk-${String(index).padStart(3, "0")}`,
        sourceId,
        chunkIndex: index,
        content,
        charCount,
      chunkType: getDemoChunkType(charCount),
      startOffset: start,
      endOffset: end,
      chunkBasis: "rule_clean_text"
    });
      index += 1;
    }
    if (end >= chars.length) break;
    start = Math.max(end - overlapChars, start + 1);
  }

  return chunks;
}

function getDemoChunkType(charCount: number): DemoChunk["chunkType"] {
  if (charCount <= 12) return "very_short_chunk";
  if (charCount < 80) return "short_chunk";
  if (charCount < 320) return "normal_chunk";
  return "long_chunk";
}

function createDemoCandidateKnowledgeUnit(chunk: DemoChunk, index: number): DemoCandidateKnowledgeUnit {
  const contentType = getDemoContentType(chunk.charCount);
  const keywords = contentType === "very_short_text" ? [] : extractDemoKeywords(chunk.content);
  const titleSeed = createDemoTitleSeed(chunk.content, keywords, index);
  return {
    kuId: `${chunk.sourceId}-candidate-ku-${String(index + 1).padStart(3, "0")}`,
    sourceId: chunk.sourceId,
    chunkId: chunk.chunkId,
    title: `候选 KU：${titleSeed}`,
    summary: createDemoSummary(chunk.content, contentType),
    keywords,
    tags: createDemoTags(keywords, contentType),
    status: "pending",
    qualityNote: createDemoQualityNote(contentType),
    confidence: createDemoConfidence(contentType),
    contentType
  };
}

function getDemoContentType(charCount: number): DemoCandidateKnowledgeUnit["contentType"] {
  if (charCount <= 12) return "very_short_text";
  if (charCount < 80) return "short_note";
  if (charCount < 320) return "paragraph_note";
  return "long_chunk";
}

function createDemoTitleSeed(text: string, keywords: string[], index: number) {
  if (keywords.length) return keywords.slice(0, 3).join(" / ");
  const compact = text.replace(/\s+/g, "").replace(/[，。！？；：,.!?;:]/g, "");
  if (compact.length >= 16) return compact.slice(0, 12);
  if (compact.length) return `短文本候选 ${index + 1}`;
  return `chunk ${index + 1} 候选材料`;
}

function extractDemoKeywords(text: string) {
  const stopwords = new Set([
    "一个",
    "这个",
    "那个",
    "进行",
    "需要",
    "可以",
    "系统",
    "文本",
    "生成",
    "显示",
    "当前",
    "Demo",
    "demo",
    "and",
    "the",
    "for",
    "with",
    "text"
  ]);
  const domainTerms = [
    "艺术史",
    "文艺复兴",
    "现代主义",
    "印象派",
    "构成主义",
    "视觉文化",
    "图像学",
    "空间",
    "媒介",
    "风格",
    "形式",
    "创作",
    "图像",
    "叙事",
    "材料",
    "历史"
  ];
  const normalized = text.replace(/[，。！？；：,.!?;:()[\]{}"'“”‘’]/g, " ");
  const asciiTokens = normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => /^[a-zA-Z0-9_-]{3,24}$/.test(token) && !stopwords.has(token));
  const termHits = domainTerms.filter((term) => text.includes(term));
  const cjkSegments = Array.from(text.matchAll(/[\u4e00-\u9fa5]{2,4}/g))
    .map((match) => match[0])
    .filter((token) => !stopwords.has(token) && !/^(我是|一个|大学|学生|这个|那个)$/.test(token));
  const frequency = new Map<string, number>();
  for (const token of [...termHits, ...cjkSegments, ...asciiTokens]) {
    frequency.set(token, (frequency.get(token) ?? 0) + 1);
  }
  return Array.from(frequency.entries())
    .sort((left, right) => right[1] - left[1] || right[0].length - left[0].length)
    .map(([token]) => token)
    .slice(0, 5);
}

function createDemoTags(
  _keywords: string[],
  contentType: DemoCandidateKnowledgeUnit["contentType"]
) {
  const topicTags = contentType === "paragraph_note" || contentType === "long_chunk"
    ? _keywords.slice(0, 2).filter((keyword) => countTextChars(keyword) <= 12)
    : [];
  return Array.from(new Set(["demo1", "入库预处理", "candidate-ku", "pending", ...topicTags]));
}

function createDemoSummary(text: string, contentType: DemoCandidateKnowledgeUnit["contentType"]) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (contentType === "very_short_text") {
    return "这是一条极短文本，可作为候选材料进入人工判断，但当前语义信息有限。";
  }
  if (contentType === "short_note") {
    return `这是一条简短笔记，主要表达：${normalized.slice(0, 36)}${normalized.length > 36 ? "..." : ""}`;
  }
  if (contentType === "paragraph_note") {
    return `这是一段普通段落候选材料，包含可供后续结构化分析的主题线索：${normalized.slice(0, 72)}${normalized.length > 72 ? "..." : ""}`;
  }
  return `这是一段较长 chunk，包含多句内容，适合在后续流程中继续拆解、抽取实体关系和匹配 schema：${normalized.slice(0, 72)}...`;
}

function createDemoQualityNote(contentType: DemoCandidateKnowledgeUnit["contentType"]) {
  if (contentType === "very_short_text") return "信息密度较低，建议人工判断是否保留。";
  if (contentType === "short_note") return "可作为候选材料进入后续确认流程。";
  return "可进入后续结构化流程。";
}

function createDemoConfidence(contentType: DemoCandidateKnowledgeUnit["contentType"]) {
  if (contentType === "very_short_text") return 0.3;
  if (contentType === "short_note") return 0.45;
  if (contentType === "paragraph_note") return 0.68;
  return 0.8;
}

function createDemoFileName() {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0")
  ].join("");
  return `demo1-text-input-${stamp}.txt`;
}

async function fileToBase64(file: File) {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function createDemoId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatDemoStatus(status: DemoProcessingStatus) {
  if (status === "processing") return "处理中";
  if (status === "committing") return "写入中";
  if (status === "completed") return "完成";
  if (status === "error") return "处理失败";
  return "等待输入";
}

function createDemoPipelineStatuses(status: DemoProcessingStatus): DemoPipelineStatus[] {
  const steps: Array<{ key: DemoPipelineStatusKey; label: string }> = [
    { key: "received", label: "已接收资料" },
    { key: "source_created", label: "已创建来源记录" },
    { key: "parsed", label: "已解析内容" },
    { key: "cleaned", label: "已清洗文本" },
    { key: "chunked", label: "已切分片段" },
    { key: "candidate_generated", label: "已生成候选知识" },
    { key: "completed", label: "预处理完成" }
  ];
  if (status === "completed") {
    return steps.map((step) => ({ ...step, state: "done" }));
  }
  if (status === "processing") {
    return steps.map((step, index) => ({
      ...step,
      state: index === 0 ? "loading" : "empty"
    }));
  }
  if (status === "committing") {
    return steps.map((step) => ({
      ...step,
      state: step.key === "completed" ? "loading" : "done"
    }));
  }
  if (status === "error") {
    return steps.map((step, index) => ({
      ...step,
      state: index === 0 ? "error" : "empty"
    }));
  }
  return steps.map((step) => ({ ...step, state: "empty" }));
}

function productizeDemoPipelineStatuses(
  statuses: DemoPipelineStatus[],
  processingStatus: DemoProcessingStatus
): DemoPipelineStatus[] {
  const labels: Record<DemoPipelineStatusKey, string> = {
    received: "已接收资料",
    source_created: "已创建来源记录",
    parsed: "已解析内容",
    cleaned: "已清洗文本",
    chunked: "已切分片段",
    candidate_generated: "已生成候选知识",
    completed: processingStatus === "committing" ? "正在写入本地库" : "预处理完成"
  };

  return statuses.map((item) => ({
    ...item,
    label: labels[item.key] ?? item.label
  }));
}

function collectDemoSourceTags(result: DemoIngestionResult | null) {
  if (!result) return [];
  const tags = result.candidateKnowledgeUnits.flatMap((unit) => unit.tags);
  const keywords = result.candidateKnowledgeUnits.flatMap((unit) => unit.keywords);
  return Array.from(new Set([...tags, ...keywords].filter(Boolean))).slice(0, 6);
}

function scrollToDemoSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function getDemoFileKind(file: File) {
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  if (["png", "jpg", "jpeg", "webp", "bmp"].includes(extension) || file.type.startsWith("image/")) {
    return {
      parserKind: "image_ocr",
      description: "图片 / 截图将由后端调用 qwen-vl-ocr-latest 做 OCR，再进入清洗、chunk 和 Candidate KU。"
    };
  }
  if (extension === "pdf" || file.type === "application/pdf") {
    return {
      parserKind: "pdf_text / pdf_ocr",
      description: "PDF 会先用 PyMuPDF 提取可复制文本；扫描页会渲染为图片并调用 OCR。"
    };
  }
  if (["html", "htm"].includes(extension)) {
    return {
      parserKind: "html_text",
      description: "HTML 文件会在后端去除标签、脚本和样式后提取正文。"
    };
  }
  return {
    parserKind: "text_file",
    description: "文本类文件会在后端按纯文本解析，再进入完整预处理链路。"
  };
}

function getDemoErrorDetails(errorCode: string | null) {
  const details: Record<string, { title: string; description: string }> = {
    demo1_ocr_model_unconfigured: {
      title: "OCR 模型未配置",
      description: "图片、截图或扫描 PDF 需要后端进程配置 DashScope API Key 后才能解析。"
    },
    demo1_model_unconfigured: {
      title: "语义模型未配置",
      description: "Candidate KU 需要后端进程配置 DashScope API Key；不会生成假候选知识。"
    },
    demo1_pdf_ocr_empty_text: {
      title: "PDF 未识别到文字",
      description: "PDF 文本提取和 OCR 都没有得到有效文本，请换一份更清晰的文件。"
    },
    demo1_ocr_empty_text: {
      title: "图片未识别到文字",
      description: "OCR 没有检测到可用文字，请上传包含清晰文字的截图或图片。"
    },
    demo1_file_type_unsupported: {
      title: "文件格式不支持",
      description: "Demo 1 当前支持文本、HTML、PDF、PNG、JPG、WEBP 和 BMP。"
    },
    demo1_file_too_large: {
      title: "文件过大",
      description: "Demo 1 单文件上限为 5 MB。"
    },
    demo1_pdf_parse_failed: {
      title: "PDF 解析失败",
      description: "PyMuPDF 无法打开该 PDF，请检查文件是否损坏或加密。"
    },
    demo1_ocr_model_http_error: {
      title: "OCR 调用失败",
      description: "OCR 服务返回错误，请检查 Key、余额、模型权限和网络。"
    },
    demo1_ocr_model_failed: {
      title: "OCR 调用失败",
      description: "OCR 请求未完成，请检查网络、模型配置和后端日志。"
    },
    demo1_preview_failed: {
      title: "预处理失败",
      description: "预处理请求失败，请检查 API 服务和终端日志。"
    },
    demo1_commit_failed: {
      title: "写入失败",
      description: "写入本地库失败，请检查本地 SQLite 和后端日志。"
    }
  };
  if (!errorCode) {
    return { title: "等待输入", description: "尚未开始处理。" };
  }
  return details[errorCode] ?? {
    title: "处理失败",
    description: `错误码：${errorCode}`
  };
}

function countTextChars(text: string) {
  return Array.from(text.replace(/\s/g, "")).length;
}

function GraphPage() {
  const t = useT();
  const organization = useOrganizationStore();
  const relations = useRelationsStore();
  const [knowledgeUnits, setKnowledgeUnits] = useState<KnowledgeUnitRecord[]>([]);
  const [knowledgeState, setKnowledgeState] = useState<UiState>("empty");
  const [knowledgeErrorCode, setKnowledgeErrorCode] = useState<string | null>(null);
  const [sourceKnowledgeUnitId, setSourceKnowledgeUnitId] = useState("");
  const [targetKnowledgeUnitId, setTargetKnowledgeUnitId] = useState("");
  const [relationType, setRelationType] =
    useState<KnowledgeRelationCreateRequest["relation_type"]>("supports");
  const [description, setDescription] = useState("");
  const [editingRelationId, setEditingRelationId] = useState<string | null>(null);
  const [editRelationType, setEditRelationType] =
    useState<KnowledgeRelationPatchRequest["relation_type"]>("supports");
  const [editDescription, setEditDescription] = useState("");
  const activeFilters = useMemo(
    () => ({
      projectId: organization.selectedProjectId,
      folderId: organization.selectedFolderId,
      tagIds: organization.selectedTagIds
    }),
    [organization.selectedProjectId, organization.selectedFolderId, organization.selectedTagIds]
  );

  useEffect(() => {
    void refreshGraphData();
  }, [organization.selectedProjectId, organization.selectedFolderId, organization.selectedTagIds.join("|")]);

  async function refreshGraphData() {
    await organization.refresh();
    await Promise.all([relations.refreshGraph(activeFilters), relations.refreshRelations(activeFilters)]);
    if (!hasBridge()) {
      setKnowledgeUnits([]);
      setKnowledgeState("degraded");
      setKnowledgeErrorCode("desktop_bridge_unavailable");
      return;
    }
    setKnowledgeState("loading");
    setKnowledgeErrorCode(null);
    try {
      const units = await listKnowledgeUnits("confirmed", activeFilters);
      setKnowledgeUnits(units);
      setKnowledgeState(units.length ? "done" : "empty");
      if (!sourceKnowledgeUnitId && units[0]) setSourceKnowledgeUnitId(units[0].id);
      if (!targetKnowledgeUnitId && units[1]) setTargetKnowledgeUnitId(units[1].id);
    } catch (error) {
      setKnowledgeUnits([]);
      setKnowledgeState("recoverable_error");
      setKnowledgeErrorCode(resolveErrorCode(error, "knowledge_units_refresh_failed"));
    }
  }

  async function submitRelation() {
    if (!sourceKnowledgeUnitId || !targetKnowledgeUnitId) return;
    const relation = await relations.createRelation({
      project_id: organization.selectedProjectId,
      source_knowledge_unit_id: sourceKnowledgeUnitId,
      target_knowledge_unit_id: targetKnowledgeUnitId,
      relation_type: relationType,
      description: description.trim() || null
    });
    if (relation) {
      setDescription("");
      await Promise.all([relations.refreshGraph(activeFilters), relations.refreshRelations(activeFilters)]);
    }
  }

  function startEditRelation(relation: KnowledgeRelationRecord) {
    setEditingRelationId(relation.id);
    setEditRelationType(relation.relation_type);
    setEditDescription(relation.description ?? "");
  }

  async function saveRelationEdit() {
    if (!editingRelationId) return;
    const updated = await relations.updateRelation(editingRelationId, {
      relation_type: editRelationType,
      description: editDescription.trim() || null
    });
    if (updated) {
      setEditingRelationId(null);
      setEditDescription("");
      await Promise.all([relations.refreshGraph(activeFilters), relations.refreshRelations(activeFilters)]);
    }
  }

  async function archiveRelation(relationId: string) {
    await relations.archiveRelation(relationId, activeFilters);
  }

  return (
    <section className="page-grid">
      <section className="page-frame">
        <div className="section-title-row">
          <h2>{t("graph.title")}</h2>
          <div className="inline-actions">
            <StateChip state={relations.graphState} />
            <button className="icon-command" type="button" onClick={refreshGraphData}>
              <RefreshCw aria-hidden="true" size={16} />
              <span>{t("action.refresh")}</span>
            </button>
          </div>
        </div>
        <p className="section-note">{t("graph.boundary")}</p>
        {relations.graphErrorCode ? (
          <div className="row-note">
            <AlertCircle aria-hidden="true" size={15} />
            <span>{relations.graphErrorCode}</span>
          </div>
        ) : null}
        <GraphSummary graph={relations.graph} />
      </section>

      <section className="page-frame">
        <div className="section-title-row">
          <h2>{t("organization.filters")}</h2>
          <StateChip state={organization.state} />
        </div>
        <OrganizationFilterControls
          projects={organization.projects}
          folders={organization.folders}
          tags={organization.tags}
          selectedProjectId={organization.selectedProjectId}
          selectedFolderId={organization.selectedFolderId}
          selectedTagIds={organization.selectedTagIds}
          onSelectProject={organization.setSelectedProject}
          onSelectFolder={organization.setSelectedFolder}
          onSelectTagIds={organization.setSelectedTagIds}
          onReset={organization.resetFilters}
        />
      </section>

      <section className="page-frame">
        <div className="section-title-row">
          <h2>{t("graph.createRelation")}</h2>
          <StateChip state={relations.relationState} />
        </div>
        <div className="organization-filter-grid">
          <label className="memory-label">
            <span>{t("graph.sourceKu")}</span>
            <select
              className="settings-select"
              value={sourceKnowledgeUnitId}
              onChange={(event) => setSourceKnowledgeUnitId(event.target.value)}
            >
              <option value="">{t("graph.selectKu")}</option>
              {knowledgeUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.title}
                </option>
              ))}
            </select>
          </label>
          <label className="memory-label">
            <span>{t("graph.targetKu")}</span>
            <select
              className="settings-select"
              value={targetKnowledgeUnitId}
              onChange={(event) => setTargetKnowledgeUnitId(event.target.value)}
            >
              <option value="">{t("graph.selectKu")}</option>
              {knowledgeUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.title}
                </option>
              ))}
            </select>
          </label>
          <label className="memory-label">
            <span>{t("graph.relationType")}</span>
            <select
              className="settings-select"
              value={relationType}
              onChange={(event) =>
                setRelationType(event.target.value as KnowledgeRelationCreateRequest["relation_type"])
              }
            >
              {relationTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="memory-label">
            <span>{t("graph.description")}</span>
            <input
              className="query-input"
              value={description}
              placeholder={t("graph.descriptionPlaceholder")}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <button
            className="icon-command"
            type="button"
            disabled={
              !sourceKnowledgeUnitId ||
              !targetKnowledgeUnitId ||
              sourceKnowledgeUnitId === targetKnowledgeUnitId ||
              relations.relationState === "loading"
            }
            onClick={submitRelation}
          >
            <Save aria-hidden="true" size={16} />
            <span>{t("graph.createRelation")}</span>
          </button>
        </div>
        {knowledgeErrorCode ? (
          <div className="row-note">
            <AlertCircle aria-hidden="true" size={15} />
            <span>{knowledgeErrorCode}</span>
          </div>
        ) : null}
        {relations.relationErrorCode ? (
          <div className="row-note">
            <AlertCircle aria-hidden="true" size={15} />
            <span>{relations.relationErrorCode}</span>
          </div>
        ) : null}
      </section>

      <GraphEdgeList
        graph={relations.graph}
        state={relations.graphState}
        relations={relations.relations}
        editingRelationId={editingRelationId}
        editRelationType={editRelationType}
        editDescription={editDescription}
        onEditRelationTypeChange={setEditRelationType}
        onEditDescriptionChange={setEditDescription}
        onStartEdit={startEditRelation}
        onCancelEdit={() => setEditingRelationId(null)}
        onSaveEdit={saveRelationEdit}
        onArchive={archiveRelation}
      />

      <GraphNodeList
        graph={relations.graph}
        knowledgeUnits={knowledgeUnits}
        state={knowledgeState}
      />
    </section>
  );
}

function GraphSummary({ graph }: { graph?: GraphPreviewResponse }) {
  const t = useT();
  return (
    <>
      <div className="metric-row">
        <Metric label={t("graph.nodes")} value={graph?.summary.node_count ?? 0} />
        <Metric label={t("graph.edges")} value={graph?.summary.edge_count ?? 0} />
      </div>
      <div className="panel-grid">
        <article className="panel">
          <h3>{t("graph.provider")}</h3>
          <p>{graph?.provider_status ?? "not_ready"}</p>
        </article>
        <article className="panel">
          <h3>{t("graph.fallback")}</h3>
          <p>{graph?.fallback_reason ?? t("empty.none")}</p>
        </article>
      </div>
    </>
  );
}

function GraphEdgeList({
  graph,
  state,
  relations,
  editingRelationId,
  editRelationType,
  editDescription,
  onEditRelationTypeChange,
  onEditDescriptionChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onArchive
}: {
  graph?: GraphPreviewResponse;
  state: UiState;
  relations: KnowledgeRelationRecord[];
  editingRelationId: string | null;
  editRelationType: KnowledgeRelationPatchRequest["relation_type"];
  editDescription: string;
  onEditRelationTypeChange: (type: KnowledgeRelationPatchRequest["relation_type"]) => void;
  onEditDescriptionChange: (description: string) => void;
  onStartEdit: (relation: KnowledgeRelationRecord) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onArchive: (relationId: string) => void;
}) {
  const t = useT();
  const rows = relations;
  return (
    <section className="page-frame">
      <div className="section-title-row">
        <h2>{t("graph.edges")}</h2>
        <StateChip state={state} />
      </div>
      <div className="file-table">
        {rows.length ? (
          rows.map((relation) => (
            <div className="review-row" key={relation.id}>
              <div>
                <strong>{relation.source_title} → {relation.target_title}</strong>
                <span>{relation.id}</span>
              </div>
              <StatusPill label={t("graph.relationType")} value={relation.relation_type} />
              <StatusPill label="status" value={relation.status} />
              <div className="row-note evidence-excerpt">
                <GitBranch aria-hidden="true" size={15} />
                <span>{relation.description ?? t("empty.none")}</span>
              </div>
              {editingRelationId === relation.id ? (
                <div className="organization-filter-grid">
                  <label className="memory-label">
                    <span>{t("graph.relationType")}</span>
                    <select
                      className="settings-select"
                      value={editRelationType ?? "supports"}
                      onChange={(event) =>
                        onEditRelationTypeChange(
                          event.target.value as KnowledgeRelationPatchRequest["relation_type"]
                        )
                      }
                    >
                      {relationTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="memory-label">
                    <span>{t("graph.description")}</span>
                    <input
                      className="query-input"
                      value={editDescription}
                      onChange={(event) => onEditDescriptionChange(event.target.value)}
                    />
                  </label>
                  <div className="inline-actions">
                    <button className="icon-command" type="button" onClick={onSaveEdit}>
                      <Save aria-hidden="true" size={16} />
                      <span>{t("action.save")}</span>
                    </button>
                    <button className="icon-command" type="button" onClick={onCancelEdit}>
                      <XCircle aria-hidden="true" size={16} />
                      <span>{t("action.cancel")}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="inline-actions">
                  <button className="icon-command" type="button" onClick={() => onStartEdit(relation)}>
                    <FileText aria-hidden="true" size={16} />
                    <span>{t("action.edit")}</span>
                  </button>
                  <button className="icon-command" type="button" onClick={() => onArchive(relation.id)}>
                    <Trash2 aria-hidden="true" size={16} />
                    <span>{t("action.archive")}</span>
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <EmptyState message={state === "degraded" ? t("empty.bridgeUnavailable") : t("graph.empty")} />
        )}
      </div>
    </section>
  );
}

function GraphNodeList({
  graph,
  knowledgeUnits,
  state
}: {
  graph?: GraphPreviewResponse;
  knowledgeUnits: KnowledgeUnitRecord[];
  state: UiState;
}) {
  const t = useT();
  const graphNodeIds = new Set(graph?.nodes.map((node) => node.id) ?? []);
  return (
    <section className="page-frame">
      <div className="section-title-row">
        <h2>{t("graph.nodes")}</h2>
        <StateChip state={state} />
      </div>
      <div className="file-table">
        {knowledgeUnits.length ? (
          knowledgeUnits.map((unit) => {
            const tags = unit.tags ?? [];
            return (
              <div className="review-row" key={unit.id}>
                <div>
                  <strong>{unit.title}</strong>
                  <span>{unit.id}</span>
                </div>
                <StatusPill
                  label={t("graph.inGraph")}
                  value={graphNodeIds.has(unit.id) ? t("state.done") : t("state.empty")}
                />
                <StatusPill label="status" value={unit.status} />
                <div className="tag-select-row">
                  {tags.length ? (
                    tags.map((tag) => (
                      <span className="mini-badge" key={`${unit.id}-${tag.id}`}>
                        {tag.name}
                      </span>
                    ))
                  ) : (
                    <span className="muted-text">{t("organization.noTags")}</span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <EmptyState message={state === "degraded" ? t("empty.bridgeUnavailable") : t("graph.noConfirmedKu")} />
        )}
      </div>
    </section>
  );
}

function DashboardPage() {
  const workspace = useWorkspaceStore();
  const runtime = useRuntimeStore();
  const t = useT();
  return (
    <section className="page-grid">
      <div className="metric-row">
        <Metric label={t("metric.uploads")} value={workspace.summary.upload_count} />
        <Metric label={t("metric.files")} value={workspace.summary.file_count} />
        <Metric label={t("metric.knowledgeUnits")} value={workspace.summary.knowledge_unit_count} />
        <Metric label={t("metric.pendingReview")} value={workspace.summary.pending_review_count} />
        <Metric label={t("metric.folders")} value={workspace.summary.folder_count} />
        <Metric label={t("metric.tags")} value={workspace.summary.tag_count} />
      </div>
      <PageFrame
        state={workspace.state}
        title={t("dashboard.summary.title")}
        sections={[
          [t("dashboard.runtime"), runtime.status?.status_reason ?? t("dashboard.runtimeReady")],
          [t("dashboard.recentImports"), t("dashboard.filesReceived", { count: workspace.summary.file_count })],
          [t("dashboard.organization"), t("dashboard.organizationSummary", {
            folders: workspace.summary.folder_count,
            tags: workspace.summary.tag_count
          })],
          [t("dashboard.evidence"), t("dashboard.evidencePacks", { count: workspace.summary.evidence_pack_count })]
        ]}
      />
    </section>
  );
}

function ImportPage() {
  const t = useT();
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const uppyRef = useRef<Uppy | null>(null);
  const files = useFileStore();
  const workspace = useWorkspaceStore();

  if (!uppyRef.current) {
    uppyRef.current = new Uppy({
      restrictions: {
        maxFileSize: 50 * 1024 * 1024
      }
    });
  }

  useEffect(() => {
    files.refresh();
  }, []);

  function updateQueue(id: string, patch: Partial<UploadQueueItem>) {
    setQueue((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function enqueue(fileList: File[]) {
    const nextItems: UploadQueueItem[] = [];
    for (const file of fileList) {
      try {
        uppyRef.current?.addFile({
          name: file.name,
          type: file.type || "application/octet-stream",
          data: file
        });
      } catch {
        // Uppy rejects duplicate browser File objects; the local queue handles visible state.
      }
      nextItems.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        status: "pending",
        progress: 0,
        message: "pending"
      });
    }
    setQueue((items) => [...items, ...nextItems]);
  }

  async function runUpload(item: UploadQueueItem) {
    updateQueue(item.id, { status: "uploading", progress: 0, message: "uploading" });
    try {
      const snapshot = await uploadFile(item.file, ({ receivedBytes, totalBytes, uploadId }) => {
        const progress = Math.max(1, Math.round((receivedBytes / totalBytes) * 100));
        updateQueue(item.id, { progress, uploadId });
      });
      updateQueue(item.id, {
        status: "done",
        progress: 100,
        message: snapshot.inspection?.risk_level ?? "completed",
        fileId: snapshot.file_id
      });
      await Promise.all([files.refresh(), workspace.refresh()]);
    } catch (error) {
      updateQueue(item.id, {
        status: "error",
        message: resolveErrorCode(error, "upload_failed")
      });
    }
  }

  async function uploadReadyItems() {
    for (const item of queue.filter((entry) => entry.status === "pending" || entry.status === "error")) {
      await runUpload(item);
    }
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    enqueue(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    enqueue(Array.from(event.dataTransfer.files));
  }

  return (
    <section className="page-grid">
      <section className="page-frame">
        <div className="section-title-row">
          <h2>{t("import.sourceIntake")}</h2>
          <StateChip state={hasBridge() ? "ready" : "degraded"} />
        </div>
        <div
          className="upload-zone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <Upload aria-hidden="true" size={26} />
          <div>
            <strong>{t("import.fileUpload")}</strong>
            <p>{t("import.uploadHint")}</p>
          </div>
          <input ref={inputRef} className="visually-hidden" type="file" multiple onChange={handleInput} />
          <button className="icon-command" type="button" onClick={() => inputRef.current?.click()}>
            <Upload aria-hidden="true" size={17} />
            <span>{t("action.select")}</span>
          </button>
          <button className="icon-command" type="button" onClick={uploadReadyItems} disabled={!queue.length}>
            <FileCheck aria-hidden="true" size={17} />
            <span>{t("action.upload")}</span>
          </button>
        </div>
      </section>

      <section className="page-frame">
        <div className="section-title-row">
          <h2>{t("import.uploadQueue")}</h2>
          <StateChip
            state={queue.length ? "ready" : "empty"}
            label={queue.length ? t("import.queued", { count: queue.length }) : t("import.emptyQueue")}
          />
        </div>
        <div className="file-table">
          {queue.length ? (
            queue.map((item) => (
              <div className="file-row" key={item.id}>
                <div>
                  <strong>{item.file.name}</strong>
                  <span>{formatBytes(item.file.size)}</span>
                </div>
                <div className="progress-track" aria-label={t("import.progressLabel", { name: item.file.name })}>
                  <span style={{ width: `${item.progress}%` }} />
                </div>
                <StatusPill label={item.status} value={item.message} />
                {item.status === "error" ? (
                  <button className="icon-command" type="button" onClick={() => runUpload(item)}>
                    <RefreshCw aria-hidden="true" size={16} />
                    <span>{t("action.retry")}</span>
                  </button>
                ) : null}
              </div>
            ))
          ) : (
            <EmptyState message={t("import.noQueuedFiles")} />
          )}
        </div>
      </section>

      <FileListPanel
        files={files.files}
        state={files.state}
        onRefresh={files.refresh}
        onVerify={files.verify}
        onParse={files.parse}
        onParsed={() => Promise.all([files.refresh(), workspace.refresh()]).then(() => undefined)}
      />
    </section>
  );
}

function LibraryPage() {
  const t = useT();
  const files = useFileStore();
  const sources = useSourceStore();
  const review = useReviewStore();
  const workspace = useWorkspaceStore();
  const organization = useOrganizationStore();
  const activeFilters = useMemo(
    () => ({
      projectId: organization.selectedProjectId,
      folderId: organization.selectedFolderId,
      tagIds: organization.selectedTagIds
    }),
    [organization.selectedProjectId, organization.selectedFolderId, organization.selectedTagIds]
  );
  useEffect(() => {
    files.refresh();
    organization.refresh();
    sources.refresh(activeFilters);
    review.refresh();
  }, [organization.selectedProjectId, organization.selectedFolderId, organization.selectedTagIds.join("|")]);

  async function parseAndRefresh(fileId: string) {
    await files.parse(fileId);
    await Promise.all([sources.refresh(activeFilters), workspace.refresh()]);
  }

  async function extractAndRefresh(sourceId: string) {
    await sources.extract(sourceId, activeFilters);
    await Promise.all([review.refresh(), workspace.refresh()]);
  }

  async function completeReview(action: "confirm" | "ignore", taskId: string) {
    if (action === "confirm") {
      await review.confirm(taskId);
    } else {
      await review.ignore(taskId);
    }
    await sources.refresh(activeFilters);
    await workspace.refresh();
  }

  async function refreshOrganizationBoundData() {
    await Promise.all([organization.refresh(), sources.refresh(activeFilters), workspace.refresh()]);
  }

  return (
    <section className="page-grid">
      <OrganizationPanel
        projects={organization.projects}
        folders={organization.folders}
        tags={organization.tags}
        sources={sources.sources}
        state={organization.state}
        errorCode={organization.errorCode}
        selectedProjectId={organization.selectedProjectId}
        selectedFolderId={organization.selectedFolderId}
        selectedTagIds={organization.selectedTagIds}
        onRefresh={refreshOrganizationBoundData}
        onSelectProject={organization.setSelectedProject}
        onSelectFolder={organization.setSelectedFolder}
        onSelectTagIds={organization.setSelectedTagIds}
        onReset={organization.resetFilters}
        onCreateProject={organization.createProject}
        onCreateFolder={organization.createFolder}
        onCreateTag={organization.createTag}
        onUpdateSource={async (sourceId, folderId, tagIds) => {
          await organization.updateSourceOrganization(sourceId, { folder_id: folderId, tag_ids: tagIds });
          await refreshOrganizationBoundData();
        }}
        onUpdateSourcesBatch={async (sourceIds, folderId, tagIds) => {
          await organization.updateSourcesOrganizationBatch({
            source_ids: sourceIds,
            folder_id: folderId,
            tag_ids: tagIds
          });
          await refreshOrganizationBoundData();
        }}
        onUpdateKnowledgeUnit={async (knowledgeUnitId, folderId, tagIds) => {
          await organization.updateKnowledgeUnitOrganization(knowledgeUnitId, {
            folder_id: folderId,
            tag_ids: tagIds
          });
          await refreshOrganizationBoundData();
        }}
        onUpdateKnowledgeUnitsBatch={async (knowledgeUnitIds, folderId, tagIds) => {
          await organization.updateKnowledgeUnitsOrganizationBatch({
            knowledge_unit_ids: knowledgeUnitIds,
            folder_id: folderId,
            tag_ids: tagIds
          });
          await refreshOrganizationBoundData();
        }}
      />
      <FileListPanel
        files={files.files}
        state={files.state}
        onRefresh={files.refresh}
        onVerify={files.verify}
        onParse={parseAndRefresh}
        onParsed={() => Promise.all([sources.refresh(activeFilters), workspace.refresh()]).then(() => undefined)}
      />
      <SourceListPanel
        sources={sources.sources}
        state={sources.state}
        onRefresh={sources.refresh}
        onExtract={extractAndRefresh}
      />
      <ReviewQueuePanel
        tasks={review.tasks}
        state={review.state}
        onRefresh={review.refresh}
        onConfirm={(taskId) => completeReview("confirm", taskId)}
        onIgnore={(taskId) => completeReview("ignore", taskId)}
      />
      <PageFrame
        state={review.state === "done" ? "done" : sources.state}
        title={t("library.title")}
        sections={[
          [t("files.title"), t("library.filesSummary", { count: files.files.length })],
          [t("sources.title"), t("library.sourcesSummary", { count: sources.sources.length })],
          [t("review.title"), t("library.reviewSummary", { count: review.pendingCount })]
        ]}
      />
    </section>
  );
}

function SearchPage() {
  const t = useT();
  const retrieval = useRetrievalStore();
  const textToSql = useTextToSqlStore();
  const organization = useOrganizationStore();
  const [query, setQuery] = useState(retrieval.lastQuery || "Evidence Pack Source Chunk");
  const preview = retrieval.preview;
  const explanation = preview?.query_explanation ?? {};
  const activeFilters = useMemo(
    () => ({
      projectId: organization.selectedProjectId,
      folderId: organization.selectedFolderId,
      tagIds: organization.selectedTagIds
    }),
    [organization.selectedProjectId, organization.selectedFolderId, organization.selectedTagIds]
  );

  useEffect(() => {
    organization.refresh();
  }, [organization.selectedProjectId]);

  async function runSearch() {
    const trimmed = query.trim();
    if (!trimmed) return;
    await retrieval.previewQuery(trimmed, activeFilters);
  }

  async function runStructuredQuery() {
    const trimmed = query.trim();
    if (!trimmed) return;
    await textToSql.previewQuery(trimmed, activeFilters);
  }

  return (
    <section className="page-grid">
      <section className="page-frame">
        <div className="section-title-row">
          <h2>{t("search.preview")}</h2>
          <StateChip state={retrieval.previewState} />
        </div>
        <form
          className="query-bar"
          onSubmit={(event) => {
            event.preventDefault();
            runSearch();
          }}
        >
          <input
            className="query-input"
            value={query}
            placeholder={t("search.placeholder")}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button
            className="icon-command"
            type="submit"
            disabled={!query.trim() || retrieval.previewState === "loading"}
          >
            <Search aria-hidden="true" size={16} />
            <span>{t("action.search")}</span>
          </button>
          <button
            className="icon-command"
            type="button"
            disabled={!query.trim() || textToSql.state === "loading"}
            onClick={runStructuredQuery}
          >
            <FileText aria-hidden="true" size={16} />
            <span>{t("action.sqlPreview")}</span>
          </button>
        </form>
        {retrieval.previewErrorCode ? (
          <div className="row-note">
            <AlertCircle aria-hidden="true" size={15} />
            <span>{retrieval.previewErrorCode}</span>
          </div>
        ) : null}
      </section>

      <section className="page-frame">
        <div className="section-title-row">
          <h2>{t("organization.filters")}</h2>
          <StateChip state={organization.state} />
        </div>
        <OrganizationFilterControls
          projects={organization.projects}
          folders={organization.folders}
          tags={organization.tags}
          selectedProjectId={organization.selectedProjectId}
          selectedFolderId={organization.selectedFolderId}
          selectedTagIds={organization.selectedTagIds}
          onSelectProject={organization.setSelectedProject}
          onSelectFolder={organization.setSelectedFolder}
          onSelectTagIds={organization.setSelectedTagIds}
          onReset={organization.resetFilters}
        />
      </section>

      <section className="page-frame">
        <div className="section-title-row">
          <h2>{t("search.queryExplanation")}</h2>
          <StatusPill label="provider" value={preview?.provider_status ?? "not_ready"} />
        </div>
        <div className="panel-grid">
          <article className="panel">
            <h3>{t("search.strategy")}</h3>
            <p>{formatMaybe(explanation.retrieval_strategy_profile)}</p>
          </article>
          <article className="panel">
            <h3>{t("search.ranking")}</h3>
            <p>{formatMaybe(explanation.ranking_profile)}</p>
          </article>
          <article className="panel">
            <h3>{t("search.scope")}</h3>
            <p>{formatMaybe((explanation.filters as Record<string, unknown> | undefined)?.knowledge_unit_status)}</p>
          </article>
        </div>
      </section>

      <TextToSqlPanel
        preview={textToSql.preview}
        state={textToSql.state}
        errorCode={textToSql.errorCode}
      />

      <section className="page-frame">
        <div className="section-title-row">
          <h2>{t("search.evidencePack")}</h2>
          <StatusPill label="pack" value={preview?.evidence_pack.status ?? "not_ready"} />
        </div>
        <div className="panel-grid">
          <article className="panel">
            <h3>{t("search.summary")}</h3>
            <p>{preview?.evidence_pack.summary ?? t("search.noPreview")}</p>
          </article>
          <article className="panel">
            <h3>{t("search.failure")}</h3>
            <p>{preview?.evidence_pack.failure_type ?? t("empty.none")}</p>
          </article>
          <article className="panel">
            <h3>{t("search.fallback")}</h3>
            <p>{preview?.fallback_reason ?? t("empty.none")}</p>
          </article>
        </div>
      </section>

      <EvidenceItemsPanel
        items={preview?.evidence_pack.items ?? []}
        state={retrieval.previewState}
        onOpenDetail={(evidencePackId, evidenceItemId) =>
          retrieval.loadDetail(evidencePackId, evidenceItemId)
        }
        evidencePackId={preview?.evidence_pack_id}
      />

      <CitationDetailPanel
        detail={retrieval.detail}
        state={retrieval.detailState}
        errorCode={retrieval.detailErrorCode}
        annotations={retrieval.annotations}
        annotationState={retrieval.annotationState}
        annotationErrorCode={retrieval.annotationErrorCode}
        comparison={retrieval.comparison}
        compareState={retrieval.compareState}
        compareErrorCode={retrieval.compareErrorCode}
        focusedEvidenceItemId={retrieval.focusedEvidenceItemId}
        onFocusItem={(evidenceItemId) =>
          retrieval.detail?.id && retrieval.loadDetail(retrieval.detail.id, evidenceItemId)
        }
        onCreateAnnotation={retrieval.createAnnotation}
        onCreateAnnotationsBatch={retrieval.createAnnotationsBatch}
        onUpdateAnnotation={retrieval.updateAnnotation}
        onDeleteAnnotation={retrieval.deleteAnnotation}
        onCompareItems={retrieval.compareItems}
        onClearComparison={retrieval.clearComparison}
      />

      <PageFrame
        state={retrieval.previewState}
        title={t("citation.trace")}
        sections={[
          [t("citation.trace"), preview?.citation_trace_summary ?? t("search.noTrace")],
          ["Pack ID", preview?.evidence_pack_id ?? "not_ready"],
          ["Retrieval Log", preview?.retrieval_log_id ?? "not_ready"]
        ]}
      />
    </section>
  );
}

function AskPage() {
  const t = useT();
  const retrieval = useRetrievalStore();
  const review = useReviewStore();
  const feedbackMemory = useFeedbackMemoryStore();
  const organization = useOrganizationStore();
  const [query, setQuery] = useState(retrieval.lastQuery || "Evidence Pack Source Chunk");
  const [memoryType, setMemoryType] = useState<MemoryDraftRequest["memory_type"]>("decision");
  const [memoryContent, setMemoryContent] = useState("");
  const answer = retrieval.answer;
  const activeFilters = useMemo(
    () => ({
      projectId: organization.selectedProjectId,
      folderId: organization.selectedFolderId,
      tagIds: organization.selectedTagIds
    }),
    [organization.selectedProjectId, organization.selectedFolderId, organization.selectedTagIds]
  );

  useEffect(() => {
    organization.refresh();
  }, [organization.selectedProjectId]);

  useEffect(() => {
    setMemoryContent(answer?.answer ?? "");
  }, [answer?.answer_id]);

  async function runAsk() {
    const trimmed = query.trim();
    if (!trimmed) return;
    await retrieval.ask(trimmed, activeFilters);
  }

  async function submitAnswerFeedback(feedbackType: FeedbackRequest["feedback_type"]) {
    if (!answer) return;
    await feedbackMemory.submitFeedback({
      feedback_type: feedbackType,
      evidence_pack_id: answer.evidence_pack_id,
      ai_answer_id: answer.answer_id,
      evidence_item_id: answer.evidence_item_ids[0]
    });
  }

  async function saveMemoryDraft() {
    if (!answer || !memoryContent.trim()) return;
    const draft = await feedbackMemory.createMemoryDraft({
      source_answer_id: answer.answer_id,
      content: memoryContent.trim(),
      memory_type: memoryType
    });
    if (draft) {
      await review.refresh();
    }
  }

  return (
    <section className="page-grid">
      <section className="page-frame">
        <div className="section-title-row">
          <h2>{t("ask.title")}</h2>
          <StateChip state={retrieval.answerState} />
        </div>
        <form
          className="query-bar"
          onSubmit={(event) => {
            event.preventDefault();
            runAsk();
          }}
        >
          <input
            className="query-input"
            value={query}
            placeholder={t("ask.placeholder")}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button
            className="icon-command"
            type="submit"
            disabled={!query.trim() || retrieval.answerState === "loading"}
          >
            <MessageSquare aria-hidden="true" size={16} />
            <span>{t("action.ask")}</span>
          </button>
        </form>
        {retrieval.answerErrorCode ? (
          <div className="row-note">
            <AlertCircle aria-hidden="true" size={15} />
            <span>{retrieval.answerErrorCode}</span>
          </div>
        ) : null}
      </section>

      <section className="page-frame">
        <div className="section-title-row">
          <h2>{t("organization.filters")}</h2>
          <StateChip state={organization.state} />
        </div>
        <OrganizationFilterControls
          projects={organization.projects}
          folders={organization.folders}
          tags={organization.tags}
          selectedProjectId={organization.selectedProjectId}
          selectedFolderId={organization.selectedFolderId}
          selectedTagIds={organization.selectedTagIds}
          onSelectProject={organization.setSelectedProject}
          onSelectFolder={organization.setSelectedFolder}
          onSelectTagIds={organization.setSelectedTagIds}
          onReset={organization.resetFilters}
        />
      </section>

      <section className="page-frame">
        <div className="section-title-row">
          <h2>{t("ask.answer")}</h2>
          <StatusPill label="output" value={answer?.output_type ?? "not_ready"} />
        </div>
        <div className="answer-box">
          {answer?.answer ? answer.answer : <EmptyState message={t("ask.noAnswer")} />}
        </div>
      </section>

      <section className="page-frame">
        <div className="section-title-row">
          <h2>{t("feedback.title")}</h2>
          <StateChip state={feedbackMemory.feedbackState} />
        </div>
        <p className="section-note">{t("feedback.appendOnly")}</p>
        <div className="feedback-actions">
          <button
            className="icon-command"
            type="button"
            disabled={!answer || feedbackMemory.feedbackState === "loading"}
            onClick={() => submitAnswerFeedback("useful")}
          >
            <ThumbsUp aria-hidden="true" size={16} />
            <span>{t("action.useful")}</span>
          </button>
          <button
            className="icon-command"
            type="button"
            disabled={!answer || feedbackMemory.feedbackState === "loading"}
            onClick={() => submitAnswerFeedback("not_useful")}
          >
            <ThumbsDown aria-hidden="true" size={16} />
            <span>{t("action.notUseful")}</span>
          </button>
          <button
            className="icon-command"
            type="button"
            disabled={!answer || feedbackMemory.feedbackState === "loading"}
            onClick={() => submitAnswerFeedback("favorite")}
          >
            <Bookmark aria-hidden="true" size={16} />
            <span>{t("action.favorite")}</span>
          </button>
          <button
            className="icon-command"
            type="button"
            disabled={!answer || feedbackMemory.feedbackState === "loading"}
            onClick={() => submitAnswerFeedback("bad_citation")}
          >
            <AlertCircle aria-hidden="true" size={16} />
            <span>{t("action.badCitation")}</span>
          </button>
          <button
            className="icon-command"
            type="button"
            disabled={!answer || feedbackMemory.feedbackState === "loading"}
            onClick={() => submitAnswerFeedback("missing_source")}
          >
            <FileText aria-hidden="true" size={16} />
            <span>{t("action.missingSource")}</span>
          </button>
        </div>
        {feedbackMemory.feedbackErrorCode ? (
          <div className="row-note">
            <AlertCircle aria-hidden="true" size={15} />
            <span>{feedbackMemory.feedbackErrorCode}</span>
          </div>
        ) : feedbackMemory.lastFeedback ? (
          <div className="row-note">
            <CheckCircle aria-hidden="true" size={15} />
            <span>{t("feedback.success")} · {feedbackMemory.lastFeedback.feedback_type}</span>
          </div>
        ) : null}
      </section>

      <section className="page-frame">
        <div className="section-title-row">
          <h2>{t("memory.title")}</h2>
          <StateChip state={feedbackMemory.memoryState} />
        </div>
        <p className="section-note">{t("memory.body")}</p>
        <div className="memory-form">
          <label className="memory-label">
            <span>{t("memory.type")}</span>
            <select
              className="settings-select"
              value={memoryType}
              onChange={(event) => setMemoryType(event.target.value as MemoryDraftRequest["memory_type"])}
            >
              <option value="preference">{t("memory.type.preference")}</option>
              <option value="decision">{t("memory.type.decision")}</option>
              <option value="style">{t("memory.type.style")}</option>
              <option value="conclusion">{t("memory.type.conclusion")}</option>
              <option value="reusable_context">{t("memory.type.reusable_context")}</option>
            </select>
          </label>
          <textarea
            className="memory-textarea"
            value={memoryContent}
            placeholder={t("memory.contentPlaceholder")}
            onChange={(event) => setMemoryContent(event.target.value)}
          />
          <button
            className="icon-command"
            type="button"
            disabled={!answer || !memoryContent.trim() || feedbackMemory.memoryState === "loading"}
            onClick={saveMemoryDraft}
          >
            <Save aria-hidden="true" size={16} />
            <span>{t("action.saveMemory")}</span>
          </button>
        </div>
        {feedbackMemory.memoryErrorCode ? (
          <div className="row-note">
            <AlertCircle aria-hidden="true" size={15} />
            <span>{feedbackMemory.memoryErrorCode}</span>
          </div>
        ) : feedbackMemory.memoryState === "done" ? (
          <div className="row-note">
            <CheckCircle aria-hidden="true" size={15} />
            <span>{t("memory.created")}</span>
          </div>
        ) : null}
      </section>

      <section className="page-frame">
        <div className="section-title-row">
          <h2>{t("ask.citations")}</h2>
          <div className="inline-actions">
            <StatusPill label="provider" value={answer?.provider_status ?? "not_ready"} />
            <button
              className="icon-command"
              type="button"
              disabled={!answer?.evidence_pack_id || retrieval.detailState === "loading"}
              onClick={() => answer?.evidence_pack_id && retrieval.loadDetail(answer.evidence_pack_id)}
            >
              <FileText aria-hidden="true" size={16} />
              <span>{t("action.openDetail")}</span>
            </button>
          </div>
        </div>
        <div className="panel-grid">
          <article className="panel">
            <h3>{t("ask.labels")}</h3>
            {answer?.citation_labels.length ? (
              <div className="citation-button-row">
                {answer.citation_labels.map((label, index) => (
                  <button
                    className="citation-token"
                    key={`${label}-${answer.evidence_item_ids[index] ?? index}`}
                    type="button"
                    onClick={() =>
                      answer.evidence_pack_id &&
                      retrieval.loadDetail(answer.evidence_pack_id, answer.evidence_item_ids[index])
                    }
                  >
                    <span>{label}</span>
                    <strong>{answer.evidence_item_ids[index] ?? t("empty.none")}</strong>
                  </button>
                ))}
              </div>
            ) : (
              <p>{t("empty.none")}</p>
            )}
          </article>
          <article className="panel">
            <h3>{t("ask.evidenceItems")}</h3>
            {answer?.evidence_item_ids.length ? (
              <div className="citation-button-row">
                {answer.evidence_item_ids.map((evidenceItemId, index) => (
                  <button
                    className="citation-token"
                    key={evidenceItemId}
                    type="button"
                    onClick={() =>
                      answer.evidence_pack_id && retrieval.loadDetail(answer.evidence_pack_id, evidenceItemId)
                    }
                  >
                    <span>{evidenceItemId}</span>
                    <strong>{answer.citation_labels[index] ?? t("empty.none")}</strong>
                  </button>
                ))}
              </div>
            ) : (
              <p>{t("empty.none")}</p>
            )}
          </article>
          <article className="panel">
            <h3>{t("search.fallback")}</h3>
            <p>{answer?.fallback_reason ?? t("empty.none")}</p>
          </article>
        </div>
      </section>

      <CitationDetailPanel
        detail={retrieval.detail}
        state={retrieval.detailState}
        errorCode={retrieval.detailErrorCode}
        annotations={retrieval.annotations}
        annotationState={retrieval.annotationState}
        annotationErrorCode={retrieval.annotationErrorCode}
        comparison={retrieval.comparison}
        compareState={retrieval.compareState}
        compareErrorCode={retrieval.compareErrorCode}
        focusedEvidenceItemId={retrieval.focusedEvidenceItemId}
        onFocusItem={(evidenceItemId) =>
          retrieval.detail?.id && retrieval.loadDetail(retrieval.detail.id, evidenceItemId)
        }
        onCreateAnnotation={retrieval.createAnnotation}
        onCreateAnnotationsBatch={retrieval.createAnnotationsBatch}
        onUpdateAnnotation={retrieval.updateAnnotation}
        onDeleteAnnotation={retrieval.deleteAnnotation}
        onCompareItems={retrieval.compareItems}
        onClearComparison={retrieval.clearComparison}
      />

      <PageFrame
        state={retrieval.answerState}
        title={t("citation.trace")}
        sections={[
          [t("citation.trace"), answer?.citation_trace_summary ?? t("search.noTrace")],
          ["Pack ID", answer?.evidence_pack_id ?? "not_ready"],
          ["Retrieval Log", answer?.retrieval_log_id ?? "not_ready"]
        ]}
      />
    </section>
  );
}

function OutputsPage() {
  const t = useT();
  const feedbackMemory = useFeedbackMemoryStore();
  const organization = useOrganizationStore();
  const knowledgeExport = useKnowledgeExportStore();
  const [feedbackTypeFilter, setFeedbackTypeFilter] = useState<FeedbackFilterValue>("all");
  const [targetTypeFilter, setTargetTypeFilter] = useState<FeedbackTargetFilterValue>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [createdFromFilter, setCreatedFromFilter] = useState("");
  const [createdToFilter, setCreatedToFilter] = useState("");
  const [rankingEffectFilter, setRankingEffectFilter] =
    useState<FeedbackRankingEffectFilterValue>("all");
  const [commentFilter, setCommentFilter] = useState<FeedbackCommentFilterValue>("all");
  const [sortFilter, setSortFilter] = useState<FeedbackSortOrder>("created_desc");
  const [limitFilter, setLimitFilter] = useState(50);
  const [exportFormat, setExportFormat] = useState<FeedbackExportFormat>("json");
  const [knowledgeExportKind, setKnowledgeExportKind] =
    useState<KnowledgeExportKind>("knowledge_units");
  const [knowledgeExportFormat, setKnowledgeExportFormat] =
    useState<KnowledgeUnitExportFormat>("markdown");
  const [includeChunks, setIncludeChunks] = useState(false);
  const [includeSources, setIncludeSources] = useState(false);
  const [includePendingReview, setIncludePendingReview] = useState(false);
  const [selectedExportKnowledgeUnitIds, setSelectedExportKnowledgeUnitIds] = useState<string[]>(
    []
  );

  useEffect(() => {
    feedbackMemory.refreshMemories();
    feedbackMemory.refreshFeedbackDiagnostics();
    feedbackMemory.refreshFeedbackExportHistory();
    knowledgeExport.refreshHistory();
    organization.refresh();
  }, []);

  function diagnosticsFilters(): FeedbackDiagnosticsFilters {
    return {
      feedback_type: feedbackTypeFilter === "all" ? undefined : feedbackTypeFilter,
      target_type: targetTypeFilter === "all" ? undefined : targetTypeFilter,
      search: searchFilter.trim() || undefined,
      created_from: datetimeLocalToIso(createdFromFilter),
      created_to: datetimeLocalToIso(createdToFilter),
      ranking_effect: rankingEffectFilter === "all" ? undefined : rankingEffectFilter,
      has_comment:
        commentFilter === "all" ? undefined : commentFilter === "with_comment",
      sort: sortFilter,
      limit: limitFilter
    };
  }

  async function refreshDiagnostics() {
    await feedbackMemory.refreshFeedbackDiagnostics(diagnosticsFilters());
  }

  async function exportDiagnostics() {
    const exported = await feedbackMemory.exportFeedbackDiagnostics(diagnosticsFilters(), exportFormat);
    if (exported) downloadTextFile(exported.filename, exported.mime_type, exported.content);
  }

  async function exportKnowledgeAssets() {
    const projectId = organization.selectedProjectId || "default-space";
    if (knowledgeExportKind === "project") {
      const exported = await knowledgeExport.exportProject({
        project_id: projectId,
        include_pending_review: includePendingReview,
        format: "zip"
      });
      if (exported?.content_base64) {
        downloadBase64File(exported.filename, exported.mime_type, exported.content_base64);
      }
      return;
    }
    const exported = await knowledgeExport.exportKnowledgeUnits({
      format: knowledgeExportFormat,
      project_id: projectId,
      folder_id: organization.selectedFolderId,
      tag_ids: organization.selectedTagIds,
      knowledge_unit_ids: selectedExportKnowledgeUnitIds,
      include_chunks: includeChunks,
      include_sources: includeSources,
      include_pending_review: includePendingReview
    });
    if (exported?.content) {
      downloadTextFile(exported.filename, exported.mime_type, exported.content);
    }
  }

  function applyKnowledgeExportHistory(record: KnowledgeExportHistoryRecord) {
    const filters = record.filters as Record<string, unknown>;
    const projectId = typeof filters.project_id === "string" ? filters.project_id : "default-space";
    const folderId = typeof filters.folder_id === "string" ? filters.folder_id : null;
    const tagIds = Array.isArray(filters.tag_ids)
      ? filters.tag_ids.filter((tagId): tagId is string => typeof tagId === "string")
      : [];

    organization.setSelectedProject(projectId);
    organization.setSelectedFolder(record.export_kind === "project" ? null : folderId);
    organization.setSelectedTagIds(record.export_kind === "project" ? [] : tagIds);
    setSelectedExportKnowledgeUnitIds([]);
    setKnowledgeExportKind(record.export_kind);
    if (record.format === "markdown" || record.format === "json") {
      setKnowledgeExportFormat(record.format);
    }
    setIncludeChunks(Boolean(filters.include_chunks));
    setIncludeSources(Boolean(filters.include_sources));
    setIncludePendingReview(Boolean(filters.include_pending_review));
  }

  function resetDiagnosticsFilters() {
    setFeedbackTypeFilter("all");
    setTargetTypeFilter("all");
    setSearchFilter("");
    setCreatedFromFilter("");
    setCreatedToFilter("");
    setRankingEffectFilter("all");
    setCommentFilter("all");
    setSortFilter("created_desc");
    setLimitFilter(50);
  }

  return (
    <section className="page-grid">
      <PageFrame
        state={feedbackMemory.memoryState}
        title={t("outputs.title")}
        sections={[
          [t("outputs.memoryDrafts"), t("outputs.memorySummary")],
          [t("review.title"), t("outputs.review")],
          [t("outputs.exportTitle"), t("outputs.export")]
        ]}
      />
      <section className="page-frame">
        <div className="section-title-row">
          <h2>{t("memory.drafts")}</h2>
          <div className="inline-actions">
            <StateChip state={feedbackMemory.memoryState} />
            <button className="icon-command" type="button" onClick={feedbackMemory.refreshMemories}>
              <RefreshCw aria-hidden="true" size={16} />
              <span>{t("action.refresh")}</span>
            </button>
          </div>
        </div>
        {feedbackMemory.memoryErrorCode ? (
          <div className="row-note">
            <AlertCircle aria-hidden="true" size={15} />
            <span>{feedbackMemory.memoryErrorCode}</span>
          </div>
        ) : null}
        <MemoryDraftList memories={feedbackMemory.memories} state={feedbackMemory.memoryState} />
      </section>
      <KnowledgeExportPanel
        projects={organization.projects}
        folders={organization.folders}
        tags={organization.tags}
        organizationState={organization.state}
        organizationErrorCode={organization.errorCode}
        selectedProjectId={organization.selectedProjectId}
        selectedFolderId={organization.selectedFolderId}
        selectedTagIds={organization.selectedTagIds}
        exportKind={knowledgeExportKind}
        exportFormat={knowledgeExportFormat}
        includeChunks={includeChunks}
        includeSources={includeSources}
        includePendingReview={includePendingReview}
        selectedKnowledgeUnitIds={selectedExportKnowledgeUnitIds}
        exportState={knowledgeExport.state}
        exportErrorCode={knowledgeExport.errorCode}
        lastExport={knowledgeExport.lastExport}
        history={knowledgeExport.history}
        historyState={knowledgeExport.historyState}
        historyErrorCode={knowledgeExport.historyErrorCode}
        onSelectProject={organization.setSelectedProject}
        onSelectFolder={organization.setSelectedFolder}
        onSelectTagIds={organization.setSelectedTagIds}
        onResetFilters={organization.resetFilters}
        onRefreshOrganization={organization.refresh}
        onExportKindChange={setKnowledgeExportKind}
        onExportFormatChange={setKnowledgeExportFormat}
        onIncludeChunksChange={setIncludeChunks}
        onIncludeSourcesChange={setIncludeSources}
        onIncludePendingReviewChange={setIncludePendingReview}
        onSelectedKnowledgeUnitIdsChange={setSelectedExportKnowledgeUnitIds}
        onExport={exportKnowledgeAssets}
        onRefreshHistory={knowledgeExport.refreshHistory}
        onDeleteHistory={knowledgeExport.deleteHistory}
        onApplyHistory={applyKnowledgeExportHistory}
      />
      <FeedbackDiagnosticsPanel
        events={feedbackMemory.feedbackEvents}
        summary={feedbackMemory.feedbackSummary}
        state={feedbackMemory.diagnosticsState}
        errorCode={feedbackMemory.diagnosticsErrorCode}
        feedbackTypeFilter={feedbackTypeFilter}
        targetTypeFilter={targetTypeFilter}
        searchFilter={searchFilter}
        createdFromFilter={createdFromFilter}
        createdToFilter={createdToFilter}
        rankingEffectFilter={rankingEffectFilter}
        commentFilter={commentFilter}
        sortFilter={sortFilter}
        limitFilter={limitFilter}
        exportFormat={exportFormat}
        exportState={feedbackMemory.diagnosticsExportState}
        exportErrorCode={feedbackMemory.diagnosticsExportErrorCode}
        exportHistory={feedbackMemory.feedbackExportHistory}
        exportHistoryState={feedbackMemory.exportHistoryState}
        exportHistoryErrorCode={feedbackMemory.exportHistoryErrorCode}
        onFeedbackTypeChange={setFeedbackTypeFilter}
        onTargetTypeChange={setTargetTypeFilter}
        onSearchChange={setSearchFilter}
        onCreatedFromChange={setCreatedFromFilter}
        onCreatedToChange={setCreatedToFilter}
        onRankingEffectChange={setRankingEffectFilter}
        onCommentFilterChange={setCommentFilter}
        onSortChange={setSortFilter}
        onLimitChange={setLimitFilter}
        onExportFormatChange={setExportFormat}
        onRefresh={refreshDiagnostics}
        onExport={exportDiagnostics}
        onResetFilters={resetDiagnosticsFilters}
        onRefreshHistory={feedbackMemory.refreshFeedbackExportHistory}
        onDeleteHistory={feedbackMemory.deleteFeedbackExportHistory}
      />
    </section>
  );
}

function MemoryDraftList({
  memories,
  state
}: {
  memories: MemoryDraftRecord[];
  state: UiState;
}) {
  const t = useT();
  return (
    <div className="file-table">
      {memories.length ? (
        memories.map((memory) => (
          <div className="review-row" key={memory.id}>
            <div>
              <strong>{memory.content.slice(0, 96) || t("memory.title")}</strong>
              <span>{memory.source_answer_id}</span>
            </div>
            <StatusPill label={t("memory.type")} value={t(memoryTypeKey(memory.memory_type))} />
            <StatusPill label="status" value={memory.status} />
            <div className="row-note evidence-excerpt">
              <FileText aria-hidden="true" size={15} />
              <span>{memory.content}</span>
            </div>
          </div>
        ))
      ) : (
        <EmptyState message={state === "degraded" ? t("empty.bridgeUnavailable") : t("memory.noDrafts")} />
      )}
    </div>
  );
}

function KnowledgeExportPanel({
  projects,
  folders,
  tags,
  organizationState,
  organizationErrorCode,
  selectedProjectId,
  selectedFolderId,
  selectedTagIds,
  exportKind,
  exportFormat,
  includeChunks,
  includeSources,
  includePendingReview,
  selectedKnowledgeUnitIds,
  exportState,
  exportErrorCode,
  lastExport,
  history,
  historyState,
  historyErrorCode,
  onSelectProject,
  onSelectFolder,
  onSelectTagIds,
  onResetFilters,
  onRefreshOrganization,
  onExportKindChange,
  onExportFormatChange,
  onIncludeChunksChange,
  onIncludeSourcesChange,
  onIncludePendingReviewChange,
  onSelectedKnowledgeUnitIdsChange,
  onExport,
  onRefreshHistory,
  onDeleteHistory,
  onApplyHistory
}: {
  projects: ProjectRecord[];
  folders: FolderRecord[];
  tags: TagRecord[];
  organizationState: UiState;
  organizationErrorCode: string | null;
  selectedProjectId: string;
  selectedFolderId: string | null;
  selectedTagIds: string[];
  exportKind: KnowledgeExportKind;
  exportFormat: KnowledgeUnitExportFormat;
  includeChunks: boolean;
  includeSources: boolean;
  includePendingReview: boolean;
  selectedKnowledgeUnitIds: string[];
  exportState: UiState;
  exportErrorCode?: string;
  lastExport?: KnowledgeExportResponse;
  history: KnowledgeExportHistoryRecord[];
  historyState: UiState;
  historyErrorCode?: string;
  onSelectProject: (projectId: string) => void;
  onSelectFolder: (folderId: string | null) => void;
  onSelectTagIds: (tagIds: string[]) => void;
  onResetFilters: () => void;
  onRefreshOrganization: () => Promise<void>;
  onExportKindChange: (kind: KnowledgeExportKind) => void;
  onExportFormatChange: (format: KnowledgeUnitExportFormat) => void;
  onIncludeChunksChange: (value: boolean) => void;
  onIncludeSourcesChange: (value: boolean) => void;
  onIncludePendingReviewChange: (value: boolean) => void;
  onSelectedKnowledgeUnitIdsChange: (knowledgeUnitIds: string[]) => void;
  onExport: () => Promise<void>;
  onRefreshHistory: () => Promise<void>;
  onDeleteHistory: (historyId: string) => Promise<void>;
  onApplyHistory: (record: KnowledgeExportHistoryRecord) => void;
}) {
  const t = useT();
  const [exportKnowledgeUnits, setExportKnowledgeUnits] = useState<KnowledgeUnitRecord[]>([]);
  const selectedKnowledgeUnitIdSet = useMemo(
    () => new Set(selectedKnowledgeUnitIds),
    [selectedKnowledgeUnitIds]
  );

  useEffect(() => {
    let cancelled = false;
    if (!hasBridge() || exportKind !== "knowledge_units") {
      setExportKnowledgeUnits([]);
      return () => {
        cancelled = true;
      };
    }
    listKnowledgeUnits(includePendingReview ? undefined : "confirmed", {
      projectId: selectedProjectId,
      folderId: selectedFolderId,
      tagIds: selectedTagIds
    })
      .then((records) => {
        if (cancelled) return;
        setExportKnowledgeUnits(records);
      })
      .catch(() => {
        if (!cancelled) setExportKnowledgeUnits([]);
      });
    return () => {
      cancelled = true;
    };
  }, [
    exportKind,
    includePendingReview,
    selectedProjectId,
    selectedFolderId,
    selectedTagIds.join("|")
  ]);

  useEffect(() => {
    if (exportKind !== "knowledge_units") {
      if (selectedKnowledgeUnitIds.length) onSelectedKnowledgeUnitIdsChange([]);
      return;
    }
    const validIds = new Set(exportKnowledgeUnits.map((record) => record.id));
    const prunedIds = selectedKnowledgeUnitIds.filter((knowledgeUnitId) =>
      validIds.has(knowledgeUnitId)
    );
    if (prunedIds.length !== selectedKnowledgeUnitIds.length) {
      onSelectedKnowledgeUnitIdsChange(prunedIds);
    }
  }, [
    exportKind,
    exportKnowledgeUnits,
    onSelectedKnowledgeUnitIdsChange,
    selectedKnowledgeUnitIds
  ]);

  function toggleSelectedKnowledgeUnit(knowledgeUnitId: string) {
    onSelectedKnowledgeUnitIdsChange(
      selectedKnowledgeUnitIdSet.has(knowledgeUnitId)
        ? selectedKnowledgeUnitIds.filter((id) => id !== knowledgeUnitId)
        : [...selectedKnowledgeUnitIds, knowledgeUnitId]
    );
  }

  function selectAllKnowledgeUnits() {
    onSelectedKnowledgeUnitIdsChange(exportKnowledgeUnits.map((knowledgeUnit) => knowledgeUnit.id));
  }

  return (
    <section className="page-frame">
      <div className="section-title-row">
        <h2>{t("knowledgeExport.title")}</h2>
        <div className="inline-actions">
          <StateChip state={exportState} />
          <button className="icon-command" type="button" onClick={onRefreshOrganization}>
            <RefreshCw aria-hidden="true" size={16} />
            <span>{t("action.refresh")}</span>
          </button>
          <button
            className="icon-command"
            type="button"
            disabled={exportState === "loading" || organizationState === "loading"}
            onClick={onExport}
          >
            <Download aria-hidden="true" size={16} />
            <span>{t("knowledgeExport.export")}</span>
          </button>
        </div>
      </div>
      <p className="section-note">{t("knowledgeExport.body")}</p>
      <OrganizationFilterControls
        projects={projects}
        folders={folders}
        tags={tags}
        selectedProjectId={selectedProjectId}
        selectedFolderId={selectedFolderId}
        selectedTagIds={selectedTagIds}
        onSelectProject={onSelectProject}
        onSelectFolder={onSelectFolder}
        onSelectTagIds={onSelectTagIds}
        onReset={onResetFilters}
      />
      <div className="settings-row">
        <label className="memory-label">
          <span>{t("knowledgeExport.type")}</span>
          <select
            className="settings-select"
            value={exportKind}
            onChange={(event) => onExportKindChange(event.target.value as KnowledgeExportKind)}
          >
            <option value="knowledge_units">{t("knowledgeExport.knowledgeUnits")}</option>
            <option value="project">{t("knowledgeExport.projectZip")}</option>
          </select>
        </label>
        <label className="memory-label">
          <span>{t("knowledgeExport.format")}</span>
          <select
            className="settings-select"
            value={exportKind === "project" ? "zip" : exportFormat}
            disabled={exportKind === "project"}
            onChange={(event) =>
              onExportFormatChange(event.target.value as KnowledgeUnitExportFormat)
            }
          >
            <option value="markdown">{t("knowledgeExport.markdown")}</option>
            <option value="json">{t("knowledgeExport.json")}</option>
            {exportKind === "project" ? (
              <option value="zip">{t("knowledgeExport.zip")}</option>
            ) : null}
          </select>
        </label>
      </div>
      <div className="settings-row">
        <label className="tag-checkbox">
          <input
            type="checkbox"
            checked={includeChunks}
            disabled={exportKind === "project"}
            onChange={(event) => onIncludeChunksChange(event.target.checked)}
          />
          <span>{t("knowledgeExport.includeChunks")}</span>
        </label>
        <label className="tag-checkbox">
          <input
            type="checkbox"
            checked={includeSources}
            disabled={exportKind === "project"}
            onChange={(event) => onIncludeSourcesChange(event.target.checked)}
          />
          <span>{t("knowledgeExport.includeSources")}</span>
        </label>
        <label className="tag-checkbox">
          <input
            type="checkbox"
            checked={includePendingReview}
            onChange={(event) => onIncludePendingReviewChange(event.target.checked)}
          />
          <span>{t("knowledgeExport.includePending")}</span>
        </label>
      </div>
      {exportKind === "knowledge_units" ? (
        <section className="focused-citation">
          <div className="section-title-row compact-title-row">
            <h3>{t("knowledgeExport.selectKnowledgeUnits")}</h3>
            <StatusPill
              label={t("knowledgeExport.selected")}
              value={`${selectedKnowledgeUnitIds.length}/${exportKnowledgeUnits.length}`}
            />
          </div>
          <div className="inline-actions">
            <button className="icon-command" type="button" onClick={selectAllKnowledgeUnits}>
              <CheckCircle aria-hidden="true" size={16} />
              <span>{t("knowledgeExport.selectAll")}</span>
            </button>
            <button
              className="icon-command"
              type="button"
              onClick={() => onSelectedKnowledgeUnitIdsChange([])}
            >
              <XCircle aria-hidden="true" size={16} />
              <span>{t("knowledgeExport.clearSelection")}</span>
            </button>
          </div>
          <div className="file-table compact-table">
            {exportKnowledgeUnits.length ? (
              exportKnowledgeUnits.map((knowledgeUnit) => (
                <div className="review-row" key={knowledgeUnit.id}>
                  <label className="compare-check">
                    <input
                      type="checkbox"
                      checked={selectedKnowledgeUnitIdSet.has(knowledgeUnit.id)}
                      onChange={() => toggleSelectedKnowledgeUnit(knowledgeUnit.id)}
                    />
                    <span>{knowledgeUnit.title}</span>
                  </label>
                  <StatusPill label="status" value={knowledgeUnit.status} />
                  <StatusPill label="type" value={knowledgeUnit.type} />
                  <div className="row-note evidence-excerpt">
                    <FileText aria-hidden="true" size={15} />
                    <span>{knowledgeUnit.id}</span>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState message={t("knowledgeExport.noSelectableUnits")} />
            )}
          </div>
        </section>
      ) : null}
      {organizationErrorCode || exportErrorCode ? (
        <div className="row-note">
          <AlertCircle aria-hidden="true" size={15} />
          <span>{organizationErrorCode ?? exportErrorCode}</span>
        </div>
      ) : null}
      {exportState === "degraded" || organizationState === "degraded" ? (
        <EmptyState message={t("empty.bridgeUnavailable")} />
      ) : null}
      {lastExport ? (
        <div className="panel-grid">
          <article className="panel">
            <h3>{t("knowledgeExport.lastExport")}</h3>
            <p>{lastExport.filename}</p>
          </article>
          <article className="panel">
            <h3>{t("knowledgeExport.records")}</h3>
            <p>{String(lastExport.record_count)}</p>
          </article>
          <article className="panel">
            <h3>{t("knowledgeExport.redacted")}</h3>
            <p>{String(lastExport.redacted)}</p>
          </article>
        </div>
      ) : (
        <EmptyState message={t("knowledgeExport.noExport")} />
      )}
      <div className="section-title-row compact-title-row">
        <h3>{t("knowledgeExport.history")}</h3>
        <div className="inline-actions">
          <StateChip state={historyState} />
          <button className="icon-command" type="button" onClick={onRefreshHistory}>
            <RefreshCw aria-hidden="true" size={16} />
            <span>{t("action.refresh")}</span>
          </button>
        </div>
      </div>
      {historyErrorCode ? (
        <div className="row-note">
          <AlertCircle aria-hidden="true" size={15} />
          <span>{historyErrorCode}</span>
        </div>
      ) : null}
      <div className="file-table">
        {history.length ? (
          history.map((record) => (
            <div className="review-row" key={record.id}>
              <div>
                <strong>{record.filename}</strong>
                <span>{record.id}</span>
              </div>
              <StatusPill label={t("knowledgeExport.type")} value={record.export_kind} />
              <StatusPill label={t("knowledgeExport.format")} value={record.format} />
              <StatusPill label={t("knowledgeExport.records")} value={String(record.record_count)} />
              <StatusPill label={t("feedback.generatedAt")} value={record.generated_at} />
              <div className="row-note evidence-excerpt">
                <FileText aria-hidden="true" size={15} />
                <span>
                  {t("feedback.filters")}: {formatMaybe(record.filters)}
                </span>
              </div>
              <div className="row-note evidence-excerpt">
                <FileText aria-hidden="true" size={15} />
                <span>
                  SHA256: {record.content_sha256}
                </span>
              </div>
              <div className="inline-actions">
                <button
                  className="icon-command"
                  type="button"
                  onClick={() => onApplyHistory(record)}
                >
                  <RefreshCw aria-hidden="true" size={16} />
                  <span>{t("knowledgeExport.applyHistory")}</span>
                </button>
                <button
                  className="icon-command"
                  type="button"
                  onClick={() => onDeleteHistory(record.id)}
                >
                  <Trash2 aria-hidden="true" size={16} />
                  <span>{t("knowledgeExport.deleteHistory")}</span>
                </button>
              </div>
            </div>
          ))
        ) : (
          <EmptyState
            message={
              historyState === "degraded"
                ? t("empty.bridgeUnavailable")
                : t("knowledgeExport.noHistory")
            }
          />
        )}
      </div>
    </section>
  );
}

function FeedbackDiagnosticsPanel({
  events,
  summary,
  state,
  errorCode,
  feedbackTypeFilter,
  targetTypeFilter,
  searchFilter,
  createdFromFilter,
  createdToFilter,
  rankingEffectFilter,
  commentFilter,
  sortFilter,
  limitFilter,
  exportFormat,
  exportState,
  exportErrorCode,
  exportHistory,
  exportHistoryState,
  exportHistoryErrorCode,
  onFeedbackTypeChange,
  onTargetTypeChange,
  onSearchChange,
  onCreatedFromChange,
  onCreatedToChange,
  onRankingEffectChange,
  onCommentFilterChange,
  onSortChange,
  onLimitChange,
  onExportFormatChange,
  onRefresh,
  onExport,
  onResetFilters,
  onRefreshHistory,
  onDeleteHistory
}: {
  events: FeedbackEventRecord[];
  summary?: FeedbackDiagnosticsSummary;
  state: UiState;
  errorCode?: string;
  feedbackTypeFilter: FeedbackFilterValue;
  targetTypeFilter: FeedbackTargetFilterValue;
  searchFilter: string;
  createdFromFilter: string;
  createdToFilter: string;
  rankingEffectFilter: FeedbackRankingEffectFilterValue;
  commentFilter: FeedbackCommentFilterValue;
  sortFilter: FeedbackSortOrder;
  limitFilter: number;
  exportFormat: FeedbackExportFormat;
  exportState: UiState;
  exportErrorCode?: string;
  exportHistory: FeedbackExportHistoryRecord[];
  exportHistoryState: UiState;
  exportHistoryErrorCode?: string;
  onFeedbackTypeChange: (value: FeedbackFilterValue) => void;
  onTargetTypeChange: (value: FeedbackTargetFilterValue) => void;
  onSearchChange: (value: string) => void;
  onCreatedFromChange: (value: string) => void;
  onCreatedToChange: (value: string) => void;
  onRankingEffectChange: (value: FeedbackRankingEffectFilterValue) => void;
  onCommentFilterChange: (value: FeedbackCommentFilterValue) => void;
  onSortChange: (value: FeedbackSortOrder) => void;
  onLimitChange: (value: number) => void;
  onExportFormatChange: (value: FeedbackExportFormat) => void;
  onRefresh: () => Promise<void>;
  onExport: () => Promise<void>;
  onResetFilters: () => void;
  onRefreshHistory: () => Promise<void>;
  onDeleteHistory: (historyId: string) => Promise<void>;
}) {
  const t = useT();
  const feedbackTypes: FeedbackFilterValue[] = [
    "all",
    "click",
    "useful",
    "not_useful",
    "favorite",
    "bad_citation",
    "missing_source",
    "downrank_source"
  ];
  const targetTypes: FeedbackTargetFilterValue[] = [
    "all",
    "evidence_pack",
    "ai_answer",
    "evidence_item"
  ];
  const rankingEffects: FeedbackRankingEffectFilterValue[] = [
    "all",
    "positive_weight_suggestion",
    "negative_weight_suggestion",
    "diagnostic_only"
  ];
  return (
    <section className="page-frame">
      <div className="section-title-row">
        <h2>{t("feedback.diagnostics")}</h2>
        <div className="inline-actions">
          <StateChip state={state} />
          <button className="icon-command" type="button" onClick={onRefresh}>
            <RefreshCw aria-hidden="true" size={16} />
            <span>{t("action.refresh")}</span>
          </button>
          <button
            className="icon-command"
            type="button"
            disabled={exportState === "loading"}
            onClick={onExport}
          >
            <Download aria-hidden="true" size={16} />
            <span>{t("feedback.export")}</span>
          </button>
          <button className="icon-command" type="button" onClick={onResetFilters}>
            <XCircle aria-hidden="true" size={16} />
            <span>{t("feedback.resetFilters")}</span>
          </button>
        </div>
      </div>
      <p className="section-note">{t("feedback.diagnosticsBody")}</p>
      <div className="settings-row">
        <label className="memory-label">
          <span>{t("feedback.search")}</span>
          <input
            className="query-input"
            type="search"
            value={searchFilter}
            placeholder={t("feedback.searchPlaceholder")}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
        <label className="memory-label">
          <span>{t("feedback.filterType")}</span>
          <select
            className="settings-select"
            value={feedbackTypeFilter}
            onChange={(event) => onFeedbackTypeChange(event.target.value as FeedbackFilterValue)}
          >
            {feedbackTypes.map((feedbackType) => (
              <option key={feedbackType} value={feedbackType}>
                {feedbackType === "all" ? t("feedback.allTypes") : feedbackType}
              </option>
            ))}
          </select>
        </label>
        <label className="memory-label">
          <span>{t("feedback.filterTarget")}</span>
          <select
            className="settings-select"
            value={targetTypeFilter}
            onChange={(event) => onTargetTypeChange(event.target.value as FeedbackTargetFilterValue)}
          >
            {targetTypes.map((targetType) => (
              <option key={targetType} value={targetType}>
                {targetType === "all" ? t("feedback.allTargets") : targetType}
              </option>
            ))}
          </select>
        </label>
        <label className="memory-label">
          <span>{t("feedback.rankingEffect")}</span>
          <select
            className="settings-select"
            value={rankingEffectFilter}
            onChange={(event) =>
              onRankingEffectChange(event.target.value as FeedbackRankingEffectFilterValue)
            }
          >
            {rankingEffects.map((effect) => (
              <option key={effect} value={effect}>
                {effect === "all" ? t("feedback.allRankingEffects") : effect}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="settings-row">
        <label className="memory-label">
          <span>{t("feedback.createdFrom")}</span>
          <input
            className="settings-select"
            type="datetime-local"
            value={createdFromFilter}
            onChange={(event) => onCreatedFromChange(event.target.value)}
          />
        </label>
        <label className="memory-label">
          <span>{t("feedback.createdTo")}</span>
          <input
            className="settings-select"
            type="datetime-local"
            value={createdToFilter}
            onChange={(event) => onCreatedToChange(event.target.value)}
          />
        </label>
        <label className="memory-label">
          <span>{t("feedback.commentState")}</span>
          <select
            className="settings-select"
            value={commentFilter}
            onChange={(event) =>
              onCommentFilterChange(event.target.value as FeedbackCommentFilterValue)
            }
          >
            <option value="all">{t("feedback.allComments")}</option>
            <option value="with_comment">{t("feedback.withComment")}</option>
            <option value="without_comment">{t("feedback.withoutComment")}</option>
          </select>
        </label>
      </div>
      <div className="settings-row">
        <label className="memory-label">
          <span>{t("feedback.sort")}</span>
          <select
            className="settings-select"
            value={sortFilter}
            onChange={(event) => onSortChange(event.target.value as FeedbackSortOrder)}
          >
            <option value="created_desc">{t("feedback.sortCreatedDesc")}</option>
            <option value="created_asc">{t("feedback.sortCreatedAsc")}</option>
          </select>
        </label>
        <label className="memory-label">
          <span>{t("feedback.limit")}</span>
          <input
            className="settings-select"
            min={1}
            max={100}
            type="number"
            value={limitFilter}
            onChange={(event) => {
              const value = Number(event.target.value);
              onLimitChange(Number.isFinite(value) ? Math.min(Math.max(value, 1), 100) : 50);
            }}
          />
        </label>
        <label className="memory-label">
          <span>{t("feedback.exportFormat")}</span>
          <select
            className="settings-select"
            value={exportFormat}
            onChange={(event) => onExportFormatChange(event.target.value as FeedbackExportFormat)}
          >
            <option value="json">{t("feedback.exportJson")}</option>
            <option value="csv">{t("feedback.exportCsv")}</option>
          </select>
        </label>
      </div>
      {errorCode || exportErrorCode ? (
        <div className="row-note">
          <AlertCircle aria-hidden="true" size={15} />
          <span>{errorCode ?? exportErrorCode}</span>
        </div>
      ) : null}
      <div className="metric-row">
        <Metric label={t("feedback.total")} value={summary?.total ?? 0} />
        <Metric label={t("feedback.positive")} value={summary?.positive_count ?? 0} />
        <Metric label={t("feedback.negative")} value={summary?.negative_count ?? 0} />
        <div className="metric">
          <span>{t("feedback.lastEvent")}</span>
          <strong className="metric-compact">{summary?.last_event_at ?? t("empty.none")}</strong>
        </div>
      </div>
      <div className="panel-grid">
        <article className="panel">
          <h3>{t("feedback.byType")}</h3>
          <p>{formatCounts(summary?.by_type)}</p>
        </article>
        <article className="panel">
          <h3>{t("feedback.byTarget")}</h3>
          <p>{formatCounts(summary?.by_target_type)}</p>
        </article>
        <article className="panel">
          <h3>{t("feedback.policy")}</h3>
          <p>{formatMaybe(summary?.feedback_policy)}</p>
        </article>
      </div>
      <div className="file-table">
        {events.length ? (
          events.map((event) => (
            <div className="review-row" key={event.id}>
              <div>
                <strong>{event.feedback_type}</strong>
                <span>{event.id}</span>
              </div>
              <StatusPill label="target" value={event.target_type} />
              <StatusPill label={t("feedback.rankingEffect")} value={event.ranking_effect} />
              <StatusPill label={t("feedback.citation")} value={event.citation_label ?? "none"} />
              <StatusPill label="created" value={event.created_at} />
              <div className="row-note evidence-excerpt">
                <MessageSquare aria-hidden="true" size={15} />
                <span>
                  {t("feedback.query")}: {event.query ?? t("empty.none")}
                </span>
              </div>
              {event.comment ? (
                <div className="row-note evidence-excerpt">
                  <FileText aria-hidden="true" size={15} />
                  <span>
                    {t("feedback.comment")}: {event.comment}
                  </span>
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <EmptyState
            message={state === "degraded" ? t("empty.bridgeUnavailable") : t("feedback.noEvents")}
          />
        )}
      </div>
      <div className="section-title-row compact-title-row">
        <h3>{t("feedback.exportHistory")}</h3>
        <div className="inline-actions">
          <StateChip state={exportHistoryState} />
          <button className="icon-command" type="button" onClick={onRefreshHistory}>
            <RefreshCw aria-hidden="true" size={16} />
            <span>{t("action.refresh")}</span>
          </button>
        </div>
      </div>
      {exportHistoryErrorCode ? (
        <div className="row-note">
          <AlertCircle aria-hidden="true" size={15} />
          <span>{exportHistoryErrorCode}</span>
        </div>
      ) : null}
      <div className="file-table">
        {exportHistory.length ? (
          exportHistory.map((record) => (
            <div className="review-row" key={record.id}>
              <div>
                <strong>{record.filename}</strong>
                <span>{record.id}</span>
              </div>
              <StatusPill label={t("feedback.exportFormat")} value={record.format} />
              <StatusPill label={t("feedback.records")} value={String(record.record_count)} />
              <StatusPill label={t("feedback.generatedAt")} value={record.generated_at} />
              <StatusPill label={t("feedback.redacted")} value={String(record.redacted)} />
              <div className="row-note evidence-excerpt">
                <FileText aria-hidden="true" size={15} />
                <span>
                  {t("feedback.filters")}: {formatMaybe(record.filters)}
                </span>
              </div>
              <div className="row-note evidence-excerpt">
                <FileText aria-hidden="true" size={15} />
                <span>
                  SHA256: {record.content_sha256}
                </span>
              </div>
              <button
                className="icon-command"
                type="button"
                onClick={() => onDeleteHistory(record.id)}
              >
                <XCircle aria-hidden="true" size={16} />
                <span>{t("feedback.deleteHistory")}</span>
              </button>
            </div>
          ))
        ) : (
          <EmptyState
            message={
              exportHistoryState === "degraded"
                ? t("empty.bridgeUnavailable")
                : t("feedback.noExportHistory")
            }
          />
        )}
      </div>
    </section>
  );
}

function FileListPanel({
  files,
  state,
  onRefresh,
  onVerify,
  onParse,
  onParsed
}: {
  files: FileRecord[];
  state: UiState;
  onRefresh: () => Promise<void>;
  onVerify: (fileId: string) => Promise<void>;
  onParse: (fileId: string) => Promise<void>;
  onParsed?: () => Promise<void>;
}) {
  const t = useT();
  async function handleParse(fileId: string) {
    await onParse(fileId);
    await onParsed?.();
  }

  return (
    <section className="page-frame">
      <div className="section-title-row">
        <h2>{t("files.title")}</h2>
        <button className="icon-command" type="button" onClick={onRefresh}>
          <RefreshCw aria-hidden="true" size={16} />
          <span>{t("action.refresh")}</span>
        </button>
      </div>
      <div className="file-table">
        {files.length ? (
          files.map((file) => (
            <div className="file-row" key={file.id}>
              <div>
                <strong>{file.original_filename}</strong>
                <span>
                  {formatBytes(file.size_bytes)} · {file.extension || t("files.noExtension")}
                </span>
              </div>
              <StatusPill label="file" value={file.status} />
              <StatusPill label="risk" value={file.inspection?.risk_level ?? file.inspection_status} />
              <button className="icon-command" type="button" onClick={() => onVerify(file.id)}>
                <FileCheck aria-hidden="true" size={16} />
                <span>{t("action.verify")}</span>
              </button>
              <button className="icon-command" type="button" onClick={() => handleParse(file.id)}>
                <FileText aria-hidden="true" size={16} />
                <span>{t("action.parse")}</span>
              </button>
              {file.inspection?.risk_summary ? (
                <div className="row-note">
                  <AlertCircle aria-hidden="true" size={15} />
                  <span>{file.inspection.risk_summary}</span>
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <EmptyState message={state === "degraded" ? t("empty.bridgeUnavailable") : t("files.noFiles")} />
        )}
      </div>
    </section>
  );
}

function OrganizationPanel({
  projects,
  folders,
  tags,
  sources,
  state,
  errorCode,
  selectedProjectId,
  selectedFolderId,
  selectedTagIds,
  onRefresh,
  onSelectProject,
  onSelectFolder,
  onSelectTagIds,
  onReset,
  onCreateProject,
  onCreateFolder,
  onCreateTag,
  onUpdateSource,
  onUpdateSourcesBatch,
  onUpdateKnowledgeUnit,
  onUpdateKnowledgeUnitsBatch
}: {
  projects: ProjectRecord[];
  folders: FolderRecord[];
  tags: TagRecord[];
  sources: SourceRecord[];
  state: UiState;
  errorCode: string | null;
  selectedProjectId: string;
  selectedFolderId: string | null;
  selectedTagIds: string[];
  onRefresh: () => Promise<void>;
  onSelectProject: (projectId: string) => void;
  onSelectFolder: (folderId: string | null) => void;
  onSelectTagIds: (tagIds: string[]) => void;
  onReset: () => void;
  onCreateProject: (name: string) => Promise<void>;
  onCreateFolder: (name: string) => Promise<void>;
  onCreateTag: (name: string) => Promise<void>;
  onUpdateSource: (sourceId: string, folderId: string | null, tagIds: string[]) => Promise<void>;
  onUpdateSourcesBatch: (
    sourceIds: string[],
    folderId: string | null,
    tagIds: string[]
  ) => Promise<void>;
  onUpdateKnowledgeUnit: (
    knowledgeUnitId: string,
    folderId: string | null,
    tagIds: string[]
  ) => Promise<void>;
  onUpdateKnowledgeUnitsBatch: (
    knowledgeUnitIds: string[],
    folderId: string | null,
    tagIds: string[]
  ) => Promise<void>;
}) {
  const t = useT();
  const [projectName, setProjectName] = useState("");
  const [folderName, setFolderName] = useState("");
  const [tagName, setTagName] = useState("");
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [selectedKnowledgeUnitIds, setSelectedKnowledgeUnitIds] = useState<string[]>([]);
  const [knowledgeUnits, setKnowledgeUnits] = useState<KnowledgeUnitRecord[]>([]);
  const selectedSourceIdSet = useMemo(() => new Set(selectedSourceIds), [selectedSourceIds]);
  const selectedKnowledgeUnitIdSet = useMemo(
    () => new Set(selectedKnowledgeUnitIds),
    [selectedKnowledgeUnitIds]
  );

  useEffect(() => {
    let cancelled = false;
    if (!hasBridge()) {
      setKnowledgeUnits([]);
      return () => {
        cancelled = true;
      };
    }
    listKnowledgeUnits(undefined, { projectId: selectedProjectId })
      .then((records) => {
        if (!cancelled) setKnowledgeUnits(records);
      })
      .catch(() => {
        if (!cancelled) setKnowledgeUnits([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId, state]);

  const currentFolderId = selectedFolderId || null;

  useEffect(() => {
    const visibleSourceIds = new Set(sources.map((source) => source.id));
    setSelectedSourceIds((current) => current.filter((sourceId) => visibleSourceIds.has(sourceId)));
  }, [sources]);

  useEffect(() => {
    const visibleKnowledgeUnitIds = new Set(
      knowledgeUnits.map((knowledgeUnit) => knowledgeUnit.id)
    );
    setSelectedKnowledgeUnitIds((current) =>
      current.filter((knowledgeUnitId) => visibleKnowledgeUnitIds.has(knowledgeUnitId))
    );
  }, [knowledgeUnits]);

  function toggleSourceSelection(sourceId: string) {
    setSelectedSourceIds((current) =>
      current.includes(sourceId)
        ? current.filter((id) => id !== sourceId)
        : current.length >= 50
          ? current
          : [...current, sourceId]
    );
  }

  function toggleKnowledgeUnitSelection(knowledgeUnitId: string) {
    setSelectedKnowledgeUnitIds((current) =>
      current.includes(knowledgeUnitId)
        ? current.filter((id) => id !== knowledgeUnitId)
        : current.length >= 50
          ? current
          : [...current, knowledgeUnitId]
    );
  }

  async function createNamed(kind: "project" | "folder" | "tag") {
    if (kind === "project" && projectName.trim()) {
      await onCreateProject(projectName.trim());
      setProjectName("");
    }
    if (kind === "folder" && folderName.trim()) {
      await onCreateFolder(folderName.trim());
      setFolderName("");
    }
    if (kind === "tag" && tagName.trim()) {
      await onCreateTag(tagName.trim());
      setTagName("");
    }
  }

  async function applySourceBatch() {
    if (!selectedSourceIds.length) return;
    if (selectedSourceIds.length === 1) {
      await onUpdateSource(selectedSourceIds[0], currentFolderId, selectedTagIds);
    } else {
      await onUpdateSourcesBatch(selectedSourceIds, currentFolderId, selectedTagIds);
    }
    setSelectedSourceIds([]);
  }

  async function applyKnowledgeUnitBatch() {
    if (!selectedKnowledgeUnitIds.length) return;
    if (selectedKnowledgeUnitIds.length === 1) {
      await onUpdateKnowledgeUnit(selectedKnowledgeUnitIds[0], currentFolderId, selectedTagIds);
    } else {
      await onUpdateKnowledgeUnitsBatch(selectedKnowledgeUnitIds, currentFolderId, selectedTagIds);
    }
    setSelectedKnowledgeUnitIds([]);
  }

  return (
    <section className="page-frame">
      <div className="section-title-row">
        <h2>{t("organization.title")}</h2>
        <div className="inline-actions">
          <StateChip state={state} />
          <button className="icon-command" type="button" onClick={onRefresh}>
            <RefreshCw aria-hidden="true" size={16} />
            <span>{t("action.refresh")}</span>
          </button>
        </div>
      </div>
      <p className="section-note">{t("organization.body")}</p>
      <OrganizationFilterControls
        projects={projects}
        folders={folders}
        tags={tags}
        selectedProjectId={selectedProjectId}
        selectedFolderId={selectedFolderId}
        selectedTagIds={selectedTagIds}
        onSelectProject={onSelectProject}
        onSelectFolder={onSelectFolder}
        onSelectTagIds={onSelectTagIds}
        onReset={onReset}
      />
      <div className="organization-grid">
        <label className="memory-label">
          <span>{t("organization.newProject")}</span>
          <input
            className="query-input"
            value={projectName}
            placeholder={t("organization.projectPlaceholder")}
            onChange={(event) => setProjectName(event.target.value)}
          />
          <button className="icon-command" type="button" onClick={() => createNamed("project")}>
            <Save aria-hidden="true" size={16} />
            <span>{t("action.create")}</span>
          </button>
        </label>
        <label className="memory-label">
          <span>{t("organization.newFolder")}</span>
          <input
            className="query-input"
            value={folderName}
            placeholder={t("organization.folderPlaceholder")}
            onChange={(event) => setFolderName(event.target.value)}
          />
          <button className="icon-command" type="button" onClick={() => createNamed("folder")}>
            <Save aria-hidden="true" size={16} />
            <span>{t("action.create")}</span>
          </button>
        </label>
        <label className="memory-label">
          <span>{t("organization.newTag")}</span>
          <input
            className="query-input"
            value={tagName}
            placeholder={t("organization.tagPlaceholder")}
            onChange={(event) => setTagName(event.target.value)}
          />
          <button className="icon-command" type="button" onClick={() => createNamed("tag")}>
            <Save aria-hidden="true" size={16} />
            <span>{t("action.create")}</span>
          </button>
        </label>
      </div>
      <div className="organization-grid">
        <div className="memory-label">
          <span>{t("organization.bindSource")}</span>
          <div className="file-table compact-table batch-selection-list">
            {sources.length ? (
              sources.map((source) => (
                <label className="compare-check" key={source.id}>
                  <input
                    type="checkbox"
                    checked={selectedSourceIdSet.has(source.id)}
                    disabled={!selectedSourceIdSet.has(source.id) && selectedSourceIds.length >= 50}
                    onChange={() => toggleSourceSelection(source.id)}
                  />
                  <span>{source.title}</span>
                </label>
              ))
            ) : (
              <EmptyState message={t("sources.noSources")} />
            )}
          </div>
          <button
            className="icon-command"
            type="button"
            disabled={!selectedSourceIds.length || state === "loading"}
            onClick={applySourceBatch}
          >
            <FileCheck aria-hidden="true" size={16} />
            <span>{t("organization.applyBatchBinding")}</span>
          </button>
          <StatusPill label={t("organization.selected")} value={`${selectedSourceIds.length}/50`} />
        </div>
        <div className="memory-label">
          <span>{t("organization.bindKnowledgeUnit")}</span>
          <div className="file-table compact-table batch-selection-list">
            {knowledgeUnits.length ? (
              knowledgeUnits.map((knowledgeUnit) => (
                <label className="compare-check" key={knowledgeUnit.id}>
                  <input
                    type="checkbox"
                    checked={selectedKnowledgeUnitIdSet.has(knowledgeUnit.id)}
                    disabled={
                      !selectedKnowledgeUnitIdSet.has(knowledgeUnit.id) &&
                      selectedKnowledgeUnitIds.length >= 50
                    }
                    onChange={() => toggleKnowledgeUnitSelection(knowledgeUnit.id)}
                  />
                  <span>{knowledgeUnit.title}</span>
                </label>
              ))
            ) : (
              <EmptyState message={t("organization.noKnowledgeUnits")} />
            )}
          </div>
          <button
            className="icon-command"
            type="button"
            disabled={!selectedKnowledgeUnitIds.length || state === "loading"}
            onClick={applyKnowledgeUnitBatch}
          >
            <FileCheck aria-hidden="true" size={16} />
            <span>{t("organization.applyBatchBinding")}</span>
          </button>
          <StatusPill
            label={t("organization.selected")}
            value={`${selectedKnowledgeUnitIds.length}/50`}
          />
        </div>
      </div>
      {errorCode ? (
        <div className="row-note">
          <AlertCircle aria-hidden="true" size={15} />
          <span>{errorCode}</span>
        </div>
      ) : null}
    </section>
  );
}

function OrganizationFilterControls({
  projects,
  folders,
  tags,
  selectedProjectId,
  selectedFolderId,
  selectedTagIds,
  onSelectProject,
  onSelectFolder,
  onSelectTagIds,
  onReset
}: {
  projects: ProjectRecord[];
  folders: FolderRecord[];
  tags: TagRecord[];
  selectedProjectId: string;
  selectedFolderId: string | null;
  selectedTagIds: string[];
  onSelectProject: (projectId: string) => void;
  onSelectFolder: (folderId: string | null) => void;
  onSelectTagIds: (tagIds: string[]) => void;
  onReset: () => void;
}) {
  const t = useT();
  function toggleTag(tagId: string) {
    onSelectTagIds(
      selectedTagIds.includes(tagId)
        ? selectedTagIds.filter((id) => id !== tagId)
        : [...selectedTagIds, tagId]
    );
  }
  return (
    <div className="organization-filter-grid">
      <label className="memory-label">
        <span>{t("organization.project")}</span>
        <select
          className="settings-select"
          value={selectedProjectId}
          onChange={(event) => onSelectProject(event.target.value)}
        >
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>
      <label className="memory-label">
        <span>{t("organization.folder")}</span>
        <select
          className="settings-select"
          value={selectedFolderId ?? ""}
          onChange={(event) => onSelectFolder(event.target.value || null)}
        >
          <option value="">{t("organization.allFolders")}</option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.path}
            </option>
          ))}
        </select>
      </label>
      <div className="memory-label">
        <span>{t("organization.tags")}</span>
        <div className="tag-select-row">
          {tags.length ? (
            tags.map((tag) => (
              <label className="tag-checkbox" key={tag.id}>
                <input
                  type="checkbox"
                  checked={selectedTagIds.includes(tag.id)}
                  onChange={() => toggleTag(tag.id)}
                />
                <span>{tag.name}</span>
              </label>
            ))
          ) : (
            <span className="muted-text">{t("organization.noTags")}</span>
          )}
        </div>
      </div>
      <button className="icon-command" type="button" onClick={onReset}>
        <XCircle aria-hidden="true" size={16} />
        <span>{t("organization.resetFilters")}</span>
      </button>
    </div>
  );
}

function SourceListPanel({
  sources,
  state,
  onRefresh,
  onExtract
}: {
  sources: SourceRecord[];
  state: UiState;
  onRefresh: () => Promise<void>;
  onExtract: (sourceId: string) => Promise<void>;
}) {
  const t = useT();
  return (
    <section className="page-frame">
      <div className="section-title-row">
        <h2>{t("sources.title")}</h2>
        <button className="icon-command" type="button" onClick={onRefresh}>
          <RefreshCw aria-hidden="true" size={16} />
          <span>{t("action.refresh")}</span>
        </button>
      </div>
      <div className="file-table">
        {sources.length ? (
          sources.map((source) => (
            <div className="file-row" key={source.id}>
              <div>
                <strong>{source.title}</strong>
                <span>{source.source_origin}</span>
                <span>{(source.tags ?? []).map((tag) => tag.name).join(" · ") || t("empty.none")}</span>
              </div>
              <StatusPill label="chunks" value={String(source.chunk_count)} />
              <StatusPill label="folder" value={source.primary_folder_id ?? "none"} />
              <button className="icon-command" type="button" onClick={() => onExtract(source.id)}>
                <FileText aria-hidden="true" size={16} />
                <span>{t("action.extract")}</span>
              </button>
              <div className="row-note">
                <FileText aria-hidden="true" size={15} />
                <span>{source.id}</span>
              </div>
            </div>
          ))
        ) : (
          <EmptyState message={state === "degraded" ? t("empty.bridgeUnavailable") : t("sources.noSources")} />
        )}
      </div>
    </section>
  );
}

function ReviewQueuePanel({
  tasks,
  state,
  onRefresh,
  onConfirm,
  onIgnore
}: {
  tasks: ReviewTask[];
  state: UiState;
  onRefresh: () => Promise<void>;
  onConfirm: (taskId: string) => Promise<void>;
  onIgnore: (taskId: string) => Promise<void>;
}) {
  const t = useT();
  return (
    <section className="page-frame">
      <div className="section-title-row">
        <h2>{t("review.title")}</h2>
        <button className="icon-command" type="button" onClick={onRefresh}>
          <RefreshCw aria-hidden="true" size={16} />
          <span>{t("action.refresh")}</span>
        </button>
      </div>
      <div className="file-table">
        {tasks.length ? (
          tasks.map((task) => (
            <div className="review-row" key={task.id}>
              <div>
                <strong>{String(task.payload.title ?? (task.target_type === "memory" ? t("memory.title") : t("review.candidate")))}</strong>
                <span>{String(task.payload.review_reason ?? task.target_type)}</span>
              </div>
              <StatusPill label="target" value={task.target_type} />
              <StatusPill label="status" value={task.status} />
              <button className="icon-command" type="button" onClick={() => onConfirm(task.id)}>
                <CheckCircle aria-hidden="true" size={16} />
                <span>{t("action.confirm")}</span>
              </button>
              <button className="icon-command" type="button" onClick={() => onIgnore(task.id)}>
                <XCircle aria-hidden="true" size={16} />
                <span>{t("action.ignore")}</span>
              </button>
              <div className="row-note">
                <FileText aria-hidden="true" size={15} />
                <span>{String(task.payload.source_id ?? task.target_id)}</span>
              </div>
            </div>
          ))
        ) : (
          <EmptyState message={state === "degraded" ? t("empty.bridgeUnavailable") : t("review.noTasks")} />
        )}
      </div>
    </section>
  );
}

function TextToSqlPanel({
  preview,
  state,
  errorCode
}: {
  preview?: TextToSqlPreviewResponse;
  state: UiState;
  errorCode?: string;
}) {
  const t = useT();
  const displayColumns = preview?.columns.slice(0, 6) ?? [];
  const displayRows = preview?.rows.slice(0, 8) ?? [];

  return (
    <section className="page-frame">
      <div className="section-title-row">
        <h2>{t("textToSql.title")}</h2>
        <div className="inline-actions">
          <StateChip state={state} />
          <StatusPill label="provider" value={preview?.provider_status ?? "not_ready"} />
        </div>
      </div>
      {errorCode ? (
        <div className="row-note">
          <AlertCircle aria-hidden="true" size={15} />
          <span>{errorCode}</span>
        </div>
      ) : null}
      {!preview ? (
        <EmptyState
          message={state === "degraded" ? t("empty.bridgeUnavailable") : t("textToSql.noPreview")}
        />
      ) : (
        <>
          <div className="panel-grid">
            <article className="panel">
              <h3>{t("textToSql.template")}</h3>
              <p>{preview.template_id}</p>
            </article>
            <article className="panel">
              <h3>{t("textToSql.readonly")}</h3>
              <p>{`${preview.readonly} · ${preview.safety_status}`}</p>
            </article>
            <article className="panel">
              <h3>{t("textToSql.fallback")}</h3>
              <p>{preview.fallback_reason ?? t("empty.none")}</p>
            </article>
          </div>
          <div className="sql-trace-grid">
            <section>
              <div className="section-title-row compact-title-row">
                <h3>{t("textToSql.trace")}</h3>
                <StatusPill label="rows" value={String(preview.row_count)} />
              </div>
              <pre className="sql-preview-code">{preview.generated_sql}</pre>
            </section>
            <section>
              <div className="section-title-row compact-title-row">
                <h3>{t("textToSql.parameters")}</h3>
              </div>
              <pre className="sql-preview-code">
                {JSON.stringify(preview.parameters, null, 2)}
              </pre>
            </section>
          </div>
          <section className="sql-results">
            <div className="section-title-row compact-title-row">
              <h3>{t("textToSql.results")}</h3>
              <StatusPill
                label="count"
                value={t("textToSql.rows", { count: preview.row_count })}
              />
            </div>
            {displayRows.length && displayColumns.length ? (
              <div
                className="sql-result-table"
                style={{
                  gridTemplateColumns: `repeat(${displayColumns.length}, minmax(130px, 1fr))`
                }}
              >
                {displayColumns.map((column) => (
                  <strong className="sql-result-cell" key={column}>
                    {column}
                  </strong>
                ))}
                {displayRows.flatMap((row, rowIndex) =>
                  displayColumns.map((column) => (
                    <span className="sql-result-cell" key={`${rowIndex}-${column}`}>
                      {formatMaybe(row[column])}
                    </span>
                  ))
                )}
              </div>
            ) : (
              <EmptyState message={t("textToSql.noRows")} />
            )}
          </section>
        </>
      )}
    </section>
  );
}

function EvidenceItemsPanel({
  items,
  state,
  evidencePackId,
  onOpenDetail
}: {
  items: EvidenceItemRecord[];
  state: UiState;
  evidencePackId?: string;
  onOpenDetail?: (evidencePackId: string, evidenceItemId?: string) => void;
}) {
  const t = useT();
  return (
    <section className="page-frame">
      <div className="section-title-row">
        <h2>{t("evidence.items")}</h2>
        <StateChip
          state={items.length ? "ready" : state}
          label={items.length ? t("evidence.itemCount", { count: items.length }) : undefined}
        />
      </div>
      <div className="file-table">
        {items.length ? (
          items.map((item) => (
            <div className="review-row" key={item.id}>
              <div>
                <strong>{item.citation_label}</strong>
                <span>{item.id}</span>
              </div>
              <StatusPill label="score" value={item.rank_score.toFixed(2)} />
              <StatusPill label="ku" value={item.knowledge_unit_id ?? "none"} />
              <StatusPill label="source" value={item.source_title ?? item.source_id ?? "none"} />
              <button
                className="icon-command"
                type="button"
                disabled={!evidencePackId}
                onClick={() => evidencePackId && onOpenDetail?.(evidencePackId, item.id)}
              >
                <FileText aria-hidden="true" size={16} />
                <span>{t("action.openDetail")}</span>
              </button>
              <div className="row-note evidence-excerpt">
                <FileText aria-hidden="true" size={15} />
                <span>{item.chunk_content || item.chunk_content_excerpt || item.excerpt}</span>
              </div>
            </div>
          ))
        ) : (
          <EmptyState
            message={state === "degraded" ? t("empty.bridgeUnavailable") : t("evidence.noItems")}
          />
        )}
      </div>
    </section>
  );
}

function CitationDetailPanel({
  detail,
  state,
  errorCode,
  annotations,
  annotationState = "empty",
  annotationErrorCode,
  comparison,
  compareState = "empty",
  compareErrorCode,
  focusedEvidenceItemId,
  onFocusItem,
  onCreateAnnotation,
  onCreateAnnotationsBatch,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onCompareItems,
  onClearComparison
}: {
  detail?: EvidencePackDetail;
  state: UiState;
  errorCode?: string;
  annotations?: CitationAnnotationListResponse;
  annotationState?: UiState;
  annotationErrorCode?: string;
  comparison?: CitationCompareResponse;
  compareState?: UiState;
  compareErrorCode?: string;
  focusedEvidenceItemId?: string;
  onFocusItem?: (evidenceItemId: string) => void;
  onCreateAnnotation?: (
    evidencePackId: string,
    payload: CitationAnnotationRequest
  ) => Promise<CitationAnnotationRecord | undefined>;
  onCreateAnnotationsBatch?: (
    evidencePackId: string,
    payload: CitationAnnotationBatchRequest
  ) => Promise<CitationAnnotationBatchResponse | undefined>;
  onUpdateAnnotation?: (
    annotationId: string,
    payload: CitationAnnotationPatchRequest
  ) => Promise<CitationAnnotationRecord | undefined>;
  onDeleteAnnotation?: (annotationId: string) => Promise<void>;
  onCompareItems?: (evidencePackId: string, evidenceItemIds: string[]) => Promise<void>;
  onClearComparison?: () => void;
}) {
  const t = useT();
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<"rank_desc" | "source_asc">("rank_desc");
  const [copyState, setCopyState] = useState("");
  const [annotationType, setAnnotationType] =
    useState<CitationAnnotationRequest["annotation_type"]>("note");
  const [annotationContent, setAnnotationContent] = useState("");
  const [editingAnnotationId, setEditingAnnotationId] = useState<string>();
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [batchAnnotationSelection, setBatchAnnotationSelection] = useState<string[]>([]);
  const compareSelectionSet = useMemo(() => new Set(compareSelection), [compareSelection]);
  const batchAnnotationSelectionSet = useMemo(
    () => new Set(batchAnnotationSelection),
    [batchAnnotationSelection]
  );
  const explanation = detail?.query_explanation ?? {};
  const visibleItems = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const filtered = (detail?.items ?? []).filter((item) => {
      if (!needle) return true;
      return [
        item.id,
        item.citation_label,
        item.knowledge_unit_id,
        item.knowledge_unit_title,
        item.chunk_id,
        item.chunk_citation_label,
        item.source_id,
        item.source_title,
        item.source_origin,
        item.excerpt,
        item.chunk_content,
        item.chunk_content_excerpt
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
    return [...filtered].sort((left, right) => {
      if (sort === "source_asc") {
        return (
          (left.source_title ?? left.source_id ?? "").localeCompare(
            right.source_title ?? right.source_id ?? ""
          ) || right.rank_score - left.rank_score
        );
      }
      return right.rank_score - left.rank_score;
    });
  }, [detail?.items, filter, sort]);
  const focusedItem =
    visibleItems.find((item) => item.id === focusedEvidenceItemId) ??
    detail?.items.find((item) => item.id === focusedEvidenceItemId) ??
    visibleItems[0];
  const focusedIndex = focusedItem
    ? visibleItems.findIndex((item) => item.id === focusedItem.id)
    : -1;
  const focusedTrace = focusedItem?.citation_trace as Record<string, unknown> | undefined;
  const tracePath = Array.isArray(focusedTrace?.trace_path)
    ? (focusedTrace.trace_path as Record<string, unknown>[])
    : [];
  const traceIds = focusedItem
    ? {
        evidence_pack_id: detail?.id,
        evidence_item_id: focusedItem.id,
        knowledge_unit_id: focusedItem.knowledge_unit_id,
        chunk_id: focusedItem.chunk_id,
        source_id: focusedItem.source_id,
        citation_label: focusedItem.citation_label
      }
    : undefined;
  const sourceChunkKuSummary = focusedItem
    ? [
        `citation=${focusedItem.citation_label}`,
        `source=${focusedItem.source_title ?? focusedItem.source_id ?? "unknown"}`,
        `chunk=${focusedItem.chunk_citation_label ?? focusedItem.chunk_id ?? "unknown"}`,
        `knowledge_unit=${focusedItem.knowledge_unit_title ?? focusedItem.knowledge_unit_id ?? "unknown"}`
      ].join(" | ")
    : "";
  const focusedAnnotations = focusedItem
    ? (annotations?.annotations ?? []).filter(
        (annotation) => annotation.evidence_item_id === focusedItem.id
      )
    : [];

  useEffect(() => {
    setCopyState("");
    setAnnotationContent("");
    setAnnotationType("note");
    setEditingAnnotationId(undefined);
  }, [detail?.id, focusedEvidenceItemId]);

  useEffect(() => {
    setCompareSelection([]);
    setBatchAnnotationSelection([]);
    onClearComparison?.();
  }, [detail?.id]);

  function focusRelative(delta: number) {
    if (!visibleItems.length || focusedIndex < 0) return;
    const nextIndex = (focusedIndex + delta + visibleItems.length) % visibleItems.length;
    onFocusItem?.(visibleItems[nextIndex].id);
  }

  async function copyText(label: string, value: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopyState(`${t("citation.copied")} · ${label}`);
    } catch {
      setCopyState(t("citation.copyFailed"));
    }
  }

  function startEditAnnotation(annotation: CitationAnnotationRecord) {
    setEditingAnnotationId(annotation.id);
    setAnnotationType(annotation.annotation_type);
    setAnnotationContent(annotation.content);
  }

  async function submitAnnotation() {
    if (!detail || !focusedItem || !annotationContent.trim()) return;
    const payload = {
      evidence_item_id: focusedItem.id,
      annotation_type: annotationType,
      content: annotationContent.trim()
    };
    const saved = editingAnnotationId
      ? await onUpdateAnnotation?.(editingAnnotationId, {
          annotation_type: annotationType,
          content: annotationContent.trim()
        })
      : await onCreateAnnotation?.(detail.id, payload);
    if (saved) {
      setEditingAnnotationId(undefined);
      setAnnotationContent("");
      setAnnotationType("note");
    }
  }

  async function submitBatchAnnotation() {
    if (!detail || !batchAnnotationSelection.length || !annotationContent.trim()) return;
    const saved = await onCreateAnnotationsBatch?.(detail.id, {
      evidence_item_ids: batchAnnotationSelection,
      annotation_type: annotationType,
      content: annotationContent.trim()
    });
    if (saved) {
      setBatchAnnotationSelection([]);
      setEditingAnnotationId(undefined);
      setAnnotationContent("");
      setAnnotationType("note");
    }
  }

  function toggleBatchAnnotationSelection(evidenceItemId: string) {
    setBatchAnnotationSelection((current) => {
      if (current.includes(evidenceItemId)) {
        return current.filter((id) => id !== evidenceItemId);
      }
      if (current.length >= 20) return current;
      return [...current, evidenceItemId];
    });
  }

  function toggleCompareSelection(evidenceItemId: string) {
    setCompareSelection((current) => {
      if (current.includes(evidenceItemId)) {
        return current.filter((id) => id !== evidenceItemId);
      }
      if (current.length >= 3) return current;
      return [...current, evidenceItemId];
    });
  }

  async function runCompare() {
    if (!detail || compareSelection.length < 2) return;
    await onCompareItems?.(detail.id, compareSelection);
  }

  return (
    <section className="page-frame">
      <div className="section-title-row">
        <h2>{t("citation.detail")}</h2>
        <StateChip state={state} />
      </div>
      {errorCode ? (
        <div className="row-note">
          <AlertCircle aria-hidden="true" size={15} />
          <span>{errorCode}</span>
        </div>
      ) : null}
      {detail ? (
        <>
          <div className="panel-grid">
            <article className="panel">
              <h3>{t("citation.pack")}</h3>
              <p>{detail.id}</p>
            </article>
            <article className="panel">
              <h3>{t("citation.query")}</h3>
              <p>{detail.query}</p>
            </article>
            <article className="panel">
              <h3>{t("search.fallback")}</h3>
              <p>{detail.fallback_reason ?? detail.provider_status}</p>
            </article>
          </div>
          <div className="panel-grid">
            <article className="panel">
              <h3>{t("citation.detailSummary")}</h3>
              <p>
                {t("evidence.itemCount", { count: detail.detail_summary.item_count })} ·{" "}
                {t("citation.sourceCount", { count: detail.detail_summary.source_count })} ·{" "}
                {t("citation.knowledgeUnitCount", {
                  count: detail.detail_summary.knowledge_unit_count
                })}
              </p>
            </article>
            <article className="panel">
              <h3>{t("citation.rankRange")}</h3>
              <p>
                {detail.detail_summary.rank_score_min?.toFixed(2) ?? t("empty.none")} /{" "}
                {detail.detail_summary.rank_score_max?.toFixed(2) ?? t("empty.none")}
              </p>
            </article>
            <article className="panel">
              <h3>{t("citation.noEvidenceReason")}</h3>
              <p>{detail.detail_summary.no_evidence_reason ?? t("empty.none")}</p>
            </article>
          </div>
          <div className="panel-grid">
            <article className="panel">
              <h3>{t("search.strategy")}</h3>
              <p>{formatMaybe(explanation.retrieval_strategy_profile)}</p>
            </article>
            <article className="panel">
              <h3>{t("citation.trace")}</h3>
              <p>{detail.citation_trace_summary}</p>
            </article>
            <article className="panel">
              <h3>{t("search.failure")}</h3>
              <p>{detail.failure_type ?? t("empty.none")}</p>
            </article>
          </div>
          <div className="settings-row">
            <label className="memory-label">
              <span>{t("citation.filter")}</span>
              <input
                className="query-input"
                type="search"
                value={filter}
                placeholder={t("citation.filterPlaceholder")}
                onChange={(event) => setFilter(event.target.value)}
              />
            </label>
            <label className="memory-label">
              <span>{t("citation.sort")}</span>
              <select
                className="settings-select"
                value={sort}
                onChange={(event) => setSort(event.target.value as "rank_desc" | "source_asc")}
              >
                <option value="rank_desc">{t("citation.sortRank")}</option>
                <option value="source_asc">{t("citation.sortSource")}</option>
              </select>
            </label>
            <div className="inline-actions">
              <button
                className="icon-command"
                type="button"
                disabled={!focusedItem || visibleItems.length < 2}
                onClick={() => focusRelative(-1)}
              >
                <ChevronLeft aria-hidden="true" size={16} />
                <span>{t("citation.previous")}</span>
              </button>
              <button
                className="icon-command"
                type="button"
                disabled={!focusedItem || visibleItems.length < 2}
                onClick={() => focusRelative(1)}
              >
                <ChevronRight aria-hidden="true" size={16} />
                <span>{t("citation.next")}</span>
              </button>
            </div>
          </div>
          {focusedItem ? (
            <section className="focused-citation">
              <div className="section-title-row compact-title-row">
                <h3>{t("citation.focusedItem")}</h3>
                <span className="state-chip">{focusedItem.id}</span>
              </div>
              <div className="panel-grid">
                <article className="panel">
                  <h3>{focusedItem.citation_label}</h3>
                  <p>{sourceChunkKuSummary}</p>
                </article>
                <article className="panel">
                  <h3>{t("citation.tracePath")}</h3>
                  <ol className="trace-path-list">
                    {tracePath.length ? (
                      tracePath.map((node, index) => (
                        <li key={`${formatMaybe(node.type)}-${formatMaybe(node.id)}-${index}`}>
                          <strong>{formatMaybe(node.type)}</strong>
                          <span>{formatMaybe(node.id)}</span>
                        </li>
                      ))
                    ) : (
                      <li>{t("empty.none")}</li>
                    )}
                  </ol>
                </article>
                <article className="panel">
                  <h3>{t("citation.copy")}</h3>
                  <div className="copy-actions">
                    <button
                      className="icon-command"
                      type="button"
                      onClick={() => copyText(t("citation.copyLabel"), focusedItem.citation_label)}
                    >
                      <Clipboard aria-hidden="true" size={16} />
                      <span>{t("citation.copyLabel")}</span>
                    </button>
                    <button
                      className="icon-command"
                      type="button"
                      onClick={() =>
                        copyText(t("citation.copyTraceIds"), JSON.stringify(traceIds, null, 2))
                      }
                    >
                      <Clipboard aria-hidden="true" size={16} />
                      <span>{t("citation.copyTraceIds")}</span>
                    </button>
                    <button
                      className="icon-command"
                      type="button"
                      onClick={() =>
                        copyText(t("citation.copySummary"), sourceChunkKuSummary)
                      }
                    >
                      <Clipboard aria-hidden="true" size={16} />
                      <span>{t("citation.copySummary")}</span>
                    </button>
                  </div>
                  {copyState ? <p>{copyState}</p> : null}
                </article>
              </div>
              <div className="annotation-box">
                <div className="section-title-row compact-title-row">
                  <h3>{t("citation.annotations")}</h3>
                  <StateChip state={annotationState} />
                </div>
                {annotationErrorCode ? (
                  <div className="row-note">
                    <AlertCircle aria-hidden="true" size={15} />
                    <span>{annotationErrorCode}</span>
                  </div>
                ) : null}
                <div className="memory-form">
                  <label className="memory-label">
                    <span>{t("citation.annotationType")}</span>
                    <select
                      className="settings-select"
                      value={annotationType}
                      onChange={(event) =>
                        setAnnotationType(
                          event.target.value as CitationAnnotationRequest["annotation_type"]
                        )
                      }
                    >
                      <option value="note">{t("citation.annotation.note")}</option>
                      <option value="question">{t("citation.annotation.question")}</option>
                      <option value="risk">{t("citation.annotation.risk")}</option>
                      <option value="follow_up">{t("citation.annotation.followUp")}</option>
                    </select>
                  </label>
                  <textarea
                    className="memory-textarea"
                    value={annotationContent}
                    placeholder={t("citation.annotationPlaceholder")}
                    onChange={(event) => setAnnotationContent(event.target.value)}
                  />
                  <div className="inline-actions">
                    <button
                      className="icon-command"
                      type="button"
                      disabled={!annotationContent.trim() || annotationState === "loading"}
                      onClick={submitAnnotation}
                    >
                      <Save aria-hidden="true" size={16} />
                      <span>
                        {editingAnnotationId
                          ? t("citation.updateAnnotation")
                          : t("citation.saveAnnotation")}
                      </span>
                    </button>
                    <button
                      className="icon-command"
                      type="button"
                      disabled={
                        !annotationContent.trim() ||
                        !batchAnnotationSelection.length ||
                        Boolean(editingAnnotationId) ||
                        annotationState === "loading"
                      }
                      onClick={submitBatchAnnotation}
                    >
                      <Save aria-hidden="true" size={16} />
                      <span>{t("citation.saveBatchAnnotation")}</span>
                    </button>
                    <StatusPill
                      label={t("citation.batchSelected")}
                      value={`${batchAnnotationSelection.length}/20`}
                    />
                    {editingAnnotationId ? (
                      <button
                        className="icon-command"
                        type="button"
                        onClick={() => {
                          setEditingAnnotationId(undefined);
                          setAnnotationContent("");
                          setAnnotationType("note");
                        }}
                      >
                        <XCircle aria-hidden="true" size={16} />
                        <span>{t("citation.cancelEdit")}</span>
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="file-table compact-table">
                  {focusedAnnotations.length ? (
                    focusedAnnotations.map((annotation) => (
                      <div className="review-row" key={annotation.id}>
                        <div>
                          <strong>{annotation.annotation_type}</strong>
                          <span>{annotation.updated_at}</span>
                        </div>
                        <p className="annotation-content">{annotation.content}</p>
                        <div className="inline-actions">
                          <button
                            className="icon-command"
                            type="button"
                            onClick={() => startEditAnnotation(annotation)}
                          >
                            <FileText aria-hidden="true" size={16} />
                            <span>{t("citation.editAnnotation")}</span>
                          </button>
                          <button
                            className="icon-command"
                            type="button"
                            disabled={annotationState === "loading"}
                            onClick={() => onDeleteAnnotation?.(annotation.id)}
                          >
                            <Trash2 aria-hidden="true" size={16} />
                            <span>{t("citation.deleteAnnotation")}</span>
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState message={t("citation.noAnnotations")} />
                  )}
                </div>
              </div>
            </section>
          ) : null}
          <section className="focused-citation">
            <div className="section-title-row compact-title-row">
              <h3>{t("citation.compare")}</h3>
              <StateChip state={compareState} />
            </div>
            <div className="inline-actions">
              <button
                className="icon-command"
                type="button"
                disabled={compareSelection.length < 2 || compareState === "loading"}
                onClick={runCompare}
              >
                <GitBranch aria-hidden="true" size={16} />
                <span>{t("citation.runCompare")}</span>
              </button>
              <button
                className="icon-command"
                type="button"
                onClick={() => {
                  setCompareSelection([]);
                  onClearComparison?.();
                }}
              >
                <XCircle aria-hidden="true" size={16} />
                <span>{t("feedback.resetFilters")}</span>
              </button>
              <StatusPill label="selected" value={`${compareSelection.length}/3`} />
            </div>
            {compareErrorCode ? (
              <div className="row-note">
                <AlertCircle aria-hidden="true" size={15} />
                <span>{compareErrorCode}</span>
              </div>
            ) : null}
            {comparison ? (
              <>
                <div className="panel-grid">
                  <article className="panel">
                    <h3>{t("citation.compareSummary")}</h3>
                    <p>{comparison.copy_safe_summary}</p>
                  </article>
                  <article className="panel">
                    <h3>{t("citation.compareDifferences")}</h3>
                    <p>{formatMaybe(comparison.differences)}</p>
                  </article>
                  <article className="panel">
                    <h3>{t("citation.copy")}</h3>
                    <button
                      className="icon-command"
                      type="button"
                      onClick={() =>
                        copyText(t("citation.copyCompare"), comparison.copy_safe_summary)
                      }
                    >
                      <Clipboard aria-hidden="true" size={16} />
                      <span>{t("citation.copyCompare")}</span>
                    </button>
                  </article>
                </div>
                <div className="file-table compact-table">
                  {comparison.items.map((item) => (
                    <div className="review-row" key={item.id}>
                      <div>
                        <strong>{item.citation_label}</strong>
                        <span>{item.id}</span>
                      </div>
                      <StatusPill label="score" value={item.rank_score.toFixed(2)} />
                      <StatusPill label="source" value={item.source_title ?? item.source_id ?? "none"} />
                      <StatusPill label="ku" value={item.knowledge_unit_title ?? item.knowledge_unit_id ?? "none"} />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState message={t("citation.noCompare")} />
            )}
          </section>
          <div className="file-table">
            {visibleItems.length ? (
              visibleItems.map((item) => (
                <div
                  className={`review-row ${focusedItem?.id === item.id ? "is-focused" : ""}`}
                  key={item.id}
                >
                  <div>
                    <strong>{item.knowledge_unit_title ?? item.citation_label}</strong>
                    <span>{item.knowledge_unit_status ?? "unknown"} · {item.knowledge_unit_type ?? "unknown"}</span>
                  </div>
                  <label className="compare-check">
                    <input
                      type="checkbox"
                      checked={compareSelectionSet.has(item.id)}
                      disabled={
                        !compareSelectionSet.has(item.id) && compareSelection.length >= 3
                      }
                      onChange={() => toggleCompareSelection(item.id)}
                    />
                    <span>{t("citation.compareSelect")}</span>
                  </label>
                  <label className="compare-check">
                    <input
                      type="checkbox"
                      checked={batchAnnotationSelectionSet.has(item.id)}
                      disabled={
                        !batchAnnotationSelectionSet.has(item.id) &&
                        batchAnnotationSelection.length >= 20
                      }
                      onChange={() => toggleBatchAnnotationSelection(item.id)}
                    />
                    <span>{t("citation.batchAnnotateSelect")}</span>
                  </label>
                  <StatusPill label="source" value={item.source_origin ?? "unknown"} />
                  <StatusPill label="score" value={item.rank_score.toFixed(2)} />
                  <button
                    className="icon-command"
                    type="button"
                    onClick={() => onFocusItem?.(item.id)}
                  >
                    <FileText aria-hidden="true" size={16} />
                    <span>{t("citation.focus")}</span>
                  </button>
                  <div className="row-note evidence-excerpt">
                    <FileText aria-hidden="true" size={15} />
                    <span>
                      {item.source_title ?? item.source_id} · {item.chunk_citation_label ?? item.citation_label}
                    </span>
                  </div>
                  <div className="row-note evidence-excerpt">
                    <FileText aria-hidden="true" size={15} />
                    <span>{item.chunk_content || item.chunk_content_excerpt || item.excerpt}</span>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState message={detail.summary} />
            )}
          </div>
        </>
      ) : (
        <EmptyState message={t("citation.noDetail")} />
      )}
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="empty-state">{message}</div>;
}

function SettingsPage() {
  const t = useT();
  const runtime = useRuntimeStore();
  const settings = useSettingsStore();
  const state = settings.state === "done" && runtime.status?.runtime_state === "ready" ? "done" : settings.state;
  return (
    <section className="page-grid">
      <section className="page-frame">
        <div className="section-title-row">
          <h2>{t("settings.languageTitle")}</h2>
          <StateChip state={settings.state} />
        </div>
        <div className="settings-row">
          <div>
            <strong>{t("settings.languageTitle")}</strong>
            <p>{t("settings.languageBody")}</p>
          </div>
          <select
            className="settings-select"
            value={settings.language}
            onChange={(event) => settings.setLanguage(event.target.value as LanguageCode)}
          >
            {supportedLanguages.map((language) => (
              <option key={language.code} value={language.code}>
                {language.label}
              </option>
            ))}
          </select>
        </div>
        <div className="row-note">
          <Settings aria-hidden="true" size={15} />
          <span>
            {settings.persistence === "config_json"
              ? t("settings.persistenceBackend")
              : t("settings.persistenceFallback")}
          </span>
        </div>
        {settings.errorCode ? (
          <div className="row-note">
            <AlertCircle aria-hidden="true" size={15} />
            <span>{settings.errorCode}</span>
          </div>
        ) : null}
      </section>
      <AIModelSettingsPanel />
      <PageFrame
        state={state}
        title={t("settings.title")}
        sections={[
          [t("settings.app"), `${appIdentity.appName} · ${appIdentity.bundleId}`],
          [t("settings.storage"), runtime.status?.database.path ?? t("settings.storageFallback")],
          [t("settings.provider"), runtime.status?.vector.fallback_reason ?? t("settings.providerFallback")]
        ]}
      />
    </section>
  );
}

type AIModelSettingsForm = {
  provider: string;
  baseUrl: string;
  textModel: string;
  visionModel: string;
  endpoint: "chat_completions" | "responses";
  apiKey: string;
};

const defaultAIModelSettingsForm: AIModelSettingsForm = {
  provider: "dashscope",
  baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  textModel: "qwen-plus",
  visionModel: "qwen-vl-ocr-latest",
  endpoint: "chat_completions",
  apiKey: ""
};

function AIModelSettingsPanel() {
  const [settings, setSettings] = useState<AIModelSettingsResponse | null>(null);
  const [form, setForm] = useState<AIModelSettingsForm>(defaultAIModelSettingsForm);
  const [testResult, setTestResult] = useState<AIModelTestResponse | null>(null);
  const [state, setState] = useState<UiState>("empty");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const canUseBackend = hasBridge();

  useEffect(() => {
    void refreshAIModelSettings();
  }, []);

  async function refreshAIModelSettings() {
    if (!canUseBackend) {
      setState("degraded");
      setErrorCode("desktop_bridge_unavailable");
      return;
    }
    setState("loading");
    setErrorCode(null);
    try {
      const next = await getAIModelSettings();
      applyAIModelSettings(next);
      setState("done");
    } catch (error) {
      setState("recoverable_error");
      setErrorCode(resolveErrorCode(error, "ai_model_settings_load_failed"));
    }
  }

  function applyAIModelSettings(next: AIModelSettingsResponse) {
    setSettings(next);
    setForm({
      provider: next.provider,
      baseUrl: next.base_url,
      textModel: next.text_model,
      visionModel: next.vision_model,
      endpoint: next.endpoint,
      apiKey: ""
    });
  }

  async function saveAIModelSettings() {
    if (!canUseBackend) return;
    setState("loading");
    setErrorCode(null);
    try {
      const next = await patchAIModelSettings({
        provider: form.provider,
        base_url: form.baseUrl,
        text_model: form.textModel,
        vision_model: form.visionModel,
        endpoint: form.endpoint,
        api_key: form.apiKey.trim() || undefined
      });
      applyAIModelSettings(next);
      setState("done");
    } catch (error) {
      setState("recoverable_error");
      setErrorCode(resolveErrorCode(error, "ai_model_settings_save_failed"));
    }
  }

  async function runAIModelTest() {
    if (!canUseBackend) return;
    setState("loading");
    setErrorCode(null);
    setTestResult(null);
    try {
      const result = await testAIModelSettings();
      setTestResult(result);
      const next = await getAIModelSettings();
      applyAIModelSettings(next);
      setState(result.ok ? "done" : "recoverable_error");
      setErrorCode(result.ok ? null : result.error_code ?? "ai_model_test_failed");
    } catch (error) {
      setState("recoverable_error");
      setErrorCode(resolveErrorCode(error, "ai_model_test_failed"));
    }
  }

  async function removeAIModelKey() {
    if (!canUseBackend) return;
    setState("loading");
    setErrorCode(null);
    try {
      const next = await deleteAIModelKey();
      applyAIModelSettings(next);
      setTestResult(null);
      setState("done");
    } catch (error) {
      setState("recoverable_error");
      setErrorCode(resolveErrorCode(error, "ai_model_key_delete_failed"));
    }
  }

  const lastTest = settings?.last_test;
  return (
    <section className="page-frame">
      <div className="section-title-row">
        <div>
          <h2>模型配置 / AI Provider</h2>
          <p className="section-note">配置一次 DashScope / 百炼 Key，Demo 1 自动用于语义分析、Candidate KU 和 OCR。</p>
        </div>
        <StateChip state={state} />
      </div>
      <div className="settings-row">
        <label className="memory-label">
          <span>Provider</span>
          <input
            className="query-input"
            value={form.provider}
            onChange={(event) => setForm({ ...form, provider: event.target.value })}
          />
        </label>
        <label className="memory-label">
          <span>Base URL</span>
          <input
            className="query-input"
            value={form.baseUrl}
            onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}
          />
        </label>
      </div>
      <div className="settings-row">
        <label className="memory-label">
          <span>文本模型</span>
          <input
            className="query-input"
            value={form.textModel}
            onChange={(event) => setForm({ ...form, textModel: event.target.value })}
          />
        </label>
        <label className="memory-label">
          <span>OCR 模型</span>
          <input
            className="query-input"
            value={form.visionModel}
            onChange={(event) => setForm({ ...form, visionModel: event.target.value })}
          />
        </label>
      </div>
      <div className="settings-row">
        <label className="memory-label">
          <span>Endpoint</span>
          <select
            className="settings-select"
            value={form.endpoint}
            onChange={(event) =>
              setForm({ ...form, endpoint: event.target.value as AIModelSettingsForm["endpoint"] })
            }
          >
            <option value="chat_completions">chat_completions</option>
            <option value="responses">responses</option>
          </select>
        </label>
        <label className="memory-label">
          <span>API Key</span>
          <input
            className="query-input"
            type="password"
            autoComplete="off"
            placeholder={settings?.key_status === "configured" ? "已保存，可留空" : "粘贴 DashScope / 百炼 Key"}
            value={form.apiKey}
            onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
          />
        </label>
      </div>
      <div className="inline-actions">
        <StatusPill label="key" value={`${settings?.key_status ?? "missing"} / ${settings?.key_source ?? "none"}`} />
        <StatusPill label="storage" value={settings?.storage_status ?? "unknown"} />
        <StatusPill label="text" value={settings?.text_model ?? form.textModel} />
        <StatusPill label="OCR" value={settings?.vision_model ?? form.visionModel} />
      </div>
      {lastTest ? (
        <div className="row-note">
          <CheckCircle aria-hidden="true" size={15} />
          <span>
            最近测试：文本 {lastTest.text_model_status ?? "unknown"}，OCR{" "}
            {lastTest.vision_model_status ?? "unknown"}，{lastTest.ok ? "连接可用" : lastTest.error_code}
          </span>
        </div>
      ) : null}
      {testResult ? (
        <div className="row-note">
          <Gauge aria-hidden="true" size={15} />
          <span>{testResult.ok ? "测试通过，模型可用。" : testResult.error_message ?? testResult.error_code}</span>
        </div>
      ) : null}
      {errorCode ? (
        <div className="row-note">
          <AlertCircle aria-hidden="true" size={15} />
          <span>{errorCode}</span>
        </div>
      ) : null}
      <div className="inline-actions">
        <button className="icon-command" type="button" disabled={!canUseBackend || state === "loading"} onClick={saveAIModelSettings}>
          <Save aria-hidden="true" size={15} />
          <span>保存配置</span>
        </button>
        <button className="icon-command" type="button" disabled={!canUseBackend || state === "loading"} onClick={runAIModelTest}>
          <RefreshCw aria-hidden="true" size={15} />
          <span>测试连接</span>
        </button>
        <button className="icon-command" type="button" disabled={!canUseBackend || state === "loading"} onClick={removeAIModelKey}>
          <Trash2 aria-hidden="true" size={15} />
          <span>删除密钥</span>
        </button>
      </div>
      <div className="row-note">
        <AlertCircle aria-hidden="true" size={15} />
        <span>API Key 只提交给本机后端加密保存；前端不持久化、不显示、不写入仓库。</span>
      </div>
    </section>
  );
}

function PageFrame({
  title,
  state,
  sections
}: {
  title: string;
  state: UiState;
  sections: [string, string][];
}) {
  return (
    <section className="page-frame">
      <div className="section-title-row">
        <h2>{title}</h2>
        <StateChip state={state} />
      </div>
      <div className="panel-grid">
        {sections.map(([heading, body]) => (
          <article className="panel" key={heading}>
            <h3>{heading}</h3>
            <p>{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatMaybe(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value == null) return "not_ready";
  return JSON.stringify(value);
}

function datetimeLocalToIso(value: string) {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function downloadTextFile(filename: string, mimeType: string, content: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadBase64File(filename: string, mimeType: string, contentBase64: string) {
  const binary = atob(contentBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatCounts(value?: Record<string, unknown>) {
  if (!value || !Object.keys(value).length) return "none";
  return Object.entries(value)
    .map(([key, count]) => `${key}: ${count}`)
    .join(" · ");
}

function memoryTypeKey(memoryType: MemoryDraftRecord["memory_type"]): MessageKey {
  return `memory.type.${memoryType}` as MessageKey;
}
