from __future__ import annotations

from typing import Optional

from fastapi import APIRouter

from app.api.schemas import (
    GraphPreviewResponse,
    KnowledgeRelationCreateRequest,
    KnowledgeRelationDeleteResponse,
    KnowledgeRelationPatchRequest,
    KnowledgeRelationRecord,
)
from app.services.organization import parse_tag_ids
from app.services.relations import (
    archive_relation,
    create_relation,
    graph_preview,
    list_relations,
    update_relation,
)

router = APIRouter()


@router.get("/relations", response_model=list[KnowledgeRelationRecord])
def get_relations(
    project_id: str = "default-space",
    status: str = "confirmed",
    folder_id: Optional[str] = None,
    tag_ids: Optional[str] = None,
) -> list[dict]:
    return list_relations(
        project_id=project_id,
        status=status,
        folder_id=folder_id,
        tag_ids=parse_tag_ids(tag_ids),
    )


@router.post("/relations", response_model=KnowledgeRelationRecord)
def post_relation(payload: KnowledgeRelationCreateRequest) -> dict:
    return create_relation(
        project_id=payload.project_id,
        source_knowledge_unit_id=payload.source_knowledge_unit_id,
        target_knowledge_unit_id=payload.target_knowledge_unit_id,
        relation_type=payload.relation_type,
        description=payload.description,
    )


@router.patch("/relations/{relation_id}", response_model=KnowledgeRelationRecord)
def patch_relation(relation_id: str, payload: KnowledgeRelationPatchRequest) -> dict:
    return update_relation(
        relation_id,
        relation_type=payload.relation_type,
        description=payload.description,
        status=payload.status,
    )


@router.delete("/relations/{relation_id}", response_model=KnowledgeRelationDeleteResponse)
def delete_relation(relation_id: str) -> dict:
    return archive_relation(relation_id)


@router.get("/graph/preview", response_model=GraphPreviewResponse)
def get_graph_preview(
    project_id: str = "default-space",
    folder_id: Optional[str] = None,
    tag_ids: Optional[str] = None,
) -> dict:
    return graph_preview(
        project_id=project_id,
        folder_id=folder_id,
        tag_ids=parse_tag_ids(tag_ids),
    )
