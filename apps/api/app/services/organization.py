from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any, Iterable, Optional

from app.core.errors import AppError
from app.db.sqlite import db, json_dumps

FOLDER_TAG_SOURCE = "folder_mirror"
SOURCE_TAG_SOURCE = "source_assignment"
USER_TAG_SOURCE = "user"
TAG_NAMESPACES = {"folder", "topic", "status", "use", "discipline", "system", "custom"}
TAG_TYPES = {
    "folder_tag",
    "topic_tag",
    "discipline_tag",
    "status_tag",
    "use_tag",
    "system_tag",
    "custom_tag",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def project_record(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "user_id": row["user_id"] or "local-user",
        "parent_id": row["parent_id"],
        "name": row["name"],
        "description": row["description"],
        "kb_type": row["kb_type"] or "project_kb",
        "status": row["status"] or "active",
        "metadata": _loads(row["metadata_json"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def folder_record(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "project_id": row["project_id"],
        "parent_id": row["parent_id"],
        "name": row["name"],
        "path": row["path"],
        "mirror_tag_id": row["mirror_tag_id"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def tag_record(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "project_id": row["project_id"] or "default-space",
        "user_id": row["user_id"] or "local-user",
        "name": row["name"],
        "namespace": row["namespace"],
        "tag_type": row["tag_type"],
        "description": row["description"],
        "created_by": row["created_by"] or "system",
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def source_tags(conn: sqlite3.Connection, source_id: str) -> list[dict]:
    rows = conn.execute(
        """
        SELECT t.*
        FROM source_tags st
        JOIN tags t ON t.id = st.tag_id
        WHERE st.source_id = ?
        ORDER BY t.namespace ASC, t.name ASC
        """,
        (source_id,),
    ).fetchall()
    return [tag_record(row) for row in rows]


def knowledge_unit_tags(conn: sqlite3.Connection, knowledge_unit_id: str) -> list[dict]:
    rows = conn.execute(
        """
        SELECT t.*
        FROM knowledge_unit_tags kut
        JOIN tags t ON t.id = kut.tag_id
        WHERE kut.knowledge_unit_id = ?
        ORDER BY t.namespace ASC, t.name ASC
        """,
        (knowledge_unit_id,),
    ).fetchall()
    return [tag_record(row) for row in rows]


def list_projects() -> list[dict]:
    with db() as conn:
        rows = conn.execute(
            """
            SELECT * FROM projects
            ORDER BY updated_at DESC, created_at DESC
            """
        ).fetchall()
    return [project_record(row) for row in rows]


def create_project(
    *,
    name: str,
    description: Optional[str] = None,
    kb_type: str = "project_kb",
    parent_id: Optional[str] = None,
) -> dict:
    timestamp = now_iso()
    with db() as conn:
        if parent_id:
            _require_project(conn, parent_id)
        project_id = new_id("project")
        conn.execute(
            """
            INSERT INTO projects (
              id, user_id, parent_id, name, description, kb_type, status,
              metadata_json, created_at, updated_at
            )
            VALUES (?, 'local-user', ?, ?, ?, ?, 'active', '{}', ?, ?)
            """,
            (project_id, parent_id, name.strip(), description, kb_type, timestamp, timestamp),
        )
        row = _require_project(conn, project_id)
    return project_record(row)


def list_folders(project_id: str = "default-space", parent_id: Optional[str] = None) -> list[dict]:
    with db() as conn:
        _require_project(conn, project_id)
        if parent_id:
            _require_folder(conn, parent_id, project_id)
            rows = conn.execute(
                """
                SELECT * FROM folders
                WHERE project_id = ? AND parent_id = ?
                ORDER BY path ASC
                """,
                (project_id, parent_id),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT * FROM folders
                WHERE project_id = ?
                ORDER BY path ASC
                """,
                (project_id,),
            ).fetchall()
    return [folder_record(row) for row in rows]


def create_folder(
    *,
    project_id: str,
    name: str,
    parent_id: Optional[str] = None,
) -> dict:
    timestamp = now_iso()
    folder_name = name.strip().strip("/")
    if not folder_name:
        raise AppError("folder_name_required", "Folder name is required.", status_code=422)
    with db() as conn:
        _require_project(conn, project_id)
        parent_path = ""
        if parent_id:
            parent = _require_folder(conn, parent_id, project_id)
            parent_path = parent["path"]
        path = f"{parent_path}/{folder_name}" if parent_path else folder_name
        existing = conn.execute(
            "SELECT * FROM folders WHERE project_id = ? AND path = ?",
            (project_id, path),
        ).fetchone()
        if existing:
            mirror_tag_id = ensure_folder_mirror_tag(conn, project_id, path)
            conn.execute(
                """
                UPDATE folders
                SET mirror_tag_id = ?, updated_at = ?
                WHERE id = ?
                """,
                (mirror_tag_id, timestamp, existing["id"]),
            )
            return folder_record(_require_folder(conn, existing["id"], project_id))
        mirror_tag_id = ensure_folder_mirror_tag(conn, project_id, path)
        folder_id = new_id("folder")
        conn.execute(
            """
            INSERT INTO folders (
              id, project_id, parent_id, name, path, mirror_tag_id, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                folder_id,
                project_id,
                parent_id,
                folder_name,
                path,
                mirror_tag_id,
                timestamp,
                timestamp,
            ),
        )
        row = _require_folder(conn, folder_id, project_id)
    return folder_record(row)


def list_tags(project_id: str = "default-space", namespace: Optional[str] = None) -> list[dict]:
    with db() as conn:
        _require_project(conn, project_id)
        if namespace:
            rows = conn.execute(
                """
                SELECT * FROM tags
                WHERE project_id = ? AND namespace = ?
                ORDER BY namespace ASC, name ASC
                """,
                (project_id, namespace),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT * FROM tags
                WHERE project_id = ?
                ORDER BY namespace ASC, name ASC
                """,
                (project_id,),
            ).fetchall()
    return [tag_record(row) for row in rows]


def create_tag(
    *,
    project_id: str,
    name: str,
    namespace: str = "topic",
    tag_type: str = "topic_tag",
    description: Optional[str] = None,
    created_by: str = "user",
) -> dict:
    tag_name = name.strip()
    if namespace not in TAG_NAMESPACES:
        raise AppError("invalid_tag_namespace", "Tag namespace is not supported.", status_code=422)
    if tag_type not in TAG_TYPES:
        raise AppError("invalid_tag_type", "Tag type is not supported.", status_code=422)
    if not tag_name:
        raise AppError("tag_name_required", "Tag name is required.", status_code=422)
    timestamp = now_iso()
    with db() as conn:
        _require_project(conn, project_id)
        existing = conn.execute(
            """
            SELECT * FROM tags
            WHERE project_id = ? AND namespace = ? AND name = ?
            """,
            (project_id, namespace, tag_name),
        ).fetchone()
        if existing:
            return tag_record(existing)
        tag_id = new_id("tag")
        conn.execute(
            """
            INSERT INTO tags (
              id, project_id, user_id, name, namespace, tag_type, description,
              created_by, created_at, updated_at
            )
            VALUES (?, ?, 'local-user', ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                tag_id,
                project_id,
                tag_name,
                namespace,
                tag_type,
                description,
                created_by,
                timestamp,
                timestamp,
            ),
        )
        row = _require_tag(conn, tag_id, project_id)
    return tag_record(row)


def update_source_organization(
    source_id: str,
    folder_id: Optional[str],
    tag_ids: list[str],
) -> dict:
    timestamp = now_iso()
    with db() as conn:
        source = _require_source(conn, source_id)
        project_id = source["project_id"]
        mirror_tag_id = _validate_folder_for_project(conn, project_id, folder_id)
        valid_tag_ids = _require_tags(conn, project_id, tag_ids)
        conn.execute(
            """
            UPDATE sources
            SET primary_folder_id = ?
            WHERE id = ?
            """,
            (folder_id, source_id),
        )
        _replace_source_tags(conn, source_id, valid_tag_ids, mirror_tag_id, timestamp)
        ku_rows = conn.execute(
            "SELECT id FROM knowledge_units WHERE source_id = ?",
            (source_id,),
        ).fetchall()
        for row in ku_rows:
            conn.execute(
                """
                UPDATE knowledge_units
                SET primary_folder_id = ?, updated_at = ?
                WHERE id = ?
                """,
                (folder_id, timestamp, row["id"]),
            )
            _replace_ku_synced_tags(conn, row["id"], valid_tag_ids, mirror_tag_id, timestamp)
        conn.execute(
            """
            INSERT INTO audit_logs (id, event_type, payload_json, created_at)
            VALUES (?, 'source_organization_updated', ?, ?)
            """,
            (
                new_id("audit"),
                json_dumps(
                    {
                        "source_id": source_id,
                        "folder_id": folder_id,
                        "tag_ids": valid_tag_ids,
                        "synced_knowledge_unit_count": len(ku_rows),
                    }
                ),
                timestamp,
            ),
        )
        updated = _require_source(conn, source_id)
        return {
            "target_type": "source",
            "target_id": source_id,
            "project_id": project_id,
            "folder_id": updated["primary_folder_id"],
            "tags": source_tags(conn, source_id),
            "synced_knowledge_unit_ids": [row["id"] for row in ku_rows],
            "updated_at": timestamp,
        }


def update_sources_organization_batch(
    source_ids: list[str],
    folder_id: Optional[str],
    tag_ids: list[str],
) -> dict:
    unique_source_ids = list(dict.fromkeys(source_ids))
    if not unique_source_ids or len(unique_source_ids) > 50:
        raise AppError(
            "validation_error",
            "Batch source organization requires 1-50 source ids.",
            status_code=422,
        )
    timestamp = now_iso()
    with db() as conn:
        sources = [_require_source(conn, source_id) for source_id in unique_source_ids]
        project_id = sources[0]["project_id"]
        if any(source["project_id"] != project_id for source in sources):
            raise AppError(
                "project_mismatch",
                "Batch source organization requires targets in the same project.",
                status_code=422,
            )
        mirror_tag_id = _validate_folder_for_project(conn, project_id, folder_id)
        valid_tag_ids = _require_tags(conn, project_id, tag_ids)
        synced_knowledge_unit_ids: list[str] = []
        for source in sources:
            source_id = source["id"]
            conn.execute(
                """
                UPDATE sources
                SET primary_folder_id = ?
                WHERE id = ?
                """,
                (folder_id, source_id),
            )
            _replace_source_tags(conn, source_id, valid_tag_ids, mirror_tag_id, timestamp)
            ku_rows = conn.execute(
                "SELECT id FROM knowledge_units WHERE source_id = ?",
                (source_id,),
            ).fetchall()
            for row in ku_rows:
                conn.execute(
                    """
                    UPDATE knowledge_units
                    SET primary_folder_id = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (folder_id, timestamp, row["id"]),
                )
                _replace_ku_synced_tags(
                    conn,
                    row["id"],
                    valid_tag_ids,
                    mirror_tag_id,
                    timestamp,
                )
                synced_knowledge_unit_ids.append(row["id"])
        conn.execute(
            """
            INSERT INTO audit_logs (id, event_type, payload_json, created_at)
            VALUES (?, 'source_organization_batch_updated', ?, ?)
            """,
            (
                new_id("audit"),
                json_dumps(
                    {
                        "source_ids": unique_source_ids,
                        "folder_id": folder_id,
                        "tag_ids": valid_tag_ids,
                        "synced_knowledge_unit_count": len(synced_knowledge_unit_ids),
                    }
                ),
                timestamp,
            ),
        )
        return {
            "target_type": "source",
            "project_id": project_id,
            "requested_ids": unique_source_ids,
            "updated_ids": unique_source_ids,
            "updated_count": len(unique_source_ids),
            "folder_id": folder_id,
            "tags": _batch_tags(conn, project_id, valid_tag_ids, mirror_tag_id),
            "synced_knowledge_unit_ids": synced_knowledge_unit_ids,
            "updated_at": timestamp,
        }


def update_knowledge_unit_organization(
    knowledge_unit_id: str,
    folder_id: Optional[str],
    tag_ids: list[str],
) -> dict:
    timestamp = now_iso()
    with db() as conn:
        ku = _require_knowledge_unit(conn, knowledge_unit_id)
        project_id = ku["project_id"]
        mirror_tag_id = _validate_folder_for_project(conn, project_id, folder_id)
        valid_tag_ids = _require_tags(conn, project_id, tag_ids)
        conn.execute(
            """
            UPDATE knowledge_units
            SET primary_folder_id = ?, updated_at = ?
            WHERE id = ?
            """,
            (folder_id, timestamp, knowledge_unit_id),
        )
        conn.execute(
            """
            DELETE FROM knowledge_unit_tags
            WHERE knowledge_unit_id = ? AND tag_source IN (?, ?)
            """,
            (knowledge_unit_id, USER_TAG_SOURCE, FOLDER_TAG_SOURCE),
        )
        if mirror_tag_id:
            conn.execute(
                """
                INSERT OR IGNORE INTO knowledge_unit_tags (
                  knowledge_unit_id, tag_id, tag_source, created_at
                )
                VALUES (?, ?, ?, ?)
                """,
                (knowledge_unit_id, mirror_tag_id, FOLDER_TAG_SOURCE, timestamp),
            )
        for tag_id in valid_tag_ids:
            conn.execute(
                """
                INSERT OR IGNORE INTO knowledge_unit_tags (
                  knowledge_unit_id, tag_id, tag_source, created_at
                )
                VALUES (?, ?, ?, ?)
                """,
                (knowledge_unit_id, tag_id, USER_TAG_SOURCE, timestamp),
            )
        conn.execute(
            """
            INSERT INTO audit_logs (id, event_type, payload_json, created_at)
            VALUES (?, 'knowledge_unit_organization_updated', ?, ?)
            """,
            (
                new_id("audit"),
                json_dumps(
                    {
                        "knowledge_unit_id": knowledge_unit_id,
                        "folder_id": folder_id,
                        "tag_ids": valid_tag_ids,
                    }
                ),
                timestamp,
            ),
        )
        return {
            "target_type": "knowledge_unit",
            "target_id": knowledge_unit_id,
            "project_id": project_id,
            "folder_id": folder_id,
            "tags": knowledge_unit_tags(conn, knowledge_unit_id),
            "synced_knowledge_unit_ids": [],
            "updated_at": timestamp,
        }


def update_knowledge_units_organization_batch(
    knowledge_unit_ids: list[str],
    folder_id: Optional[str],
    tag_ids: list[str],
) -> dict:
    unique_knowledge_unit_ids = list(dict.fromkeys(knowledge_unit_ids))
    if not unique_knowledge_unit_ids or len(unique_knowledge_unit_ids) > 50:
        raise AppError(
            "validation_error",
            "Batch knowledge unit organization requires 1-50 knowledge unit ids.",
            status_code=422,
        )
    timestamp = now_iso()
    with db() as conn:
        knowledge_units = [
            _require_knowledge_unit(conn, knowledge_unit_id)
            for knowledge_unit_id in unique_knowledge_unit_ids
        ]
        project_id = knowledge_units[0]["project_id"]
        if any(knowledge_unit["project_id"] != project_id for knowledge_unit in knowledge_units):
            raise AppError(
                "project_mismatch",
                "Batch knowledge unit organization requires targets in the same project.",
                status_code=422,
            )
        mirror_tag_id = _validate_folder_for_project(conn, project_id, folder_id)
        valid_tag_ids = _require_tags(conn, project_id, tag_ids)
        for knowledge_unit in knowledge_units:
            knowledge_unit_id = knowledge_unit["id"]
            conn.execute(
                """
                UPDATE knowledge_units
                SET primary_folder_id = ?, updated_at = ?
                WHERE id = ?
                """,
                (folder_id, timestamp, knowledge_unit_id),
            )
            conn.execute(
                """
                DELETE FROM knowledge_unit_tags
                WHERE knowledge_unit_id = ? AND tag_source IN (?, ?)
                """,
                (knowledge_unit_id, USER_TAG_SOURCE, FOLDER_TAG_SOURCE),
            )
            if mirror_tag_id:
                conn.execute(
                    """
                    INSERT OR IGNORE INTO knowledge_unit_tags (
                      knowledge_unit_id, tag_id, tag_source, created_at
                    )
                    VALUES (?, ?, ?, ?)
                    """,
                    (knowledge_unit_id, mirror_tag_id, FOLDER_TAG_SOURCE, timestamp),
                )
            for tag_id in valid_tag_ids:
                conn.execute(
                    """
                    INSERT OR IGNORE INTO knowledge_unit_tags (
                      knowledge_unit_id, tag_id, tag_source, created_at
                    )
                    VALUES (?, ?, ?, ?)
                    """,
                    (knowledge_unit_id, tag_id, USER_TAG_SOURCE, timestamp),
                )
        conn.execute(
            """
            INSERT INTO audit_logs (id, event_type, payload_json, created_at)
            VALUES (?, 'knowledge_unit_organization_batch_updated', ?, ?)
            """,
            (
                new_id("audit"),
                json_dumps(
                    {
                        "knowledge_unit_ids": unique_knowledge_unit_ids,
                        "folder_id": folder_id,
                        "tag_ids": valid_tag_ids,
                    }
                ),
                timestamp,
            ),
        )
        return {
            "target_type": "knowledge_unit",
            "project_id": project_id,
            "requested_ids": unique_knowledge_unit_ids,
            "updated_ids": unique_knowledge_unit_ids,
            "updated_count": len(unique_knowledge_unit_ids),
            "folder_id": folder_id,
            "tags": _batch_tags(conn, project_id, valid_tag_ids, mirror_tag_id),
            "synced_knowledge_unit_ids": [],
            "updated_at": timestamp,
        }


def ensure_folder_mirror_tag(conn: sqlite3.Connection, project_id: str, path: str) -> str:
    timestamp = now_iso()
    existing = conn.execute(
        """
        SELECT * FROM tags
        WHERE project_id = ? AND namespace = 'folder' AND name = ?
        """,
        (project_id, path),
    ).fetchone()
    if existing:
        return existing["id"]
    tag_id = new_id("tag")
    conn.execute(
        """
        INSERT INTO tags (
          id, project_id, user_id, name, namespace, tag_type, description,
          created_by, created_at, updated_at
        )
        VALUES (?, ?, 'local-user', ?, 'folder', 'folder_tag', ?, 'system', ?, ?)
        """,
        (tag_id, project_id, path, f"Mirror tag for folder {path}", timestamp, timestamp),
    )
    return tag_id


def parse_tag_ids(tag_ids: Optional[str]) -> list[str]:
    if not tag_ids:
        return []
    return [tag_id.strip() for tag_id in tag_ids.split(",") if tag_id.strip()]


def _replace_source_tags(
    conn: sqlite3.Connection,
    source_id: str,
    tag_ids: list[str],
    mirror_tag_id: Optional[str],
    timestamp: str,
) -> None:
    conn.execute(
        "DELETE FROM source_tags WHERE source_id = ?",
        (source_id,),
    )
    if mirror_tag_id:
        conn.execute(
            """
            INSERT OR IGNORE INTO source_tags (source_id, tag_id, tag_source, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (source_id, mirror_tag_id, FOLDER_TAG_SOURCE, timestamp),
        )
    for tag_id in tag_ids:
        conn.execute(
            """
            INSERT OR IGNORE INTO source_tags (source_id, tag_id, tag_source, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (source_id, tag_id, SOURCE_TAG_SOURCE, timestamp),
        )


def _replace_ku_synced_tags(
    conn: sqlite3.Connection,
    knowledge_unit_id: str,
    tag_ids: list[str],
    mirror_tag_id: Optional[str],
    timestamp: str,
) -> None:
    conn.execute(
        """
        DELETE FROM knowledge_unit_tags
        WHERE knowledge_unit_id = ? AND tag_source IN (?, ?)
        """,
        (knowledge_unit_id, SOURCE_TAG_SOURCE, FOLDER_TAG_SOURCE),
    )
    if mirror_tag_id:
        conn.execute(
            """
            INSERT OR IGNORE INTO knowledge_unit_tags (
              knowledge_unit_id, tag_id, tag_source, created_at
            )
            VALUES (?, ?, ?, ?)
            """,
            (knowledge_unit_id, mirror_tag_id, FOLDER_TAG_SOURCE, timestamp),
        )
    for tag_id in tag_ids:
        conn.execute(
            """
            INSERT OR IGNORE INTO knowledge_unit_tags (
              knowledge_unit_id, tag_id, tag_source, created_at
            )
            VALUES (?, ?, ?, ?)
            """,
            (knowledge_unit_id, tag_id, SOURCE_TAG_SOURCE, timestamp),
        )


def _require_project(conn: sqlite3.Connection, project_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not row:
        raise AppError("project_not_found", "Project was not found.", status_code=404)
    return row


def _require_folder(
    conn: sqlite3.Connection,
    folder_id: str,
    project_id: Optional[str] = None,
) -> sqlite3.Row:
    if project_id:
        row = conn.execute(
            "SELECT * FROM folders WHERE id = ? AND project_id = ?",
            (folder_id, project_id),
        ).fetchone()
    else:
        row = conn.execute("SELECT * FROM folders WHERE id = ?", (folder_id,)).fetchone()
    if not row:
        raise AppError("folder_not_found", "Folder was not found.", status_code=404)
    return row


def _require_tag(
    conn: sqlite3.Connection,
    tag_id: str,
    project_id: Optional[str] = None,
) -> sqlite3.Row:
    if project_id:
        row = conn.execute(
            "SELECT * FROM tags WHERE id = ? AND project_id = ?",
            (tag_id, project_id),
        ).fetchone()
    else:
        row = conn.execute("SELECT * FROM tags WHERE id = ?", (tag_id,)).fetchone()
    if not row:
        raise AppError("tag_not_found", "Tag was not found.", status_code=404)
    return row


def _require_tags(conn: sqlite3.Connection, project_id: str, tag_ids: Iterable[str]) -> list[str]:
    unique_ids = list(dict.fromkeys(tag_ids))
    for tag_id in unique_ids:
        _require_tag(conn, tag_id, project_id)
    return unique_ids


def _batch_tags(
    conn: sqlite3.Connection,
    project_id: str,
    tag_ids: list[str],
    mirror_tag_id: Optional[str],
) -> list[dict]:
    combined_ids = list(dict.fromkeys(([mirror_tag_id] if mirror_tag_id else []) + tag_ids))
    if not combined_ids:
        return []
    placeholders = ",".join("?" for _ in combined_ids)
    rows = conn.execute(
        f"""
        SELECT *
        FROM tags
        WHERE project_id = ? AND id IN ({placeholders})
        ORDER BY namespace ASC, name ASC
        """,
        (project_id, *combined_ids),
    ).fetchall()
    return [tag_record(row) for row in rows]


def _require_source(conn: sqlite3.Connection, source_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM sources WHERE id = ?", (source_id,)).fetchone()
    if not row:
        raise AppError("source_not_found", "Source was not found.", status_code=404)
    return row


def _require_knowledge_unit(conn: sqlite3.Connection, knowledge_unit_id: str) -> sqlite3.Row:
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
    return row


def _validate_folder_for_project(
    conn: sqlite3.Connection,
    project_id: str,
    folder_id: Optional[str],
) -> Optional[str]:
    if not folder_id:
        return None
    folder = _require_folder(conn, folder_id, project_id)
    mirror_tag_id = folder["mirror_tag_id"] or ensure_folder_mirror_tag(
        conn,
        project_id,
        folder["path"],
    )
    if mirror_tag_id != folder["mirror_tag_id"]:
        conn.execute(
            "UPDATE folders SET mirror_tag_id = ?, updated_at = ? WHERE id = ?",
            (mirror_tag_id, now_iso(), folder_id),
        )
    return mirror_tag_id


def _loads(raw: Optional[str]) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}
