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
        "filters": {"project_id": project_id, "knowledge_unit_status": "confirmed"},
        "ranking_summary": {
            "method": "token_overlap",
            "candidate_scope": "confirmed_knowledge_units",
            "evidence_count": evidence_count,
        },
        "provider_status": provider_status,
        "fallback_reason": fallback_reason,
        "disabled_capabilities": ["provider_backed_rag", "reranker", "text_to_sql_model"],
    }


def _load_confirmed_rows(project_id: str) -> List[Dict[str, Any]]:
    with db() as conn:
        rows = conn.execute(
            """
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
            WHERE ku.project_id = ?
              AND ku.status = 'confirmed'
            ORDER BY ku.updated_at DESC
            LIMIT 50
            """,
            (project_id,),
        ).fetchall()
    return [dict(row) for row in rows]


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
    if focus_item_id and not any(item["id"] == focus_item_id for item in items):
        raise AppError(
            "evidence_item_not_in_pack",
            "Evidence item is not part of this Evidence Pack.",
            status_code=404,
        )
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


def build_retrieval_preview(query: str, project_id: str = "default-space") -> Dict[str, Any]:
    vector = sqlite_vec_status()
    retrieval_log_id = new_id("retrieval")
    evidence_pack_id = new_id("epack")
    timestamp = now_iso()
    ranked_rows = _rank_evidence_rows(query, _load_confirmed_rows(project_id))
    evidence_count = len(ranked_rows)
    query_explanation = _query_explanation(
        query=query,
        project_id=project_id,
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


def build_evidence_only_answer(query: str, project_id: str = "default-space") -> Dict[str, Any]:
    preview = build_retrieval_preview(query, project_id)
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
