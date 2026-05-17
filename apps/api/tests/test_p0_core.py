from __future__ import annotations

import csv
import hashlib
import io
import json

from app.db.sqlite import db
from app.main import create_app
from fastapi.testclient import TestClient


def test_health_and_auth_status(monkeypatch, tmp_path):
    monkeypatch.setenv("KB_APP_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("KB_LOCAL_TOKEN", "test-token")
    with TestClient(create_app()) as client:
        health = client.get("/api/health")
        assert health.status_code == 200
        assert health.json()["ok"] is True

        unauthorized = client.get("/api/auth/status")
        assert unauthorized.status_code == 401
        assert unauthorized.json()["error"]["code"] == "sidecar_auth_failed"

        auth = client.get("/api/auth/status", headers={"x-kb-local-token": "test-token"})
        assert auth.status_code == 200
        assert auth.json()["auth_enabled"] is False


def test_settings_language_persistence_and_validation(monkeypatch, tmp_path):
    monkeypatch.setenv("KB_APP_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("KB_LOCAL_TOKEN", "test-token")
    headers = {"x-kb-local-token": "test-token"}
    with TestClient(create_app()) as client:
        unauthorized = client.get("/api/settings")
        assert unauthorized.status_code == 401
        assert unauthorized.json()["error"]["code"] == "sidecar_auth_failed"

        defaults = client.get("/api/settings", headers=headers)
        assert defaults.status_code == 200
        assert defaults.json()["language"] == "zh-CN"
        assert defaults.json()["persistence"] == "config_json"

        english = client.patch("/api/settings", headers=headers, json={"language": "en-US"})
        assert english.status_code == 200
        assert english.json()["language"] == "en-US"

        persisted = client.get("/api/settings", headers=headers)
        assert persisted.status_code == 200
        assert persisted.json()["language"] == "en-US"

        chinese = client.patch("/api/settings", headers=headers, json={"language": "zh-CN"})
        assert chinese.status_code == 200
        assert chinese.json()["language"] == "zh-CN"

        invalid = client.patch("/api/settings", headers=headers, json={"language": "fr-FR"})
        assert invalid.status_code == 422
        assert invalid.json()["error"]["code"] == "validation_error"

        unknown = client.patch(
            "/api/settings",
            headers=headers,
            json={"language": "zh-CN", "theme": "dark"},
        )
        assert unknown.status_code == 422
        assert unknown.json()["error"]["code"] == "validation_error"


def test_z0a_text_import_review_and_evidence(monkeypatch, tmp_path):
    monkeypatch.setenv("KB_APP_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("KB_LOCAL_TOKEN", "test-token")
    headers = {"x-kb-local-token": "test-token"}
    with TestClient(create_app()) as client:
        imported = client.post(
            "/api/text-imports",
            headers=headers,
            json={
                "title": "Evidence test",
                "content": (
                    "Evidence Pack 引用 Source 和 Chunk。"
                    "Knowledge Unit 需要 Review 后才能调用。"
                ),
            },
        )
        assert imported.status_code == 200
        body = imported.json()
        assert body["review_task_ids"]

        pending_preview = client.post(
            "/api/retrieval/preview",
            headers=headers,
            json={"query": "Evidence Pack Source Chunk"},
        )
        assert pending_preview.status_code == 200
        pending_preview_body = pending_preview.json()
        assert pending_preview_body["evidence_pack"]["status"] == "empty"
        assert pending_preview_body["evidence_pack"]["failure_type"] == "no_retrieval_result"
        assert pending_preview_body["evidence_item_ids"] == []

        confirmed = client.post(
            f"/api/review-tasks/{body['review_task_ids'][0]}:confirm",
            headers=headers,
        )
        assert confirmed.status_code == 200

        preview = client.post(
            "/api/retrieval/preview",
            headers=headers,
            json={"query": "Evidence Pack Source Chunk"},
        )
        assert preview.status_code == 200
        preview_body = preview.json()
        assert preview_body["evidence_pack"]["status"] == "ready"
        assert preview_body["evidence_pack"]["items"]
        assert preview_body["query_explanation"]["retrieval_strategy_profile"] == (
            "p0_confirmed_ku_token_overlap_v1"
        )
        assert preview_body["provider_status"] == "degraded"
        assert preview_body["fallback_reason"]

        pack = client.get(
            f"/api/evidence-packs/{preview_body['evidence_pack_id']}",
            headers=headers,
        )
        assert pack.status_code == 200
        pack_body = pack.json()
        assert [item["id"] for item in pack_body["items"]] == preview_body["evidence_item_ids"]
        assert pack_body["query"] == "Evidence Pack Source Chunk"
        assert pack_body["detail_summary"]["item_count"] == len(preview_body["evidence_item_ids"])
        assert pack_body["detail_summary"]["source_count"] == 1
        assert pack_body["detail_summary"]["knowledge_unit_count"] == 1
        assert pack_body["detail_summary"]["citation_labels"] == preview_body["citation_labels"]
        assert pack_body["detail_summary"]["rank_score_min"] is not None
        assert pack_body["detail_summary"]["rank_score_max"] is not None
        assert pack_body["detail_summary"]["focused_item_id"] is None
        assert pack_body["detail_summary"]["no_evidence_reason"] is None
        assert pack_body["query_explanation"]["retrieval_strategy_profile"] == (
            "p0_confirmed_ku_token_overlap_v1"
        )
        assert pack_body["provider_status"] == "degraded"
        assert pack_body["fallback_reason"]
        detail_item = pack_body["items"][0]
        assert detail_item["knowledge_unit_title"] == "Evidence test"
        assert detail_item["knowledge_unit_status"] == "confirmed"
        assert detail_item["knowledge_unit_type"] == "claim"
        assert "Evidence Pack" in detail_item["chunk_content_excerpt"]
        assert detail_item["source_title"] == "Evidence test"
        assert detail_item["source_origin"] == "text_import"
        assert detail_item["citation_trace"]["profile"] == "p0_citation_trace_source_chunk_v1"
        assert detail_item["citation_trace"]["evidence_pack_id"] == preview_body["evidence_pack_id"]
        assert detail_item["citation_trace"]["evidence_item_id"] == detail_item["id"]
        trace_path_types = [node["type"] for node in detail_item["citation_trace"]["trace_path"]]
        assert trace_path_types == [
            "evidence_pack",
            "evidence_item",
            "knowledge_unit",
            "chunk",
            "source",
        ]
        copy_payload = detail_item["citation_trace"]["copy_payload"]
        assert copy_payload["citation_label"] == detail_item["citation_label"]
        assert copy_payload["evidence_item_id"] == detail_item["id"]
        assert copy_payload["knowledge_unit_id"] == detail_item["knowledge_unit_id"]

        focused_pack = client.get(
            f"/api/evidence-packs/{preview_body['evidence_pack_id']}",
            headers=headers,
            params={"focus_item_id": detail_item["id"]},
        )
        assert focused_pack.status_code == 200
        assert focused_pack.json()["detail_summary"]["focused_item_id"] == detail_item["id"]

        invalid_focus = client.get(
            f"/api/evidence-packs/{preview_body['evidence_pack_id']}",
            headers=headers,
            params={"focus_item_id": "eitem_not_in_pack"},
        )
        assert invalid_focus.status_code == 404
        assert invalid_focus.json()["error"]["code"] == "evidence_item_not_in_pack"

        answer = client.post(
            "/api/retrieval/evidence-only",
            headers=headers,
            json={"query": "Evidence Pack Source Chunk"},
        )
        assert answer.status_code == 200
        answer_body = answer.json()
        assert answer_body["output_type"] == "evidence_only_answer"
        assert answer_body["evidence_item_ids"]
        assert answer_body["citation_labels"]

        no_evidence = client.post(
            "/api/retrieval/evidence-only",
            headers=headers,
            json={"query": "zzzz-not-present"},
        )
        assert no_evidence.status_code == 200
        no_evidence_body = no_evidence.json()
        assert no_evidence_body["evidence_item_ids"] == []
        assert "不会在无证据时生成伪答案" in no_evidence_body["answer"]
        no_evidence_pack = client.get(
            f"/api/evidence-packs/{no_evidence_body['evidence_pack_id']}",
            headers=headers,
        )
        assert no_evidence_pack.status_code == 200
        no_evidence_pack_body = no_evidence_pack.json()
        assert no_evidence_pack_body["status"] == "empty"
        assert no_evidence_pack_body["failure_type"] == "no_retrieval_result"
        assert no_evidence_pack_body["items"] == []
        assert no_evidence_pack_body["detail_summary"]["item_count"] == 0
        assert (
            no_evidence_pack_body["detail_summary"]["no_evidence_reason"]
            == "no_retrieval_result"
        )


def test_citation_annotations_and_compare(monkeypatch, tmp_path):
    monkeypatch.setenv("KB_APP_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("KB_LOCAL_TOKEN", "test-token")
    headers = {"x-kb-local-token": "test-token"}
    with TestClient(create_app()) as client:
        unauthorized = client.get("/api/evidence-packs/epack_missing/annotations")
        assert unauthorized.status_code == 401
        assert unauthorized.json()["error"]["code"] == "sidecar_auth_failed"

        imports = []
        for title, content in [
            (
                "Citation Annotation Alpha",
                "Citation annotation compare alpha evidence keeps Source Chunk Knowledge binding.",
            ),
            (
                "Citation Annotation Beta",
                "Citation annotation compare beta evidence keeps Source Chunk Knowledge binding.",
            ),
        ]:
            imported = client.post(
                "/api/text-imports",
                headers=headers,
                json={"title": title, "content": content},
            )
            assert imported.status_code == 200
            imports.append(imported.json())

        pending_preview = client.post(
            "/api/retrieval/preview",
            headers=headers,
            json={"query": "Citation annotation compare Source Chunk"},
        )
        assert pending_preview.status_code == 200
        assert pending_preview.json()["evidence_item_ids"] == []

        for imported in imports:
            confirmed = client.post(
                f"/api/review-tasks/{imported['review_task_ids'][0]}:confirm",
                headers=headers,
            )
            assert confirmed.status_code == 200

        preview = client.post(
            "/api/retrieval/preview",
            headers=headers,
            json={"query": "Citation annotation compare Source Chunk"},
        )
        assert preview.status_code == 200
        preview_body = preview.json()
        assert len(preview_body["evidence_item_ids"]) >= 2
        pack_id = preview_body["evidence_pack_id"]
        item_ids = preview_body["evidence_item_ids"][:2]

        empty_annotations = client.get(
            f"/api/evidence-packs/{pack_id}/annotations",
            headers=headers,
        )
        assert empty_annotations.status_code == 200
        assert empty_annotations.json()["total"] == 0

        created = client.post(
            f"/api/evidence-packs/{pack_id}/annotations",
            headers=headers,
            json={
                "evidence_item_id": item_ids[0],
                "annotation_type": "note",
                "content": "  first local citation note  ",
            },
        )
        assert created.status_code == 200
        created_body = created.json()
        assert created_body["content"] == "first local citation note"
        assert created_body["annotation_type"] == "note"
        assert created_body["metadata"]["source"] == "citation_detail"

        detail_with_annotation = client.get(f"/api/evidence-packs/{pack_id}", headers=headers)
        assert detail_with_annotation.status_code == 200
        detail_summary = detail_with_annotation.json()["detail_summary"]
        assert detail_summary["annotation_count"] == 1
        assert detail_summary["annotation_counts"]["note"] == 1

        updated = client.patch(
            f"/api/citation-annotations/{created_body['id']}",
            headers=headers,
            json={"annotation_type": "risk", "content": "needs source comparison"},
        )
        assert updated.status_code == 200
        assert updated.json()["annotation_type"] == "risk"
        assert updated.json()["content"] == "needs source comparison"

        annotations = client.get(f"/api/evidence-packs/{pack_id}/annotations", headers=headers)
        assert annotations.status_code == 200
        annotations_body = annotations.json()
        assert annotations_body["total"] == 1
        assert annotations_body["counts_by_type"]["risk"] == 1

        invalid_annotation = client.post(
            f"/api/evidence-packs/{pack_id}/annotations",
            headers=headers,
            json={
                "evidence_item_id": "eitem_not_in_pack",
                "annotation_type": "note",
                "content": "bad binding",
            },
        )
        assert invalid_annotation.status_code == 404
        assert invalid_annotation.json()["error"]["code"] == "evidence_item_not_in_pack"

        invalid_empty = client.post(
            f"/api/evidence-packs/{pack_id}/annotations",
            headers=headers,
            json={
                "evidence_item_id": item_ids[0],
                "annotation_type": "note",
                "content": "   ",
            },
        )
        assert invalid_empty.status_code == 422
        assert invalid_empty.json()["error"]["code"] == "validation_error"

        compare = client.post(
            f"/api/evidence-packs/{pack_id}/compare",
            headers=headers,
            json={"evidence_item_ids": item_ids},
        )
        assert compare.status_code == 200
        compare_body = compare.json()
        assert compare_body["item_count"] == 2
        assert compare_body["differences"]["source_count"] >= 1
        assert compare_body["differences"]["knowledge_unit_count"] >= 1
        assert compare_body["copy_safe_summary"]
        assert "alpha evidence" not in compare_body["copy_safe_summary"]
        for item in compare_body["items"]:
            assert item["knowledge_unit_status"] == "confirmed"
            assert [node["type"] for node in item["trace_path"]] == [
                "evidence_pack",
                "evidence_item",
                "knowledge_unit",
                "chunk",
                "source",
            ]
            assert item["copy_payload"]["evidence_item_id"] == item["id"]

        invalid_compare = client.post(
            f"/api/evidence-packs/{pack_id}/compare",
            headers=headers,
            json={"evidence_item_ids": [item_ids[0], "eitem_not_in_pack"]},
        )
        assert invalid_compare.status_code == 404
        assert invalid_compare.json()["error"]["code"] == "evidence_item_not_in_pack"

        before_counts = {}
        with db() as conn:
            for table in [
                "evidence_packs",
                "evidence_items",
                "knowledge_units",
                "sources",
                "ai_answers",
                "memories",
            ]:
                before_counts[table] = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        repeated_compare = client.post(
            f"/api/evidence-packs/{pack_id}/compare",
            headers=headers,
            json={"evidence_item_ids": item_ids},
        )
        assert repeated_compare.status_code == 200
        with db() as conn:
            for table, before_count in before_counts.items():
                assert conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0] == before_count

        deleted = client.delete(f"/api/citation-annotations/{created_body['id']}", headers=headers)
        assert deleted.status_code == 200
        assert deleted.json()["deleted"] is True
        after_delete = client.get(f"/api/evidence-packs/{pack_id}/annotations", headers=headers)
        assert after_delete.status_code == 200
        assert after_delete.json()["total"] == 0


def test_feedback_events_and_memory_draft_review(monkeypatch, tmp_path):
    monkeypatch.setenv("KB_APP_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("KB_LOCAL_TOKEN", "test-token")
    headers = {"x-kb-local-token": "test-token"}
    with TestClient(create_app()) as client:
        unauthorized = client.post("/api/feedback", json={"feedback_type": "useful"})
        assert unauthorized.status_code == 401
        assert unauthorized.json()["error"]["code"] == "sidecar_auth_failed"

        imported = client.post(
            "/api/text-imports",
            headers=headers,
            json={
                "title": "Feedback memory source",
                "content": "Feedback events and Memory Draft must stay pending review.",
            },
        )
        assert imported.status_code == 200
        imported_body = imported.json()
        assert imported_body["review_task_ids"]
        assert imported_body["candidate_knowledge_unit_ids"]

        confirmed = client.post(
            f"/api/review-tasks/{imported_body['review_task_ids'][0]}:confirm",
            headers=headers,
        )
        assert confirmed.status_code == 200

        answer = client.post(
            "/api/retrieval/evidence-only",
            headers=headers,
            json={"query": "Feedback Memory Draft"},
        )
        assert answer.status_code == 200
        answer_body = answer.json()
        assert answer_body["answer_id"]
        assert answer_body["evidence_pack_id"]
        assert answer_body["evidence_item_ids"]

        missing_target = client.post(
            "/api/feedback",
            headers=headers,
            json={"feedback_type": "useful"},
        )
        assert missing_target.status_code == 422
        assert missing_target.json()["error"]["code"] == "validation_error"

        invalid_feedback = client.post(
            "/api/feedback",
            headers=headers,
            json={"feedback_type": "wrong", "ai_answer_id": answer_body["answer_id"]},
        )
        assert invalid_feedback.status_code == 422
        assert invalid_feedback.json()["error"]["code"] == "validation_error"

        feedback = client.post(
            "/api/feedback",
            headers=headers,
            json={
                "feedback_type": "useful",
                "evidence_pack_id": answer_body["evidence_pack_id"],
                "ai_answer_id": answer_body["answer_id"],
                "evidence_item_id": answer_body["evidence_item_ids"][0],
                "comment": "This answer is useful.",
            },
        )
        assert feedback.status_code == 200
        feedback_body = feedback.json()
        assert feedback_body["feedback_type"] == "useful"
        assert feedback_body["target_type"] == "evidence_item"
        assert feedback_body["feedback_policy"]["mutates_confirmed_knowledge"] is False

        with db() as conn:
            event_count = conn.execute("SELECT COUNT(*) FROM feedback_events").fetchone()[0]
            ku_status = conn.execute(
                "SELECT status FROM knowledge_units WHERE id = ?",
                (imported_body["candidate_knowledge_unit_ids"][0],),
            ).fetchone()[0]
        assert event_count == 1
        assert ku_status == "confirmed"

        missing_answer = client.post(
            "/api/memory-drafts",
            headers=headers,
            json={
                "source_answer_id": "answer_missing",
                "content": "Should fail",
                "memory_type": "decision",
            },
        )
        assert missing_answer.status_code == 404
        assert missing_answer.json()["error"]["code"] == "ai_answer_not_found"

        empty_memory = client.post(
            "/api/memory-drafts",
            headers=headers,
            json={
                "source_answer_id": answer_body["answer_id"],
                "content": "",
                "memory_type": "decision",
            },
        )
        assert empty_memory.status_code == 422
        assert empty_memory.json()["error"]["code"] == "validation_error"

        memory = client.post(
            "/api/memory-drafts",
            headers=headers,
            json={
                "source_answer_id": answer_body["answer_id"],
                "content": "Feedback Memory Draft should enter review first.",
                "memory_type": "decision",
            },
        )
        assert memory.status_code == 200
        memory_body = memory.json()
        assert memory_body["status"] == "pending_review"
        assert memory_body["user_confirmed"] is False
        assert memory_body["review_task_id"]

        reviews = client.get("/api/review-tasks", headers=headers)
        assert reviews.status_code == 200
        memory_review = next(
            task for task in reviews.json() if task["target_id"] == memory_body["id"]
        )
        assert memory_review["target_type"] == "memory"

        confirmed_memory = client.post(
            f"/api/review-tasks/{memory_body['review_task_id']}:confirm",
            headers=headers,
        )
        assert confirmed_memory.status_code == 200
        memory_detail = client.get(f"/api/memory-drafts/{memory_body['id']}", headers=headers)
        assert memory_detail.status_code == 200
        assert memory_detail.json()["status"] == "confirmed"
        assert memory_detail.json()["user_confirmed"] is True

        second_memory = client.post(
            "/api/memory-drafts",
            headers=headers,
            json={
                "source_answer_id": answer_body["answer_id"],
                "content": "This second draft will be ignored.",
                "memory_type": "conclusion",
            },
        )
        assert second_memory.status_code == 200
        ignored_memory = client.post(
            f"/api/review-tasks/{second_memory.json()['review_task_id']}:ignore",
            headers=headers,
        )
        assert ignored_memory.status_code == 200
        second_detail = client.get(
            f"/api/memory-drafts/{second_memory.json()['id']}",
            headers=headers,
        )
        assert second_detail.status_code == 200
        assert second_detail.json()["status"] == "archived"

        with db() as conn:
            ku_count = conn.execute("SELECT COUNT(*) FROM knowledge_units").fetchone()[0]
            memory_count = conn.execute("SELECT COUNT(*) FROM memories").fetchone()[0]
        assert ku_count == 1
        assert memory_count == 2


def test_feedback_diagnostics_list_summary_and_filters(monkeypatch, tmp_path):
    monkeypatch.setenv("KB_APP_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("KB_LOCAL_TOKEN", "test-token")
    headers = {"x-kb-local-token": "test-token"}
    with TestClient(create_app()) as client:
        unauthorized = client.get("/api/feedback")
        assert unauthorized.status_code == 401
        assert unauthorized.json()["error"]["code"] == "sidecar_auth_failed"
        unauthorized_export = client.get("/api/feedback/export?format=json")
        assert unauthorized_export.status_code == 401
        assert unauthorized_export.json()["error"]["code"] == "sidecar_auth_failed"
        unauthorized_history = client.get("/api/feedback/export-history")
        assert unauthorized_history.status_code == 401
        assert unauthorized_history.json()["error"]["code"] == "sidecar_auth_failed"

        imported = client.post(
            "/api/text-imports",
            headers=headers,
            json={
                "title": "Feedback diagnostics source",
                "content": (
                    "Feedback Diagnostics should replay event targets, query context, "
                    "and citation labels without mutating retrieval artifacts."
                ),
            },
        )
        assert imported.status_code == 200
        imported_body = imported.json()
        assert imported_body["review_task_ids"]

        confirmed = client.post(
            f"/api/review-tasks/{imported_body['review_task_ids'][0]}:confirm",
            headers=headers,
        )
        assert confirmed.status_code == 200

        answer = client.post(
            "/api/retrieval/evidence-only",
            headers=headers,
            json={"query": "Feedback Diagnostics Citation"},
        )
        assert answer.status_code == 200
        answer_body = answer.json()
        evidence_item_id = answer_body["evidence_item_ids"][0]

        feedback_ids: dict[str, str] = {}
        for feedback_type, comment in [
            ("useful", "useful event"),
            ("bad_citation", "bad citation event"),
            ("missing_source", None),
        ]:
            feedback = client.post(
                "/api/feedback",
                headers=headers,
                json={
                    "feedback_type": feedback_type,
                    "evidence_pack_id": answer_body["evidence_pack_id"],
                    "ai_answer_id": answer_body["answer_id"],
                    "evidence_item_id": evidence_item_id,
                    "comment": comment,
                },
            )
            assert feedback.status_code == 200
            feedback_ids[feedback_type] = feedback.json()["id"]

        created_times = {
            "useful": "2026-05-17T00:00:01+00:00",
            "bad_citation": "2026-05-17T00:00:02+00:00",
            "missing_source": "2026-05-17T00:00:03+00:00",
        }
        with db() as conn:
            for feedback_type, feedback_id in feedback_ids.items():
                conn.execute(
                    "UPDATE feedback_events SET created_at = ? WHERE id = ?",
                    (created_times[feedback_type], feedback_id),
                )

        events = client.get("/api/feedback", headers=headers)
        assert events.status_code == 200
        event_body = events.json()
        assert [event["feedback_type"] for event in event_body] == [
            "missing_source",
            "bad_citation",
            "useful",
        ]
        assert all(event["target_type"] == "evidence_item" for event in event_body)
        assert all(event["query"] == "Feedback Diagnostics Citation" for event in event_body)
        assert all(event["citation_label"] for event in event_body)
        assert event_body[0]["ranking_effect"] == "negative_weight_suggestion"

        by_type = client.get("/api/feedback?feedback_type=bad_citation", headers=headers)
        assert by_type.status_code == 200
        assert [event["feedback_type"] for event in by_type.json()] == ["bad_citation"]

        by_target = client.get("/api/feedback?target_type=evidence_item", headers=headers)
        assert by_target.status_code == 200
        assert len(by_target.json()) == 3

        by_pack = client.get(
            f"/api/feedback?evidence_pack_id={answer_body['evidence_pack_id']}",
            headers=headers,
        )
        assert by_pack.status_code == 200
        assert len(by_pack.json()) == 3

        by_answer = client.get(
            f"/api/feedback?ai_answer_id={answer_body['answer_id']}",
            headers=headers,
        )
        assert by_answer.status_code == 200
        assert len(by_answer.json()) == 3

        by_item = client.get(
            f"/api/feedback?evidence_item_id={evidence_item_id}",
            headers=headers,
        )
        assert by_item.status_code == 200
        assert len(by_item.json()) == 3

        by_created_asc = client.get("/api/feedback?sort=created_asc", headers=headers)
        assert by_created_asc.status_code == 200
        assert [event["feedback_type"] for event in by_created_asc.json()] == [
            "useful",
            "bad_citation",
            "missing_source",
        ]

        by_window = client.get(
            (
                "/api/feedback?created_from=2026-05-17T00:00:02%2B00:00"
                "&created_to=2026-05-17T00:00:03%2B00:00"
            ),
            headers=headers,
        )
        assert by_window.status_code == 200
        assert [event["feedback_type"] for event in by_window.json()] == [
            "missing_source",
            "bad_citation",
        ]

        by_search = client.get("/api/feedback?search=bad%20citation", headers=headers)
        assert by_search.status_code == 200
        assert [event["feedback_type"] for event in by_search.json()] == ["bad_citation"]

        by_ranking = client.get(
            "/api/feedback?ranking_effect=negative_weight_suggestion",
            headers=headers,
        )
        assert by_ranking.status_code == 200
        assert [event["feedback_type"] for event in by_ranking.json()] == [
            "missing_source",
            "bad_citation",
        ]

        with_comment = client.get("/api/feedback?has_comment=true", headers=headers)
        assert with_comment.status_code == 200
        assert [event["feedback_type"] for event in with_comment.json()] == [
            "bad_citation",
            "useful",
        ]

        without_comment = client.get("/api/feedback?has_comment=false", headers=headers)
        assert without_comment.status_code == 200
        assert [event["feedback_type"] for event in without_comment.json()] == ["missing_source"]

        summary = client.get("/api/feedback/summary", headers=headers)
        assert summary.status_code == 200
        summary_body = summary.json()
        assert summary_body["total"] == 3
        assert summary_body["by_type"] == {
            "missing_source": 1,
            "bad_citation": 1,
            "useful": 1,
        }
        assert summary_body["by_target_type"] == {"evidence_item": 3}
        assert summary_body["positive_count"] == 1
        assert summary_body["negative_count"] == 2
        assert summary_body["last_event_at"] == event_body[0]["created_at"]
        assert summary_body["feedback_policy"]["mutates_confirmed_knowledge"] is False

        filtered_summary = client.get(
            "/api/feedback/summary?ranking_effect=negative_weight_suggestion",
            headers=headers,
        )
        assert filtered_summary.status_code == 200
        assert filtered_summary.json()["total"] == 2
        assert filtered_summary.json()["negative_count"] == 2

        json_export = client.get("/api/feedback/export?format=json&limit=2", headers=headers)
        assert json_export.status_code == 200
        json_export_body = json_export.json()
        assert json_export_body["format"] == "json"
        assert json_export_body["record_count"] == 2
        assert json_export_body["redacted"] is True
        assert json_export_body["includes_source_text"] is False
        assert json_export_body["mime_type"] == "application/json"
        assert json_export_body["filename"].endswith(".json")
        json_payload = json.loads(json_export_body["content"])
        assert json_payload["summary"]["total"] == 2
        assert len(json_payload["events"]) == 2
        assert json_payload["events"][0]["query"] == "Feedback Diagnostics Citation"

        csv_export = client.get(
            (
                "/api/feedback/export?format=csv&feedback_type=bad_citation"
                f"&ai_answer_id={answer_body['answer_id']}"
                f"&evidence_pack_id={answer_body['evidence_pack_id']}"
                f"&evidence_item_id={evidence_item_id}"
            ),
            headers=headers,
        )
        assert csv_export.status_code == 200
        csv_export_body = csv_export.json()
        assert csv_export_body["format"] == "csv"
        assert csv_export_body["record_count"] == 1
        assert csv_export_body["mime_type"] == "text/csv"
        assert csv_export_body["filename"].endswith(".csv")
        header = csv_export_body["content"].splitlines()[0].split(",")
        assert header == [
            "id",
            "feedback_type",
            "target_type",
            "target_id",
            "evidence_pack_id",
            "ai_answer_id",
            "evidence_item_id",
            "ranking_effect",
            "query",
            "citation_label",
            "comment",
            "created_at",
        ]
        csv_rows = list(csv.DictReader(io.StringIO(csv_export_body["content"])))
        assert len(csv_rows) == 1
        assert csv_rows[0]["feedback_type"] == "bad_citation"
        assert csv_rows[0]["ranking_effect"] == "negative_weight_suggestion"
        assert csv_rows[0]["query"] == "Feedback Diagnostics Citation"
        assert csv_rows[0]["citation_label"]

        history = client.get("/api/feedback/export-history", headers=headers)
        assert history.status_code == 200
        history_body = history.json()
        assert len(history_body) == 2
        assert history_body[0]["format"] == "csv"
        assert history_body[0]["content_sha256"] == hashlib.sha256(
            csv_export_body["content"].encode("utf-8")
        ).hexdigest()
        assert history_body[1]["format"] == "json"
        assert history_body[1]["summary"]["total"] == 2
        history_blob = json.dumps(history_body, ensure_ascii=False)
        assert "content" not in history_body[0]
        assert "test-token" not in history_blob
        assert str(tmp_path) not in history_blob
        assert "mutating retrieval artifacts" not in history_blob

        deleted = client.delete(
            f"/api/feedback/export-history/{history_body[0]['id']}",
            headers=headers,
        )
        assert deleted.status_code == 200
        assert deleted.json()["deleted"] is True
        history_after_delete = client.get("/api/feedback/export-history", headers=headers)
        assert history_after_delete.status_code == 200
        assert [record["id"] for record in history_after_delete.json()] == [history_body[1]["id"]]

        exported_blob = (
            json.dumps(json_export_body, ensure_ascii=False) + csv_export_body["content"]
        )
        assert "test-token" not in exported_blob
        assert str(tmp_path) not in exported_blob
        assert "mutating retrieval artifacts" not in exported_blob

        invalid_target = client.get("/api/feedback?target_type=unknown", headers=headers)
        assert invalid_target.status_code == 422
        assert invalid_target.json()["error"]["code"] == "invalid_feedback_filter"
        invalid_ranking = client.get("/api/feedback?ranking_effect=unknown", headers=headers)
        assert invalid_ranking.status_code == 422
        invalid_sort = client.get("/api/feedback?sort=wrong", headers=headers)
        assert invalid_sort.status_code == 422
        invalid_datetime = client.get("/api/feedback?created_from=not-a-date", headers=headers)
        assert invalid_datetime.status_code == 422

        with db() as conn:
            retrieval_feedback_table = conn.execute(
                """
                SELECT name FROM sqlite_master
                WHERE type = 'table' AND name = 'retrieval_feedback'
                """
            ).fetchone()
            event_count = conn.execute("SELECT COUNT(*) FROM feedback_events").fetchone()[0]
            ku_count = conn.execute("SELECT COUNT(*) FROM knowledge_units").fetchone()[0]
            pack_count = conn.execute("SELECT COUNT(*) FROM evidence_packs").fetchone()[0]
            answer_count = conn.execute("SELECT COUNT(*) FROM ai_answers").fetchone()[0]
            memory_count = conn.execute("SELECT COUNT(*) FROM memories").fetchone()[0]
        assert retrieval_feedback_table is None
        assert event_count == 3
        assert ku_count == 1
        assert pack_count == 1
        assert answer_count == 1
        assert memory_count == 0


def test_p0_file_upload_complete_and_inspection(monkeypatch, tmp_path):
    monkeypatch.setenv("KB_APP_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("KB_LOCAL_TOKEN", "test-token")
    headers = {"x-kb-local-token": "test-token"}
    content = b"KnowledgeBaseDev upload smoke fixture."
    expected_hash = hashlib.sha256(content).hexdigest()

    with TestClient(create_app()) as client:
        created = client.post(
            "/api/uploads",
            headers=headers,
            json={
                "filename": "fixture.txt",
                "size_bytes": len(content),
                "content_type": "text/plain",
                "sha256": expected_hash,
                "part_size": 12,
            },
        )
        assert created.status_code == 200
        upload = created.json()
        assert upload["status"] == "created"
        assert upload["part_count"] == 4

        for index, offset in enumerate(range(0, len(content), 12), start=1):
            part = client.put(
                f"/api/uploads/{upload['id']}/parts/{index}",
                headers={**headers, "content-type": "application/octet-stream"},
                content=content[offset : offset + 12],
            )
            assert part.status_code == 200

        completed = client.post(f"/api/uploads/{upload['id']}:complete", headers=headers)
        assert completed.status_code == 200
        complete_body = completed.json()
        assert complete_body["status"] == "completed"
        assert complete_body["file_id"]
        assert complete_body["integrity_check"]["status"] == "passed"
        assert complete_body["inspection"]["risk_level"] == "low"
        assert complete_body["inspection"]["header_summary"]

        files = client.get("/api/files", headers=headers)
        assert files.status_code == 200
        assert files.json()[0]["id"] == complete_body["file_id"]

        verified = client.post(f"/api/files/{complete_body['file_id']}:verify", headers=headers)
        assert verified.status_code == 200
        assert verified.json()["inspection_status"] == "completed"


def test_p0_file_upload_missing_part_and_hash_mismatch_are_recoverable(monkeypatch, tmp_path):
    monkeypatch.setenv("KB_APP_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("KB_LOCAL_TOKEN", "test-token")
    headers = {"x-kb-local-token": "test-token"}
    content = b"two chunks"

    with TestClient(create_app()) as client:
        missing_upload = client.post(
            "/api/uploads",
            headers=headers,
            json={"filename": "missing.md", "size_bytes": len(content), "part_size": 4},
        ).json()
        client.put(
            f"/api/uploads/{missing_upload['id']}/parts/1",
            headers={**headers, "content-type": "application/octet-stream"},
            content=content[:4],
        )
        missing = client.post(f"/api/uploads/{missing_upload['id']}:complete", headers=headers)
        assert missing.status_code == 409
        assert missing.json()["error"]["code"] == "upload_part_missing"

        snapshot = client.get(f"/api/uploads/{missing_upload['id']}", headers=headers)
        assert snapshot.status_code == 200
        assert snapshot.json()["status"] == "recoverable_error"
        assert snapshot.json()["error_code"] == "upload_part_missing"

        mismatch_upload = client.post(
            "/api/uploads",
            headers=headers,
            json={
                "filename": "mismatch.md",
                "size_bytes": len(content),
                "sha256": "0" * 64,
                "part_size": 32,
            },
        ).json()
        client.put(
            f"/api/uploads/{mismatch_upload['id']}/parts/1",
            headers={**headers, "content-type": "application/octet-stream"},
            content=content,
        )
        mismatch = client.post(f"/api/uploads/{mismatch_upload['id']}:complete", headers=headers)
        assert mismatch.status_code == 409
        assert mismatch.json()["error"]["code"] == "hash_mismatch"

        mismatch_snapshot = client.get(f"/api/uploads/{mismatch_upload['id']}", headers=headers)
        assert mismatch_snapshot.status_code == 200
        assert mismatch_snapshot.json()["status"] == "recoverable_error"
        assert mismatch_snapshot.json()["integrity_check"]["status"] == "failed"


def test_p0_parse_text_file_creates_source_and_chunks(monkeypatch, tmp_path):
    monkeypatch.setenv("KB_APP_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("KB_LOCAL_TOKEN", "test-token")
    headers = {"x-kb-local-token": "test-token"}
    content = b"# File parser\n\nParser Router creates Source and Chunk from inspected text."
    expected_hash = hashlib.sha256(content).hexdigest()

    with TestClient(create_app()) as client:
        upload = client.post(
            "/api/uploads",
            headers=headers,
            json={
                "filename": "parser.md",
                "size_bytes": len(content),
                "content_type": "text/markdown",
                "sha256": expected_hash,
                "part_size": 1024,
            },
        ).json()
        client.put(
            f"/api/uploads/{upload['id']}/parts/1",
            headers={**headers, "content-type": "application/octet-stream"},
            content=content,
        )
        completed = client.post(f"/api/uploads/{upload['id']}:complete", headers=headers).json()

        parsed = client.post(f"/api/files/{completed['file_id']}:parse", headers=headers)
        assert parsed.status_code == 200
        parsed_body = parsed.json()
        assert parsed_body["status"] == "completed"
        assert parsed_body["source_id"]
        assert parsed_body["chunk_ids"]
        assert parsed_body["source"]["source_origin"] == "parsed_file"

        task = client.get(f"/api/parse-tasks/{parsed_body['id']}", headers=headers)
        assert task.status_code == 200
        assert task.json()["source_id"] == parsed_body["source_id"]

        sources = client.get("/api/sources", headers=headers)
        assert sources.status_code == 200
        assert sources.json()[0]["id"] == parsed_body["source_id"]

        source = client.get(f"/api/sources/{parsed_body['source_id']}", headers=headers)
        assert source.status_code == 200
        assert source.json()["chunks"][0]["citation_label"].startswith("parser.md")

        extracted = client.post(
            "/api/knowledge-units:extract",
            headers=headers,
            json={"source_id": parsed_body["source_id"]},
        )
        assert extracted.status_code == 200
        extracted_body = extracted.json()
        assert extracted_body["status"] == "completed"
        assert extracted_body["candidate_knowledge_unit_ids"]
        assert extracted_body["review_task_ids"]
        assert extracted_body["embedding_ids"]
        assert extracted_body["fallback_reason"] == "provider_capability_unavailable"

        reused = client.post(
            "/api/knowledge-units:extract",
            headers=headers,
            json={"source_id": parsed_body["source_id"]},
        )
        assert reused.status_code == 200
        assert reused.json()["status"] == "reused"
        assert reused.json()["candidate_knowledge_unit_ids"] == extracted_body[
            "candidate_knowledge_unit_ids"
        ]

        ku = client.get(
            f"/api/knowledge-units/{extracted_body['candidate_knowledge_unit_ids'][0]}",
            headers=headers,
        )
        assert ku.status_code == 200
        ku_body = ku.json()
        assert ku_body["status"] == "pending_review"
        assert ku_body["embeddings"][0]["embedding_profile"] == "mock_fixed_384"
        assert ku_body["embeddings"][0]["dimension"] == 384

        review_queue = client.get("/api/review-tasks", headers=headers)
        assert review_queue.status_code == 200
        assert review_queue.json()[0]["target_id"] in extracted_body["candidate_knowledge_unit_ids"]

        pending_preview = client.post(
            "/api/retrieval/preview",
            headers=headers,
            json={"query": "Parser Router Source Chunk"},
        )
        assert pending_preview.status_code == 200
        assert pending_preview.json()["evidence_pack"]["failure_type"] == "no_retrieval_result"

        confirmed = client.post(
            f"/api/review-tasks/{extracted_body['review_task_ids'][0]}:confirm",
            headers=headers,
        )
        assert confirmed.status_code == 200

        preview = client.post(
            "/api/retrieval/preview",
            headers=headers,
            json={"query": "Parser Router Source Chunk"},
        )
        assert preview.status_code == 200
        preview_body = preview.json()
        assert preview_body["evidence_pack"]["items"]
        pack = client.get(
            f"/api/evidence-packs/{preview_body['evidence_pack_id']}",
            headers=headers,
        )
        assert pack.status_code == 200
        pack_item = pack.json()["items"][0]
        assert pack_item["knowledge_unit_status"] == "confirmed"
        assert pack_item["source_origin"] == "parsed_file"

        answer = client.post(
            "/api/retrieval/evidence-only",
            headers=headers,
            json={"query": "Parser Router Source Chunk"},
        )
        assert answer.status_code == 200
        assert answer.json()["evidence_item_ids"]

        summary = client.get("/api/workspace/summary", headers=headers)
        assert summary.status_code == 200
        assert summary.json()["source_count"] == 1
        assert summary.json()["chunk_count"] >= 1
        assert summary.json()["knowledge_unit_count"] >= 1


def test_p0_parse_unsupported_and_blocked_files_are_recoverable(monkeypatch, tmp_path):
    monkeypatch.setenv("KB_APP_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("KB_LOCAL_TOKEN", "test-token")
    headers = {"x-kb-local-token": "test-token"}

    with TestClient(create_app()) as client:
        pdf_content = b"%PDF-1.7\nnot implemented in z0a"
        pdf_hash = hashlib.sha256(pdf_content).hexdigest()
        pdf_upload = client.post(
            "/api/uploads",
            headers=headers,
            json={
                "filename": "unsupported.pdf",
                "size_bytes": len(pdf_content),
                "content_type": "application/pdf",
                "sha256": pdf_hash,
                "part_size": 1024,
            },
        ).json()
        client.put(
            f"/api/uploads/{pdf_upload['id']}/parts/1",
            headers={**headers, "content-type": "application/octet-stream"},
            content=pdf_content,
        )
        pdf_completed = client.post(
            f"/api/uploads/{pdf_upload['id']}:complete",
            headers=headers,
        ).json()
        unsupported = client.post(f"/api/files/{pdf_completed['file_id']}:parse", headers=headers)
        assert unsupported.status_code == 409
        assert unsupported.json()["error"]["code"] == "unsupported_parser"

        script_content = b"#!/bin/sh\necho blocked"
        script_hash = hashlib.sha256(script_content).hexdigest()
        script_upload = client.post(
            "/api/uploads",
            headers=headers,
            json={
                "filename": "blocked.sh",
                "size_bytes": len(script_content),
                "content_type": "text/x-shellscript",
                "sha256": script_hash,
                "part_size": 1024,
            },
        ).json()
        client.put(
            f"/api/uploads/{script_upload['id']}/parts/1",
            headers={**headers, "content-type": "application/octet-stream"},
            content=script_content,
        )
        script_completed = client.post(
            f"/api/uploads/{script_upload['id']}:complete",
            headers=headers,
        ).json()
        assert script_completed["inspection"]["risk_level"] == "blocked"
        blocked = client.post(f"/api/files/{script_completed['file_id']}:parse", headers=headers)
        assert blocked.status_code == 409
        assert blocked.json()["error"]["code"] == "file_blocked_by_risk_policy"
