from __future__ import annotations

import base64
import hashlib
import io
import json
import sqlite3
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import PurePath
from typing import Any, Iterable, Optional

from app.api.schemas import KnowledgeUnitExportRequest, ProjectExportRequest
from app.core.errors import AppError
from app.db.sqlite import db
from app.services.organization import folder_record, project_record, tag_record
from app.services.settings import (
    append_knowledge_export_history,
    delete_knowledge_export_history,
    get_knowledge_export_history,
)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def export_knowledge_units(payload: KnowledgeUnitExportRequest) -> dict[str, Any]:
    export_id = new_id("export")
    generated_at = now_iso()
    with db() as conn:
        project = _require_project(conn, payload.project_id)
        _validate_folder(conn, payload.project_id, payload.folder_id)
        tag_ids = _require_tags(conn, payload.project_id, payload.tag_ids)
        explicit_ids = _require_knowledge_units(
            conn,
            payload.project_id,
            payload.knowledge_unit_ids,
        )
        rows = _query_knowledge_units(
            conn,
            project_id=payload.project_id,
            folder_id=payload.folder_id,
            tag_ids=tag_ids,
            knowledge_unit_ids=explicit_ids,
            include_pending_review=payload.include_pending_review,
        )
        records = _knowledge_unit_records(conn, rows)
        folders = _folders_for_records(conn, records, project_id=payload.project_id)
        tags = _tags_for_records(conn, records, project_id=payload.project_id)
        chunks = _chunks_for_records(records) if payload.include_chunks else []
        sources = _sources_for_records(records) if payload.include_sources else []
        project_payload = project_record(project)

    filters = _knowledge_filters(payload, tag_ids, explicit_ids)
    if payload.format == "markdown":
        content = _markdown_export(records, include_chunks=payload.include_chunks)
        mime_type = "text/markdown; charset=utf-8"
        filename = _filename("knowledge-units", "md", generated_at)
    else:
        content = _json_export(
            export_id=export_id,
            generated_at=generated_at,
            filters=filters,
            project=project_payload,
            folders=folders,
            tags=tags,
            knowledge_units=records,
            chunks=chunks,
            sources=sources,
        )
        mime_type = "application/json"
        filename = _filename("knowledge-units", "json", generated_at)

    append_knowledge_export_history(
        _history_record(
            export_id=export_id,
            export_kind="knowledge_units",
            filename=filename,
            export_format=payload.format,
            record_count=len(records),
            generated_at=generated_at,
            filters=filters,
            summary=_knowledge_history_summary(
                payload=payload,
                records=records,
                folders=folders,
                tags=tags,
                chunks=chunks,
                sources=sources,
            ),
            content_sha256=_sha256_text(content),
            includes_source_text=bool(payload.include_chunks or payload.include_sources),
        )
    )
    return {
        "export_id": export_id,
        "filename": filename,
        "mime_type": mime_type,
        "format": payload.format,
        "record_count": len(records),
        "generated_at": generated_at,
        "filters": filters,
        "content": content,
        "content_base64": None,
        "redacted": True,
        "includes_source_text": bool(payload.include_chunks or payload.include_sources),
    }


