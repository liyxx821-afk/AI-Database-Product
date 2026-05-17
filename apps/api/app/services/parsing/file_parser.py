from __future__ import annotations

import hashlib
import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from app.core.config import get_settings
from app.core.errors import AppError
from app.db.sqlite import db, json_dumps
from app.services.organization import source_tags

TEXT_EXTENSIONS = {".csv", ".json", ".md", ".markdown", ".txt"}
TEXT_MIME_PREFIXES = ("text/",)
TEXT_MIME_TYPES = {"application/json", "application/x-ndjson"}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def parse_file(file_id: str) -> dict:
    timestamp = now_iso()
    with db() as conn:
        file_row = get_file_row(conn, file_id)
        existing = latest_parse_task(conn, file_id, status="completed")
        if existing:
            return parse_task_response(conn, existing["id"])

        inspection = latest_inspection(conn, file_id)
        if not inspection:
            raise AppError(
                "file_not_inspected",
                "File must be inspected before parse.",
                status_code=409,
            )
        if inspection["risk_level"] == "blocked":
            raise AppError(
                "file_blocked_by_risk_policy",
                "File is blocked by the Z0a risk policy and cannot be parsed.",
                status_code=409,
            )

        parser_key = select_parser(file_row, inspection)
        job_id = new_id("job")
        trace_id = new_id("trace")
        parse_task_id = new_id("parse")
        conn.execute(
            """
            INSERT INTO processing_jobs (
              id, job_type, status, trace_id, payload_json, result_json, created_at, updated_at
            )
            VALUES (?, 'file_parse', 'running', ?, ?, '{}', ?, ?)
            """,
            (
                job_id,
                trace_id,
                json_dumps({"file_id": file_id, "parser_key": parser_key}),
                timestamp,
                timestamp,
            ),
        )
        insert_job_event(
            conn,
            job_id,
            1,
            "parse_started",
            "File parse started.",
            {"file_id": file_id, "trace_id": trace_id},
            timestamp,
        )

        if parser_key is None:
            create_failed_parse_task(
                conn,
                parse_task_id,
                file_id,
                job_id,
                "unsupported_parser",
                timestamp,
            )
            conn.execute(
                """
                UPDATE processing_jobs
                SET status = 'failed_recoverable', result_json = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    json_dumps({"error_code": "unsupported_parser", "recoverable": True}),
                    timestamp,
                    job_id,
                ),
            )
            insert_job_event(
                conn,
                job_id,
                2,
                "parse_failed_recoverable",
                "No Z0a parser is available for this file.",
                {"error_code": "unsupported_parser", "file_id": file_id},
                timestamp,
            )
            raise AppError(
                "unsupported_parser",
                "No Z0a parser is available for this file type.",
                status_code=409,
            )

        file_path = app_data_path(file_row["storage_path"])
        if not file_path.exists():
            raise AppError(
                "file_missing_from_storage",
                "Stored file is missing from local storage.",
                status_code=409,
            )

        raw_bytes = file_path.read_bytes()
        decoded = raw_bytes.decode("utf-8", errors="replace")
        had_replacement = "\ufffd" in decoded
        content = decoded.strip()
        if not content:
            create_failed_parse_task(
                conn,
                parse_task_id,
                file_id,
                job_id,
                "parse_empty_content",
                timestamp,
            )
            raise AppError("parse_empty_content", "Parsed text is empty.", status_code=409)

        source_id = new_id("source")
        chunks = chunk_text(content)
        source_title = file_row["original_filename"]
        conn.execute(
            """
            INSERT INTO sources (
              id, project_id, title, source_type, source_origin,
              content_hash, metadata_json, created_at
            )
            VALUES (?, ?, ?, 'uploaded_file', 'parsed_file', ?, ?, ?)
            """,
            (
                source_id,
                file_row["project_id"],
                source_title,
                hashlib.sha256(content.encode("utf-8")).hexdigest(),
                json_dumps(
                    {
                        "file_id": file_id,
                        "parse_task_id": parse_task_id,
                        "parser_key": parser_key,
                        "trace_id": trace_id,
                        "content_kind": "text",
                        "source_origin": "parsed_file",
                    }
                ),
                timestamp,
            ),
        )
        conn.execute(
            """
            INSERT INTO parse_tasks (
              id, file_id, source_id, job_id, parser_key, parser_version, provider_key,
              profile, capability_status, fallback_reason, status, output_text_path,
              error_code, metadata_json, created_at, updated_at
            )
            VALUES (
              ?, ?, ?, ?, ?, 'z0a', 'builtin', 'plain_text_parser',
              'available', NULL, 'completed', NULL, NULL, ?, ?, ?
            )
            """,
            (
                parse_task_id,
                file_id,
                source_id,
                job_id,
                parser_key,
                json_dumps({"chunk_strategy": "fixed_1200_chars", "trace_id": trace_id}),
                timestamp,
                timestamp,
            ),
        )
        if had_replacement:
            insert_parse_warning(
                conn,
                parse_task_id,
                "encoding_replacement",
                "warning",
                "UTF-8 decoding replaced invalid bytes.",
                None,
                timestamp,
            )

        chunk_ids = []
        for index, chunk_content in enumerate(chunks):
            chunk_id = new_id("chunk")
            chunk_ids.append(chunk_id)
            citation_label = f"{source_title} · chunk {index + 1}"
            conn.execute(
                """
                INSERT INTO chunks (
                  id, source_id, project_id, content, chunk_index,
                  citation_label, metadata_json, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    chunk_id,
                    source_id,
                    file_row["project_id"],
                    chunk_content,
                    index,
                    citation_label,
                    json_dumps(
                        {
                            "file_id": file_id,
                            "parse_task_id": parse_task_id,
                            "chunk_type": "text_semantic",
                            "chunk_execution_profile": "fixed_1200_chars_z0a",
                            "source_binding_status": "bound",
                        }
                    ),
                    timestamp,
                ),
            )
            conn.execute(
                """
                INSERT INTO chunks_fts (content, chunk_id, source_id, knowledge_unit_id)
                VALUES (?, ?, ?, ?)
                """,
                (chunk_content, chunk_id, source_id, ""),
            )
            insert_chunk_quality_check(
                conn,
                chunk_id,
                "input_integrity",
                "passed",
                "Chunk contains parsed text.",
                {"length": len(chunk_content)},
                timestamp,
            )
            insert_chunk_quality_check(
                conn,
                chunk_id,
                "source_binding",
                "passed",
                "Chunk is bound to parsed file source.",
                {"source_id": source_id, "file_id": file_id},
                timestamp,
            )

        result = {"parse_task_id": parse_task_id, "source_id": source_id, "chunk_ids": chunk_ids}
        insert_job_event(
            conn,
            job_id,
            2,
            "parser_selected",
            "Parser Router selected builtin parser.",
            {"parser_key": parser_key, "file_id": file_id},
            timestamp,
        )
        insert_job_event(
            conn,
            job_id,
            3,
            "source_created",
            "Source created from file.",
            result,
            timestamp,
        )
        insert_job_event(
            conn,
            job_id,
            4,
            "chunks_created",
            "Chunks created from parsed text.",
            result,
            timestamp,
        )
        conn.execute(
            """
            UPDATE processing_jobs
            SET status = 'completed', result_json = ?, updated_at = ?
            WHERE id = ?
            """,
            (json_dumps(result), timestamp, job_id),
        )
        insert_job_event(
            conn,
            job_id,
            5,
            "parse_completed",
            "File parse completed.",
            result,
            timestamp,
        )
        conn.execute(
            """
            UPDATE files
            SET status = 'parsed', updated_at = ?
            WHERE id = ?
            """,
            (timestamp, file_id),
        )
    return get_parse_task(parse_task_id)


