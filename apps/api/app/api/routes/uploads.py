from __future__ import annotations

from collections.abc import Callable
from typing import Any

from fastapi import APIRouter, HTTPException, Request

from app.api.schemas import (
    FileRecord,
    ParseTaskRecord,
    UploadCreateRequest,
    UploadPartResponse,
    UploadSnapshot,
)
from app.services.parsing.file_parser import parse_file

try:
    from app.services.uploads.file_upload import (
        complete_upload,
        create_upload_task,
        get_file_record,
        get_upload_snapshot,
        list_files,
        store_upload_part,
        verify_file,
    )
except ModuleNotFoundError as exc:
    if exc.name not in {"app.services.uploads", "app.services.uploads.file_upload"}:
        raise

    def _uploads_unavailable(*_args: Any, **_kwargs: Any) -> None:
        raise HTTPException(status_code=503, detail="Upload service is unavailable in this build.")

    complete_upload: Callable[..., Any] = _uploads_unavailable
    create_upload_task: Callable[..., Any] = _uploads_unavailable
    get_file_record: Callable[..., Any] = _uploads_unavailable
    get_upload_snapshot: Callable[..., Any] = _uploads_unavailable
    list_files: Callable[..., Any] = _uploads_unavailable
    store_upload_part: Callable[..., Any] = _uploads_unavailable
    verify_file: Callable[..., Any] = _uploads_unavailable

router = APIRouter()


@router.post("/uploads", response_model=UploadSnapshot)
def create_upload(payload: UploadCreateRequest) -> dict:
    return create_upload_task(
        filename=payload.filename,
        size_bytes=payload.size_bytes,
        content_type=payload.content_type,
        sha256=payload.sha256,
        part_size=payload.part_size,
        project_id=payload.project_id,
    )


@router.put("/uploads/{upload_id}/parts/{part_no}", response_model=UploadPartResponse)
async def upload_part(upload_id: str, part_no: int, request: Request) -> dict:
    content = await request.body()
    return store_upload_part(upload_id, part_no, content)


@router.post("/uploads/{upload_id}:complete", response_model=UploadSnapshot)
def finish_upload(upload_id: str) -> dict:
    return complete_upload(upload_id)


@router.get("/uploads/{upload_id}", response_model=UploadSnapshot)
def get_upload(upload_id: str) -> dict:
    return get_upload_snapshot(upload_id)


@router.get("/files", response_model=list[FileRecord])
def get_files(project_id: str = "default-space") -> list[dict]:
    return list_files(project_id)


@router.get("/files/{file_id}", response_model=FileRecord)
def get_file(file_id: str) -> dict:
    return get_file_record(file_id)


@router.post("/files/{file_id}:verify", response_model=FileRecord)
def verify_stored_file(file_id: str) -> dict:
    return verify_file(file_id)


@router.post("/files/{file_id}:parse", response_model=ParseTaskRecord)
def parse_stored_file(file_id: str) -> dict:
    return parse_file(file_id)
