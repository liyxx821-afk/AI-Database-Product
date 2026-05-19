from __future__ import annotations

import json

from app.db.sqlite import db
from app.main import create_app
from fastapi.testclient import TestClient


def test_text_import_creates_pending_review_knowledge_chain(monkeypatch, tmp_path):
    monkeypatch.setenv("KB_APP_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("KB_LOCAL_TOKEN", "test-token")
    headers = {"x-kb-local-token": "test-token"}
    title = "Text ingestion test"
    content = "Personal knowledge bases turn raw notes into reusable knowledge assets."

    with TestClient(create_app()) as client:
        imported = client.post(
            "/api/text-imports",
            headers=headers,
            json={"title": title, "content": content, "project_id": "default-space"},
        )
        assert imported.status_code == 200, imported.text
        body = imported.json()
        assert body["source_id"].startswith("source_")
        assert len(body["chunk_ids"]) == 1
        assert len(body["candidate_knowledge_unit_ids"]) == 1
        assert len(body["review_task_ids"]) == 1

        review_tasks = client.get(
            "/api/review-tasks",
            headers=headers,
            params={"status": "pending_review"},
        )
        assert review_tasks.status_code == 200, review_tasks.text
        matching_tasks = [
            task for task in review_tasks.json() if task["id"] in body["review_task_ids"]
        ]
        assert len(matching_tasks) == 1
        assert matching_tasks[0]["target_type"] == "knowledge_unit"
        assert matching_tasks[0]["target_id"] == body["candidate_knowledge_unit_ids"][0]
        assert matching_tasks[0]["status"] == "pending_review"

        with db() as conn:
            source = conn.execute(
                "SELECT * FROM sources WHERE id = ?",
                (body["source_id"],),
            ).fetchone()
            chunk = conn.execute(
                "SELECT * FROM chunks WHERE id = ?",
                (body["chunk_ids"][0],),
            ).fetchone()
            knowledge_unit = conn.execute(
                "SELECT * FROM knowledge_units WHERE id = ?",
                (body["candidate_knowledge_unit_ids"][0],),
            ).fetchone()
            review_task = conn.execute(
                "SELECT * FROM review_tasks WHERE id = ?",
                (body["review_task_ids"][0],),
            ).fetchone()
            job = conn.execute(
                "SELECT * FROM processing_jobs WHERE id = ?",
                (body["job_id"],),
            ).fetchone()

        assert source is not None
        assert source["title"] == title
        assert source["source_type"] == "text"
        assert source["source_origin"] == "text_import"

        assert chunk is not None
        assert chunk["source_id"] == body["source_id"]
        assert chunk["content"] == content
        assert chunk["chunk_index"] == 0

        assert knowledge_unit is not None
        assert knowledge_unit["source_id"] == body["source_id"]
        assert knowledge_unit["chunk_id"] == body["chunk_ids"][0]
        assert knowledge_unit["status"] == "pending_review"
        assert knowledge_unit["user_verified"] == 0
        ku_metadata = json.loads(knowledge_unit["metadata_json"])
        assert ku_metadata["extraction_method"] == "rule_based"
        assert ku_metadata["llm_used"] is False

        assert review_task is not None
        assert review_task["target_type"] == "knowledge_unit"
        assert review_task["target_id"] == body["candidate_knowledge_unit_ids"][0]
        assert review_task["status"] == "pending_review"
        review_payload = json.loads(review_task["payload_json"])
        assert review_payload["source_id"] == body["source_id"]
        assert review_payload["chunk_id"] == body["chunk_ids"][0]
        assert review_payload["suggestion_type"] == "knowledge_unit"
        assert review_payload["review_reason"] == "p0_rule_text_import_candidate"

        assert job is not None
        assert job["job_type"] == "text_import"
        assert job["status"] == "completed"