def export_project(payload: ProjectExportRequest) -> dict[str, Any]:
    export_id = new_id("export")
    generated_at = now_iso()
    with db() as conn:
        project = _require_project(conn, payload.project_id)
        rows = _query_knowledge_units(
            conn,
            project_id=payload.project_id,
            folder_id=None,
            tag_ids=[],
            knowledge_unit_ids=[],
            include_pending_review=payload.include_pending_review,
        )
        records = _knowledge_unit_records(conn, rows)
        folders = [folder_record(row) for row in _project_folders(conn, payload.project_id)]
        tags = [tag_record(row) for row in _project_tags(conn, payload.project_id)]
        chunks = _project_chunks(conn, payload.project_id, records)
        sources = _project_sources(conn, payload.project_id, records)
        project_payload = project_record(project)

    filters = {
        "project_id": payload.project_id,
        "include_pending_review": payload.include_pending_review,
    }
    manifest = _manifest(
        export_id=export_id,
        generated_at=generated_at,
        kind="project",
        format="zip",
        filters=filters,
        record_count=len(records),
        redacted=True,
        includes_source_text=True,
    )
    archive = _project_zip(
        manifest=manifest,
        project=project_payload,
        folders=folders,
        tags=tags,
        knowledge_units=records,
        sources=sources,
        chunks=chunks,
    )
    filename = _filename(f"project-{payload.project_id}", "zip", generated_at)
    append_knowledge_export_history(
        _history_record(
            export_id=export_id,
            export_kind="project",
            filename=filename,
            export_format="zip",
            record_count=len(records),
            generated_at=generated_at,
            filters=filters,
            summary={
                "project_id": payload.project_id,
                "folder_count": len(folders),
                "tag_count": len(tags),
                "source_count": len(sources),
                "chunk_count": len(chunks),
                "knowledge_unit_count": len(records),
                "include_pending_review": payload.include_pending_review,
            },
            content_sha256=_sha256_bytes(archive),
            includes_source_text=True,
        )
    )
    return {
        "export_id": export_id,
        "filename": filename,
        "mime_type": "application/zip",
        "format": "zip",
        "record_count": len(records),
        "generated_at": generated_at,
        "filters": filters,
        "content": None,
        "content_base64": base64.b64encode(archive).decode("ascii"),
        "redacted": True,
        "includes_source_text": True,
    }


def list_knowledge_export_history() -> list[dict[str, Any]]:
    return get_knowledge_export_history()


def remove_knowledge_export_history(history_id: str) -> dict[str, Any]:
    if not delete_knowledge_export_history(history_id):
        raise AppError(
            "knowledge_export_history_not_found",
            "Knowledge export history record was not found.",
            status_code=404,
        )
    return {"deleted": True, "id": history_id}


def _query_knowledge_units(
    conn: sqlite3.Connection,
    *,
    project_id: str,
    folder_id: Optional[str],
    tag_ids: list[str],
    knowledge_unit_ids: list[str],
    include_pending_review: bool,
) -> list[sqlite3.Row]:
    conditions = ["ku.project_id = ?"]
    params: list[Any] = [project_id]
    if not include_pending_review:
        conditions.append("ku.status = 'confirmed'")
    if folder_id:
        conditions.append("ku.primary_folder_id = ?")
        params.append(folder_id)
    if knowledge_unit_ids:
        placeholders = ",".join("?" for _ in knowledge_unit_ids)
        conditions.append(f"ku.id IN ({placeholders})")
        params.extend(knowledge_unit_ids)
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
    where_sql = " AND ".join(conditions)
    return conn.execute(
        f"""
        SELECT
          ku.*,
          f.path AS folder_path,
          c.content AS chunk_content,
          c.chunk_index,
          c.citation_label AS chunk_citation_label,
          c.metadata_json AS chunk_metadata_json,
          c.created_at AS chunk_created_at,
          s.title AS source_title,
          s.source_type,
          s.source_origin,
          s.content_hash AS source_content_hash,
          s.metadata_json AS source_metadata_json,
          s.created_at AS source_created_at
        FROM knowledge_units ku
        LEFT JOIN folders f ON f.id = ku.primary_folder_id
        LEFT JOIN chunks c ON c.id = ku.chunk_id
        LEFT JOIN sources s ON s.id = ku.source_id
        WHERE {where_sql}
        ORDER BY ku.updated_at DESC, ku.created_at DESC, ku.id ASC
        """,
        tuple(params),
    ).fetchall()


