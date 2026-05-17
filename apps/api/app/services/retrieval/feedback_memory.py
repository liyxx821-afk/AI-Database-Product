from __future__ import annotations

import csv
import hashlib
import io
import json
from datetime import datetime
from typing import Any, Dict, Optional

from app.api.schemas import FeedbackRequest, MemoryDraftRequest
from app.core.errors import AppError
from app.db.sqlite import db, json_dumps
from app.services.ingestion.text_import import new_id, now_iso
from app.services.settings import (
    append_feedback_export_history,
    delete_feedback_export_history,
    get_feedback_export_history,
)

VALID_TARGET_TYPES = {"evidence_pack", "ai_answer", "evidence_item"}
POSITIVE_FEEDBACK_TYPES = {"click", "useful", "favorite"}
NEGATIVE_FEEDBACK_TYPES = {
    "not_useful",
    "bad_citation",
    "missing_source",
    "downrank_source",
}
VALID_RANKING_EFFECTS = {
    "positive_weight_suggestion",
    "negative_weight_suggestion",
    "diagnostic_only",
}
VALID_SORT_ORDERS = {"created_desc", "created_asc"}


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


def list_feedback_events(
    *,
    feedback_type: Optional[str] = None,
    target_type: Optional[str] = None,
    evidence_pack_id: Optional[str] = None,
    ai_answer_id: Optional[str] = None,
    evidence_item_id: Optional[str] = None,
    created_from: Optional[str] = None,
    created_to: Optional[str] = None,
    search: Optional[str] = None,
    ranking_effect: Optional[str] = None,
    has_comment: Optional[bool] = None,
    sort: str = "created_desc",
    limit: int = 50,
) -> list[Dict[str, Any]]:
    return _query_feedback_events(
        feedback_type=feedback_type,
        target_type=target_type,
        evidence_pack_id=evidence_pack_id,
        ai_answer_id=ai_answer_id,
        evidence_item_id=evidence_item_id,
        created_from=created_from,
        created_to=created_to,
        search=search,
        ranking_effect=ranking_effect,
        has_comment=has_comment,
        sort=sort,
        limit=limit,
        max_limit=100,
    )


def export_feedback_diagnostics(
    *,
    export_format: str,
    feedback_type: Optional[str] = None,
    target_type: Optional[str] = None,
    evidence_pack_id: Optional[str] = None,
    ai_answer_id: Optional[str] = None,
    evidence_item_id: Optional[str] = None,
    created_from: Optional[str] = None,
    created_to: Optional[str] = None,
    search: Optional[str] = None,
    ranking_effect: Optional[str] = None,
    has_comment: Optional[bool] = None,
    sort: str = "created_desc",
    limit: int = 50,
) -> Dict[str, Any]:
    if export_format not in {"json", "csv"}:
        raise AppError(
            "invalid_feedback_export_format",
            "Unsupported export format.",
            status_code=422,
        )

    events = _query_feedback_events(
        feedback_type=feedback_type,
        target_type=target_type,
        evidence_pack_id=evidence_pack_id,
        ai_answer_id=ai_answer_id,
        evidence_item_id=evidence_item_id,
        created_from=created_from,
        created_to=created_to,
        search=search,
        ranking_effect=ranking_effect,
        has_comment=has_comment,
        sort=sort,
        limit=limit,
        max_limit=100,
    )
    generated_at = now_iso()
    filters = _normalized_export_filters(
        feedback_type=feedback_type,
        target_type=target_type,
        evidence_pack_id=evidence_pack_id,
        ai_answer_id=ai_answer_id,
        evidence_item_id=evidence_item_id,
        created_from=created_from,
        created_to=created_to,
        search=search,
        ranking_effect=ranking_effect,
        has_comment=has_comment,
        sort=sort,
        limit=min(max(limit, 1), 100),
    )
    summary = _summary_from_events(events)
    if export_format == "json":
        content = json.dumps(
            {
                "generated_at": generated_at,
                "filters": filters,
                "summary": summary,
                "events": events,
                "redacted": True,
                "includes_source_text": False,
            },
            ensure_ascii=False,
            indent=2,
        )
        mime_type = "application/json"
    else:
        content = _events_to_csv(events)
        mime_type = "text/csv"
    filename = _export_filename(generated_at, export_format)
    content_sha256 = hashlib.sha256(content.encode("utf-8")).hexdigest()
    append_feedback_export_history(
        {
            "id": new_id("feedback_export"),
            "filename": filename,
            "format": export_format,
            "record_count": len(events),
            "generated_at": generated_at,
            "filters": filters,
            "summary": summary,
            "content_sha256": content_sha256,
            "redacted": True,
            "includes_source_text": False,
        }
    )
    return {
        "filename": filename,
        "mime_type": mime_type,
        "format": export_format,
        "record_count": len(events),
        "generated_at": generated_at,
        "filters": filters,
        "summary": summary,
        "content": content,
        "redacted": True,
        "includes_source_text": False,
    }


