from __future__ import annotations

from typing import Optional

from fastapi import APIRouter

from app.api.schemas import (
    KnowledgeExtractRequest,
    KnowledgeExtractResponse,
    KnowledgeUnitDetail,
    KnowledgeUnitRecord,
)
from app.services.knowledge.extraction import (
    extract_candidates_from_source,
    get_knowledge_unit,
    list_knowledge_units,
)
from app.services.organization import parse_tag_ids

router = APIRouter()


@router.post("/knowledge-units:extract", response_model=KnowledgeExtractResponse)
def extract_knowledge_units(payload: KnowledgeExtractRequest) -> dict:
    return extract_candidates_from_source(payload.source_id, payload.project_id, payload.force)


@router.get("/knowledge-units", response_model=list[KnowledgeUnitRecord])
def get_knowledge_units(
    project_id: str = "default-space",
    status: Optional[str] = None,
    folder_id: Optional[str] = None,
    tag_ids: Optional[str] = None,
) -> list[dict]:
    return list_knowledge_units(project_id, status, folder_id, parse_tag_ids(tag_ids))


@router.get("/knowledge-units/{knowledge_unit_id}", response_model=KnowledgeUnitDetail)
def get_knowledge_unit_detail(knowledge_unit_id: str) -> dict:
    return get_knowledge_unit(knowledge_unit_id)
