from __future__ import annotations

from app.api.routes import knowledge, z0a
from app.db.sqlite import db, initialize_database
from fastapi import FastAPI
from fastapi.testclient import TestClient


def create_review_test_app() -> FastAPI:
    initialize_database()
    app = FastAPI()
    app.include_router(knowledge.router, prefix="/api")
    app.include_router(z0a.router, prefix="/api")
    return app


def test_p0_knowledge_review_confirm_and_ignore(monkeypatch, tmp_path):
    monkeypatch.setenv("KB_APP_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("KB_LOCAL_TOKEN", "test-token")
    headers = {"x-kb-local-token": "test-token"}
    json_headers = {"content-type": "application/json", **headers}

    with TestClient(create_review_test_app()) as client:
        first_import = client.post(
            "/api/text-imports",
            headers=json_headers,
            json={
                "title": "B line confirm candidate",
                "content": "B line confirm candidate should become trusted knowledge.",
            },
        )
        assert first_import.status_code == 200
        first_body = first_import.json()
        first_task_id = first_body["review_task_ids"][0]
        first_ku_id = first_body["candidate_knowledge_unit_ids"][0]

        second_import = client.post(
            "/api/text-imports",
            headers=json_headers,
            json={
                "title": "B line ignore candidate",
                "content": "B line ignore candidate should stay out of trusted knowledge.",
            },
        )
        assert second_import.status_code == 200
        second_body = second_import.json()
        second_task_id = second_body["review_task_ids"][0]
        second_ku_id = second_body["candidate_knowledge_unit_ids"][0]

        pending_tasks = client.get(
            "/api/review-tasks",
            headers=headers,
            params={"status": "pending_review"},
        )
        assert pending_tasks.status_code == 200
        pending_task_ids = {task["id"] for task in pending_tasks.json()}
        assert {first_task_id, second_task_id}.issubset(pending_task_ids)

        pending_units = client.get(
            "/api/knowledge-units",
            headers=headers,
            params={"status": "pending_review"},
        )
        assert pending_units.status_code == 200
        pending_ku_ids = {unit["id"] for unit in pending_units.json()}
        assert {first_ku_id, second_ku_id}.issubset(pending_ku_ids)

        confirmed = client.post(f"/api/review-tasks/{first_task_id}:confirm", headers=headers)
        assert confirmed.status_code == 200
        assert confirmed.json()["status"] == "confirmed"

        ignored = client.post(f"/api/review-tasks/{second_task_id}:ignore", headers=headers)
        assert ignored.status_code == 200
        assert ignored.json()["status"] == "ignored"

        confirmed_units = client.get(
            "/api/knowledge-units",
            headers=headers,
            params={"status": "confirmed"},
        )
        assert confirmed_units.status_code == 200
        confirmed_unit = next(
            unit for unit in confirmed_units.json() if unit["id"] == first_ku_id
        )
        assert confirmed_unit["user_verified"] is True

        ignored_units = client.get(
            "/api/knowledge-units",
            headers=headers,
            params={"status": "ignored"},
        )
        assert ignored_units.status_code == 200
        assert any(unit["id"] == second_ku_id for unit in ignored_units.json())

        with db() as conn:
            task_rows = conn.execute(
                """
                SELECT id, status FROM review_tasks
                WHERE id IN (?, ?)
                ORDER BY id
                """,
                (first_task_id, second_task_id),
            ).fetchall()
            ku_rows = conn.execute(
                """
                SELECT id, status, user_verified FROM knowledge_units
                WHERE id IN (?, ?)
                ORDER BY id
                """,
                (first_ku_id, second_ku_id),
            ).fetchall()

        task_statuses = {row["id"]: row["status"] for row in task_rows}
        ku_statuses = {row["id"]: row["status"] for row in ku_rows}
        ku_verified = {row["id"]: bool(row["user_verified"]) for row in ku_rows}

        assert task_statuses[first_task_id] == "confirmed"
        assert task_statuses[second_task_id] == "ignored"
        assert ku_statuses[first_ku_id] == "confirmed"
        assert ku_statuses[second_ku_id] == "ignored"
        assert ku_verified[first_ku_id] is True
        assert ku_verified[second_ku_id] is False