def _query_feedback_events(
    *,
    feedback_type: Optional[str] = None,
    target_type: Optional[str] = None,
    evidence_pack_id: Optional[str] = None,
    ai_answer_id: Optional[str] = None,
    evidence_item_id: Optional[str] = None,
    created_from: Optional[str] = None,
    created_to: Optional[str] = None,
    search: Optional[str] = None,
    ranking_effect: Optional[str] = None,
    has_comment: Optional[bool] = None,
    sort: str = "created_desc",
    limit: int = 50,
    max_limit: int = 100,
) -> list[Dict[str, Any]]:
    where, params = _feedback_filter_clauses(
        feedback_type=feedback_type,
        target_type=target_type,
        evidence_pack_id=evidence_pack_id,
        ai_answer_id=ai_answer_id,
        evidence_item_id=evidence_item_id,
        created_from=created_from,
        created_to=created_to,
        search=search,
        ranking_effect=ranking_effect,
        has_comment=has_comment,
    )
    order_by = _feedback_order_by(sort)
    safe_limit = min(max(limit, 1), max_limit)

    query = """
        SELECT
          f.*,
          rl.query AS retrieval_query,
          ei.citation_label AS evidence_citation_label
        FROM feedback_events f
        LEFT JOIN evidence_items ei ON ei.id = f.evidence_item_id
        LEFT JOIN ai_answers aa ON aa.id = f.ai_answer_id
        LEFT JOIN evidence_packs ep
          ON ep.id = COALESCE(f.evidence_pack_id, aa.evidence_pack_id, ei.evidence_pack_id)
        LEFT JOIN retrieval_logs rl ON rl.id = COALESCE(aa.retrieval_log_id, ep.retrieval_log_id)
    """
    if where:
        query += " WHERE " + " AND ".join(where)
    query += f" ORDER BY {order_by} LIMIT ?"
    params.append(safe_limit)

    with db() as conn:
        rows = conn.execute(query, tuple(params)).fetchall()
    return [_feedback_event_row(row) for row in rows]


def feedback_summary(
    *,
    feedback_type: Optional[str] = None,
    target_type: Optional[str] = None,
    evidence_pack_id: Optional[str] = None,
    ai_answer_id: Optional[str] = None,
    evidence_item_id: Optional[str] = None,
    created_from: Optional[str] = None,
    created_to: Optional[str] = None,
    search: Optional[str] = None,
    ranking_effect: Optional[str] = None,
    has_comment: Optional[bool] = None,
    sort: str = "created_desc",
) -> Dict[str, Any]:
    where, params = _feedback_filter_clauses(
        feedback_type=feedback_type,
        target_type=target_type,
        evidence_pack_id=evidence_pack_id,
        ai_answer_id=ai_answer_id,
        evidence_item_id=evidence_item_id,
        created_from=created_from,
        created_to=created_to,
        search=search,
        ranking_effect=ranking_effect,
        has_comment=has_comment,
    )
    order_by = _feedback_order_by(sort)
    query = """
        SELECT
          f.feedback_type,
          f.target_type,
          f.metadata_json,
          f.created_at
        FROM feedback_events f
        LEFT JOIN evidence_items ei ON ei.id = f.evidence_item_id
        LEFT JOIN ai_answers aa ON aa.id = f.ai_answer_id
        LEFT JOIN evidence_packs ep
          ON ep.id = COALESCE(f.evidence_pack_id, aa.evidence_pack_id, ei.evidence_pack_id)
        LEFT JOIN retrieval_logs rl ON rl.id = COALESCE(aa.retrieval_log_id, ep.retrieval_log_id)
    """
    if where:
        query += " WHERE " + " AND ".join(where)
    query += f" ORDER BY {order_by}"
    with db() as conn:
        rows = conn.execute(query, tuple(params)).fetchall()
    by_type: dict[str, int] = {}
    by_target_type: dict[str, int] = {}
    positive_count = 0
    negative_count = 0
    for row in rows:
        feedback_type = row["feedback_type"]
        target_type = row["target_type"]
        by_type[feedback_type] = by_type.get(feedback_type, 0) + 1
        by_target_type[target_type] = by_target_type.get(target_type, 0) + 1
        if feedback_type in POSITIVE_FEEDBACK_TYPES:
            positive_count += 1
        if feedback_type in NEGATIVE_FEEDBACK_TYPES:
            negative_count += 1
    return {
        "total": len(rows),
        "by_type": by_type,
        "by_target_type": by_target_type,
        "positive_count": positive_count,
        "negative_count": negative_count,
        "last_event_at": max((row["created_at"] for row in rows), default=None),
        "feedback_policy": _summary_feedback_policy(rows),
    }


