from __future__ import annotations

import hashlib
import json
import math
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from app.core.config import get_settings
from app.core.errors import AppError
from app.db.sqlite import db, json_dumps


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def create_upload_task(
    *,
    filename: str,
    size_bytes: int,
    content_type: Optional[str],
    sha256: Optional[str],
    part_size: Optional[int],
    project_id: str,
) -> dict:
    settings = get_settings()
    if size_bytes > settings.max_upload_bytes:
        raise AppError("upload_too_large", "Upload exceeds the configured size limit.", 413)
    timestamp = now_iso()
    upload_id = new_id("upload")
    chosen_part_size = part_size or settings.default_upload_part_size
    part_count = max(1, math.ceil(size_bytes / chosen_part_size))
    with db() as conn:
        conn.execute(
            """
            INSERT INTO upload_tasks (
              id, project_id, original_filename, content_type, expected_size,
              part_size, expected_sha256, received_bytes, status, metadata_json,
              created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'created', '{}', ?, ?)
            """,
            (
                upload_id,
                project_id,
                filename,
                content_type,
                size_bytes,
                chosen_part_size,
                sha256,
                timestamp,
                timestamp,
            ),
        )
        return upload_snapshot(conn, upload_id)


def store_upload_part(upload_id: str, part_no: int, content: bytes) -> dict:
    timestamp = now_iso()
    part_hash = hashlib.sha256(content).hexdigest()
    part_id = new_id("part")
    relative_path = Path("tmp") / "uploads" / upload_id / f"part-{part_no:05d}.bin"
    absolute_path = get_settings().app_data_dir / relative_path
    absolute_path.parent.mkdir(parents=True, exist_ok=True)
    absolute_path.write_bytes(content)
    with db() as conn:
        upload = upload_row(conn, upload_id)
        existing = conn.execute(
            "SELECT id FROM upload_parts WHERE upload_id = ? AND part_no = ?",
            (upload_id, part_no),
        ).fetchone()
        if existing:
            conn.execute(
                """
                UPDATE upload_parts
                SET size_bytes = ?, sha256 = ?, storage_path = ?, created_at = ?
                WHERE id = ?
                """,
                (len(content), part_hash, str(relative_path).replace("\\", "/"), timestamp, existing["id"]),
            )
        else:
            conn.execute(
                """
                INSERT INTO upload_parts (
                  id, upload_id, part_no, size_bytes, sha256, storage_path, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    part_id,
                    upload_id,
                    part_no,
                    len(content),
                    part_hash,
                    str(relative_path).replace("\\", "/"),
                    timestamp,
                ),
            )
        received = sum_part_bytes(conn, upload_id)
        conn.execute(
            """
            UPDATE upload_tasks
            SET received_bytes = ?, status = 'uploading', error_code = NULL, updated_at = ?
            WHERE id = ?
            """,
            (received, timestamp, upload_id),
        )
        return {
            "upload_id": upload_id,
            "part_no": part_no,
            "size_bytes": len(content),
            "sha256": part_hash,
            "received_bytes": received,
            "status": upload["status"] if received == 0 else "uploaded",
        }


def complete_upload(upload_id: str) -> dict:
    timestamp = now_iso()
    with db() as conn:
        upload = upload_row(conn, upload_id)
        parts = part_rows(conn, upload_id)
        expected_count = max(1, math.ceil(upload["expected_size"] / upload["part_size"]))
        received_part_numbers = {part["part_no"] for part in parts}
        missing = [
            number
            for number in range(1, expected_count + 1)
            if number not in received_part_numbers
        ]
        if missing:
            mark_upload_error(conn, upload_id, "upload_part_missing", timestamp)
            conn.commit()
            raise AppError("upload_part_missing", "One or more upload parts are missing.", 409)

        content = b"".join(read_part(part) for part in sorted(parts, key=lambda row: row["part_no"]))
        actual_hash = hashlib.sha256(content).hexdigest()
        integrity_id = new_id("integrity")
        if upload["expected_sha256"] and upload["expected_sha256"] != actual_hash:
            conn.execute(
                """
                INSERT INTO file_integrity_checks (
                  id, upload_id, expected_sha256, actual_sha256, status, message, created_at
                )
                VALUES (?, ?, ?, ?, 'failed', 'SHA-256 mismatch.', ?)
                """,
                (integrity_id, upload_id, upload["expected_sha256"], actual_hash, timestamp),
            )
            mark_upload_error(conn, upload_id, "hash_mismatch", timestamp)
            conn.commit()
            raise AppError("hash_mismatch", "Uploaded content does not match expected hash.", 409)

        file_id = new_id("file")
        extension = Path(upload["original_filename"]).suffix.lower()
        storage_relative = Path("sources") / f"{file_id}{extension or '.bin'}"
        storage_absolute = get_settings().app_data_dir / storage_relative
        storage_absolute.parent.mkdir(parents=True, exist_ok=True)
        storage_absolute.write_bytes(content)
        risk_level = inspect_risk_level(extension, upload["content_type"])
        inspection_status = "completed"
        conn.execute(
            """
            INSERT INTO files (
              id, project_id, original_filename, content_type, extension, size_bytes,
              sha256, storage_path, status, inspection_status, metadata_json, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'stored', ?, '{}', ?, ?)
            """,
            (
                file_id,
                upload["project_id"],
                upload["original_filename"],
                upload["content_type"],
                extension,
                len(content),
                actual_hash,
                str(storage_relative).replace("\\", "/"),
                inspection_status,
                timestamp,
                timestamp,
            ),
        )
        conn.execute(
            """
            INSERT INTO file_integrity_checks (
              id, upload_id, file_id, expected_sha256, actual_sha256, status, message, created_at
            )
            VALUES (?, ?, ?, ?, ?, 'passed', 'SHA-256 verified.', ?)
            """,
            (integrity_id, upload_id, file_id, upload["expected_sha256"], actual_hash, timestamp),
        )
        job_id = new_id("job")
        conn.execute(
            """
            INSERT INTO processing_jobs (
              id, job_type, status, trace_id, payload_json, result_json, created_at, updated_at
            )
            VALUES (?, 'file_inspection', 'completed', ?, ?, ?, ?, ?)
            """,
            (
                job_id,
                new_id("trace"),
                json_dumps({"file_id": file_id, "upload_id": upload_id}),
                json_dumps({"risk_level": risk_level}),
                timestamp,
                timestamp,
            ),
        )
        conn.execute(
            """
            INSERT INTO file_inspection_results (
              id, file_id, job_id, status, extension, mime_type, size_bytes, sha256,
              header_summary, risk_level, risk_summary, recoverable, payload_json,
              created_at, updated_at
            )
            VALUES (?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                new_id("inspection"),
                file_id,
                job_id,
                extension,
                upload["content_type"],
                len(content),
                actual_hash,
                header_summary(content),
                risk_level,
                risk_summary(risk_level),
                1 if risk_level != "blocked" else 0,
                json_dumps({"profile": "z0a_local_inspection"}),
                timestamp,
                timestamp,
            ),
        )
        conn.execute(
            """
            UPDATE upload_tasks
            SET status = 'completed', received_bytes = ?, file_id = ?, job_id = ?,
                error_code = NULL, updated_at = ?
            WHERE id = ?
            """,
            (len(content), file_id, job_id, timestamp, upload_id),
        )
        return upload_snapshot(conn, upload_id)


