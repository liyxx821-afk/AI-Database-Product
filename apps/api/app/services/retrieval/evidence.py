from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.core.errors import AppError
from app.db.sqlite import db, json_dumps, sqlite_vec_status

QUERY_UNDERSTANDING_PROFILE = "p0_query_understanding_rule_v1"
RETRIEVAL_STRATEGY_PROFILE = "p0_confirmed_ku_token_overlap_v1"
RANKING_PROFILE = "p0_token_overlap_metadata_fallback_v1"
CITATION_TRACE_PROFILE = "p0_citation_trace_source_chunk_v1"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def _query_tokens(query: str) -> List[str]:
    return [token for token in query.lower().split() if token]


def _token_score(query: str, text: str) -> float:
    query_tokens = _query_tokens(query)
    if not query_tokens:
        return 0.0
    lower_text = text.lower()
    hits = sum(1 for token in query_tokens if token in lower_text)
    return hits / max(len(query_tokens), 1)


def _query_explanation(
    *,
    query: str,
    project_id: str,
    folder_id: Optional[str],
    tag_ids: List[str],
    provider_status: str,
    fallback_reason: Optional[str],
    evidence_count: int,
) -> Dict[str, Any]:
    return {
        "query": query,
        "query_understanding_profile": QUERY_UNDERSTANDING_PROFILE,
        "retrieval_strategy_profile": RETRIEVAL_STRATEGY_PROFILE,
        "ranking_profile": RANKING_PROFILE,
        "citation_trace_profile": CITATION_TRACE_PROFILE,
        "filters": {
            "project_id": project_id,
            "folder_id": folder_id,
            "tag_ids": tag_ids,
            "knowledge_unit_status": "confirmed",
        },
        "ranking_summary": {
            "method": "token_overlap",
            "candidate_scope": "confirmed_knowledge_units",
            "evidence_count": evidence_count,
        },
        "provider_status": provider_status,
        "fallback_reason": fallback_reason,
        "disabled_capabilities": ["provider_backed_rag", "reranker", "text_to_sql_model"],
    }


