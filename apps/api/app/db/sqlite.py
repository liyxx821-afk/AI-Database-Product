from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from app.core.config import get_settings


def ensure_data_dirs() -> None:
    settings = get_settings()
    settings.app_data_dir.mkdir(parents=True, exist_ok=True)
    (settings.app_data_dir / "logs").mkdir(exist_ok=True)
    (settings.app_data_dir / "backups").mkdir(exist_ok=True)
    (settings.app_data_dir / "tmp" / "uploads").mkdir(parents=True, exist_ok=True)
    (settings.app_data_dir / "sources").mkdir(exist_ok=True)


def connect() -> sqlite3.Connection:
    ensure_data_dirs()
    conn = sqlite3.connect(get_settings().database_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=5000")
    return conn


@contextmanager
def db() -> Iterator[sqlite3.Connection]:
    conn = connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def initialize_database() -> None:
    ensure_data_dirs()
    with db() as conn:
        conn.executescript(SCHEMA_SQL)
        conn.execute(
            """
            INSERT OR IGNORE INTO local_users (id, display_name, created_at)
            VALUES ('local-user', 'Local User', datetime('now'))
            """
        )
        conn.execute(
            """
            INSERT OR IGNORE INTO projects (id, name, description, created_at, updated_at)
            VALUES (
              'default-space',
              'Default Knowledge Space',
              'P0 local workspace',
              datetime('now'),
              datetime('now')
            )
            """
        )


def quick_check() -> str:
    with db() as conn:
        result = conn.execute("PRAGMA quick_check").fetchone()
        if not result:
            return "failed"
        return "ok" if result[0] == "ok" else "failed"


def sqlite_vec_status() -> dict:
    with db() as conn:
        try:
            conn.execute("SELECT vec_version()").fetchone()
            return {"status": "available", "provider": "sqlite_vec", "fallback_reason": None}
        except sqlite3.Error as exc:
            return {
                "status": "degraded",
                "provider": "fallback",
                "fallback_reason": f"sqlite-vec extension unavailable: {exc.__class__.__name__}",
            }


def json_dumps(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def database_path() -> Path:
    return get_settings().database_path


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS local_users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  namespace TEXT NOT NULL,
  tag_type TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS upload_tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  content_type TEXT,
  expected_size INTEGER NOT NULL,
  part_size INTEGER NOT NULL,
  expected_sha256 TEXT,
  received_bytes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  file_id TEXT,
  job_id TEXT,
  recoverable INTEGER NOT NULL DEFAULT 1,
  error_code TEXT,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS upload_parts (
  id TEXT PRIMARY KEY,
  upload_id TEXT NOT NULL,
  part_no INTEGER NOT NULL,
  size_bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(upload_id, part_no),
  FOREIGN KEY(upload_id) REFERENCES upload_tasks(id)
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  content_type TEXT,
  extension TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL,
  inspection_status TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS file_integrity_checks (
  id TEXT PRIMARY KEY,
  upload_id TEXT NOT NULL,
  file_id TEXT,
  expected_sha256 TEXT,
  actual_sha256 TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(upload_id) REFERENCES upload_tasks(id),
  FOREIGN KEY(file_id) REFERENCES files(id)
);

CREATE TABLE IF NOT EXISTS file_inspection_results (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  status TEXT NOT NULL,
  extension TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  header_summary TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  risk_summary TEXT NOT NULL,
  recoverable INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(file_id) REFERENCES files(id),
  FOREIGN KEY(job_id) REFERENCES processing_jobs(id)
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_origin TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  citation_label TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(source_id) REFERENCES sources(id),
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS parse_tasks (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  source_id TEXT,
  job_id TEXT NOT NULL,
  parser_key TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  provider_key TEXT NOT NULL,
  profile TEXT NOT NULL,
  capability_status TEXT NOT NULL,
  fallback_reason TEXT,
  status TEXT NOT NULL,
  output_text_path TEXT,
  error_code TEXT,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(file_id) REFERENCES files(id),
  FOREIGN KEY(source_id) REFERENCES sources(id),
  FOREIGN KEY(job_id) REFERENCES processing_jobs(id)
);

CREATE TABLE IF NOT EXISTS parse_warnings (
  id TEXT PRIMARY KEY,
  parse_task_id TEXT NOT NULL,
  warning_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  source_location TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(parse_task_id) REFERENCES parse_tasks(id)
);

CREATE TABLE IF NOT EXISTS chunk_quality_checks (
  id TEXT PRIMARY KEY,
  chunk_id TEXT NOT NULL,
  check_type TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(chunk_id) REFERENCES chunks(id)
);

CREATE TABLE IF NOT EXISTS knowledge_units (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  chunk_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL,
  user_verified INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(source_id) REFERENCES sources(id),
  FOREIGN KEY(chunk_id) REFERENCES chunks(id),
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS review_tasks (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  status TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS embeddings (
  id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  embedding_profile TEXT NOT NULL,
  dimension INTEGER NOT NULL,
  vector_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS processing_jobs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS processing_status_events (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  event_seq INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(job_id) REFERENCES processing_jobs(id)
);

CREATE TABLE IF NOT EXISTS retrieval_logs (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  query_intent TEXT NOT NULL,
  filters_json TEXT NOT NULL,
  capability_status TEXT NOT NULL,
  fallback_reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence_packs (
  id TEXT PRIMARY KEY,
  retrieval_log_id TEXT NOT NULL,
  status TEXT NOT NULL,
  failure_type TEXT,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(retrieval_log_id) REFERENCES retrieval_logs(id)
);

CREATE TABLE IF NOT EXISTS evidence_items (
  id TEXT PRIMARY KEY,
  evidence_pack_id TEXT NOT NULL,
  knowledge_unit_id TEXT,
  chunk_id TEXT,
  source_id TEXT,
  citation_label TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  rank_score REAL NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(evidence_pack_id) REFERENCES evidence_packs(id)
);

CREATE TABLE IF NOT EXISTS ai_answers (
  id TEXT PRIMARY KEY,
  retrieval_log_id TEXT NOT NULL,
  evidence_pack_id TEXT NOT NULL,
  output_type TEXT NOT NULL,
  answer TEXT NOT NULL,
  evidence_item_ids_json TEXT NOT NULL,
  citation_labels_json TEXT NOT NULL,
  citation_trace_summary TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(retrieval_log_id) REFERENCES retrieval_logs(id),
  FOREIGN KEY(evidence_pack_id) REFERENCES evidence_packs(id)
);

CREATE TABLE IF NOT EXISTS feedback_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  evidence_pack_id TEXT,
  ai_answer_id TEXT,
  evidence_item_id TEXT,
  feedback_type TEXT NOT NULL,
  comment TEXT,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(evidence_pack_id) REFERENCES evidence_packs(id),
  FOREIGN KEY(ai_answer_id) REFERENCES ai_answers(id),
  FOREIGN KEY(evidence_item_id) REFERENCES evidence_items(id)
);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  source_answer_id TEXT NOT NULL,
  content TEXT NOT NULL,
  memory_type TEXT NOT NULL,
  status TEXT NOT NULL,
  permission TEXT NOT NULL,
  user_confirmed INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id),
  FOREIGN KEY(source_answer_id) REFERENCES ai_answers(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS system_logs (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  content,
  chunk_id UNINDEXED,
  source_id UNINDEXED,
  knowledge_unit_id UNINDEXED
);
"""
