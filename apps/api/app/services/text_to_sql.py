from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.core.errors import AppError
from app.db.sqlite import db, json_dumps

TEXT_TO_SQL_PROFILE = "p0_text_to_sql_template_v1"
PROVIDER_STATUS = "degraded"
FALLBACK_REASON = "text_to_sql_model_unavailable"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def preview_text_to_sql(
    *,
    query: str,
    project_id: str = "default-space",
    folder_id: Optional[str] = None,
    tag_ids: Optional[List[str]] = None,
    limit: int = 50,
) -> Dict[str, Any]:
    tag_ids = tag_ids or []
    bounded_limit = min(max(limit, 1), 50)
    template = _select_template(query)
    sql, parameters = _build_template_sql(
        template_id=template["template_id"],
        query=query,
        project_id=project_id,
        folder_id=folder_id,
        tag_ids=tag_ids,
        limit=bounded_limit,
    )

    with db() as conn:
        _validate_filters(conn, project_id, folder_id, tag_ids)
        rows = [dict(row) for row in conn.execute(sql, parameters).fetchall()]
        retrieval_log_id = new_id("retrieval")
        explanation = _query_explanation(
            query=query,
            template=template,
            project_id=project_id,
            folder_id=folder_id,
            tag_ids=tag_ids,
            limit=bounded_limit,
            row_count=len(rows),
        )
        conn.execute(
            """
            INSERT INTO retrieval_logs
              (id, query, query_intent, filters_json,
               capability_status, fallback_reason, created_at)
            VALUES (?, ?, 'structured_query_preview', ?, ?, ?, ?)
            """,
            (
                retrieval_log_id,
                query,
                json_dumps(explanation),
                PROVIDER_STATUS,
                FALLBACK_REASON,
                now_iso(),
            ),
        )

    return {
        "retrieval_log_id": retrieval_log_id,
        "template_id": template["template_id"],
        "intent": template["intent"],
        "generated_sql": _redact_sql(sql),
        "parameters": _public_parameters(parameters),
        "readonly": True,
        "safety_status": "readonly_template",
        "columns": list(rows[0].keys()) if rows else template["columns"],
        "rows": rows,
        "row_count": len(rows),
        "query_explanation": explanation,
        "provider_status": PROVIDER_STATUS,
        "fallback_reason": FALLBACK_REASON,
    }


def _select_template(query: str) -> Dict[str, Any]:
    lower = query.lower()
    if any(
        token in lower
        for token in ("source", "file", "inventory", "parse", "来源", "文件", "资料")
    ):
        return {
            "template_id": "source_inventory_v1",
            "intent": "source_inventory",
            "columns": [
                "source_id",
                "source_title",
                "source_origin",
                "source_type",
                "folder_path",
                "tag_names",
                "chunk_count",
                "created_at",
            ],
        }
    if any(
        token in lower
        for token in (
            "evidence",
            "answer",
            "retrieval",
            "citation",
            "history",
            "证据",
            "引用",
            "回答",
            "历史",
        )
    ):
        return {
            "template_id": "evidence_history_v1",
            "intent": "evidence_history",
            "columns": [
                "retrieval_log_id",
                "query",
                "evidence_pack_id",
                "pack_status",
                "failure_type",
                "answer_id",
                "output_type",
                "created_at",
            ],
        }
    return {
        "template_id": "confirmed_ku_lookup_v1",
        "intent": "confirmed_ku_lookup",
        "columns": [
            "knowledge_unit_id",
            "title",
            "type",
            "status",
            "source_title",
            "folder_path",
            "tag_names",
            "citation_label",
            "updated_at",
        ],
    }