def list_feedback_export_history() -> list[Dict[str, Any]]:
    return get_feedback_export_history()


def remove_feedback_export_history(history_id: str) -> Dict[str, Any]:
    if not delete_feedback_export_history(history_id):
        raise AppError(
            "feedback_export_history_not_found",
            "Feedback export history record was not found.",
            status_code=404,
        )
    return {"deleted": True, "id": history_id}


def _feedback_filter_clauses(
    *,
    feedback_type: Optional[str],
    target_type: Optional[str],
    evidence_pack_id: Optional[str],
    ai_answer_id: Optional[str],
    evidence_item_id: Optional[str],
    created_from: Optional[str],
    created_to: Optional[str],
    search: Optional[str],
    ranking_effect: Optional[str],
    has_comment: Optional[bool],
) -> tuple[list[str], list[Any]]:
    if target_type and target_type not in VALID_TARGET_TYPES:
        raise AppError(
            "invalid_feedback_filter",
            "Unsupported feedback target type.",
            status_code=422,
        )
    if ranking_effect and ranking_effect not in VALID_RANKING_EFFECTS:
        raise AppError(
            "invalid_feedback_filter",
            "Unsupported ranking effect.",
            status_code=422,
        )

    where: list[str] = []
    params: list[Any] = []
    if feedback_type:
        where.append("f.feedback_type = ?")
        params.append(feedback_type)
    if target_type:
        where.append("f.target_type = ?")
        params.append(target_type)
    if evidence_pack_id:
        where.append("f.evidence_pack_id = ?")
        params.append(evidence_pack_id)
    if ai_answer_id:
        where.append("f.ai_answer_id = ?")
        params.append(ai_answer_id)
    if evidence_item_id:
        where.append("f.evidence_item_id = ?")
        params.append(evidence_item_id)
    if created_from:
        where.append("f.created_at >= ?")
        params.append(_validate_iso_datetime(created_from, "created_from"))
    if created_to:
        where.append("f.created_at <= ?")
        params.append(_validate_iso_datetime(created_to, "created_to"))
    if search and search.strip():
        needle = f"%{search.strip().lower()}%"
        where.append(
            """
            (
              LOWER(f.id) LIKE ?
              OR LOWER(f.target_id) LIKE ?
              OR LOWER(COALESCE(f.evidence_pack_id, '')) LIKE ?
              OR LOWER(COALESCE(f.ai_answer_id, '')) LIKE ?
              OR LOWER(COALESCE(f.evidence_item_id, '')) LIKE ?
              OR LOWER(COALESCE(rl.query, '')) LIKE ?
              OR LOWER(COALESCE(ei.citation_label, '')) LIKE ?
              OR LOWER(COALESCE(f.comment, '')) LIKE ?
            )
            """
        )
        params.extend([needle] * 8)
    if ranking_effect:
        where.append(_ranking_effect_clause(ranking_effect))
    if has_comment is True:
        where.append("f.comment IS NOT NULL AND TRIM(f.comment) != ''")
    if has_comment is False:
        where.append("(f.comment IS NULL OR TRIM(f.comment) = '')")
    return where, params


def _ranking_effect_clause(ranking_effect: str) -> str:
    positive = ", ".join(f"'{item}'" for item in sorted(POSITIVE_FEEDBACK_TYPES))
    negative = ", ".join(f"'{item}'" for item in sorted(NEGATIVE_FEEDBACK_TYPES))
    if ranking_effect == "positive_weight_suggestion":
        return f"f.feedback_type IN ({positive})"
    if ranking_effect == "negative_weight_suggestion":
        return f"f.feedback_type IN ({negative})"
    return f"f.feedback_type NOT IN ({positive}, {negative})"


def _feedback_order_by(sort: str) -> str:
    if sort not in VALID_SORT_ORDERS:
        raise AppError(
            "invalid_feedback_filter",
            "Unsupported feedback sort order.",
            status_code=422,
        )
    if sort == "created_asc":
        return "f.created_at ASC, f.id ASC"
    return "f.created_at DESC, f.id DESC"


