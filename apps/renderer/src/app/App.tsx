import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import Uppy from "@uppy/core";
import {
  Archive,
  AlertCircle,
  Bookmark,
  Bot,
  Boxes,
  CheckCircle,
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
  type LucideIcon
} from "lucide-react";
import type {
  EvidenceItemRecord,
  EvidencePackDetail,
  FeedbackRequest,
  FileRecord,
  MemoryDraftRecord,
  MemoryDraftRequest,
  ReviewTask
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
import { hasBridge } from "../services/apiClient";
import { supportedLanguages, translate, type LanguageCode, type MessageKey } from "../services/i18n";

type RouteKey =
  | "/dashboard"
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

const routes: RouteConfig[] = [
  { path: "/dashboard", labelKey: "route.dashboard", icon: Gauge, summaryKey: "route.dashboard.summary" },
  { path: "/import", labelKey: "route.import", icon: Upload, summaryKey: "route.import.summary" },
  { path: "/library", labelKey: "route.library", icon: Archive, summaryKey: "route.library.summary" },
  { path: "/search", labelKey: "route.search", icon: Search, summaryKey: "route.search.summary" },
  { path: "/ask", labelKey: "route.ask", icon: MessageSquare, summaryKey: "route.ask.summary" },
  { path: "/graph", labelKey: "route.graph", icon: GitBranch, summaryKey: "route.graph.summary" },
  { path: "/outputs", labelKey: "route.outputs", icon: FileInput, summaryKey: "route.outputs.summary" },
  { path: "/settings", labelKey: "route.settings", icon: Settings, summaryKey: "route.settings.summary" }
];

function currentPath(): RouteKey {
  const path = window.location.pathname as RouteKey;
  return routes.some((route) => route.path === path) ? path : defaultRendererRoute;
}

export function App() {
  const [activePath, setActivePath] = useState<RouteKey>(currentPath());
  const runtime = useRuntimeStore();
  const workspace = useWorkspaceStore();
  const refreshSettings = useSettingsStore((state) => state.refresh);
  const refreshMemories = useFeedbackMemoryStore((state) => state.refreshMemories);
  const t = useT();

  useEffect(() => {
    runtime.refresh();
    workspace.refresh();
    refreshSettings();
    refreshMemories();
  }, []);

  const activeRoute = useMemo(
    () => routes.find((route) => route.path === activePath) ?? routes[0],
    [activePath]
  );

  function navigate(path: RouteKey) {
    setActivePath(path);
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
          </div>
          <button className="icon-command" type="button" title={t("action.refresh")} onClick={() => runtime.refresh()}>
            <Bot aria-hidden="true" size={18} />
            <span>{t("action.refresh")}</span>
          </button>
        </header>
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

function RoutePanel({ path }: { path: RouteKey }) {
  const t = useT();
  switch (path) {
    case "/dashboard":
      return <DashboardPage />;
    case "/import":
      return <ImportPage />;
    case "/library":
      return <LibraryPage />;
    case "/search":
      return <SearchPage />;
    case "/ask":
      return <AskPage />;
    case "/graph":
      return (
        <PageFrame
          state="degraded"
          title={t("graph.title")}
          sections={[
            [t("search.failure"), t("graph.disabled")],
            [t("graph.boundaryTitle"), t("graph.boundary")],
            [t("graph.sourceLinkTitle"), t("graph.sourceLink")]
          ]}
        />
      );
    case "/outputs":
      return <OutputsPage />;
    case "/settings":
      return <SettingsPage />;
  }
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
      </div>
      <PageFrame
        state={workspace.state}
        title={t("dashboard.summary.title")}
        sections={[
          [t("dashboard.runtime"), runtime.status?.status_reason ?? t("dashboard.runtimeReady")],
          [t("dashboard.recentImports"), t("dashboard.filesReceived", { count: workspace.summary.file_count })],
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
        message: error instanceof Error ? error.message : "upload_failed"
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
          <span className={`state-chip state-${hasBridge() ? "empty" : "degraded"}`}>
            {hasBridge() ? t("state.ready") : t("state.degraded")}
          </span>
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
          <span className="state-chip">
            {queue.length ? t("import.queued", { count: queue.length }) : t("import.emptyQueue")}
          </span>
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
  useEffect(() => {
    files.refresh();
    sources.refresh();
    review.refresh();
  }, []);

  async function parseAndRefresh(fileId: string) {
    await files.parse(fileId);
    await Promise.all([sources.refresh(), workspace.refresh()]);
  }

  async function extractAndRefresh(sourceId: string) {
    await sources.extract(sourceId);
    await Promise.all([review.refresh(), workspace.refresh()]);
  }

  async function completeReview(action: "confirm" | "ignore", taskId: string) {
    if (action === "confirm") {
      await review.confirm(taskId);
    } else {
      await review.ignore(taskId);
    }
    await workspace.refresh();
  }

  return (
    <section className="page-grid">
      <FileListPanel
        files={files.files}
        state={files.state}
        onRefresh={files.refresh}
        onVerify={files.verify}
        onParse={parseAndRefresh}
        onParsed={() => Promise.all([sources.refresh(), workspace.refresh()]).then(() => undefined)}
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
  const [query, setQuery] = useState(retrieval.lastQuery || "Evidence Pack Source Chunk");
  const preview = retrieval.preview;
  const explanation = preview?.query_explanation ?? {};

  async function runSearch() {
    const trimmed = query.trim();
    if (!trimmed) return;
    await retrieval.previewQuery(trimmed);
  }

  return (
    <section className="page-grid">
      <section className="page-frame">
        <div className="section-title-row">
          <h2>{t("search.preview")}</h2>
          <span className={`state-chip state-${retrieval.previewState}`}>
            {retrieval.previewState}
          </span>
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
        onOpenDetail={(evidencePackId) => retrieval.loadDetail(evidencePackId)}
        evidencePackId={preview?.evidence_pack_id}
      />

      <CitationDetailPanel
        detail={retrieval.detail}
        state={retrieval.detailState}
        errorCode={retrieval.detailErrorCode}
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
  const [query, setQuery] = useState(retrieval.lastQuery || "Evidence Pack Source Chunk");
  const [memoryType, setMemoryType] = useState<MemoryDraftRequest["memory_type"]>("decision");
  const [memoryContent, setMemoryContent] = useState("");
  const answer = retrieval.answer;

  useEffect(() => {
    setMemoryContent(answer?.answer ?? "");
  }, [answer?.answer_id]);

  async function runAsk() {
    const trimmed = query.trim();
    if (!trimmed) return;
    await retrieval.ask(trimmed);
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
          <span className={`state-chip state-${retrieval.answerState}`}>
            {retrieval.answerState}
          </span>
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
          <span className={`state-chip state-${feedbackMemory.feedbackState}`}>
            {feedbackMemory.feedbackState}
          </span>
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
          <span className={`state-chip state-${feedbackMemory.memoryState}`}>
            {feedbackMemory.memoryState}
          </span>
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
            <p>{answer?.citation_labels.length ? answer.citation_labels.join(", ") : t("empty.none")}</p>
          </article>
          <article className="panel">
            <h3>{t("ask.evidenceItems")}</h3>
            <p>{answer?.evidence_item_ids.length ? answer.evidence_item_ids.join(", ") : t("empty.none")}</p>
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

  useEffect(() => {
    feedbackMemory.refreshMemories();
  }, []);

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
            <span className={`state-chip state-${feedbackMemory.memoryState}`}>
              {feedbackMemory.memoryState}
            </span>
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
    </section>
  );
}

function MemoryDraftList({
  memories,
  state
}: {
  memories: MemoryDraftRecord[];
  state: "loading" | "empty" | "degraded" | "recoverable_error" | "done";
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

function FileListPanel({
  files,
  state,
  onRefresh,
  onVerify,
  onParse,
  onParsed
}: {
  files: FileRecord[];
  state: "loading" | "empty" | "degraded" | "recoverable_error" | "done";
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

function SourceListPanel({
  sources,
  state,
  onRefresh,
  onExtract
}: {
  sources: {
    id: string;
    title: string;
    source_origin: string;
    chunk_count: number;
    created_at: string;
  }[];
  state: "loading" | "empty" | "degraded" | "recoverable_error" | "done";
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
              </div>
              <StatusPill label="chunks" value={String(source.chunk_count)} />
              <StatusPill label="state" value="parsed" />
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
  state: "loading" | "empty" | "degraded" | "recoverable_error" | "done";
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

function EvidenceItemsPanel({
  items,
  state,
  evidencePackId,
  onOpenDetail
}: {
  items: EvidenceItemRecord[];
  state: "loading" | "empty" | "degraded" | "recoverable_error" | "done";
  evidencePackId?: string;
  onOpenDetail?: (evidencePackId: string) => void;
}) {
  const t = useT();
  return (
    <section className="page-frame">
      <div className="section-title-row">
        <h2>{t("evidence.items")}</h2>
        <span className="state-chip">{items.length ? t("evidence.itemCount", { count: items.length }) : state}</span>
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
              <button
                className="icon-command"
                type="button"
                disabled={!evidencePackId}
                onClick={() => evidencePackId && onOpenDetail?.(evidencePackId)}
              >
                <FileText aria-hidden="true" size={16} />
                <span>{t("action.openDetail")}</span>
              </button>
              <div className="row-note evidence-excerpt">
                <FileText aria-hidden="true" size={15} />
                <span>{item.excerpt}</span>
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
  errorCode
}: {
  detail?: EvidencePackDetail;
  state: "loading" | "empty" | "degraded" | "recoverable_error" | "done";
  errorCode?: string;
}) {
  const t = useT();
  const explanation = detail?.query_explanation ?? {};
  return (
    <section className="page-frame">
      <div className="section-title-row">
        <h2>{t("citation.detail")}</h2>
        <span className={`state-chip state-${state}`}>{state}</span>
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
          <div className="file-table">
            {detail.items.length ? (
              detail.items.map((item) => (
                <div className="review-row" key={item.id}>
                  <div>
                    <strong>{item.knowledge_unit_title ?? item.citation_label}</strong>
                    <span>{item.knowledge_unit_status ?? "unknown"} · {item.knowledge_unit_type ?? "unknown"}</span>
                  </div>
                  <StatusPill label="source" value={item.source_origin ?? "unknown"} />
                  <StatusPill label="score" value={item.rank_score.toFixed(2)} />
                  <div className="row-note evidence-excerpt">
                    <FileText aria-hidden="true" size={15} />
                    <span>
                      {item.source_title ?? item.source_id} · {item.chunk_citation_label ?? item.citation_label}
                    </span>
                  </div>
                  <div className="row-note evidence-excerpt">
                    <FileText aria-hidden="true" size={15} />
                    <span>{item.chunk_content_excerpt || item.excerpt}</span>
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
          <span className={`state-chip state-${settings.state}`}>{settings.state}</span>
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

function PageFrame({
  title,
  state,
  sections
}: {
  title: string;
  state: "loading" | "empty" | "degraded" | "recoverable_error" | "done";
  sections: [string, string][];
}) {
  return (
    <section className="page-frame">
      <div className="section-title-row">
        <h2>{title}</h2>
        <span className={`state-chip state-${state}`}>{state}</span>
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

function memoryTypeKey(memoryType: MemoryDraftRecord["memory_type"]): MessageKey {
  return `memory.type.${memoryType}` as MessageKey;
}