def _knowledge_unit_records(
    conn: sqlite3.Connection,
    rows: list[sqlite3.Row],
) -> list[dict[str, Any]]:
    tag_map = _knowledge_unit_tag_map(conn, [row["id"] for row in rows])
    records: list[dict[str, Any]] = []
    for row in rows:
        tags = tag_map.get(row["id"], [])
        source = {
            "id": row["source_id"],
            "title": row["source_title"],
            "source_type": row["source_type"],
            "source_origin": row["source_origin"],
            "content_hash": row["source_content_hash"],
            "metadata": _sanitize(_loads(row["source_metadata_json"])),
            "created_at": row["source_created_at"],
        }
        chunk = {
            "id": row["chunk_id"],
            "source_id": row["source_id"],
            "project_id": row["project_id"],
            "content": row["chunk_content"] or "",
            "chunk_index": row["chunk_index"],
            "citation_label": row["chunk_citation_label"],
            "metadata": _sanitize(_loads(row["chunk_metadata_json"])),
            "created_at": row["chunk_created_at"],
        }
        records.append(
            {
                "id": row["id"],
                "source_id": row["source_id"],
                "chunk_id": row["chunk_id"],
                "project_id": row["project_id"],
                "folder": {
                    "id": row["primary_folder_id"],
                    "path": row["folder_path"],
                },
                "title": row["title"],
                "type": row["type"],
                "content": row["content"],
                "status": row["status"],
                "user_verified": bool(row["user_verified"]),
                "tags": tags,
                "metadata": _sanitize(_loads(row["metadata_json"])),
                "citation": {
                    "source_id": row["source_id"],
                    "source_title": row["source_title"],
                    "source_origin": row["source_origin"],
                    "chunk_id": row["chunk_id"],
                    "chunk_index": row["chunk_index"],
                    "citation_label": row["chunk_citation_label"],
                },
                "source": source,
                "chunk": chunk,
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }
        )
    return records


def _knowledge_unit_tag_map(
    conn: sqlite3.Connection,
    knowledge_unit_ids: list[str],
) -> dict[str, list[dict[str, Any]]]:
    if not knowledge_unit_ids:
        return {}
    placeholders = ",".join("?" for _ in knowledge_unit_ids)
    rows = conn.execute(
        f"""
        SELECT kut.knowledge_unit_id, t.*
        FROM knowledge_unit_tags kut
        JOIN tags t ON t.id = kut.tag_id
        WHERE kut.knowledge_unit_id IN ({placeholders})
        ORDER BY t.namespace ASC, t.name ASC
        """,
        tuple(knowledge_unit_ids),
    ).fetchall()
    tag_map: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        tag_map.setdefault(row["knowledge_unit_id"], []).append(tag_record(row))
    return tag_map


def _folders_for_records(
    conn: sqlite3.Connection,
    records: list[dict[str, Any]],
    *,
    project_id: str,
) -> list[dict[str, Any]]:
    folder_ids = sorted(
        {record["folder"]["id"] for record in records if record["folder"]["id"]}
    )
    if not folder_ids:
        return []
    placeholders = ",".join("?" for _ in folder_ids)
    rows = conn.execute(
        f"""
        SELECT * FROM folders
        WHERE project_id = ? AND id IN ({placeholders})
        ORDER BY path ASC
        """,
        tuple([project_id, *folder_ids]),
    ).fetchall()
    return [folder_record(row) for row in rows]


def _tags_for_records(
    conn: sqlite3.Connection,
    records: list[dict[str, Any]],
    *,
    project_id: str,
) -> list[dict[str, Any]]:
    tag_ids = sorted({tag["id"] for record in records for tag in record["tags"]})
    if not tag_ids:
        return []
    placeholders = ",".join("?" for _ in tag_ids)
    rows = conn.execute(
        f"""
        SELECT * FROM tags
        WHERE project_id = ? AND id IN ({placeholders})
        ORDER BY namespace ASC, name ASC
        """,
        tuple([project_id, *tag_ids]),
    ).fetchall()
    return [tag_record(row) for row in rows]


