from __future__ import annotations

import json
import re
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any

from app.core.errors import AppError
from app.db.sqlite import db, json_dumps
from app.services.embedding.fallback import MOCK_FIXED_PROFILE, ensure_mock_embedding


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def extract_candidates_from_source(
    source_id: str,
    project_id: str = "default-space",
    force: bool = False,
) -> dict:
    timestamp = now_iso()
    with db() as conn:
        source = conn.execute(
            "SELECT * FROM sources WHERE id = ? AND project_id = ?",
            (source_id, project_id),
        ).fetchone()
        if not source:
            raise AppError("source_not_found", "Source was not found.", status_code=404)

        chunks = conn.execute(
            """
            SELECT * FROM chunks
            WHERE source_id = ? AND project_id = ?
            ORDER BY chunk_index ASC
            """,
            (source_id, project_id),
        ).fetchall()
        if not chunks:
            raise AppError(
                "source_has_no_chunks",
                "Source has no chunks available for candidate extraction.",
                status_code=409,
            )

        existing = existing_knowledge_for_source(conn, source_id)
        if existing and not force:
            return extraction_response(conn, source_id, None, reused=True)

        job_id = new_id("job")
        trace_id = new_id("trace")
        conn.execute(
            """
            INSERT INTO processing_jobs (
              id, job_type, status, trace_id, payload_json, result_json, created_at, updated_at
            )
            VALUES (?, 'knowledge_extract', 'running', ?, ?, '{}', ?, ?)
            """,
            (
                job_id,
                trace_id,
                json_dumps({"source_id": source_id, "project_id": project_id, "force": force}),
                timestamp,
                timestamp,
            ),
        )
        insert_event(
            conn,
            job_id,
            1,
            "knowledge_extraction_started",
            "Candidate knowledge extraction started.",
            {"source_id": source_id, "trace_id": trace_id},
            timestamp,
        )
        insert_event(
            conn,
            job_id,
            2,
            "chunks_loaded",
            "Source chunks loaded for candidate extraction.",
            {"source_id": source_id, "chunk_count": len(chunks)},
            timestamp,
        )

        candidate_ids: list[str] = []
        review_task_ids: list[str] = []
        embedding_ids: list[str] = []

        for chunk in chunks:
            ku_id = new_id("ku")
            candidate_ids.append(ku_id)
            title = candidate_title(source["title"], chunk["content"], chunk["chunk_index"])
            metadata = candidate_metadata(
                trace_id=trace_id,
                source_id=source_id,
                chunk_id=chunk["id"],
                source_origin=source["source_origin"],
            )
            conn.execute(
                """
                INSERT INTO knowledge_units
                  (id, source_id, chunk_id, project_id, title, type, content, status,
                   user_verified, metadata_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'claim', ?, 'pending_review', 0, ?, ?, ?)
                """,
                (
                    ku_id,
                    source_id,
                    chunk["id"],
                    project_id,
                    title,
                    chunk["content"],
                    json_dumps(metadata),
                    timestamp,
                    timestamp,
                ),
            )

            review_task_id = new_id("review")
            review_task_ids.append(review_task_id)
            conn.execute(
                """
                INSERT INTO review_tasks
                  (id, target_type, target_id, status, payload_json, created_at, updated_at)
                VALUES (?, 'knowledge_unit', ?, 'pending_review', ?, ?, ?)
                """,
                (
                    review_task_id,
                    ku_id,
                    json_dumps(
                        {
                            "title": title,
                            "content": chunk["content"],
                            "source_id": source_id,
                            "chunk_id": chunk["id"],
                            "suggestion_type": "knowledge_unit",
                            "review_reason": "p0_rule_structuring_candidate",
                            "capability_status": "fallback",
                            "fallback_reason": "provider_capability_unavailable",
                        }
                    ),
                    timestamp,
                    timestamp,
                ),
            )

            embedding_id = ensure_mock_embedding(
                conn,
                owner_type="knowledge_unit",
                owner_id=ku_id,
                text=f"{title}\n\n{chunk['content']}",
                timestamp=timestamp,
            )
            embedding_ids.append(embedding_id)
            bind_fts_to_knowledge_unit(conn, chunk["id"], ku_id, chunk["content"], source_id)

        insert_event(
            conn,
            job_id,
            3,
            "candidate_knowledge_units_created",
            "Candidate knowledge units created from source chunks.",
            {"candidate_knowledge_unit_ids": candidate_ids, "review_task_ids": review_task_ids},
            timestamp,
        )
        insert_event(
            conn,
            job_id,
            4,
            "fallback_embeddings_created",
            "Fallback embeddings created for candidate knowledge units.",
            {"embedding_profile": MOCK_FIXED_PROFILE, "embedding_ids": embedding_ids},
            timestamp,
        )
        result = {
            "source_id": source_id,
            "candidate_knowledge_unit_ids": candidate_ids,
            "review_task_ids": review_task_ids,
            "embedding_ids": embedding_ids,
            "fallback_reason": "provider_capability_unavailable",
        }
        conn.execute(
            """
            UPDATE processing_jobs
            SET status = 'completed', result_json = ?, updated_at = ?
            WHERE id = ?
            """,
            (json_dumps(result), timestamp, job_id),
        )
        insert_event(
            conn,
            job_id,
            5,
            "knowledge_extraction_completed",
            "Candidate knowledge extraction completed.",
            result,
            timestamp,
        )
    return extraction_response(db_conn=None, source_id=source_id, job_id=job_id, reused=False)


