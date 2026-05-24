from __future__ import annotations

from app.db.sqlite import db
from app.main import create_app
from app.services import demo1_ingestion
from fastapi.testclient import TestClient


def _mock_model_analysis(*, chunks, source_id, project_id):
    candidates = []
    for index, chunk in enumerate(chunks, start=1):
        content_type = "very_short_text" if chunk["char_count"] <= 12 else "paragraph_note"
        candidates.append(
            {
                "ku_id": f"{source_id}_candidate_ku_{index:03d}",
                "source_id": source_id,
                "chunk_id": chunk["chunk_id"],
                "title": f"候选材料 {index}",
                "summary": "模型基于 chunk 生成的候选摘要。",
                "keywords": ["艺术史", "图像", "方法"] if content_type != "very_short_text" else [],
                "tags": ["#demo1", "#入库预处理", "#candidate-ku", "#pending"],
                "status": "pending",
                "confidence": 0.3 if content_type == "very_short_text" else 0.7,
                "quality_note": "信息密度较低，建议人工判断是否保留。"
                if content_type == "very_short_text"
                else "内容较完整，可进入后续结构化流程。",
                "content_type": content_type,
            }
        )
    return {
        "model_status": "available",
        "model_name": "test-model",
        "candidate_knowledge_units": candidates,
    }


def test_demo1_preview_generates_model_candidates(monkeypatch, tmp_path):
    monkeypatch.setenv("KB_APP_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("KB_LOCAL_TOKEN", "test-token")
    monkeypatch.setattr(demo1_ingestion, "analyze_chunks_with_model", _mock_model_analysis)
    headers = {"x-kb-local-token": "test-token"}

    with TestClient(create_app()) as client:
        response = client.post(
            "/api/demo1/ingestion:preview",
            headers=headers,
            json={
                "file_name": "demo-short.txt",
                "input_type": "text",
                "raw_text": "我是一个大学生。",
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["metadata"]["model_status"] == "available"
    assert body["metadata"]["commit_status"] == "preview_only"
    assert body["source"]["chunk_count"] == 1
    assert body["source"]["candidate_ku_count"] == 1
    assert body["candidate_knowledge_units"][0]["status"] == "pending"
    assert body["candidate_knowledge_units"][0]["confidence"] == 0.3
    assert body["candidate_knowledge_units"][0]["chunk_id"] == body["chunks"][0]["chunk_id"]


def test_demo1_commit_persists_source_chunks_candidates_and_review(monkeypatch, tmp_path):
    monkeypatch.setenv("KB_APP_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("KB_LOCAL_TOKEN", "test-token")
    monkeypatch.setattr(demo1_ingestion, "analyze_chunks_with_model", _mock_model_analysis)
    headers = {"x-kb-local-token": "test-token"}
    long_text = "艺术史研究关注图像、媒介、风格和社会语境之间的关系。" * 20

    with TestClient(create_app()) as client:
        preview = client.post(
            "/api/demo1/ingestion:preview",
            headers=headers,
            json={
                "file_name": "demo-long.txt",
                "input_type": "text",
                "raw_text": long_text,
            },
        )
        assert preview.status_code == 200
        commit = client.post(
            "/api/demo1/ingestion:commit",
            headers=headers,
            json={"preview_result": preview.json()},
        )

    assert commit.status_code == 200
    body = commit.json()
    assert body["persisted"] is True
    assert body["metadata"]["commit_status"] == "committed"
    assert len(body["chunks"]) > 1
    assert len(body["candidate_knowledge_units"]) == len(body["chunks"])

    with db() as conn:
        source = conn.execute(
            "SELECT * FROM sources WHERE id = ?",
            (body["source"]["source_id"],),
        ).fetchone()
        chunks = conn.execute(
            "SELECT * FROM chunks WHERE source_id = ?", (body["source"]["source_id"],)
        ).fetchall()
        units = conn.execute(
            "SELECT * FROM knowledge_units WHERE source_id = ?", (body["source"]["source_id"],)
        ).fetchall()
        reviews = conn.execute(
            """
            SELECT rt.* FROM review_tasks rt
            JOIN knowledge_units ku ON ku.id = rt.target_id
            WHERE ku.source_id = ?
            """,
            (body["source"]["source_id"],),
        ).fetchall()

    assert source is not None
    assert len(chunks) == len(body["chunks"])
    assert len(units) == len(body["candidate_knowledge_units"])
    assert len(reviews) == len(body["candidate_knowledge_units"])