def _load_confirmed_rows(
    project_id: str,
    folder_id: Optional[str] = None,
    tag_ids: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    tag_ids = tag_ids or []
    conditions = ["ku.project_id = ?", "ku.status = 'confirmed'"]
    params: list[Any] = [project_id]
    if folder_id:
        conditions.append("ku.primary_folder_id = ?")
        params.append(folder_id)
    for tag_id in tag_ids:
        conditions.append(
            """
            EXISTS (
              SELECT 1 FROM knowledge_unit_tags kut
              WHERE kut.knowledge_unit_id = ku.id AND kut.tag_id = ?
            )
            """
        )
        params.append(tag_id)
    where_clause = " AND ".join(conditions)
    with db() as conn:
        _validate_retrieval_filters(conn, project_id, folder_id, tag_ids)
        rows = conn.execute(
            f"""
            SELECT
              ku.id AS knowledge_unit_id,
              ku.title,
              ku.content,
              ku.status,
              c.id AS chunk_id,
              c.citation_label,
              s.id AS source_id,
              s.title AS source_title
            FROM knowledge_units ku
            JOIN chunks c ON c.id = ku.chunk_id
            JOIN sources s ON s.id = ku.source_id
            WHERE {where_clause}
            ORDER BY ku.updated_at DESC
            LIMIT 50
            """,
            params,
        ).fetchall()
    return [dict(row) for row in rows]


def _validate_retrieval_filters(
    conn: Any,
    project_id: str,
    folder_id: Optional[str],
    tag_ids: List[str],
) -> None:
    if not conn.execute("SELECT 1 FROM projects WHERE id = ?", (project_id,)).fetchone():
        raise AppError("project_not_found", "Project was not found.", status_code=404)
    if folder_id and not conn.execute(
        "SELECT 1 FROM folders WHERE id = ? AND project_id = ?",
        (folder_id, project_id),
    ).fetchone():
        raise AppError("folder_not_found", "Folder was not found.", status_code=404)
    for tag_id in tag_ids:
        if not conn.execute(
            "SELECT 1 FROM tags WHERE id = ? AND project_id = ?",
            (tag_id, project_id),
        ).fetchone():
            raise AppError("tag_not_found", "Tag was not found.", status_code=404)


def _rank_evidence_rows(query: str, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    scored_rows: List[Dict[str, Any]] = []
    for row in rows:
        score = _token_score(query, f"{row['title']} {row['content']} {row['source_title']}")
        if score <= 0:
            continue
        scored_rows.append({**row, "rank_score": score})
    return sorted(
        scored_rows,
        key=lambda row: (row["rank_score"], row["source_title"], row["title"]),
        reverse=True,
    )[:3]


def _pack_summary(evidence_count: int, provider_status: str) -> str:
    if evidence_count == 0:
        return "No confirmed evidence found."
    if provider_status != "available":
        return "Evidence Pack assembled from confirmed knowledge with vector fallback degraded."
    return "Evidence Pack assembled from confirmed knowledge."


def _citation_trace_path(item: Dict[str, Any]) -> List[Dict[str, Any]]:
    path = [
        {
            "type": "evidence_pack",
            "id": item["evidence_pack_id"],
        },
        {
            "type": "evidence_item",
            "id": item["id"],
            "label": item["citation_label"],
        },
    ]
    if item["knowledge_unit_id"]:
        path.append(
            {
                "type": "knowledge_unit",
                "id": item["knowledge_unit_id"],
                "title": item["knowledge_unit_title"],
                "status": item["knowledge_unit_status"],
            }
        )
    if item["chunk_id"]:
        path.append(
            {
                "type": "chunk",
                "id": item["chunk_id"],
                "label": item["chunk_citation_label"],
            }
        )
    if item["source_id"]:
        path.append(
            {
                "type": "source",
                "id": item["source_id"],
                "title": item["source_title"],
                "origin": item["source_origin"],
            }
        )
    return path


def _copy_safe_citation_payload(item: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "citation_label": item["citation_label"],
        "evidence_pack_id": item["evidence_pack_id"],
        "evidence_item_id": item["id"],
        "knowledge_unit_id": item["knowledge_unit_id"],
        "knowledge_unit_title": item["knowledge_unit_title"],
        "chunk_id": item["chunk_id"],
        "chunk_citation_label": item["chunk_citation_label"],
        "source_id": item["source_id"],
        "source_title": item["source_title"],
        "source_origin": item["source_origin"],
    }


def _annotation_record(row: Any) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "evidence_pack_id": row["evidence_pack_id"],
        "evidence_item_id": row["evidence_item_id"],
        "annotation_type": row["annotation_type"],
        "content": row["content"],
        "metadata": json.loads(row["metadata_json"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _annotation_counts(rows: List[Any]) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for row in rows:
        counts[row["annotation_type"]] = int(row["count"])
    return counts


def _build_evidence_pack_response(
    evidence_pack_id: str,
    focus_item_id: Optional[str] = None,
) -> Dict[str, Any]:
    with db() as conn:
        pack = conn.execute(
            """
            SELECT
              ep.*,
              rl.query,
              rl.filters_json,
              rl.capability_status,
              rl.fallback_reason
            FROM evidence_packs ep
            JOIN retrieval_logs rl ON rl.id = ep.retrieval_log_id
            WHERE ep.id = ?
            """,
            (evidence_pack_id,),
        ).fetchone()
        if not pack:
            raise AppError(
                "evidence_pack_not_found",
                "Evidence Pack was not found.",
                status_code=404,
            )
        items = conn.execute(
            """
            SELECT
              ei.*,
              ku.title AS knowledge_unit_title,
              ku.status AS knowledge_unit_status,
              ku.type AS knowledge_unit_type,
              c.citation_label AS chunk_citation_label,
              c.content AS chunk_content,
              s.title AS source_title,
              s.source_origin,
              s.source_type
            FROM evidence_items ei
            LEFT JOIN knowledge_units ku ON ku.id = ei.knowledge_unit_id
            LEFT JOIN chunks c ON c.id = ei.chunk_id
            LEFT JOIN sources s ON s.id = ei.source_id
            WHERE ei.evidence_pack_id = ?
            ORDER BY ei.rank_score DESC, ei.created_at ASC
            """,
            (evidence_pack_id,),
        ).fetchall()
        annotation_count_rows = conn.execute(
            """
            SELECT annotation_type, COUNT(*) AS count
            FROM citation_annotations
            WHERE evidence_pack_id = ?
            GROUP BY annotation_type
            """,
            (evidence_pack_id,),
        ).fetchall()
    if focus_item_id and not any(item["id"] == focus_item_id for item in items):
        raise AppError(
            "evidence_item_not_in_pack",
            "Evidence item is not part of this Evidence Pack.",
            status_code=404,
        )
    annotation_counts = _annotation_counts(annotation_count_rows)
    query_explanation = json.loads(pack["filters_json"])
    citation_labels = [item["citation_label"] for item in items]
    rank_scores = [float(item["rank_score"]) for item in items]
    citation_summary = (
        "Evidence Pack uses " + ", ".join(citation_labels)
        if citation_labels
        else "No evidence items were attached."
    )
    return {
        "id": pack["id"],
        "retrieval_log_id": pack["retrieval_log_id"],
        "query": pack["query"],
        "query_explanation": query_explanation,
        "provider_status": pack["capability_status"],
        "fallback_reason": pack["fallback_reason"],
        "citation_trace_summary": citation_summary,
        "status": pack["status"],
        "failure_type": pack["failure_type"],
        "summary": pack["summary"],
        "detail_summary": {
            "item_count": len(items),
            "source_count": len({item["source_id"] for item in items if item["source_id"]}),
            "knowledge_unit_count": len(
                {
                    item["knowledge_unit_id"]
                    for item in items
                    if item["knowledge_unit_id"]
                }
            ),
            "citation_labels": citation_labels,
            "rank_score_min": min(rank_scores) if rank_scores else None,
            "rank_score_max": max(rank_scores) if rank_scores else None,
            "focused_item_id": focus_item_id,
            "no_evidence_reason": pack["failure_type"] if not items else None,
            "annotation_count": sum(annotation_counts.values()),
            "annotation_counts": annotation_counts,
        },
        "items": [
            {
                "id": item["id"],
                "evidence_pack_id": item["evidence_pack_id"],
                "knowledge_unit_id": item["knowledge_unit_id"],
                "chunk_id": item["chunk_id"],
                "source_id": item["source_id"],
                "citation_label": item["citation_label"],
                "excerpt": item["excerpt"],
                "rank_score": item["rank_score"],
                "knowledge_unit_title": item["knowledge_unit_title"],
                "knowledge_unit_status": item["knowledge_unit_status"],
                "knowledge_unit_type": item["knowledge_unit_type"],
                "chunk_citation_label": item["chunk_citation_label"],
                "chunk_content_excerpt": (item["chunk_content"] or "")[:360],
                "source_title": item["source_title"],
                "source_origin": item["source_origin"],
                "source_type": item["source_type"],
                "citation_trace": {
                    "profile": CITATION_TRACE_PROFILE,
                    "evidence_pack_id": item["evidence_pack_id"],
                    "evidence_item_id": item["id"],
                    "knowledge_unit_id": item["knowledge_unit_id"],
                    "chunk_id": item["chunk_id"],
                    "source_id": item["source_id"],
                    "citation_label": item["citation_label"],
                    "source_title": item["source_title"],
                    "source_origin": item["source_origin"],
                    "trace_path": _citation_trace_path(dict(item)),
                    "copy_payload": _copy_safe_citation_payload(dict(item)),
                },
                "created_at": item["created_at"],
            }
            for item in items
        ],
        "created_at": pack["created_at"],
    }


def _load_item_for_pack(conn: Any, evidence_pack_id: str, evidence_item_id: str) -> Any:
    item = conn.execute(
        """
        SELECT *
        FROM evidence_items
        WHERE id = ?
          AND evidence_pack_id = ?
        """,
        (evidence_item_id, evidence_pack_id),
    ).fetchone()
    if not item:
        raise AppError(
            "evidence_item_not_in_pack",
            "Evidence item is not part of this Evidence Pack.",
            status_code=404,
        )
    return item


def list_citation_annotations(evidence_pack_id: str) -> Dict[str, Any]:
    with db() as conn:
        pack = conn.execute(
            "SELECT id FROM evidence_packs WHERE id = ?",
            (evidence_pack_id,),
        ).fetchone()
        if not pack:
            raise AppError(
                "evidence_pack_not_found",
                "Evidence Pack was not found.",
                status_code=404,
            )
        rows = conn.execute(
            """
            SELECT *
            FROM citation_annotations
            WHERE evidence_pack_id = ?
            ORDER BY updated_at DESC, created_at DESC
            """,
            (evidence_pack_id,),
        ).fetchall()
    records = [_annotation_record(row) for row in rows]
    counts: Dict[str, int] = {}
    for record in records:
        counts[record["annotation_type"]] = counts.get(record["annotation_type"], 0) + 1
    return {
        "evidence_pack_id": evidence_pack_id,
        "annotations": records,
        "counts_by_type": counts,
        "total": len(records),
    }


def create_citation_annotation(
    evidence_pack_id: str,
    evidence_item_id: str,
    annotation_type: str,
    content: str,
) -> Dict[str, Any]:
    trimmed_content = content.strip()
    if not trimmed_content:
        raise AppError("validation_error", "Annotation content is required.", status_code=422)
    timestamp = now_iso()
    annotation_id = new_id("canno")
    with db() as conn:
        pack = conn.execute(
            "SELECT id FROM evidence_packs WHERE id = ?",
            (evidence_pack_id,),
        ).fetchone()
        if not pack:
            raise AppError(
                "evidence_pack_not_found",
                "Evidence Pack was not found.",
                status_code=404,
            )
        _load_item_for_pack(conn, evidence_pack_id, evidence_item_id)
        conn.execute(
            """
            INSERT INTO citation_annotations (
              id, evidence_pack_id, evidence_item_id, annotation_type,
              content, metadata_json, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                annotation_id,
                evidence_pack_id,
                evidence_item_id,
                annotation_type,
                trimmed_content,
                json_dumps({"source": "citation_detail"}),
                timestamp,
                timestamp,
            ),
        )
        row = conn.execute(
            "SELECT * FROM citation_annotations WHERE id = ?",
            (annotation_id,),
        ).fetchone()
    return _annotation_record(row)


def create_citation_annotations_batch(
    evidence_pack_id: str,
    evidence_item_ids: List[str],
    annotation_type: str,
    content: str,
) -> Dict[str, Any]:
    unique_item_ids = list(dict.fromkeys(evidence_item_ids))
    if not unique_item_ids or len(unique_item_ids) > 20:
        raise AppError(
            "validation_error",
            "Batch citation annotation requires 1-20 evidence item ids.",
            status_code=422,
        )
    trimmed_content = content.strip()
    if not trimmed_content:
        raise AppError("validation_error", "Annotation content is required.", status_code=422)
    timestamp = now_iso()
    created_rows = []
    with db() as conn:
        pack = conn.execute(
            "SELECT id FROM evidence_packs WHERE id = ?",
            (evidence_pack_id,),
        ).fetchone()
        if not pack:
            raise AppError(
                "evidence_pack_not_found",
                "Evidence Pack was not found.",
                status_code=404,
            )
        for evidence_item_id in unique_item_ids:
            _load_item_for_pack(conn, evidence_pack_id, evidence_item_id)
        for evidence_item_id in unique_item_ids:
            annotation_id = new_id("canno")
            conn.execute(
                """
                INSERT INTO citation_annotations (
                  id, evidence_pack_id, evidence_item_id, annotation_type,
                  content, metadata_json, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    annotation_id,
                    evidence_pack_id,
                    evidence_item_id,
                    annotation_type,
                    trimmed_content,
                    json_dumps({"source": "citation_detail_batch"}),
                    timestamp,
                    timestamp,
                ),
            )
            created_rows.append(
                conn.execute(
                    "SELECT * FROM citation_annotations WHERE id = ?",
                    (annotation_id,),
                ).fetchone()
            )
    return {
        "evidence_pack_id": evidence_pack_id,
        "requested_item_ids": unique_item_ids,
        "created_count": len(created_rows),
        "annotations": [_annotation_record(row) for row in created_rows],
    }


def update_citation_annotation(
    annotation_id: str,
    annotation_type: Optional[str],
    content: Optional[str],
) -> Dict[str, Any]:
    updates: Dict[str, str] = {}
    if annotation_type is not None:
        updates["annotation_type"] = annotation_type
    if content is not None:
        trimmed_content = content.strip()
        if not trimmed_content:
            raise AppError("validation_error", "Annotation content is required.", status_code=422)
        updates["content"] = trimmed_content
    if not updates:
        raise AppError("validation_error", "Annotation change is required.", status_code=422)
    timestamp = now_iso()
    with db() as conn:
        current = conn.execute(
            "SELECT * FROM citation_annotations WHERE id = ?",
            (annotation_id,),
        ).fetchone()
        if not current:
            raise AppError(
                "citation_annotation_not_found",
                "Citation annotation was not found.",
                status_code=404,
            )
        conn.execute(
            """
            UPDATE citation_annotations
            SET annotation_type = ?, content = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                updates.get("annotation_type", current["annotation_type"]),
                updates.get("content", current["content"]),
                timestamp,
                annotation_id,
            ),
        )
        row = conn.execute(
            "SELECT * FROM citation_annotations WHERE id = ?",
            (annotation_id,),
        ).fetchone()
    return _annotation_record(row)


def delete_citation_annotation(annotation_id: str) -> Dict[str, Any]:
    with db() as conn:
        current = conn.execute(
            "SELECT * FROM citation_annotations WHERE id = ?",
            (annotation_id,),
        ).fetchone()
        if not current:
            raise AppError(
                "citation_annotation_not_found",
                "Citation annotation was not found.",
                status_code=404,
            )
        conn.execute("DELETE FROM citation_annotations WHERE id = ?", (annotation_id,))
    return {"id": annotation_id, "deleted": True}


def compare_evidence_items(evidence_pack_id: str, evidence_item_ids: List[str]) -> Dict[str, Any]:
    if len(evidence_item_ids) < 2 or len(evidence_item_ids) > 3:
        raise AppError(
            "validation_error",
            "Compare requires two or three evidence items.",
            status_code=422,
        )
    if len(set(evidence_item_ids)) != len(evidence_item_ids):
        raise AppError(
            "validation_error",
            "Compare evidence items must be unique.",
            status_code=422,
        )
    placeholders = ",".join("?" for _ in evidence_item_ids)
    with db() as conn:
        pack = conn.execute(
            "SELECT id FROM evidence_packs WHERE id = ?",
            (evidence_pack_id,),
        ).fetchone()
        if not pack:
            raise AppError(
                "evidence_pack_not_found",
                "Evidence Pack was not found.",
                status_code=404,
            )
        rows = conn.execute(
            f"""
            SELECT
              ei.*,
              ku.title AS knowledge_unit_title,
              ku.status AS knowledge_unit_status,
              ku.type AS knowledge_unit_type,
              c.citation_label AS chunk_citation_label,
              s.title AS source_title,
              s.source_origin,
              s.source_type
            FROM evidence_items ei
            LEFT JOIN knowledge_units ku ON ku.id = ei.knowledge_unit_id
            LEFT JOIN chunks c ON c.id = ei.chunk_id
            LEFT JOIN sources s ON s.id = ei.source_id
            WHERE ei.evidence_pack_id = ?
              AND ei.id IN ({placeholders})
            ORDER BY ei.rank_score DESC, ei.created_at ASC
            """,
            (evidence_pack_id, *evidence_item_ids),
        ).fetchall()
    found_ids = {row["id"] for row in rows}
    if found_ids != set(evidence_item_ids):
        raise AppError(
            "evidence_item_not_in_pack",
            "One or more evidence items are not part of this Evidence Pack.",
            status_code=404,
        )
    items = [
        {
            "id": row["id"],
            "citation_label": row["citation_label"],
            "rank_score": row["rank_score"],
            "knowledge_unit_id": row["knowledge_unit_id"],
            "knowledge_unit_title": row["knowledge_unit_title"],
            "knowledge_unit_status": row["knowledge_unit_status"],
            "knowledge_unit_type": row["knowledge_unit_type"],
            "chunk_id": row["chunk_id"],
            "chunk_citation_label": row["chunk_citation_label"],
            "source_id": row["source_id"],
            "source_title": row["source_title"],
            "source_origin": row["source_origin"],
            "source_type": row["source_type"],
            "trace_path": _citation_trace_path(dict(row)),
            "copy_payload": _copy_safe_citation_payload(dict(row)),
        }
        for row in rows
    ]
    source_titles = {item["source_title"] or item["source_id"] for item in items}
    chunk_labels = {item["chunk_citation_label"] or item["chunk_id"] for item in items}
    knowledge_titles = {
        item["knowledge_unit_title"] or item["knowledge_unit_id"] for item in items
    }
    rank_scores = [float(item["rank_score"]) for item in items]
    copy_safe_summary = " | ".join(
        [
            f"{item['citation_label']}:"
            f"source={item['source_title'] or item['source_id'] or 'unknown'};"
            f"chunk={item['chunk_citation_label'] or item['chunk_id'] or 'unknown'};"
            f"ku={item['knowledge_unit_title'] or item['knowledge_unit_id'] or 'unknown'}"
            for item in items
        ]
    )
    return {
        "evidence_pack_id": evidence_pack_id,
        "item_count": len(items),
        "items": items,
        "differences": {
            "source_count": len(source_titles),
            "chunk_count": len(chunk_labels),
            "knowledge_unit_count": len(knowledge_titles),
            "rank_score_min": min(rank_scores) if rank_scores else None,
            "rank_score_max": max(rank_scores) if rank_scores else None,
            "same_source": len(source_titles) == 1,
            "same_knowledge_unit": len(knowledge_titles) == 1,
        },
        "copy_safe_summary": copy_safe_summary,
    }


def build_retrieval_preview(
    query: str,
    project_id: str = "default-space",
    folder_id: Optional[str] = None,
    tag_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    tag_ids = tag_ids or []
    vector = sqlite_vec_status()
    retrieval_log_id = new_id("retrieval")
    evidence_pack_id = new_id("epack")
    timestamp = now_iso()
    ranked_rows = _rank_evidence_rows(
        query,
        _load_confirmed_rows(project_id, folder_id, tag_ids),
    )
    evidence_count = len(ranked_rows)
    query_explanation = _query_explanation(
        query=query,
        project_id=project_id,
        folder_id=folder_id,
        tag_ids=tag_ids,
        provider_status=vector["status"],
        fallback_reason=vector["fallback_reason"],
        evidence_count=evidence_count,
    )
    pack_status = "ready" if evidence_count else "empty"
    failure_type = None
    if not evidence_count:
        failure_type = "no_retrieval_result"
    elif vector["status"] != "available":
        failure_type = "vector_degraded"

    with db() as conn:
        conn.execute(
            """
            INSERT INTO retrieval_logs
              (id, query, query_intent, filters_json,
               capability_status, fallback_reason, created_at)
            VALUES (?, ?, 'simple_fact', ?, ?, ?, ?)
            """,
            (
                retrieval_log_id,
                query,
                json_dumps(query_explanation),
                vector["status"],
                vector["fallback_reason"],
                timestamp,
            ),
        )
        conn.execute(
            """
            INSERT INTO evidence_packs
              (id, retrieval_log_id, status, failure_type, summary, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                evidence_pack_id,
                retrieval_log_id,
                pack_status,
                failure_type,
                _pack_summary(evidence_count, vector["status"]),
                timestamp,
            ),
        )
        for index, row in enumerate(ranked_rows):
            conn.execute(
                """
                INSERT INTO evidence_items
                  (id, evidence_pack_id, knowledge_unit_id, chunk_id, source_id,
                   citation_label, excerpt, rank_score, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    new_id("eitem"),
                    evidence_pack_id,
                    row["knowledge_unit_id"],
                    row["chunk_id"],
                    row["source_id"],
                    row["citation_label"],
                    row["content"][:280],
                    max(float(row["rank_score"]) - index * 0.01, 0.01),
                    timestamp,
                ),
            )

    evidence_pack = _build_evidence_pack_response(evidence_pack_id)
    evidence_item_ids = [item["id"] for item in evidence_pack["items"]]
    citation_labels = [item["citation_label"] for item in evidence_pack["items"]]
    citation_summary = (
        "Evidence Pack uses " + ", ".join(citation_labels)
        if citation_labels
        else "No evidence items were attached."
    )

    return {
        "retrieval_log_id": retrieval_log_id,
        "evidence_pack_id": evidence_pack_id,
        "query": query,
        "query_explanation": query_explanation,
        "evidence_pack": evidence_pack,
        "evidence_item_ids": evidence_item_ids,
        "citation_labels": citation_labels,
        "citation_trace_summary": citation_summary,
        "provider_status": vector["status"],
        "fallback_reason": vector["fallback_reason"],
    }


def get_evidence_pack(
    evidence_pack_id: str,
    focus_item_id: Optional[str] = None,
) -> Dict[str, Any]:
    return _build_evidence_pack_response(evidence_pack_id, focus_item_id)


def build_evidence_only_answer(
    query: str,
    project_id: str = "default-space",
    folder_id: Optional[str] = None,
    tag_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    preview = build_retrieval_preview(query, project_id, folder_id, tag_ids)
    answer_id = new_id("answer")
    timestamp = now_iso()
    evidence_items = preview["evidence_pack"]["items"]
    if evidence_items:
        answer_text = "；".join(item["excerpt"] for item in evidence_items)
    else:
        answer_text = "未找到可引用的已确认知识。P0-Z0a 不会在无证据时生成伪答案。"

    with db() as conn:
        conn.execute(
            """
            INSERT INTO ai_answers
              (id, retrieval_log_id, evidence_pack_id, output_type, answer,
               evidence_item_ids_json, citation_labels_json, citation_trace_summary, created_at)
            VALUES (?, ?, ?, 'evidence_only_answer', ?, ?, ?, ?, ?)
            """,
            (
                answer_id,
                preview["retrieval_log_id"],
                preview["evidence_pack_id"],
                answer_text,
                json.dumps(preview["evidence_item_ids"]),
                json.dumps(preview["citation_labels"], ensure_ascii=False),
                preview["citation_trace_summary"],
                timestamp,
            ),
        )

    return {
        "retrieval_log_id": preview["retrieval_log_id"],
        "evidence_pack_id": preview["evidence_pack_id"],
        "answer_id": answer_id,
        "output_type": "evidence_only_answer",
        "answer": answer_text,
        "evidence_item_ids": preview["evidence_item_ids"],
        "citation_labels": preview["citation_labels"],
        "citation_trace_summary": preview["citation_trace_summary"],
        "provider_status": preview["provider_status"],
        "fallback_reason": preview["fallback_reason"],
    }