def _chunks_for_records(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    chunks: list[dict[str, Any]] = []
    for record in records:
        chunk = record["chunk"]
        if chunk["id"] and chunk["id"] not in seen:
            chunks.append(chunk)
            seen.add(chunk["id"])
    return chunks


def _sources_for_records(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    sources: list[dict[str, Any]] = []
    for record in records:
        source = record["source"]
        if source["id"] and source["id"] not in seen:
            sources.append(source)
            seen.add(source["id"])
    return sources


def _project_folders(conn: sqlite3.Connection, project_id: str) -> list[sqlite3.Row]:
    return conn.execute(
        """
        SELECT * FROM folders
        WHERE project_id = ?
        ORDER BY path ASC
        """,
        (project_id,),
    ).fetchall()


def _project_tags(conn: sqlite3.Connection, project_id: str) -> list[sqlite3.Row]:
    return conn.execute(
        """
        SELECT * FROM tags
        WHERE project_id = ?
        ORDER BY namespace ASC, name ASC
        """,
        (project_id,),
    ).fetchall()


def _project_chunks(
    conn: sqlite3.Connection,
    project_id: str,
    records: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    chunk_ids = sorted({record["chunk_id"] for record in records if record["chunk_id"]})
    if not chunk_ids:
        return []
    placeholders = ",".join("?" for _ in chunk_ids)
    rows = conn.execute(
        f"""
        SELECT * FROM chunks
        WHERE project_id = ? AND id IN ({placeholders})
        ORDER BY chunk_index ASC, id ASC
        """,
        tuple([project_id, *chunk_ids]),
    ).fetchall()
    return [
        {
            "id": row["id"],
            "source_id": row["source_id"],
            "project_id": row["project_id"],
            "content": row["content"],
            "chunk_index": row["chunk_index"],
            "citation_label": row["citation_label"],
            "metadata": _sanitize(_loads(row["metadata_json"])),
            "created_at": row["created_at"],
        }
        for row in rows
    ]


def _project_sources(
    conn: sqlite3.Connection,
    project_id: str,
    records: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    source_ids = sorted({record["source_id"] for record in records if record["source_id"]})
    if not source_ids:
        return []
    placeholders = ",".join("?" for _ in source_ids)
    rows = conn.execute(
        f"""
        SELECT * FROM sources
        WHERE project_id = ? AND id IN ({placeholders})
        ORDER BY created_at ASC, id ASC
        """,
        tuple([project_id, *source_ids]),
    ).fetchall()
    return [
        {
            "id": row["id"],
            "project_id": row["project_id"],
            "primary_folder_id": row["primary_folder_id"],
            "title": row["title"],
            "source_type": row["source_type"],
            "source_origin": row["source_origin"],
            "content_hash": row["content_hash"],
            "metadata": _sanitize(_loads(row["metadata_json"])),
            "created_at": row["created_at"],
        }
        for row in rows
    ]


def _json_export(
    *,
    export_id: str,
    generated_at: str,
    filters: dict[str, Any],
    project: dict[str, Any],
    folders: list[dict[str, Any]],
    tags: list[dict[str, Any]],
    knowledge_units: list[dict[str, Any]],
    chunks: list[dict[str, Any]],
    sources: list[dict[str, Any]],
) -> str:
    payload = {
        "manifest": _manifest(
            export_id=export_id,
            generated_at=generated_at,
            kind="knowledge_units",
            format="json",
            filters=filters,
            record_count=len(knowledge_units),
            redacted=True,
            includes_source_text=bool(chunks or sources),
        ),
        "project": _sanitize(project),
        "folders": _sanitize(folders),
        "tags": _sanitize(tags),
        "knowledge_units": _export_knowledge_units(knowledge_units),
        "chunks": chunks,
        "sources": sources,
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)


def _markdown_export(records: list[dict[str, Any]], *, include_chunks: bool) -> str:
    documents: list[str] = []
    for record in records:
        frontmatter = [
            "---",
            f"id: {_yaml(record['id'])}",
            f"title: {_yaml(record['title'])}",
            f"type: {_yaml(record['type'])}",
            f"status: {_yaml(record['status'])}",
            f"project_id: {_yaml(record['project_id'])}",
            f"folder_id: {_yaml(record['folder']['id'])}",
            f"folder: {_yaml(record['folder']['path'])}",
            "tags:",
        ]
        if record["tags"]:
            frontmatter.extend(f"  - {_yaml(tag['name'])}" for tag in record["tags"])
        else:
            frontmatter.append("  []")
        frontmatter.extend(
            [
                f"source_id: {_yaml(record['source_id'])}",
                f"source_title: {_yaml(record['citation']['source_title'])}",
                f"source_origin: {_yaml(record['citation']['source_origin'])}",
                f"chunk_id: {_yaml(record['chunk_id'])}",
                f"citation_label: {_yaml(record['citation']['citation_label'])}",
                f"created_at: {_yaml(record['created_at'])}",
                f"updated_at: {_yaml(record['updated_at'])}",
                "redacted: true",
                "---",
                "",
                f"# {record['title']}",
                "",
                record["content"],
                "",
                "## Citation",
                "",
                f"- Source: {record['citation']['source_title'] or record['source_id']}",
                f"- Origin: {record['citation']['source_origin'] or 'unknown'}",
                f"- Chunk: {record['citation']['citation_label'] or record['chunk_id']}",
            ]
        )
        if include_chunks:
            frontmatter.extend(["", "## Chunk Excerpt", "", record["chunk"]["content"]])
        documents.append("\n".join(frontmatter))
    return "\n\n".join(documents) + ("\n" if documents else "")


def _project_zip(
    *,
    manifest: dict[str, Any],
    project: dict[str, Any],
    folders: list[dict[str, Any]],
    tags: list[dict[str, Any]],
    knowledge_units: list[dict[str, Any]],
    sources: list[dict[str, Any]],
    chunks: list[dict[str, Any]],
) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", _json_bytes(manifest))
        archive.writestr(
            "knowledge-units.json",
            _json_bytes(_export_knowledge_units(knowledge_units)),
        )
        archive.writestr("tags.json", _json_bytes(_sanitize(tags)))
        archive.writestr("folders.json", _json_bytes(_sanitize(folders)))
        archive.writestr("sources.json", _json_bytes(_sanitize(sources)))
        archive.writestr("chunks.json", _json_bytes(_sanitize(chunks)))
        archive.writestr(
            "README.md",
            "# KnowledgeBaseDev Project Export\n\n"
            "This Z0b-lite package contains redacted local knowledge asset data. "
            "It is not a database backup or restore snapshot.\n",
        )
    return buffer.getvalue()


def _export_knowledge_units(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    exported: list[dict[str, Any]] = []
    for record in records:
        exported.append(
            {
                "id": record["id"],
                "source_id": record["source_id"],
                "chunk_id": record["chunk_id"],
                "project_id": record["project_id"],
                "folder": record["folder"],
                "title": record["title"],
                "type": record["type"],
                "content": record["content"],
                "status": record["status"],
                "user_verified": record["user_verified"],
                "tags": record["tags"],
                "metadata": record["metadata"],
                "citation": record["citation"],
                "created_at": record["created_at"],
                "updated_at": record["updated_at"],
            }
        )
    return _sanitize(exported)


def _manifest(
    *,
    export_id: str,
    generated_at: str,
    kind: str,
    format: str,
    filters: dict[str, Any],
    record_count: int,
    redacted: bool,
    includes_source_text: bool,
) -> dict[str, Any]:
    return {
        "export_id": export_id,
        "app": "KnowledgeBaseDev",
        "kind": kind,
        "format": format,
        "generated_at": generated_at,
        "filters": filters,
        "record_count": record_count,
        "redacted": redacted,
        "includes_source_text": includes_source_text,
        "package_boundary": "p0_z0b_lite_knowledge_asset_export",
    }


def _knowledge_filters(
    payload: KnowledgeUnitExportRequest,
    tag_ids: list[str],
    knowledge_unit_ids: list[str],
) -> dict[str, Any]:
    return {
        "project_id": payload.project_id,
        "folder_id": payload.folder_id,
        "tag_ids": tag_ids,
        "knowledge_unit_ids": knowledge_unit_ids,
        "include_chunks": payload.include_chunks,
        "include_sources": payload.include_sources,
        "include_pending_review": payload.include_pending_review,
    }


def _knowledge_history_summary(
    *,
    payload: KnowledgeUnitExportRequest,
    records: list[dict[str, Any]],
    folders: list[dict[str, Any]],
    tags: list[dict[str, Any]],
    chunks: list[dict[str, Any]],
    sources: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "project_id": payload.project_id,
        "folder_id": payload.folder_id,
        "tag_count": len(payload.tag_ids),
        "knowledge_unit_id_count": len(payload.knowledge_unit_ids),
        "folder_count": len(folders),
        "tag_record_count": len(tags),
        "source_count": len(sources),
        "chunk_count": len(chunks),
        "knowledge_unit_count": len(records),
        "include_chunks": payload.include_chunks,
        "include_sources": payload.include_sources,
        "include_pending_review": payload.include_pending_review,
    }


def _history_record(
    *,
    export_id: str,
    export_kind: str,
    filename: str,
    export_format: str,
    record_count: int,
    generated_at: str,
    filters: dict[str, Any],
    summary: dict[str, Any],
    content_sha256: str,
    includes_source_text: bool,
) -> dict[str, Any]:
    return {
        "id": new_id("knowledge_export_history"),
        "export_id": export_id,
        "export_kind": export_kind,
        "filename": filename,
        "format": export_format,
        "record_count": record_count,
        "generated_at": generated_at,
        "filters": filters,
        "summary": summary,
        "content_sha256": content_sha256,
        "redacted": True,
        "includes_source_text": includes_source_text,
    }


def _sha256_text(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def _sha256_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _filename(prefix: str, extension: str, generated_at: str) -> str:
    stamp = generated_at.replace(":", "").replace("-", "").split(".")[0]
    return f"{prefix}-{stamp}.{extension}"


def _json_bytes(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2)


def _yaml(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    return json.dumps(str(value), ensure_ascii=False)


def _loads(raw: Optional[str]) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}


def _sanitize(value: Any, key: str = "") -> Any:
    key_lower = key.lower()
    if isinstance(value, dict):
        sanitized: dict[str, Any] = {}
        for child_key, child_value in value.items():
            child_key_lower = str(child_key).lower()
            if _is_secret_key(child_key_lower):
                sanitized[str(child_key)] = "[redacted]"
            else:
                sanitized[str(child_key)] = _sanitize(child_value, str(child_key))
        return sanitized
    if isinstance(value, list):
        return [_sanitize(item, key) for item in value]
    if isinstance(value, str) and _is_path_key(key_lower):
        return PurePath(value).name if value else ""
    return value


def _is_secret_key(key: str) -> bool:
    return any(
        fragment in key
        for fragment in ("token", "secret", "credential", "database", "sqlite", "app_data")
    )


def _is_path_key(key: str) -> bool:
    return key == "path" or key.endswith("_path") or key in {
        "source_path",
        "storage_path",
        "output_text_path",
    }


def _require_project(conn: sqlite3.Connection, project_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not row:
        raise AppError("project_not_found", "Project was not found.", status_code=404)
    return row


def _validate_folder(
    conn: sqlite3.Connection,
    project_id: str,
    folder_id: Optional[str],
) -> None:
    if not folder_id:
        return
    row = conn.execute(
        "SELECT id FROM folders WHERE id = ? AND project_id = ?",
        (folder_id, project_id),
    ).fetchone()
    if not row:
        raise AppError("folder_not_found", "Folder was not found.", status_code=404)


def _require_tags(
    conn: sqlite3.Connection,
    project_id: str,
    tag_ids: Iterable[str],
) -> list[str]:
    unique_ids = list(dict.fromkeys(tag_ids))
    if not unique_ids:
        return []
    placeholders = ",".join("?" for _ in unique_ids)
    rows = conn.execute(
        f"""
        SELECT id
        FROM tags
        WHERE project_id = ? AND id IN ({placeholders})
        """,
        (project_id, *unique_ids),
    ).fetchall()
    found_ids = {row["id"] for row in rows}
    if any(tag_id not in found_ids for tag_id in unique_ids):
        raise AppError("tag_not_found", "Tag was not found.", status_code=404)
    return unique_ids


def _require_knowledge_units(
    conn: sqlite3.Connection,
    project_id: str,
    knowledge_unit_ids: Iterable[str],
) -> list[str]:
    unique_ids = list(dict.fromkeys(knowledge_unit_ids))
    if not unique_ids:
        return []
    placeholders = ",".join("?" for _ in unique_ids)
    rows = conn.execute(
        f"""
        SELECT id
        FROM knowledge_units
        WHERE project_id = ? AND id IN ({placeholders})
        """,
        (project_id, *unique_ids),
    ).fetchall()
    found_ids = {row["id"] for row in rows}
    if any(knowledge_unit_id not in found_ids for knowledge_unit_id in unique_ids):
        raise AppError(
            "knowledge_unit_not_found",
            "Knowledge Unit was not found.",
            status_code=404,
        )
    return unique_ids
