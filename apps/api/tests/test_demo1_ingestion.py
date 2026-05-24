from __future__ import annotations

import base64
import json

from app.db.sqlite import db
from app.main import create_app
from app.services import demo1_ingestion
from fastapi.testclient import TestClient


class _FakeModelResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return json.dumps(self.payload).encode("utf-8")


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


def _mock_semantic_preprocess(*, raw_text, rule_clean_text, source_id, file_name, input_type):
    return {
        "chunk_basis": "semantic_clean_text",
        "semantic_parsing": {
            "status": "semantic_parsed",
            "summary": "模型识别到一段待入库文本。",
            "titles": ["课堂笔记"],
            "paragraph_notes": ["短文本也进入完整预处理链路。"],
            "possible_toc": [],
            "citations": [],
            "noise_blocks": [],
        },
        "semantic_cleaning": {
            "content": rule_clean_text,
            "status": "semantic_cleaned",
            "before_char_count": len(rule_clean_text),
            "after_char_count": len(rule_clean_text),
            "note": "模型已完成语义清洗，未新增事实。",
            "cleaning_report": "文本较短，但仍保留为后续 chunk 和 Candidate KU 输入。",
            "noise_findings": [],
            "quality_score": 0.35 if len(rule_clean_text) <= 20 else 0.72,
            "fallback_reason": None,
        },
    }


