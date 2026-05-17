from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query

from app.api.schemas import (
    FeedbackDiagnosticsExportResponse,
    FeedbackDiagnosticsSummary,
    FeedbackEventRecord,
    FeedbackExportFormat,
    FeedbackExportHistoryRecord,
    FeedbackRankingEffect,
    FeedbackRequest,
    FeedbackResponse,
    FeedbackSortOrder,
    FeedbackType,
    MemoryDraftRecord,
    MemoryDraftRequest,
)
from app.services.retrieval.feedback_memory import (
    create_memory_draft,
    export_feedback_diagnostics,
    feedback_summary,
    get_memory_draft,
    list_feedback_events,
    list_feedback_export_history,
    list_memory_drafts,
    remove_feedback_export_history,
    submit_feedback,
)

router = APIRouter()
EXPORT_FORMAT_QUERY = Query(default="json", alias="format")


@router.post("/feedback", response_model=FeedbackResponse)
def submit_feedback_route(payload: FeedbackRequest) -> dict:
    return submit_feedback(payload)


@router.get("/feedback", response_model=list[FeedbackEventRecord])
def list_feedback_events_route(
    feedback_type: Optional[FeedbackType] = None,
    target_type: Optional[str] = None,
    evidence_pack_id: Optional[str] = None,
    ai_answer_id: Optional[str] = None,
    evidence_item_id: Optional[str] = None,
    created_from: Optional[str] = None,
    created_to: Optional[str] = None,
    search: Optional[str] = None,
    ranking_effect: Optional[FeedbackRankingEffect] = None,
    has_comment: Optional[bool] = None,
    sort: FeedbackSortOrder = "created_desc",
    limit: int = 50,
) -> list[dict]:
    return list_feedback_events(
        feedback_type=feedback_type,
        target_type=target_type,
        evidence_pack_id=evidence_pack_id,
        ai_answer_id=ai_answer_id,
        evidence_item_id=evidence_item_id,
        created_from=created_from,
        created_to=created_to,
        search=search,
        ranking_effect=ranking_effect,
        has_comment=has_comment,
        sort=sort,
        limit=limit,
    )


@router.get("/feedback/summary", response_model=FeedbackDiagnosticsSummary)
def feedback_summary_route(
    feedback_type: Optional[FeedbackType] = None,
    target_type: Optional[str] = None,
    evidence_pack_id: Optional[str] = None,
    ai_answer_id: Optional[str] = None,
    evidence_item_id: Optional[str] = None,
    created_from: Optional[str] = None,
    created_to: Optional[str] = None,
    search: Optional[str] = None,
    ranking_effect: Optional[FeedbackRankingEffect] = None,
    has_comment: Optional[bool] = None,
    sort: FeedbackSortOrder = "created_desc",
) -> dict:
    return feedback_summary(
        feedback_type=feedback_type,
        target_type=target_type,
        evidence_pack_id=evidence_pack_id,
        ai_answer_id=ai_answer_id,
        evidence_item_id=evidence_item_id,
        created_from=created_from,
        created_to=created_to,
        search=search,
        ranking_effect=ranking_effect,
        has_comment=has_comment,
        sort=sort,
    )


@router.get("/feedback/export", response_model=FeedbackDiagnosticsExportResponse)
def export_feedback_diagnostics_route(
    export_format: FeedbackExportFormat = EXPORT_FORMAT_QUERY,
    feedback_type: Optional[FeedbackType] = None,
    target_type: Optional[str] = None,
    evidence_pack_id: Optional[str] = None,
    ai_answer_id: Optional[str] = None,
    evidence_item_id: Optional[str] = None,
    created_from: Optional[str] = None,
    created_to: Optional[str] = None,
    search: Optional[str] = None,
    ranking_effect: Optional[FeedbackRankingEffect] = None,
    has_comment: Optional[bool] = None,
    sort: FeedbackSortOrder = "created_desc",
    limit: int = 50,
) -> dict:
    return export_feedback_diagnostics(
        export_format=export_format,
        feedback_type=feedback_type,
        target_type=target_type,
        evidence_pack_id=evidence_pack_id,
        ai_answer_id=ai_answer_id,
        evidence_item_id=evidence_item_id,
        created_from=created_from,
        created_to=created_to,
        search=search,
        ranking_effect=ranking_effect,
        has_comment=has_comment,
        sort=sort,
        limit=limit,
    )


@router.get("/feedback/export-history", response_model=list[FeedbackExportHistoryRecord])
def list_feedback_export_history_route() -> list[dict]:
    return list_feedback_export_history()


@router.delete("/feedback/export-history/{history_id}")
def delete_feedback_export_history_route(history_id: str) -> dict:
    return remove_feedback_export_history(history_id)


@router.post("/memory-drafts", response_model=MemoryDraftRecord)
def create_memory_draft_route(payload: MemoryDraftRequest) -> dict:
    return create_memory_draft(payload)


@router.get("/memory-drafts", response_model=list[MemoryDraftRecord])
def list_memory_drafts_route(status: Optional[str] = None) -> list[dict]:
    return list_memory_drafts(status)


@router.get("/memory-drafts/{memory_id}", response_model=MemoryDraftRecord)
def get_memory_draft_route(memory_id: str) -> dict:
    return get_memory_draft(memory_id)