def get_upload_snapshot(upload_id: str) -> dict:
    with db() as conn:
        return upload_snapshot(conn, upload_id)


def list_files(project_id: str) -> list[dict]:
    with db() as conn:
        rows = conn.execute(
            "SELECT * FROM files WHERE project_id = ? ORDER BY created_at DESC",
            (project_id,),
        ).fetchall()
        return [file_response(conn, row) for row in rows]


def get_file_record(file_id: str) -> dict:
    with db() as conn:
        return file_response(conn, file_row(conn, file_id))


def verify_file(file_id: str) -> dict:
    with db() as conn:
        row = file_row(conn, file_id)
        path = get_settings().app_data_dir / row["storage_path"]
        if not path.exists():
            raise AppError("file_missing_from_storage", "Stored file is missing.", 409)
        return file_response(conn, row)


def upload_snapshot(conn: sqlite3.Connection, upload_id: str) -> dict:
    upload = upload_row(conn, upload_id)
    parts = part_rows(conn, upload_id)
    integrity = latest_integrity(conn, upload_id)
    inspection = latest_inspection(conn, upload["file_id"]) if upload["file_id"] else None
    return {
        "id": upload["id"],
        "project_id": upload["project_id"],
        "original_filename": upload["original_filename"],
        "content_type": upload["content_type"],
        "expected_size": upload["expected_size"],
        "part_size": upload["part_size"],
        "part_count": max(1, math.ceil(upload["expected_size"] / upload["part_size"])),
        "expected_sha256": upload["expected_sha256"],
        "received_bytes": upload["received_bytes"],
        "status": upload["status"],
        "file_id": upload["file_id"],
        "job_id": upload["job_id"],
        "recoverable": bool(upload["recoverable"]),
        "error_code": upload["error_code"],
        "parts": [part_response(part) for part in parts],
        "integrity_check": integrity_response(integrity) if integrity else None,
        "inspection": inspection_response(inspection) if inspection else None,
        "created_at": upload["created_at"],
        "updated_at": upload["updated_at"],
    }


