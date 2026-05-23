from __future__ import annotations

from app.main import create_app
from fastapi.testclient import TestClient


def _import_and_confirm(
    client: TestClient,
    headers: dict[str, str],
    title: str,
    content: str,
) -> dict:
    imported = client.post(
        "/api/text-imports",
        headers=headers,
        json={"title": title, "content": content, "project_id": "default-space"},
    )
    assert imported.status_code == 200, imported.text
    body = imported.json()
    confirmed = client.post(
        f"/api/review-tasks/{body['review_task_ids'][0]}:confirm",
        headers=headers,
    )
    assert confirmed.status_code == 200, confirmed.text
    return body


def test_rag_qa_demo_returns_answer_top_k_scores_and_citations(monkeypatch, tmp_path):
    monkeypatch.setenv("KB_APP_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("KB_LOCAL_TOKEN", "test-token")
    headers = {"x-kb-local-token": "test-token"}

    with TestClient(create_app()) as client:
        first = _import_and_confirm(
            client,
            headers,
            "RAG citation basics",
            "RAG citation source tracking links every answer to a source chunk.",
        )
        second = _import_and_confirm(
            client,
            headers,
            "RAG retrieval context",
            "RAG retrieval builds prompt context from confirmed source evidence.",
        )

        response = client.post(
            "/api/rag/ask",
            headers=headers,
            json={
                "query": "RAG citation source context",
                "project_id": "default-space",
                "top_k": 2,
            },
        )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["query"] == "RAG citation source context"
    assert body["top_k"] == 2
    assert body["status"] == "answered"
    assert body["output_type"] == "rag_qa_demo_rule_answer"
    assert body["answer_generation_profile"] == "p0_rag_qa_demo_rule_v1"
    assert body["llm_used"] is False
    assert len(body["top_k_snippets"]) == 2
    assert len(body["citations"]) == 2
    assert len(body["evidence_item_ids"]) == 2
    assert len(body["citation_labels"]) == 2
    assert body["prompt_context"]["question"] == "RAG citation source context"
    assert len(body["prompt_context"]["context_blocks"]) == 2
    assert body["answer"].startswith("基于已确认知识回答：")
    assert body["retrieval_log_id"].startswith("retrieval_")
    assert body["evidence_pack_id"].startswith("epack_")
    assert body["answer_id"].startswith("answer_")

    source_ids = {first["source_id"], second["source_id"]}
    snippet_source_ids = {snippet["source_id"] for snippet in body["top_k_snippets"]}
    assert snippet_source_ids == source_ids
    for index, snippet in enumerate(body["top_k_snippets"], start=1):
        assert snippet["rank"] == index
        assert snippet["rank_score"] > 0
        assert snippet["citation_label"]
        assert snippet["source_jump"]["source_api_path"] == f"/api/sources/{snippet['source_id']}"
        assert snippet["source_jump"]["evidence_focus_api_path"].startswith(
            f"/api/evidence-packs/{body['evidence_pack_id']}?focus_item_id="
        )

    for citation in body["citations"]:
        assert citation["source_id"] in source_ids
        assert citation["rank_score"] > 0
        assert citation["chunk_id"]
        assert citation["knowledge_unit_id"]


def test_rag_qa_demo_refuses_to_answer_without_evidence(monkeypatch, tmp_path):
    monkeypatch.setenv("KB_APP_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("KB_LOCAL_TOKEN", "test-token")
    headers = {"x-kb-local-token": "test-token"}

    with TestClient(create_app()) as client:
        _import_and_confirm(
            client,
            headers,
            "Unrelated source",
            "This confirmed note is about invoices and quarterly bookkeeping.",
        )
        response = client.post(
            "/api/rag/ask",
            headers=headers,
            json={
                "query": "volcanic mineral spectroscopy",
                "project_id": "default-space",
                "top_k": 3,
            },
        )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "no_evidence"
    assert body["top_k_snippets"] == []
    assert body["citations"] == []
    assert body["prompt_context"]["context_blocks"] == []
    assert body["no_evidence_reason"] == "no_retrieval_result"
    assert body["answer"] == "未找到可引用的已确认知识。系统不会在无证据时生成回答。"
