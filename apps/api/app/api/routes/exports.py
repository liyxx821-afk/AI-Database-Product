from __future__ import annotations

from fastapi import APIRouter

from app.api.schemas import (
    KnowledgeExportHistoryRecord,
    KnowledgeExportResponse,
    KnowledgeUnitExportRequest,
    ProjectExportRequest,
)
from app.services.exports import (
    export_knowledge_units,
    export_project,
    list_knowledge_export_history,
    remove_knowledge_export_history,
)

router = APIRouter()


@router.post("/exports/knowledge-units", response_model=KnowledgeExportResponse)
def post_knowledge_unit_export(payload: KnowledgeUnitExportRequest) -> dict:
    return export_knowledge_units(payload)


@router.post("/exports/project", response_model=KnowledgeExportResponse)
def post_project_export(payload: ProjectExportRequest) -> dict:
    return export_project(payload)


@router.get("/exports/history", response_model=list[KnowledgeExportHistoryRecord])
def list_knowledge_export_history_route() -> list[dict]:
    return list_knowledge_export_history()


@router.delete("/exports/history/{history_id}")
def delete_knowledge_export_history_route(history_id: str) -> dict:
    return remove_knowledge_export_history(history_id)