def _validate_iso_datetime(value: str, field_name: str) -> str:
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise AppError(
            "invalid_feedback_filter",
            f"{field_name} must be an ISO datetime.",
            status_code=422,
        ) from exc
    return value


def _summary_from_events(events: list[Dict[str, Any]]) -> Dict[str, Any]:
    by_type: dict[str, int] = {}
    by_target_type: dict[str, int] = {}
    positive_count = 0
    negative_count = 0
    for event in events:
        event_type = event["feedback_type"]
        target_type = event["target_type"]
        by_type[event_type] = by_type.get(event_type, 0) + 1
        by_target_type[target_type] = by_target_type.get(target_type, 0) + 1
        if event_type in POSITIVE_FEEDBACK_TYPES:
            positive_count += 1
        if event_type in NEGATIVE_FEEDBACK_TYPES:
            negative_count += 1
    return {
        "total": len(events),
        "by_type": by_type,
        "by_target_type": by_target_type,
        "positive_count": positive_count,
        "negative_count": negative_count,
        "last_event_at": max((event["created_at"] for event in events), default=None),
        "feedback_policy": feedback_policy(),
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


def _feedback_event_row(row) -> Dict[str, Any]:
    metadata = _metadata(row["metadata_json"])
    signal = metadata.get("feedback_signal", {})
    ranking_effect = signal.get("ranking_effect")
    if not isinstance(ranking_effect, str):
        ranking_effect = _ranking_effect(row["feedback_type"])
    return {
        "id": row["id"],
        "feedback_type": row["feedback_type"],
        "target_type": row["target_type"],
        "target_id": row["target_id"],
        "evidence_pack_id": row["evidence_pack_id"],
        "ai_answer_id": row["ai_answer_id"],
        "evidence_item_id": row["evidence_item_id"],
        "comment": row["comment"],
        "ranking_effect": ranking_effect,
        "query": row["retrieval_query"],
        "citation_label": row["evidence_citation_label"],
        "created_at": row["created_at"],
    }


def _normalized_export_filters(
    *,
    feedback_type: Optional[str],
    target_type: Optional[str],
    evidence_pack_id: Optional[str],
    ai_answer_id: Optional[str],
    evidence_item_id: Optional[str],
    created_from: Optional[str],
    created_to: Optional[str],
    search: Optional[str],
    ranking_effect: Optional[str],
    has_comment: Optional[bool],
    sort: str,
    limit: int,
) -> Dict[str, Any]:
    filters: Dict[str, Any] = {"limit": limit, "sort": sort}
    if feedback_type:
        filters["feedback_type"] = feedback_type
    if target_type:
        filters["target_type"] = target_type
    if evidence_pack_id:
        filters["evidence_pack_id"] = evidence_pack_id
    if ai_answer_id:
        filters["ai_answer_id"] = ai_answer_id
    if evidence_item_id:
        filters["evidence_item_id"] = evidence_item_id
    if created_from:
        filters["created_from"] = created_from
    if created_to:
        filters["created_to"] = created_to
    if search and search.strip():
        filters["search"] = search.strip()
    if ranking_effect:
        filters["ranking_effect"] = ranking_effect
    if has_comment is not None:
        filters["has_comment"] = has_comment
    return filters


def _events_to_csv(events: list[Dict[str, Any]]) -> str:
    output = io.StringIO()
    fieldnames = [
        "id",
        "feedback_type",
        "target_type",
        "target_id",
        "evidence_pack_id",
        "ai_answer_id",
        "evidence_item_id",
        "ranking_effect",
        "query",
        "citation_label",
        "comment",
        "created_at",
    ]
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    for event in events:
        writer.writerow({key: event.get(key) for key in fieldnames})
    return output.getvalue()


def _export_filename(generated_at: str, export_format: str) -> str:
    safe_timestamp = (
        generated_at.replace("-", "")
        .replace(":", "")
        .replace(".", "")
        .replace("+", "")
    )
    return f"feedback-diagnostics-{safe_timestamp}.{export_format}"


def _summary_feedback_policy(rows) -> Dict[str, Any]:
    for row in rows:
        metadata = _metadata(row["metadata_json"])
        policy = metadata.get("feedback_policy")
        if isinstance(policy, dict):
            return policy
    return feedback_policy()


def _metadata(raw: str) -> dict[str, Any]:
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}
