from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from app.core.errors import AppError
from app.db.sqlite import db, json_dumps
from app.services.organization import knowledge_unit_tags

RELATION_TYPES = {
    "supports",
    "contradicts",
    "derived_from",
    "example_of",
    "part_of",
    "depends_on",
    "similar_to",
    "used_for",
    "updates",
    "replaces",
}
RELATION_STATUSES = {"confirmed", "archived"}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def list_relations(
    project_id: str = "default-space",
    status: str = "confirmed",
    folder_id: Optional[str] = None,
    tag_ids: Optional[list[str]] = None,
) -> list[dict]:
    tag_ids = tag_ids or []
    if status not in RELATION_STATUSES:
        raise AppError(
            "invalid_relation_status",
            "Relation status is not supported.",
            status_code=422,
        )
    with db() as conn:
        nodes = _filtered_confirmed_knowledge_units(conn, project_id, folder_id, tag_ids)
        node_ids = [row["id"] for row in nodes]
        rows = _relation_rows(conn, project_id, node_ids, status=status)
    return [_relation_record(row) for row in rows]


def create_relation(
    *,
    project_id: str,
    source_knowledge_unit_id: str,
    target_knowledge_unit_id: str,
    relation_type: str,
    description: Optional[str] = None,
) -> dict:
    if relation_type not in RELATION_TYPES:
        raise AppError("invalid_relation_type", "Relation type is not supported.", status_code=422)
    if source_knowledge_unit_id == target_knowledge_unit_id:
        raise AppError(
            "invalid_relation_target",
            "Relation source and target must be different knowledge units.",
            status_code=422,
        )
    timestamp = now_iso()
    with db() as conn:
        source = _require_confirmed_knowledge_unit(conn, source_knowledge_unit_id)
        target = _require_confirmed_knowledge_unit(conn, target_knowledge_unit_id)
        _validate_relation_project(project_id, source, target)
        _ensure_no_duplicate_relation(
            conn,
            project_id,
            source_knowledge_unit_id,
            target_knowledge_unit_id,
            relation_type,
        )
        relation_id = new_id("rel")
        conn.execute(
            """
            INSERT INTO knowledge_relations (
              id, project_id, source_knowledge_unit_id, target_knowledge_unit_id,
              relation_type, status, description, created_by, metadata_json,
              created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, 'confirmed', ?, 'user', ?, ?, ?)
            """,
            (
                relation_id,
                project_id,
                source_knowledge_unit_id,
                target_knowledge_unit_id,
                relation_type,
                _clean_description(description),
                json_dumps(
                    {
                        "source": "manual",
                        "capability_status": "user_confirmed",
                        "graph_profile": "p0_manual_relation_graph_preview_v1",
                    }
                ),
                timestamp,
                timestamp,
            ),
        )
        _insert_audit(
            conn,
            "knowledge_relation_created",
            {"relation_id": relation_id, "relation_type": relation_type},
            timestamp,
        )
        row = _require_relation(conn, relation_id)
    return _relation_record(row)


