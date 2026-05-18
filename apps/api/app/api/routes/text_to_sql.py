from __future__ import annotations

from fastapi import APIRouter

from app.api.schemas import TextToSqlPreviewRequest, TextToSqlPreviewResponse
from app.services.text_to_sql import preview_text_to_sql

router = APIRouter(prefix="/text-to-sql")


@router.post("/preview", response_model=TextToSqlPreviewResponse)
def text_to_sql_preview(payload: TextToSqlPreviewRequest) -> dict:
    return preview_text_to_sql(
        query=payload.query,
        project_id=payload.project_id,
        folder_id=payload.folder_id,
        tag_ids=payload.tag_ids,
        limit=payload.limit,
    )