def get_parse_task(parse_task_id: str) -> dict:
    with db() as conn:
        return parse_task_response(conn, parse_task_id)


def list_sources(
    project_id: str = "default-space",
    folder_id: Optional[str] = None,
    tag_ids: Optional[list[str]] = None,
) -> list[dict]:
    tag_ids = tag_ids or []
    conditions = ["s.project_id = ?"]
    params: list[Any] = [project_id]
    if folder_id:
        conditions.append("s.primary_folder_id = ?")
        params.append(folder_id)
    for tag_id in tag_ids:
        conditions.append(
            """
            EXISTS (
              SELECT 1 FROM source_tags st
              WHERE st.source_id = s.id AND st.tag_id = ?
            )
            """
        )
        params.append(tag_id)
    where_clause = " AND ".join(conditions)
    with db() as conn:
        rows = conn.execute(
            f"""
            SELECT s.*, COUNT(c.id) AS chunk_count
            FROM sources s
            LEFT JOIN chunks c ON c.source_id = s.id
            WHERE {where_clause}
            GROUP BY s.id
            ORDER BY s.created_at DESC
            """,
            params,
        ).fetchall()
        return [source_row_to_response(row, source_tags(conn, row["id"])) for row in rows]


def get_source(source_id: str) -> dict:
    with db() as conn:
        source = conn.execute("SELECT * FROM sources WHERE id = ?", (source_id,)).fetchone()
        if not source:
            raise AppError("source_not_found", "Source was not found.", status_code=404)
        chunks = conn.execute(
            """
            SELECT * FROM chunks
            WHERE source_id = ?
            ORDER BY chunk_index ASC
            """,
            (source_id,),
        ).fetchall()
        metadata = json.loads(source["metadata_json"])
        tags = source_tags(conn, source_id)
    return {
        "id": source["id"],
        "project_id": source["project_id"],
        "primary_folder_id": source["primary_folder_id"],
        "title": source["title"],
        "source_type": source["source_type"],
        "source_origin": source["source_origin"],
        "content_hash": source["content_hash"],
        "metadata": metadata,
        "tags": tags,
        "chunk_count": len(chunks),
        "chunks": [chunk_row_to_response(chunk) for chunk in chunks],
        "created_at": source["created_at"],
    }


