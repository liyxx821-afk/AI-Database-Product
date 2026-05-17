from __future__ import annotations

import json
from typing import Optional

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.api.schemas import (
    CitationAnnotationListResponse,
    CitationAnnotationPatchRequest,
    CitationAnnotationRecord,
    CitationAnnotationRequest,
    CitationCompareRequest,
    CitationCompareResponse,
    EvidenceOnlyRequest,
    EvidenceOnlyResponse,
    EvidencePackDetail,
    JobSnapshot,
    RetrievalPreviewRequest,
    RetrievalPreviewResponse,
    ReviewActionResponse,
    ReviewTask,
    TextImportRequest,
    TextImportResponse,
)
from app.core.errors import AppError
from app.db.sqlite import db, json_dumps
from app.services.ingestion.text_import import import_text, now_iso
from app.services.retrieval.evidence import (
    build_evidence_only_answer,
    build_retrieval_preview,
    compare_evidence_items,
    create_citation_annotation,
    delete_citation_annotation,
    get_evidence_pack,
    list_citation_annotations,
    update_citation_annotation,
)

router = APIRouter()


@router.post("/text-imports", response_model=TextImportResponse)
def create_text_import(payload: TextImportRequest) -> dict:
    return import_text(payload.title, payload.content, payload.project_id)


@router.get("/jobs/{job_id}", response_model=JobSnapshot)
def get_job(job_id: str) -> dict:
    with db() as conn:
        job = conn.execute("SELECT * FROM processing_jobs WHERE id = ?", (job_id,)).fetchone()
        if not job:
            raise AppError("job_not_found", "Processing job was not found.", status_code=404)
        events = conn.execute(
            """
            SELECT * FROM processing_status_events
            WHERE job_id = ?
            ORDER BY event_seq ASC
            """,
            (job_id,),
        ).fetchall()
    return {
        "id": job["id"],
        "job_type": job["job_type"],
        "status": job["status"],
        "trace_id": job["trace_id"],
        "payload": json.loads(job["payload_json"]),
        "result": json.loads(job["result_json"]),
        "events": [
            {
                "event_seq": event["event_seq"],
                "event_type": event["event_type"],
                "message": event["message"],
                "payload": json.loads(event["payload_json"]),
                "created_at": event["created_at"],
            }
            for event in events
        ],
    }


@router.get("/jobs/{job_id}/events:stream")
def stream_job_events(job_id: str) -> StreamingResponse:
    snapshot = get_job(job_id)

    def iter_events():
        for event in snapshot["events"]:
            data = json.dumps(event)
            yield f"id: {event['event_seq']}\nevent: {event['event_type']}\ndata: {data}\n\n"

    return StreamingResponse(iter_events(), media_type="text/event-stream")


@router.get("/review-tasks", response_model=list[ReviewTask])
def list_review_tasks(status: str = "pending_review") -> list[dict]:
    with db() as conn:
        rows = conn.execute(
            """
            SELECT * FROM review_tasks
            WHERE status = ?
            ORDER BY created_at DESC
            """,
            (status,),
        ).fetchall()
    return [
        {
            "id": row["id"],
            "target_type": row["target_type"],
            "target_id": row["target_id"],
            "status": row["status"],
            "payload": json.loads(row["payload_json"]),
        }
        for row in rows
    ]


@router.post("/review-tasks/{task_id}:confirm", response_model=ReviewActionResponse)
def confirm_review_task(task_id: str) -> dict:
    timestamp = now_iso()
    with db() as conn:
        task = conn.execute("SELECT * FROM review_tasks WHERE id = ?", (task_id,)).fetchone()
        if not task:
            raise AppError("review_task_not_found", "Review task was not found.", status_code=404)
        if task["target_type"] == "memory":
            memory = conn.execute(
                "SELECT * FROM memories WHERE id = ?",
                (task["target_id"],),
            ).fetchone()
            if not memory:
                raise AppError("memory_not_found", "Memory draft was not found.", status_code=404)
            conn.execute(
                """
                UPDATE review_tasks SET status = 'confirmed', updated_at = ?
                WHERE id = ?
                """,
                (timestamp, task_id),
            )
            conn.execute(
                """
                UPDATE memories
                SET status = 'confirmed', user_confirmed = 1, updated_at = ?
                WHERE id = ?
                """,
                (timestamp, task["target_id"]),
            )
            conn.execute(
                """
                INSERT INTO audit_logs (id, event_type, payload_json, created_at)
                VALUES (?, 'memory_review_confirmed', ?, ?)
                """,
                (f"audit_{task_id}", json_dumps({"review_task_id": task_id}), timestamp),
            )
            return {
                "review_task_id": task_id,
                "target_id": task["target_id"],
                "status": "confirmed",
            }
        if task["target_type"] != "knowledge_unit":
            raise AppError(
                "review_target_not_supported",
                "Review target is not supported.",
                status_code=400,
            )
        conn.execute(
            """
            UPDATE review_tasks SET status = 'confirmed', updated_at = ?
            WHERE id = ?
            """,
            (timestamp, task_id),
        )
        conn.execute(
            """
            UPDATE knowledge_units
            SET status = 'confirmed', user_verified = 1, updated_at = ?
            WHERE id = ?
            """,
            (timestamp, task["target_id"]),
        )
        conn.execute(
            """
            INSERT INTO audit_logs (id, event_type, payload_json, created_at)
            VALUES (?, 'review_task_confirmed', ?, ?)
            """,
            (f"audit_{task_id}", json_dumps({"review_task_id": task_id}), timestamp),
        )
    return {"review_task_id": task_id, "target_id": task["target_id"], "status": "confirmed"}


