from __future__ import annotations

from fastapi import APIRouter

from app.api.schemas import (
    KnowledgeExportResponse,
    KnowledgeUnitExportRequest,
    ProjectExportRequest,
)
from app.services.exports import export_knowledge_units, export_project

router = APIRouter()


@router.post("/exports/knowledge-units", response_model=KnowledgeExportResponse)
def post_knowledge_unit_export(payload: KnowledgeUnitExportRequest) -> dict:
    return export_knowledge_units(payload)


@router.post("/exports/project", response_model=KnowledgeExportResponse)
def post_project_export(payload: ProjectExportRequest) -> dict:
    return export_project(payload)
