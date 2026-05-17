from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone
from typing import Dict, List

from app.db.sqlite import db, json_dumps
from app.services.embedding.fallback import ensure_mock_embedding


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def _event(conn, job_id: str, seq: int, event_type: str, message: str, payload: Dict) -> None:
    conn.execute(
        """
        INSERT INTO processing_status_events
          (id, job_id, event_seq, event_type, message, payload_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (new_id("event"), job_id, seq, event_type, message, json_dumps(payload), now_iso()),
    )


def _chunk_text(content: str) -> List[str]:
    stripped = content.strip()
    if len(stripped) <= 1200:
        return [stripped]
    chunks: List[str] = []
    start = 0
    while start < len(stripped):
        chunks.append(stripped[start : start + 1200])
        start += 1200
    return chunks


def import_text(title: str, content: str, project_id: str = "default-space") -> Dict:
    job_id = new_id("job")
    trace_id = new_id("trace")
    source_id = new_id("source")
    timestamp = now_iso()
    content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
    chunk_ids: List[str] = []
    ku_ids: List[str] = []
    review_task_ids: List[str] = []

    with db() as conn:
        conn.execute(
            """
            INSERT INTO processing_jobs
              (id, job_type, status, trace_id, payload_json, result_json, created_at, updated_at)
            VALUES (?, 'text_import', 'running', ?, ?, '{}', ?, ?)
            """,
            (
                job_id,
                trace_id,
                json_dumps({"title": title, "project_id": project_id}),
                timestamp,
                timestamp,
            ),
        )
        _event(conn, job_id, 1, "job_created", "Text import job created.", {"trace_id": trace_id})

        conn.execute(
            """
            INSERT INTO sources
              (id, project_id, title, source_type, source_origin,
               content_hash, metadata_json, created_at)
            VALUES (?, ?, ?, 'text', 'text_import', ?, ?, ?)
            """,
            (
                source_id,
                project_id,
                title,
                content_hash,
                json_dumps({"source_origin": "text_import", "trace_id": trace_id}),
                timestamp,
            ),
        )
        _event(
            conn,
            job_id,
            2,
            "source_created",
            "Source record created.",
            {"source_id": source_id},
        )

        for index, chunk_content in enumerate(_chunk_text(content)):
            chunk_id = new_id("chunk")
            citation_label = f"{title} · chunk {index + 1}"
            chunk_ids.append(chunk_id)
            conn.execute(
                """
                INSERT INTO chunks
                  (id, source_id, project_id, content, chunk_index,
                   citation_label, metadata_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    chunk_id,
                    source_id,
                    project_id,
                    chunk_content,
                    index,
                    citation_label,
                    json_dumps({"trace_id": trace_id, "source_origin": "text_import"}),
                    timestamp,
                ),
            )

            ku_id = new_id("ku")
            ku_ids.append(ku_id)
            ku_title = title if index == 0 else f"{title} #{index + 1}"
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
                    chunk_id,
                    project_id,
                    ku_title,
                    chunk_content,
                    json_dumps(
                        {
                            "trace_id": trace_id,
                            "extraction_profile": "rule_text_import_v0",
                            "ai_confidence": 0.42,
                        }
                    ),
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
                            "title": ku_title,
                            "content": chunk_content,
                            "source_id": source_id,
                            "chunk_id": chunk_id,
                            "review_reason": "rule_extracted_candidate",
                        }
                    ),
                    timestamp,
                    timestamp,
                ),
            )

            ensure_mock_embedding(
                conn,
                owner_type="knowledge_unit",
                owner_id=ku_id,
                text=f"{ku_title}\n\n{chunk_content}",
                timestamp=timestamp,
            )
            conn.execute(
                """
                INSERT INTO chunks_fts (content, chunk_id, source_id, knowledge_unit_id)
                VALUES (?, ?, ?, ?)
                """,
                (chunk_content, chunk_id, source_id, ku_id),
            )

        _event(
            conn,
            job_id,
            3,
            "candidate_knowledge_units_created",
            "Candidate knowledge units created.",
            {"candidate_knowledge_unit_ids": ku_ids},
        )
        result = {
            "source_id": source_id,
            "chunk_ids": chunk_ids,
            "candidate_knowledge_unit_ids": ku_ids,
            "review_task_ids": review_task_ids,
        }
        conn.execute(
            """
            UPDATE processing_jobs
            SET status = 'completed', result_json = ?, updated_at = ?
            WHERE id = ?
            """,
            (json_dumps(result), now_iso(), job_id),
        )
        _event(conn, job_id, 4, "job_completed", "Text import job completed.", result)

    return {"job_id": job_id, **result}