@router.post("/review-tasks/{task_id}:ignore", response_model=ReviewActionResponse)
def ignore_review_task(task_id: str) -> dict:
    timestamp = now_iso()
    with db() as conn:
        task = conn.execute("SELECT * FROM review_tasks WHERE id = ?", (task_id,)).fetchone()
        if not task:
            raise AppError("review_task_not_found", "Review task was not found.", status_code=404)
        if task["target_type"] == "memory":
            memory = conn.execute(
                "SELECT * FROM memories WHERE id = ?",
                (task["target_id"],),
            ).fetchone()
            if not memory:
                raise AppError("memory_not_found", "Memory draft was not found.", status_code=404)
            conn.execute(
                "UPDATE review_tasks SET status = 'ignored', updated_at = ? WHERE id = ?",
                (timestamp, task_id),
            )
            conn.execute(
                """
                UPDATE memories
                SET status = 'archived', user_confirmed = 0, updated_at = ?
                WHERE id = ?
                """,
                (timestamp, task["target_id"]),
            )
            return {
                "review_task_id": task_id,
                "target_id": task["target_id"],
                "status": "ignored",
            }
        if task["target_type"] != "knowledge_unit":
            raise AppError(
                "review_target_not_supported",
                "Review target is not supported.",
                status_code=400,
            )
        conn.execute(
            "UPDATE review_tasks SET status = 'ignored', updated_at = ? WHERE id = ?",
            (timestamp, task_id),
        )
        conn.execute(
            "UPDATE knowledge_units SET status = 'archived', updated_at = ? WHERE id = ?",
            (timestamp, task["target_id"]),
        )
    return {"review_task_id": task_id, "target_id": task["target_id"], "status": "ignored"}


@router.post("/retrieval/evidence-only", response_model=EvidenceOnlyResponse)
def evidence_only(payload: EvidenceOnlyRequest) -> dict:
    return build_evidence_only_answer(
        payload.query,
        payload.project_id,
        payload.folder_id,
        payload.tag_ids,
    )


@router.post("/retrieval/preview", response_model=RetrievalPreviewResponse)
def retrieval_preview(payload: RetrievalPreviewRequest) -> dict:
    return build_retrieval_preview(
        payload.query,
        payload.project_id,
        payload.folder_id,
        payload.tag_ids,
    )


@router.get("/evidence-packs/{evidence_pack_id}", response_model=EvidencePackDetail)
def evidence_pack_detail(evidence_pack_id: str, focus_item_id: Optional[str] = None) -> dict:
    return get_evidence_pack(evidence_pack_id, focus_item_id)


@router.get(
    "/evidence-packs/{evidence_pack_id}/annotations",
    response_model=CitationAnnotationListResponse,
)
def evidence_pack_annotations(evidence_pack_id: str) -> dict:
    return list_citation_annotations(evidence_pack_id)


@router.post(
    "/evidence-packs/{evidence_pack_id}/annotations",
    response_model=CitationAnnotationRecord,
)
def create_evidence_pack_annotation(
    evidence_pack_id: str,
    payload: CitationAnnotationRequest,
) -> dict:
    return create_citation_annotation(
        evidence_pack_id=evidence_pack_id,
        evidence_item_id=payload.evidence_item_id,
        annotation_type=payload.annotation_type,
        content=payload.content,
    )


@router.patch(
    "/citation-annotations/{annotation_id}",
    response_model=CitationAnnotationRecord,
)
def patch_citation_annotation(
    annotation_id: str,
    payload: CitationAnnotationPatchRequest,
) -> dict:
    return update_citation_annotation(annotation_id, payload.annotation_type, payload.content)


@router.delete("/citation-annotations/{annotation_id}")
def remove_citation_annotation(annotation_id: str) -> dict:
    return delete_citation_annotation(annotation_id)


@router.post(
    "/evidence-packs/{evidence_pack_id}/compare",
    response_model=CitationCompareResponse,
)
def compare_evidence_pack_items(
    evidence_pack_id: str,
    payload: CitationCompareRequest,
) -> dict:
    return compare_evidence_items(evidence_pack_id, payload.evidence_item_ids)