def list_knowledge_units(
    project_id: str = "default-space",
    status: str | None = None,
) -> list[dict]:
    with db() as conn:
        if status:
            rows = conn.execute(
                """
                SELECT * FROM knowledge_units
                WHERE project_id = ? AND status = ?
                ORDER BY updated_at DESC
                """,
                (project_id, status),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT * FROM knowledge_units
                WHERE project_id = ?
                ORDER BY updated_at DESC
                """,
                (project_id,),
            ).fetchall()
    return [knowledge_unit_row(row) for row in rows]


def get_knowledge_unit(knowledge_unit_id: str) -> dict:
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM knowledge_units WHERE id = ?",
            (knowledge_unit_id,),
        ).fetchone()
        if not row:
            raise AppError(
                "knowledge_unit_not_found",
                "Knowledge unit was not found.",
                status_code=404,
            )
        source = conn.execute("SELECT * FROM sources WHERE id = ?", (row["source_id"],)).fetchone()
        chunk = conn.execute("SELECT * FROM chunks WHERE id = ?", (row["chunk_id"],)).fetchone()
        embeddings = conn.execute(
            """
            SELECT * FROM embeddings
            WHERE owner_type = 'knowledge_unit' AND owner_id = ?
            ORDER BY created_at DESC
            """,
            (knowledge_unit_id,),
        ).fetchall()
        review_task = conn.execute(
            """
            SELECT * FROM review_tasks
            WHERE target_type = 'knowledge_unit' AND target_id = ?
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (knowledge_unit_id,),
        ).fetchone()
    detail = knowledge_unit_row(row)
    detail["source"] = source_row(source) if source else None
    detail["chunk"] = chunk_row(chunk) if chunk else None
    detail["embeddings"] = [embedding_row(embedding) for embedding in embeddings]
    detail["review_task"] = review_task_row(review_task) if review_task else None
    return detail


def extraction_response(
    db_conn: sqlite3.Connection | None,
    source_id: str,
    job_id: str | None,
    reused: bool,
) -> dict:
    if db_conn is None:
        with db() as conn:
            return extraction_response(conn, source_id, job_id, reused)

    ku_rows = existing_knowledge_for_source(db_conn, source_id)
    candidate_ids = [row["id"] for row in ku_rows]
    review_rows = db_conn.execute(
        f"""
        SELECT * FROM review_tasks
        WHERE target_type = 'knowledge_unit'
          AND target_id IN ({",".join("?" for _ in candidate_ids)})
        ORDER BY created_at ASC
        """,
        candidate_ids,
    ).fetchall() if candidate_ids else []
    embedding_rows = db_conn.execute(
        f"""
        SELECT * FROM embeddings
        WHERE owner_type = 'knowledge_unit'
          AND owner_id IN ({",".join("?" for _ in candidate_ids)})
        ORDER BY created_at ASC
        """,
        candidate_ids,
    ).fetchall() if candidate_ids else []
    return {
        "job_id": job_id,
        "source_id": source_id,
        "candidate_knowledge_unit_ids": candidate_ids,
        "review_task_ids": [row["id"] for row in review_rows],
        "embedding_ids": [row["id"] for row in embedding_rows],
        "status": "reused" if reused else "completed",
        "reused": reused,
        "fallback_reason": "provider_capability_unavailable",
    }