def upload_row(conn: sqlite3.Connection, upload_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM upload_tasks WHERE id = ?", (upload_id,)).fetchone()
    if not row:
        raise AppError("upload_not_found", "Upload task was not found.", 404)
    return row


def file_row(conn: sqlite3.Connection, file_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM files WHERE id = ?", (file_id,)).fetchone()
    if not row:
        raise AppError("file_not_found", "File was not found.", 404)
    return row


def part_rows(conn: sqlite3.Connection, upload_id: str) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT * FROM upload_parts WHERE upload_id = ? ORDER BY part_no",
        (upload_id,),
    ).fetchall()


def part_response(row: sqlite3.Row) -> dict:
    return {
        "part_no": row["part_no"],
        "size_bytes": row["size_bytes"],
        "sha256": row["sha256"],
        "created_at": row["created_at"],
    }


def file_response(conn: sqlite3.Connection, row: sqlite3.Row) -> dict:
    inspection = latest_inspection(conn, row["id"])
    return {
        "id": row["id"],
        "project_id": row["project_id"],
        "original_filename": row["original_filename"],
        "content_type": row["content_type"],
        "extension": row["extension"],
        "size_bytes": row["size_bytes"],
        "sha256": row["sha256"],
        "status": row["status"],
        "inspection_status": row["inspection_status"],
        "inspection": inspection_response(inspection) if inspection else None,
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def integrity_response(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "upload_id": row["upload_id"],
        "file_id": row["file_id"],
        "expected_sha256": row["expected_sha256"],
        "actual_sha256": row["actual_sha256"],
        "status": row["status"],
        "message": row["message"],
        "created_at": row["created_at"],
    }


def inspection_response(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "file_id": row["file_id"],
        "job_id": row["job_id"],
        "status": row["status"],
        "extension": row["extension"],
        "mime_type": row["mime_type"],
        "size_bytes": row["size_bytes"],
        "sha256": row["sha256"],
        "header_summary": row["header_summary"],
        "risk_level": row["risk_level"],
        "risk_summary": row["risk_summary"],
        "recoverable": bool(row["recoverable"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def latest_integrity(conn: sqlite3.Connection, upload_id: str) -> Optional[sqlite3.Row]:
    return conn.execute(
        """
        SELECT * FROM file_integrity_checks
        WHERE upload_id = ?
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (upload_id,),
    ).fetchone()


def latest_inspection(conn: sqlite3.Connection, file_id: str) -> Optional[sqlite3.Row]:
    return conn.execute(
        """
        SELECT * FROM file_inspection_results
        WHERE file_id = ?
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (file_id,),
    ).fetchone()


def sum_part_bytes(conn: sqlite3.Connection, upload_id: str) -> int:
    return conn.execute(
        "SELECT COALESCE(SUM(size_bytes), 0) FROM upload_parts WHERE upload_id = ?",
        (upload_id,),
    ).fetchone()[0]


def read_part(row: sqlite3.Row) -> bytes:
    return (get_settings().app_data_dir / row["storage_path"]).read_bytes()


def mark_upload_error(
    conn: sqlite3.Connection,
    upload_id: str,
    error_code: str,
    timestamp: str,
) -> None:
    conn.execute(
        """
        UPDATE upload_tasks
        SET status = 'recoverable_error', error_code = ?, updated_at = ?
        WHERE id = ?
        """,
        (error_code, timestamp, upload_id),
    )


def inspect_risk_level(extension: str, content_type: Optional[str]) -> str:
    if extension in {".bat", ".cmd", ".exe", ".ps1", ".sh"}:
        return "blocked"
    if content_type and "shellscript" in content_type:
        return "blocked"
    return "low"


def risk_summary(risk_level: str) -> str:
    if risk_level == "blocked":
        return "Executable or script-like file blocked by the Z0a risk policy."
    return "No high-risk file traits detected by the Z0a inspection policy."


def header_summary(content: bytes) -> str:
    sample = content[:80].decode("utf-8", errors="replace").replace("\n", " ").strip()
    return sample or "Binary or empty header sample."
