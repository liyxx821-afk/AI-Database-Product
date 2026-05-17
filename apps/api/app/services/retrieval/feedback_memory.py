from __future__ import annotations

from typing import Any, Dict, Optional

from app.api.schemas import FeedbackRequest, MemoryDraftRequest
from app.core.errors import AppError
from app.db.sqlite import db, json_dumps
from app.services.ingestion.text_import import new_id, now_iso


def submit_feedback(payload: FeedbackRequest) -> Dict[str, Any]:
    timestamp = now_iso()
    with db() as conn:
        _ensure_targets(
            conn,
            evidence_pack_id=payload.evidence_pack_id,
            ai_answer_id=payload.ai_answer_id,
            evidence_item_id=payload.evidence_item_id,
        )
        target_type, target_id = _primary_target(
            payload.evidence_pack_id,
            payload.ai_answer_id,
            payload.evidence_item_id,
        )
        feedback_id = new_id("feedback")
        metadata = {
            "feedback_signal": {
                "signal_type": payload.feedback_type,
                "target_type": target_type,
                "target_id": target_id,
                "ranking_effect": _ranking_effect(payload.feedback_type),
                "mutates_confirmed_knowledge": False,
            },
            "feedback_policy": feedback_policy(),
            "frontend_event_source": "d107_feedback_controls",
        }
        conn.execute(
            """
            INSERT INTO feedback_events
              (id, user_id, target_type, target_id, evidence_pack_id, ai_answer_id,
               evidence_item_id, feedback_type, comment, metadata_json, created_at)
            VALUES (?, 'local-user', ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                feedback_id,
                target_type,
                target_id,
                payload.evidence_pack_id,
                payload.ai_answer_id,
                payload.evidence_item_id,
                payload.feedback_type,
                payload.comment,
                json_dumps(metadata),
                timestamp,
            ),
        )
    return {
        "id": feedback_id,
        "feedback_type": payload.feedback_type,
        "target_type": target_type,
        "target_id": target_id,
        "evidence_pack_id": payload.evidence_pack_id,
        "ai_answer_id": payload.ai_answer_id,
        "evidence_item_id": payload.evidence_item_id,
        "feedback_policy": feedback_policy(),
        "created_at": timestamp,
    }


def create_memory_draft(payload: MemoryDraftRequest) -> Dict[str, Any]:
    timestamp = now_iso()
    with db() as conn:
        answer = conn.execute(
            "SELECT * FROM ai_answers WHERE id = ?",
            (payload.source_answer_id,),
        ).fetchone()
        if not answer:
            raise AppError("ai_answer_not_found", "Source answer was not found.", status_code=404)
        memory_id = new_id("memory")
        review_task_id = new_id("review")
        metadata = {
            "source": "ai_answer",
            "evidence_pack_id": answer["evidence_pack_id"],
            "retrieval_log_id": answer["retrieval_log_id"],
            "d107_boundary": "pending_review_only",
        }
        conn.execute(
            """
            INSERT INTO memories
              (id, project_id, source_answer_id, content, memory_type, status, permission,
               user_confirmed, metadata_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'pending_review', ?, 0, ?, ?, ?)
            """,
            (
                memory_id,
                payload.project_id,
                payload.source_answer_id,
                payload.content.strip(),
                payload.memory_type,
                payload.permission,
                json_dumps(metadata),
                timestamp,
                timestamp,
            ),
        )
        conn.execute(
            """
            INSERT INTO review_tasks
              (id, target_type, target_id, status, payload_json, created_at, updated_at)
            VALUES (?, 'memory', ?, 'pending_review', ?, ?, ?)
            """,
            (
                review_task_id,
                memory_id,
                json_dumps(
                    {
                        "title": _memory_title(payload.content),
                        "content": payload.content.strip(),
                        "memory_type": payload.memory_type,
                        "source_answer_id": payload.source_answer_id,
                        "evidence_pack_id": answer["evidence_pack_id"],
                        "review_reason": "memory_draft_from_evidence_only_answer",
                    }
                ),
                timestamp,
                timestamp,
            ),
        )
        conn.execute(
            """
            INSERT INTO audit_logs (id, event_type, payload_json, created_at)
            VALUES (?, 'memory_draft_created', ?, ?)
            """,
            (
                new_id("audit"),
                json_dumps({"memory_id": memory_id, "review_task_id": review_task_id}),
                timestamp,
            ),
        )
    return get_memory_draft(memory_id)


def list_memory_drafts(status: Optional[str] = None) -> list[Dict[str, Any]]:
    query = """
        SELECT m.*, rt.id AS review_task_id
        FROM memories m
        LEFT JOIN review_tasks rt
          ON rt.target_type = 'memory' AND rt.target_id = m.id
    """
    params: tuple[str, ...] = ()
    if status:
        query += " WHERE m.status = ?"
        params = (status,)
    query += " ORDER BY m.created_at DESC"
    with db() as conn:
        rows = conn.execute(query, params).fetchall()
    return [_memory_row(row) for row in rows]


def get_memory_draft(memory_id: str) -> Dict[str, Any]:
    with db() as conn:
        row = conn.execute(
            """
            SELECT m.*, rt.id AS review_task_id
            FROM memories m
            LEFT JOIN review_tasks rt
              ON rt.target_type = 'memory' AND rt.target_id = m.id
            WHERE m.id = ?
            """,
            (memory_id,),
        ).fetchone()
    if not row:
        raise AppError("memory_not_found", "Memory draft was not found.", status_code=404)
    return _memory_row(row)


def feedback_policy() -> Dict[str, Any]:
    return {
        "storage_mode": "local_only",
        "scope": "current_project",
        "ranking_effect": "suggestion_only",
        "mutates_confirmed_knowledge": False,
    }


def _ensure_targets(
    conn,
    *,
    evidence_pack_id: Optional[str],
    ai_answer_id: Optional[str],
    evidence_item_id: Optional[str],
) -> None:
    if evidence_pack_id and not conn.execute(
        "SELECT 1 FROM evidence_packs WHERE id = ?",
        (evidence_pack_id,),
    ).fetchone():
        raise AppError("feedback_target_not_found", "Evidence pack was not found.", status_code=404)
    if ai_answer_id and not conn.execute(
        "SELECT 1 FROM ai_answers WHERE id = ?",
        (ai_answer_id,),
    ).fetchone():
        raise AppError("feedback_target_not_found", "AI answer was not found.", status_code=404)
    if evidence_item_id and not conn.execute(
        "SELECT 1 FROM evidence_items WHERE id = ?",
        (evidence_item_id,),
    ).fetchone():
        raise AppError("feedback_target_not_found", "Evidence item was not found.", status_code=404)


def _primary_target(
    evidence_pack_id: Optional[str],
    ai_answer_id: Optional[str],
    evidence_item_id: Optional[str],
) -> tuple[str, str]:
    if evidence_item_id:
        return "evidence_item", evidence_item_id
    if ai_answer_id:
        return "ai_answer", ai_answer_id
    if evidence_pack_id:
        return "evidence_pack", evidence_pack_id
    raise AppError("feedback_target_required", "Feedback target is required.", status_code=422)


def _ranking_effect(feedback_type: str) -> str:
    if feedback_type in {"useful", "favorite", "click"}:
        return "positive_weight_suggestion"
    if feedback_type in {"not_useful", "bad_citation", "missing_source", "downrank_source"}:
        return "negative_weight_suggestion"
    return "diagnostic_only"


def _memory_title(content: str) -> str:
    compact = " ".join(content.strip().split())
    return compact[:80] or "Memory Draft"


def _memory_row(row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "project_id": row["project_id"],
        "source_answer_id": row["source_answer_id"],
        "content": row["content"],
        "memory_type": row["memory_type"],
        "status": row["status"],
        "permission": row["permission"],
        "user_confirmed": bool(row["user_confirmed"]),
        "review_task_id": row["review_task_id"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }
