from __future__ import annotations

from typing import Optional

from fastapi import APIRouter

from app.api.schemas import (
    FeedbackRequest,
    FeedbackResponse,
    MemoryDraftRecord,
    MemoryDraftRequest,
)
from app.services.retrieval.feedback_memory import (
    create_memory_draft,
    get_memory_draft,
    list_memory_drafts,
    submit_feedback,
)

router = APIRouter()


@router.post("/feedback", response_model=FeedbackResponse)
def submit_feedback_route(payload: FeedbackRequest) -> dict:
    return submit_feedback(payload)


@router.post("/memory-drafts", response_model=MemoryDraftRecord)
def create_memory_draft_route(payload: MemoryDraftRequest) -> dict:
    return create_memory_draft(payload)


@router.get("/memory-drafts", response_model=list[MemoryDraftRecord])
def list_memory_drafts_route(status: Optional[str] = None) -> list[dict]:
    return list_memory_drafts(status)


@router.get("/memory-drafts/{memory_id}", response_model=MemoryDraftRecord)
def get_memory_draft_route(memory_id: str) -> dict:
    return get_memory_draft(memory_id)
