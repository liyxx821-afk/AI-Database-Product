from __future__ import annotations

from typing import Optional

from fastapi import APIRouter

from app.api.schemas import ParseTaskRecord, SourceDetail, SourceRecord
from app.services.organization import parse_tag_ids
from app.services.parsing.file_parser import get_parse_task, get_source, list_sources

router = APIRouter()


@router.get("/parse-tasks/{parse_task_id}", response_model=ParseTaskRecord)
def get_parse_task_snapshot(parse_task_id: str) -> dict:
    return get_parse_task(parse_task_id)


@router.get("/sources", response_model=list[SourceRecord])
def get_sources(
    project_id: str = "default-space",
    folder_id: Optional[str] = None,
    tag_ids: Optional[str] = None,
) -> list[dict]:
    return list_sources(project_id, folder_id, parse_tag_ids(tag_ids))


@router.get("/sources/{source_id}", response_model=SourceDetail)
def get_source_detail(source_id: str) -> dict:
    return get_source(source_id)
