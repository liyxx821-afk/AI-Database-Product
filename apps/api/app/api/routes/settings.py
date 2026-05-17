from __future__ import annotations

from fastapi import APIRouter

from app.api.schemas import SettingsPatchRequest, SettingsResponse
from app.services.settings import get_user_settings, update_user_settings

router = APIRouter(prefix="/settings")


@router.get("", response_model=SettingsResponse)
def get_settings_route() -> dict:
    return get_user_settings()


@router.patch("", response_model=SettingsResponse)
def patch_settings_route(payload: SettingsPatchRequest) -> dict:
    return update_user_settings(language=payload.language)