def existing_knowledge_for_source(conn: sqlite3.Connection, source_id: str) -> list[sqlite3.Row]:
    return conn.execute(
        """
        SELECT * FROM knowledge_units
        WHERE source_id = ?
        ORDER BY created_at ASC
        """,
        (source_id,),
    ).fetchall()


def candidate_title(source_title: str, content: str, chunk_index: int) -> str:
    heading = first_heading(content)
    if heading:
        return heading[:120]
    first_line = next((line.strip() for line in content.splitlines() if line.strip()), "")
    if first_line:
        return first_line[:120]
    return source_title if chunk_index == 0 else f"{source_title} #{chunk_index + 1}"


def first_heading(content: str) -> str | None:
    for line in content.splitlines():
        match = re.match(r"^#{1,6}\s+(.+)$", line.strip())
        if match:
            return match.group(1).strip()
    return None


def candidate_metadata(
    *,
    trace_id: str,
    source_id: str,
    chunk_id: str,
    source_origin: str,
) -> dict[str, Any]:
    return {
        "trace_id": trace_id,
        "source_id": source_id,
        "chunk_id": chunk_id,
        "source_origin": source_origin,
        "extraction_profile": "p0_rule_structuring_v1",
        "embedding_profile": MOCK_FIXED_PROFILE,
        "ai_confidence": 0.42,
        "structured_organization": {
            "profile": "p0_rule_structuring_v1",
            "capability_status": "fallback",
            "fallback_reason": "provider_capability_unavailable",
            "quality_scores": {
                "content_understanding": "passed",
                "summary_generation": "fallback",
                "key_concept_extraction": "fallback",
                "schema_mapping": "pending_review",
                "knowledge_card_generation": "pending_review",
                "classification_tagging": "pending_review",
                "relation_suggestion": "disabled_z0a",
            },
        },
    }


def bind_fts_to_knowledge_unit(
    conn: sqlite3.Connection,
    chunk_id: str,
    knowledge_unit_id: str,
    content: str,
    source_id: str,
) -> None:
    updated = conn.execute(
        """
        UPDATE chunks_fts
        SET knowledge_unit_id = ?
        WHERE chunk_id = ? AND (knowledge_unit_id = '' OR knowledge_unit_id IS NULL)
        """,
        (knowledge_unit_id, chunk_id),
    ).rowcount
    if not updated:
        conn.execute(
            """
            INSERT INTO chunks_fts (content, chunk_id, source_id, knowledge_unit_id)
            VALUES (?, ?, ?, ?)
            """,
            (content, chunk_id, source_id, knowledge_unit_id),
        )


def insert_event(
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


def knowledge_unit_row(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "source_id": row["source_id"],
        "chunk_id": row["chunk_id"],
        "project_id": row["project_id"],
        "title": row["title"],
        "type": row["type"],
        "content": row["content"],
        "status": row["status"],
        "user_verified": bool(row["user_verified"]),
        "metadata": json.loads(row["metadata_json"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def source_row(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "project_id": row["project_id"],
        "title": row["title"],
        "source_type": row["source_type"],
        "source_origin": row["source_origin"],
        "content_hash": row["content_hash"],
        "metadata": json.loads(row["metadata_json"]),
        "chunk_count": 0,
        "created_at": row["created_at"],
    }


def chunk_row(row: sqlite3.Row) -> dict:
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


def embedding_row(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "owner_type": row["owner_type"],
        "owner_id": row["owner_id"],
        "embedding_profile": row["embedding_profile"],
        "dimension": row["dimension"],
        "status": row["status"],
        "created_at": row["created_at"],
    }


def review_task_row(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "target_type": row["target_type"],
        "target_id": row["target_id"],
        "status": row["status"],
        "payload": json.loads(row["payload_json"]),
    }