def _build_template_sql(
    *,
    template_id: str,
    query: str,
    project_id: str,
    folder_id: Optional[str],
    tag_ids: List[str],
    limit: int,
) -> tuple[str, Dict[str, Any]]:
    parameters: Dict[str, Any] = {
        "project_id": project_id,
        "query_like": f"%{query}%",
        "limit": limit,
    }
    conditions, tag_joins = _organization_conditions("ku", folder_id, tag_ids, parameters)

    if template_id == "source_inventory_v1":
        source_conditions, source_tag_joins = _source_organization_conditions(
            folder_id,
            tag_ids,
            parameters,
        )
        sql = f"""
            SELECT
              s.id AS source_id,
              s.title AS source_title,
              s.source_origin,
              s.source_type,
              COALESCE(f.path, '') AS folder_path,
              COALESCE(GROUP_CONCAT(DISTINCT t.name), '') AS tag_names,
              COUNT(DISTINCT c.id) AS chunk_count,
              s.created_at
            FROM sources s
            LEFT JOIN folders f ON f.id = s.primary_folder_id
            LEFT JOIN source_tags st ON st.source_id = s.id
            LEFT JOIN tags t ON t.id = st.tag_id
            LEFT JOIN chunks c ON c.source_id = s.id
            WHERE {' AND '.join(source_conditions)}
            {source_tag_joins}
            GROUP BY s.id
            ORDER BY s.created_at DESC
            LIMIT :limit
        """
        return sql, parameters

    if template_id == "evidence_history_v1":
        evidence_scope = f"""
            AND (
              (
                ep.id IS NULL
                AND json_extract(rl.filters_json, '$.filters.project_id') = :project_id
              )
              OR EXISTS (
                SELECT 1
                FROM evidence_items ei_filter
                JOIN knowledge_units ku ON ku.id = ei_filter.knowledge_unit_id
                WHERE ei_filter.evidence_pack_id = ep.id
                  AND {' AND '.join(conditions)}
                  {tag_joins}
              )
            )
        """
        sql = f"""
            SELECT
              rl.id AS retrieval_log_id,
              rl.query,
              ep.id AS evidence_pack_id,
              ep.status AS pack_status,
              COALESCE(ep.failure_type, '') AS failure_type,
              COALESCE(aa.id, '') AS answer_id,
              COALESCE(aa.output_type, '') AS output_type,
              rl.created_at
            FROM retrieval_logs rl
            LEFT JOIN evidence_packs ep ON ep.retrieval_log_id = rl.id
            LEFT JOIN ai_answers aa ON aa.retrieval_log_id = rl.id
            WHERE (
              rl.query LIKE :query_like
              OR rl.query_intent IN ('simple_fact', 'structured_query_preview')
            )
            {evidence_scope}
            ORDER BY rl.created_at DESC
            LIMIT :limit
        """
        return sql, parameters

    sql = f"""
        SELECT
          ku.id AS knowledge_unit_id,
          ku.title,
          ku.type,
          ku.status,
          s.title AS source_title,
          COALESCE(f.path, '') AS folder_path,
          COALESCE(GROUP_CONCAT(DISTINCT t.name), '') AS tag_names,
          c.citation_label,
          ku.updated_at
        FROM knowledge_units ku
        JOIN sources s ON s.id = ku.source_id
        JOIN chunks c ON c.id = ku.chunk_id
        LEFT JOIN folders f ON f.id = ku.primary_folder_id
        LEFT JOIN knowledge_unit_tags kut ON kut.knowledge_unit_id = ku.id
        LEFT JOIN tags t ON t.id = kut.tag_id
        WHERE {' AND '.join(conditions)}
          AND (ku.title LIKE :query_like OR ku.content LIKE :query_like OR s.title LIKE :query_like)
        {tag_joins}
        GROUP BY ku.id
        ORDER BY ku.updated_at DESC
        LIMIT :limit
    """
    return sql, parameters


def _organization_conditions(
    alias: str,
    folder_id: Optional[str],
    tag_ids: List[str],
    parameters: Dict[str, Any],
) -> tuple[List[str], str]:
    conditions = [f"{alias}.project_id = :project_id", f"{alias}.status = 'confirmed'"]
    if folder_id:
        conditions.append(f"{alias}.primary_folder_id = :folder_id")
        parameters["folder_id"] = folder_id
    tag_checks = []
    for index, tag_id in enumerate(tag_ids):
        key = f"tag_id_{index}"
        parameters[key] = tag_id
        tag_checks.append(
            f"""
            AND EXISTS (
              SELECT 1 FROM knowledge_unit_tags kut_filter_{index}
              WHERE kut_filter_{index}.knowledge_unit_id = {alias}.id
                AND kut_filter_{index}.tag_id = :{key}
            )
            """
        )
    return conditions, "\n".join(tag_checks)


def _source_organization_conditions(
    folder_id: Optional[str],
    tag_ids: List[str],
    parameters: Dict[str, Any],
) -> tuple[List[str], str]:
    conditions = ["s.project_id = :project_id"]
    if folder_id:
        conditions.append("s.primary_folder_id = :folder_id")
        parameters["folder_id"] = folder_id
    tag_checks = []
    for index, tag_id in enumerate(tag_ids):
        key = f"tag_id_{index}"
        parameters[key] = tag_id
        tag_checks.append(
            f"""
            AND EXISTS (
              SELECT 1 FROM source_tags st_filter_{index}
              WHERE st_filter_{index}.source_id = s.id
                AND st_filter_{index}.tag_id = :{key}
            )
            """
        )
    return conditions, "\n".join(tag_checks)


def _validate_filters(
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


def _query_explanation(
    *,
    query: str,
    template: Dict[str, Any],
    project_id: str,
    folder_id: Optional[str],
    tag_ids: List[str],
    limit: int,
    row_count: int,
) -> Dict[str, Any]:
    return {
        "query": query,
        "text_to_sql_profile": TEXT_TO_SQL_PROFILE,
        "template_id": template["template_id"],
        "intent": template["intent"],
        "filters": {
            "project_id": project_id,
            "folder_id": folder_id,
            "tag_ids": tag_ids,
            "knowledge_unit_status": "confirmed"
            if template["template_id"] == "confirmed_ku_lookup_v1"
            else None,
            "limit": limit,
        },
        "row_count": row_count,
        "safety": {
            "readonly": True,
            "model_generated_sql": False,
            "forbidden_write_sql": True,
            "allowed_statement": "SELECT",
        },
        "provider_status": PROVIDER_STATUS,
        "fallback_reason": FALLBACK_REASON,
        "disabled_capabilities": ["text_to_sql_model", "freeform_sql_editor"],
    }


def _redact_sql(sql: str) -> str:
    return " ".join(sql.split())


def _public_parameters(parameters: Dict[str, Any]) -> Dict[str, Any]:
    return json.loads(json.dumps(parameters, ensure_ascii=False))