def parse_task_response(conn: sqlite3.Connection, parse_task_id: str) -> dict:
    task = conn.execute("SELECT * FROM parse_tasks WHERE id = ?", (parse_task_id,)).fetchone()
    if not task:
        raise AppError("parse_task_not_found", "Parse task was not found.", status_code=404)
    warnings = conn.execute(
        """
        SELECT * FROM parse_warnings
        WHERE parse_task_id = ?
        ORDER BY created_at ASC
        """,
        (parse_task_id,),
    ).fetchall()
    source = None
    if task["source_id"]:
        row = conn.execute(
            """
            SELECT s.*, COUNT(c.id) AS chunk_count
            FROM sources s
            LEFT JOIN chunks c ON c.source_id = s.id
            WHERE s.id = ?
            GROUP BY s.id
            """,
            (task["source_id"],),
        ).fetchone()
        if row:
            source = source_row_to_response(row)
    chunk_ids = []
    if task["source_id"]:
        chunk_ids = [
            row["id"]
            for row in conn.execute(
                "SELECT id FROM chunks WHERE source_id = ? ORDER BY chunk_index ASC",
                (task["source_id"],),
            ).fetchall()
        ]
    return {
        "id": task["id"],
        "file_id": task["file_id"],
        "source_id": task["source_id"],
        "job_id": task["job_id"],
        "parser_key": task["parser_key"],
        "status": task["status"],
        "capability_status": task["capability_status"],
        "fallback_reason": task["fallback_reason"],
        "error_code": task["error_code"],
        "source": source,
        "chunk_ids": chunk_ids,
        "warnings": [
            {
                "id": warning["id"],
                "parse_task_id": warning["parse_task_id"],
                "warning_type": warning["warning_type"],
                "severity": warning["severity"],
                "message": warning["message"],
                "source_location": warning["source_location"],
                "created_at": warning["created_at"],
            }
            for warning in warnings
        ],
        "created_at": task["created_at"],
        "updated_at": task["updated_at"],
    }


def get_file_row(conn: sqlite3.Connection, file_id: str) -> sqlite3.Row:
    file_row = conn.execute("SELECT * FROM files WHERE id = ?", (file_id,)).fetchone()
    if not file_row:
        raise AppError("file_not_found", "File was not found.", status_code=404)
    return file_row


def latest_inspection(conn: sqlite3.Connection, file_id: str) -> sqlite3.Row | None:
    return conn.execute(
        """
        SELECT * FROM file_inspection_results
        WHERE file_id = ?
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (file_id,),
    ).fetchone()


def latest_parse_task(conn: sqlite3.Connection, file_id: str, status: str) -> sqlite3.Row | None:
    return conn.execute(
        """
        SELECT * FROM parse_tasks
        WHERE file_id = ? AND status = ?
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (file_id, status),
    ).fetchone()


