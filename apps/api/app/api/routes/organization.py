from __future__ import annotations

from typing import Optional

from fastapi import APIRouter

from app.api.schemas import (
    FolderCreateRequest,
    FolderRecord,
    KnowledgeUnitOrganizationBatchUpdateRequest,
    OrganizationBatchUpdateResponse,
    OrganizationUpdateRequest,
    OrganizationUpdateResponse,
    ProjectCreateRequest,
    ProjectRecord,
    SourceOrganizationBatchUpdateRequest,
    TagCreateRequest,
    TagRecord,
)
from app.services.organization import (
    create_folder,
    create_project,
    create_tag,
    list_folders,
    list_projects,
    list_tags,
    update_knowledge_unit_organization,
    update_knowledge_units_organization_batch,
    update_source_organization,
    update_sources_organization_batch,
)

router = APIRouter()


@router.get("/projects", response_model=list[ProjectRecord])
def get_projects() -> list[dict]:
    return list_projects()


@router.post("/projects", response_model=ProjectRecord)
def post_project(payload: ProjectCreateRequest) -> dict:
    return create_project(
        name=payload.name,
        description=payload.description,
        parent_id=payload.parent_id,
        kb_type=payload.kb_type,
    )


@router.get("/folders", response_model=list[FolderRecord])
def get_folders(
    project_id: str = "default-space",
    parent_id: Optional[str] = None,
) -> list[dict]:
    return list_folders(project_id=project_id, parent_id=parent_id)


@router.post("/folders", response_model=FolderRecord)
def post_folder(payload: FolderCreateRequest) -> dict:
    return create_folder(
        project_id=payload.project_id,
        parent_id=payload.parent_id,
        name=payload.name,
    )


@router.get("/tags", response_model=list[TagRecord])
def get_tags(
    project_id: str = "default-space",
    namespace: Optional[str] = None,
) -> list[dict]:
    return list_tags(project_id=project_id, namespace=namespace)


@router.post("/tags", response_model=TagRecord)
def post_tag(payload: TagCreateRequest) -> dict:
    return create_tag(
        project_id=payload.project_id,
        name=payload.name,
        namespace=payload.namespace,
        tag_type=payload.tag_type,
        description=payload.description,
    )


@router.patch("/sources/{source_id}/organization", response_model=OrganizationUpdateResponse)
def patch_source_organization(
    source_id: str,
    payload: OrganizationUpdateRequest,
) -> dict:
    return update_source_organization(source_id, payload.folder_id, payload.tag_ids)


@router.patch("/sources/organization:batch", response_model=OrganizationBatchUpdateResponse)
def patch_sources_organization_batch(
    payload: SourceOrganizationBatchUpdateRequest,
) -> dict:
    return update_sources_organization_batch(
        payload.source_ids,
        payload.folder_id,
        payload.tag_ids,
    )


@router.patch(
    "/knowledge-units/{knowledge_unit_id}/organization",
    response_model=OrganizationUpdateResponse,
)
def patch_knowledge_unit_organization(
    knowledge_unit_id: str,
    payload: OrganizationUpdateRequest,
) -> dict:
    return update_knowledge_unit_organization(
        knowledge_unit_id,
        payload.folder_id,
        payload.tag_ids,
    )


@router.patch(
    "/knowledge-units/organization:batch",
    response_model=OrganizationBatchUpdateResponse,
)
def patch_knowledge_units_organization_batch(
    payload: KnowledgeUnitOrganizationBatchUpdateRequest,
) -> dict:
    return update_knowledge_units_organization_batch(
        payload.knowledge_unit_ids,
        payload.folder_id,
        payload.tag_ids,
    )
