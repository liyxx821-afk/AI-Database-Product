from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Request

from app.api.schemas import (
    DiagnosticsResponse,
    HealthResponse,
    RuntimeResponse,
    SystemStatusResponse,
    WorkspaceSummaryResponse,
)
from app.core.config import get_settings
from app.db.sqlite import database_path, db, quick_check, sqlite_vec_status

router = APIRouter()


def _runtime() -> dict:
    settings = get_settings()
    vector = sqlite_vec_status()
    db_quick_check = quick_check()
    state = "ready" if db_quick_check == "ok" else "recovery_required"
    if vector["status"] != "available" and state == "ready":
        state = "degraded"
    return {
        "runtime_state": state,
        "status_reason": vector["fallback_reason"] if state == "degraded" else None,
        "sidecar": {"pid": None, "url": "managed_by_electron_main", "health": "available"},
        "database": {"path": str(settings.database_path), "quick_check": db_quick_check},
        "worker": {"status": "available", "heartbeat_at": datetime.now(timezone.utc).isoformat()},
        "vector": vector,
    }


@router.get("/health", response_model=HealthResponse)
def health(request: Request) -> dict:
    settings = get_settings()
    return {
        "ok": True,
        "app_name": settings.app_name,
        "version": settings.app_version,
        "request_id": request.state.request_id,
    }


@router.get("/system/runtime", response_model=RuntimeResponse)
def system_runtime() -> dict:
    return _runtime()


@router.get("/system/status", response_model=SystemStatusResponse)
def system_status() -> dict:
    settings = get_settings()
    vector = sqlite_vec_status()
    return {
        "app": {
            "name": settings.app_name,
            "version": settings.app_version,
            "bundle_id": settings.bundle_id,
        },
        "database": {
            "path": str(database_path()),
            "quick_check": quick_check(),
            "migration_state": "ready",
        },
        "provider": {
            "required_providers_loaded": True,
            "optional_providers": {
                "ocr": "unavailable",
                "asr": "unavailable",
                "reranker": "unavailable",
                "llm": "unavailable",
            },
        },
        "vector": vector,
    }


@router.post("/system/diagnostics:export", response_model=DiagnosticsResponse)
def export_diagnostics() -> dict:
    runtime = _runtime()
    return {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "redacted": True,
        "includes_source_text": False,
        "summary": {
            "runtime_state": runtime["runtime_state"],
            "database_quick_check": runtime["database"]["quick_check"],
            "vector_status": runtime["vector"]["status"],
        },
    }


@router.get("/workspace/summary", response_model=WorkspaceSummaryResponse)
def workspace_summary() -> dict:
    with db() as conn:
        counts = {}
        for key, table in {
            "project_count": "projects",
            "upload_count": "upload_tasks",
            "file_count": "files",
            "pending_file_count": "files WHERE inspection_status != 'completed'",
            "source_count": "sources",
            "chunk_count": "chunks",
            "knowledge_unit_count": "knowledge_units",
            "pending_review_count": "review_tasks WHERE status = 'pending_review'",
            "evidence_pack_count": "evidence_packs",
        }.items():
            counts[key] = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    return counts