def select_parser(file_row: sqlite3.Row, inspection: sqlite3.Row) -> str | None:
    extension = file_row["extension"].lower()
    mime_type = (inspection["mime_type"] or file_row["content_type"] or "").lower()
    if extension in TEXT_EXTENSIONS:
        return "builtin_text_markdown"
    if mime_type in TEXT_MIME_TYPES or any(
        mime_type.startswith(prefix) for prefix in TEXT_MIME_PREFIXES
    ):
        return "builtin_text_markdown"
    return None


def chunk_text(content: str) -> list[str]:
    stripped = content.strip()
    if len(stripped) <= 1200:
        return [stripped]
    chunks = []
    start = 0
    while start < len(stripped):
        chunks.append(stripped[start : start + 1200])
        start += 1200
    return chunks


def create_failed_parse_task(
    conn: sqlite3.Connection,
    parse_task_id: str,
    file_id: str,
    job_id: str,
    error_code: str,
    timestamp: str,
) -> None:
    conn.execute(
        """
        INSERT INTO parse_tasks (
          id, file_id, source_id, job_id, parser_key, parser_version, provider_key,
          profile, capability_status, fallback_reason, status, output_text_path,
          error_code, metadata_json, created_at, updated_at
        )
        VALUES (
          ?, ?, NULL, ?, 'unsupported', 'z0a', 'builtin',
          'plain_text_parser', 'unavailable', ?, 'failed_recoverable',
          NULL, ?, ?, ?, ?
        )
        """,
        (
            parse_task_id,
            file_id,
            job_id,
            error_code,
            error_code,
            json_dumps({"recoverable": True}),
            timestamp,
            timestamp,
        ),
    )


def insert_job_event(
    conn: sqlite3.Connection,
    job_id: str,
    seq: int,
    event_type: str,
    message: str,
    payload: dict[str, Any],
    timestamp: str,
) -> None:
    conn.execute(
        """
        INSERT INTO processing_status_events (
          id, job_id, event_seq, event_type, message, payload_json, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (new_id("event"), job_id, seq, event_type, message, json_dumps(payload), timestamp),
    )


def insert_parse_warning(
    conn: sqlite3.Connection,
    parse_task_id: str,
    warning_type: str,
    severity: str,
    message: str,
    source_location: str | None,
    timestamp: str,
) -> None:
    conn.execute(
        """
        INSERT INTO parse_warnings (
          id, parse_task_id, warning_type, severity, message, source_location, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            new_id("pwarn"),
            parse_task_id,
            warning_type,
            severity,
            message,
            source_location,
            timestamp,
        ),
    )


def insert_chunk_quality_check(
    conn: sqlite3.Connection,
    chunk_id: str,
    check_type: str,
    status: str,
    message: str,
    metadata: dict[str, Any],
    timestamp: str,
) -> None:
    conn.execute(
        """
        INSERT INTO chunk_quality_checks (
          id, chunk_id, check_type, status, message, metadata_json, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (new_id("cq"), chunk_id, check_type, status, message, json_dumps(metadata), timestamp),
    )


def source_row_to_response(row: sqlite3.Row, tags: Optional[list[dict]] = None) -> dict:
    return {
        "id": row["id"],
        "project_id": row["project_id"],
        "primary_folder_id": row["primary_folder_id"],
        "title": row["title"],
        "source_type": row["source_type"],
        "source_origin": row["source_origin"],
        "content_hash": row["content_hash"],
        "metadata": json.loads(row["metadata_json"]),
        "tags": tags or [],
        "chunk_count": row["chunk_count"],
        "created_at": row["created_at"],
    }


def chunk_row_to_response(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "source_id": row["source_id"],
        "project_id": row["project_id"],
        "content": row["content"],
        "chunk_index": row["chunk_index"],
        "citation_label": row["citation_label"],
        "metadata": json.loads(row["metadata_json"]),
        "created_at": row["created_at"],
    }


def app_data_path(relative_path: str) -> Path:
    return get_settings().app_data_dir / relative_path
