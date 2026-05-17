from __future__ import annotations

from fastapi import APIRouter

from app.api.schemas import AuthStatusResponse

router = APIRouter(prefix="/auth")


@router.get("/status", response_model=AuthStatusResponse)
def auth_status() -> dict:
    return {
        "auth_enabled": False,
        "disabled_reason": "auth_not_enabled_in_p0",
        "local_user": {"id": "local-user", "display_name": "Local User"},
    }