def test_demo1_preview_generates_model_candidates(monkeypatch, tmp_path):
    monkeypatch.setenv("KB_APP_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("KB_LOCAL_TOKEN", "test-token")
    monkeypatch.setattr(
        demo1_ingestion, "semantic_preprocess_with_model", _mock_semantic_preprocess
    )
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
    assert body["chunk_basis"] == "semantic_clean_text"
    assert body["semantic_parsing"]["status"] == "semantic_parsed"
    assert body["semantic_cleaning"]["quality_score"] == 0.35
    assert body["source"]["chunk_count"] == 1
    assert body["source"]["candidate_ku_count"] == 1
    assert body["chunks"][0]["chunk_basis"] == "semantic_clean_text"
    assert body["candidate_knowledge_units"][0]["status"] == "pending"
    assert body["candidate_knowledge_units"][0]["confidence"] == 0.3
    assert body["candidate_knowledge_units"][0]["chunk_id"] == body["chunks"][0]["chunk_id"]


def test_demo1_preview_parses_uploaded_markdown_file(monkeypatch, tmp_path):
    monkeypatch.setenv("KB_APP_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("KB_LOCAL_TOKEN", "test-token")
    monkeypatch.setattr(
        demo1_ingestion, "semantic_preprocess_with_model", _mock_semantic_preprocess
    )
    monkeypatch.setattr(demo1_ingestion, "analyze_chunks_with_model", _mock_model_analysis)
    headers = {"x-kb-local-token": "test-token"}
    content = "# 艺术史笔记\n\n图像研究关注媒介、风格与观看制度。\u200b\n"

    with TestClient(create_app()) as client:
        response = client.post(
            "/api/demo1/ingestion:preview",
            headers=headers,
            json={
                "file_name": "art-note.md",
                "input_type": "file",
                "file_content_base64": base64.b64encode(content.encode("utf-8")).decode("ascii"),
                "content_type": "text/markdown",
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["received_file"]["input_type"] == "file"
    assert body["received_file"]["file_size_bytes"] == len(content.encode("utf-8"))
    assert body["metadata"]["parser_profile"] == "demo1_plain_text_file_parser_v1:md"
    assert "\u200b" not in body["cleaning"]["content"]
    assert "图像研究关注媒介" in body["parsed"]["content"]
    assert body["source"]["candidate_ku_count"] == body["source"]["chunk_count"]


def test_demo1_preview_rejects_unsupported_file(monkeypatch, tmp_path):
    monkeypatch.setenv("KB_APP_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("KB_LOCAL_TOKEN", "test-token")
    headers = {"x-kb-local-token": "test-token"}

    with TestClient(create_app()) as client:
        response = client.post(
            "/api/demo1/ingestion:preview",
            headers=headers,
            json={
                "file_name": "unsupported.pdf",
                "input_type": "file",
                "file_content_base64": base64.b64encode(b"%PDF-1.7").decode("ascii"),
                "content_type": "application/pdf",
            },
        )

    assert response.status_code == 415
    assert response.json()["error"]["code"] == "demo1_file_type_unsupported"


def test_demo1_semantic_cleaning_falls_back_but_keeps_chunks_and_candidates(monkeypatch, tmp_path):
    monkeypatch.setenv("KB_APP_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("KB_LOCAL_TOKEN", "test-token")
    monkeypatch.delenv("KB_AI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setattr(demo1_ingestion, "analyze_chunks_with_model", _mock_model_analysis)
    headers = {"x-kb-local-token": "test-token"}

    with TestClient(create_app()) as client:
        response = client.post(
            "/api/demo1/ingestion:preview",
            headers=headers,
            json={
                "file_name": "dirty.txt",
                "input_type": "text",
                "raw_text": "  我是一个大学生。\n\n\n锟斤拷  ",
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["chunk_basis"] == "rule_clean_text"
    assert body["semantic_parsing"]["status"] == "fallback"
    assert body["semantic_cleaning"]["fallback_reason"]
    assert body["rule_cleaning"]["content"] == "我是一个大学生。"
    assert body["chunks"][0]["content"] == "我是一个大学生。"
    assert body["source"]["candidate_ku_count"] == 1


def test_demo1_guards_over_compressed_semantic_cleaning(monkeypatch, tmp_path):
    monkeypatch.setenv("KB_APP_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("KB_LOCAL_TOKEN", "test-token")

    def compressed_semantic_preprocess(
        *, raw_text, rule_clean_text, source_id, file_name, input_type
    ):
        result = _mock_semantic_preprocess(
            raw_text=raw_text,
            rule_clean_text=rule_clean_text,
            source_id=source_id,
            file_name=file_name,
            input_type=input_type,
        )
        result["semantic_cleaning"]["content"] = "Short summary only."
        result["semantic_cleaning"]["after_char_count"] = len("Short summary only.")
        return result

    monkeypatch.setattr(
        demo1_ingestion, "semantic_preprocess_with_model", compressed_semantic_preprocess
    )
    monkeypatch.setattr(demo1_ingestion, "analyze_chunks_with_model", _mock_model_analysis)
    headers = {"x-kb-local-token": "test-token"}
    long_text = "\n".join(
        f"Segment {index}: Renaissance art history note about perspective, patronage, "
        "workshop practice, urban culture, and knowledge production."
        for index in range(18)
    )

    with TestClient(create_app()) as client:
        response = client.post(
            "/api/demo1/ingestion:preview",
            headers=headers,
            json={
                "file_name": "long-note.txt",
                "input_type": "text",
                "raw_text": long_text,
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["chunk_basis"] == "rule_clean_text"
    assert body["semantic_cleaning"]["fallback_reason"] == (
        "semantic_clean_text appears over-compressed"
    )
    assert body["source"]["chunk_count"] > 1
    assert body["source"]["candidate_ku_count"] == body["source"]["chunk_count"]
    assert {chunk["chunk_basis"] for chunk in body["chunks"]} == {"rule_clean_text"}


def test_demo1_clamps_short_text_semantic_quality_score():
    assert demo1_ingestion.normalize_quality_score(1.0, "我是一个大学生。") == 0.35


def test_demo1_uses_openai_responses_default_model(monkeypatch, tmp_path):
    monkeypatch.setenv("KB_APP_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("KB_LOCAL_TOKEN", "test-token")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.delenv("KB_AI_API_KEY", raising=False)
    monkeypatch.delenv("KB_AI_BASE_URL", raising=False)
    monkeypatch.delenv("KB_AI_MODEL", raising=False)
    headers = {"x-kb-local-token": "test-token"}
    captured = {}
    monkeypatch.setattr(
        demo1_ingestion, "semantic_preprocess_with_model", _mock_semantic_preprocess
    )

    def fake_urlopen(request, timeout):
        captured["url"] = request.full_url
        captured["body"] = json.loads(request.data.decode("utf-8"))
        chunk_id = captured["body"]["input"][1]["content"].split('"chunk_id": "')[1].split('"')[0]
        return _FakeModelResponse(
            {
                "output_text": json.dumps(
                    {
                        "candidate_knowledge_units": [
                            {
                                "chunk_id": chunk_id,
                                "title": "大学生身份候选材料",
                                "summary": "该 chunk 表达了一个简短身份陈述。",
                                "keywords": ["大学生"],
                                "tags": ["#demo1", "#入库预处理", "#candidate-ku", "#pending"],
                                "confidence": 0.35,
                                "quality_note": "信息密度较低，建议人工判断是否保留。",
                                "content_type": "very_short_text",
                            }
                        ]
                    },
                    ensure_ascii=False,
                )
            }
        )

    monkeypatch.setattr(demo1_ingestion.urllib.request, "urlopen", fake_urlopen)
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
    assert captured["url"] == "https://api.openai.com/v1/responses"
    assert captured["body"]["model"] == "gpt-5.4-mini"
    assert body["metadata"]["model_status"] == "available"
    assert body["metadata"]["model_name"] == "gpt-5.4-mini"
    assert body["source"]["candidate_ku_count"] == 1


def test_demo1_commit_persists_source_chunks_candidates_and_review(monkeypatch, tmp_path):
    monkeypatch.setenv("KB_APP_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("KB_LOCAL_TOKEN", "test-token")
    monkeypatch.setattr(
        demo1_ingestion, "semantic_preprocess_with_model", _mock_semantic_preprocess
    )
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
