from __future__ import annotations

from datetime import datetime, timezone

from app.api.routes import z0a
from app.db.sqlite import db, initialize_database, json_dumps
from fastapi import FastAPI
from fastapi.testclient import TestClient


def _create_c_line_app() -> FastAPI:
    app = FastAPI()
    app.include_router(z0a.router, prefix="/api")
    return app


def _insert_search_fixture(
    *,
    source_id: str,
    chunk_id: str,
    ku_id: str,
    title: str,
    content: str,
    status: str,
) -> None:
    timestamp = datetime.now(timezone.utc).isoformat()
    with db() as conn:
        conn.execute(
            """
            INSERT INTO sources (
              id, project_id, title, source_type, source_origin,
              content_hash, metadata_json, created_at
            )
            VALUES (?, 'default-space', ?, 'text', 'p0_search_source_fixture', ?, ?, ?)
            """,
            (
                source_id,
                title,
                f"hash-{source_id}",
                json_dumps({"fixture": "p0_search_source"}),
                timestamp,
            ),
        )
        conn.execute(
            """
            INSERT INTO chunks (
              id, source_id, project_id, content, chunk_index,
              citation_label, metadata_json, created_at
            )
            VALUES (?, ?, 'default-space', ?, 0, ?, ?, ?)
            """,
            (
                chunk_id,
                source_id,
                content,
                f"{title} chunk 1",
                json_dumps({"fixture": "p0_search_source"}),
                timestamp,
            ),
        )
        conn.execute(
            """
            INSERT INTO knowledge_units (
              id, source_id, chunk_id, project_id, title, type, content,
              status, user_verified, metadata_json, created_at, updated_at
            )
            VALUES (?, ?, ?, 'default-space', ?, 'claim', ?, ?, ?, ?, ?, ?)
            """,
            (
                ku_id,
                source_id,
                chunk_id,
                title,
                content,
                status,
                1 if status == "confirmed" else 0,
                json_dumps({"fixture": "p0_search_source"}),
                timestamp,
                timestamp,
            ),
        )


def test_p0_search_returns_only_confirmed_knowledge_with_source_and_chunk_text(
    monkeypatch,
    tmp_path,
):
    monkeypatch.setenv("KB_APP_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("KB_LOCAL_TOKEN", "test-token")
    headers = {"x-kb-local-token": "test-token"}
    json_headers = {"content-type": "application/json", **headers}
    needle = "p0sourcesearchneedle"
    confirmed_chunk = (
        f"{needle} confirmed full chunk text. This is the complete Chunk original text "
        "that must be available to AI as source evidence."
    )
    pending_chunk = f"{needle} pending_review chunk text must not be returned."
    ignored_chunk = f"{needle} ignored chunk text must not be returned."

    initialize_database()
    with TestClient(_create_c_line_app()) as client:
        _insert_search_fixture(
            source_id="source_confirmed_search",
            chunk_id="chunk_confirmed_search",
            ku_id="ku_confirmed_search",
            title="Confirmed Search Source",
            content=confirmed_chunk,
            status="confirmed",
        )
        _insert_search_fixture(
            source_id="source_pending_search",
            chunk_id="chunk_pending_search",
            ku_id="ku_pending_search",
            title="Pending Search Source",
            content=pending_chunk,
            status="pending_review",
        )
        _insert_search_fixture(
            source_id="source_ignored_search",
            chunk_id="chunk_ignored_search",
            ku_id="ku_ignored_search",
            title="Ignored Search Source",
            content=ignored_chunk,
            status="ignored",
        )

        preview = client.post(
            "/api/retrieval/preview",
            headers=json_headers,
            json={"query": needle},
        )

        assert preview.status_code == 200
        preview_body = preview.json()
        items = preview_body["evidence_pack"]["items"]
        assert [item["knowledge_unit_id"] for item in items] == ["ku_confirmed_search"]

        item = items[0]
        assert item["knowledge_unit_id"] == "ku_confirmed_search"
        assert item["knowledge_unit_title"] == "Confirmed Search Source"
        assert item["knowledge_unit_status"] == "confirmed"
        assert item["source_id"] == "source_confirmed_search"
        assert item["source_title"] == "Confirmed Search Source"
        assert item["chunk_id"] == "chunk_confirmed_search"
        assert item["chunk_content"] == confirmed_chunk
        assert item["citation_label"] == "Confirmed Search Source chunk 1"
        assert "pending_review chunk text" not in item["chunk_content"]
        assert "ignored chunk text" not in item["chunk_content"]

        detail = client.get(
            f"/api/evidence-packs/{preview_body['evidence_pack_id']}",
            headers=headers,
        )

        assert detail.status_code == 200
        detail_body = detail.json()
        detail_items = detail_body["items"]
        assert [detail_item["knowledge_unit_id"] for detail_item in detail_items] == [
            "ku_confirmed_search"
        ]
        detail_item = detail_items[0]
        assert detail_item["source_id"] == "source_confirmed_search"
        assert detail_item["source_title"] == "Confirmed Search Source"
        assert detail_item["chunk_id"] == "chunk_confirmed_search"
        assert detail_item["chunk_content"] == confirmed_chunk
        assert detail_item["citation_label"] == "Confirmed Search Source chunk 1"
        assert [
            node["type"] for node in detail_item["citation_trace"]["trace_path"]
        ] == [
            "evidence_pack",
            "evidence_item",
            "knowledge_unit",
            "chunk",
            "source",
        ]
