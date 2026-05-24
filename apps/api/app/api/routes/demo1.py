from __future__ import annotations

from fastapi import APIRouter

from app.api.schemas import (
    Demo1IngestionCommitRequest,
    Demo1IngestionRequest,
    Demo1IngestionResult,
)
from app.services.demo1_ingestion import commit_ingestion, preview_ingestion

router = APIRouter()


@router.post("/demo1/ingestion:preview", response_model=Demo1IngestionResult)
def preview_demo1_ingestion(payload: Demo1IngestionRequest) -> dict:
    return preview_ingestion(payload)


@router.post("/demo1/ingestion:commit", response_model=Demo1IngestionResult)
def commit_demo1_ingestion(payload: Demo1IngestionCommitRequest) -> dict:
    return commit_ingestion(payload)