def update_relation(
    relation_id: str,
    *,
    relation_type: Optional[str] = None,
    description: Optional[str] = None,
    status: Optional[str] = None,
) -> dict:
    if relation_type is not None and relation_type not in RELATION_TYPES:
        raise AppError("invalid_relation_type", "Relation type is not supported.", status_code=422)
    if status is not None and status not in RELATION_STATUSES:
        raise AppError(
            "invalid_relation_status",
            "Relation status is not supported.",
            status_code=422,
        )
    timestamp = now_iso()
    with db() as conn:
        current = _require_relation(conn, relation_id)
        next_relation_type = relation_type or current["relation_type"]
        next_status = status or current["status"]
        if next_status != "archived":
            _ensure_no_duplicate_relation(
                conn,
                current["project_id"],
                current["source_knowledge_unit_id"],
                current["target_knowledge_unit_id"],
                next_relation_type,
                exclude_relation_id=relation_id,
            )
        conn.execute(
            """
            UPDATE knowledge_relations
            SET relation_type = ?, description = ?, status = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                next_relation_type,
                _clean_description(description)
                if description is not None
                else current["description"],
                next_status,
                timestamp,
                relation_id,
            ),
        )
        _insert_audit(
            conn,
            "knowledge_relation_updated",
            {
                "relation_id": relation_id,
                "relation_type": next_relation_type,
                "status": next_status,
            },
            timestamp,
        )
        row = _require_relation(conn, relation_id)
    return _relation_record(row)


def archive_relation(relation_id: str) -> dict:
    timestamp = now_iso()
    with db() as conn:
        _require_relation(conn, relation_id)
        conn.execute(
            """
            UPDATE knowledge_relations
            SET status = 'archived', updated_at = ?
            WHERE id = ?
            """,
            (timestamp, relation_id),
        )
        _insert_audit(
            conn,
            "knowledge_relation_archived",
            {"relation_id": relation_id},
            timestamp,
        )
    return {"id": relation_id, "status": "archived", "updated_at": timestamp}


def graph_preview(
    project_id: str = "default-space",
    folder_id: Optional[str] = None,
    tag_ids: Optional[list[str]] = None,
) -> dict:
    tag_ids = tag_ids or []
    filters = {
        "project_id": project_id,
        "folder_id": folder_id,
        "tag_ids": tag_ids,
        "knowledge_unit_status": "confirmed",
        "relation_status": "confirmed",
    }
    with db() as conn:
        filtered_nodes = _filtered_confirmed_knowledge_units(conn, project_id, folder_id, tag_ids)
        filtered_node_ids = [row["id"] for row in filtered_nodes]
        relation_rows = _relation_rows(conn, project_id, filtered_node_ids, status="confirmed")
        connected_ids = {
            row["source_knowledge_unit_id"] for row in relation_rows
        } | {row["target_knowledge_unit_id"] for row in relation_rows}
        nodes = [
            _graph_node_record(conn, row)
            for row in filtered_nodes
            if row["id"] in connected_ids
        ]
    edges = [_graph_edge_record(row) for row in relation_rows]
    relation_type_counts: dict[str, int] = {}
    for edge in edges:
        relation_type = edge["relation_type"]
        relation_type_counts[relation_type] = relation_type_counts.get(relation_type, 0) + 1
    summary = {
        "project_id": project_id,
        "node_count": len(nodes),
        "edge_count": len(edges),
        "relation_type_counts": relation_type_counts,
        "filters": filters,
    }
    return {
        "project_id": project_id,
        "filters": filters,
        "summary": summary,
        "nodes": nodes,
        "edges": edges,
        "provider_status": "degraded",
        "fallback_reason": "graph_reasoning_provider_unavailable",
    }


def _filtered_confirmed_knowledge_units(
    conn: sqlite3.Connection,
    project_id: str,
    folder_id: Optional[str],
    tag_ids: list[str],
) -> list[sqlite3.Row]:
    _validate_filters(conn, project_id, folder_id, tag_ids)
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
    return conn.execute(
        f"""
        SELECT ku.*
        FROM knowledge_units ku
        WHERE {where_clause}
        ORDER BY ku.updated_at DESC, ku.created_at DESC
        """,
        params,
    ).fetchall()


def _relation_rows(
    conn: sqlite3.Connection,
    project_id: str,
    filtered_node_ids: list[str],
    *,
    status: str,
) -> list[sqlite3.Row]:
    if not filtered_node_ids:
        return []
    placeholders = ",".join("?" for _ in filtered_node_ids)
    return conn.execute(
        f"""
        SELECT
          kr.*,
          sku.title AS source_title,
          tku.title AS target_title
        FROM knowledge_relations kr
        JOIN knowledge_units sku ON sku.id = kr.source_knowledge_unit_id
        JOIN knowledge_units tku ON tku.id = kr.target_knowledge_unit_id
        WHERE kr.project_id = ?
          AND kr.status = ?
          AND kr.source_knowledge_unit_id IN ({placeholders})
          AND kr.target_knowledge_unit_id IN ({placeholders})
        ORDER BY kr.updated_at DESC, kr.created_at DESC
        """,
        [project_id, status, *filtered_node_ids, *filtered_node_ids],
    ).fetchall()


def _validate_filters(
    conn: sqlite3.Connection,
    project_id: str,
    folder_id: Optional[str],
    tag_ids: list[str],
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


def _require_confirmed_knowledge_unit(
    conn: sqlite3.Connection,
    knowledge_unit_id: str,
) -> sqlite3.Row:
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
    if row["status"] != "confirmed":
        raise AppError(
            "knowledge_unit_not_confirmed",
            "Only confirmed knowledge units can be used in P0 graph relations.",
            status_code=422,
        )
    return row


def _validate_relation_project(
    project_id: str,
    source: sqlite3.Row,
    target: sqlite3.Row,
) -> None:
    if source["project_id"] != project_id or target["project_id"] != project_id:
        raise AppError(
            "project_mismatch",
            "Relation source and target must belong to the requested project.",
            status_code=422,
        )
    if source["project_id"] != target["project_id"]:
        raise AppError(
            "project_mismatch",
            "Relation source and target must belong to the same project.",
            status_code=422,
        )


def _ensure_no_duplicate_relation(
    conn: sqlite3.Connection,
    project_id: str,
    source_knowledge_unit_id: str,
    target_knowledge_unit_id: str,
    relation_type: str,
    exclude_relation_id: Optional[str] = None,
) -> None:
    params: list[Any] = [
        project_id,
        source_knowledge_unit_id,
        target_knowledge_unit_id,
        relation_type,
    ]
    exclude_clause = ""
    if exclude_relation_id:
        exclude_clause = "AND id != ?"
        params.append(exclude_relation_id)
    existing = conn.execute(
        f"""
        SELECT 1 FROM knowledge_relations
        WHERE project_id = ?
          AND source_knowledge_unit_id = ?
          AND target_knowledge_unit_id = ?
          AND relation_type = ?
          AND status != 'archived'
          {exclude_clause}
        """,
        params,
    ).fetchone()
    if existing:
        raise AppError(
            "relation_duplicate",
            "An active relation with the same source, target, and type already exists.",
            status_code=409,
        )


def _require_relation(conn: sqlite3.Connection, relation_id: str) -> sqlite3.Row:
    row = conn.execute(
        """
        SELECT
          kr.*,
          sku.title AS source_title,
          tku.title AS target_title
        FROM knowledge_relations kr
        JOIN knowledge_units sku ON sku.id = kr.source_knowledge_unit_id
        JOIN knowledge_units tku ON tku.id = kr.target_knowledge_unit_id
        WHERE kr.id = ?
        """,
        (relation_id,),
    ).fetchone()
    if not row:
        raise AppError(
            "knowledge_relation_not_found",
            "Knowledge relation was not found.",
            status_code=404,
        )
    return row


def _relation_record(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "project_id": row["project_id"],
        "source_knowledge_unit_id": row["source_knowledge_unit_id"],
        "target_knowledge_unit_id": row["target_knowledge_unit_id"],
        "relation_type": row["relation_type"],
        "status": row["status"],
        "description": row["description"],
        "source_title": row["source_title"],
        "target_title": row["target_title"],
        "created_by": row["created_by"],
        "metadata": json.loads(row["metadata_json"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _graph_node_record(conn: sqlite3.Connection, row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "type": row["type"],
        "status": row["status"],
        "project_id": row["project_id"],
        "primary_folder_id": row["primary_folder_id"],
        "tags": knowledge_unit_tags(conn, row["id"]),
    }


def _graph_edge_record(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "source_knowledge_unit_id": row["source_knowledge_unit_id"],
        "target_knowledge_unit_id": row["target_knowledge_unit_id"],
        "relation_type": row["relation_type"],
        "status": row["status"],
        "description": row["description"],
        "source_title": row["source_title"],
        "target_title": row["target_title"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _clean_description(description: Optional[str]) -> Optional[str]:
    if description is None:
        return None
    cleaned = description.strip()
    return cleaned or None


def _insert_audit(
    conn: sqlite3.Connection,
    event_type: str,
    payload: dict[str, Any],
    timestamp: str,
) -> None:
    conn.execute(
        """
        INSERT INTO audit_logs (id, event_type, payload_json, created_at)
        VALUES (?, ?, ?, ?)
        """,
        (new_id("audit"), event_type, json_dumps(payload), timestamp),
    )
