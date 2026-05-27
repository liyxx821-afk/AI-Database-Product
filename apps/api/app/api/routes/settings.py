from __future__ import annotations

from fastapi import APIRouter

from app.api.schemas import (
    AIModelSettingsPatchRequest,
    AIModelSettingsResponse,
    AIModelTestResponse,
    SettingsPatchRequest,
    SettingsResponse,
)
from app.services.ai_model_settings import (
    delete_ai_model_key,
    get_ai_model_settings,
    test_ai_model_settings,
    update_ai_model_settings,
)
from app.services.settings import get_user_settings, update_user_settings

router = APIRouter(prefix="/settings")


@router.get("", response_model=SettingsResponse)
def get_settings_route() -> dict:
    return get_user_settings()


@router.patch("", response_model=SettingsResponse)
def patch_settings_route(payload: SettingsPatchRequest) -> dict:
    return update_user_settings(language=payload.language)


@router.get("/ai-model", response_model=AIModelSettingsResponse)
def get_ai_model_settings_route() -> dict:
    return get_ai_model_settings()


@router.patch("/ai-model", response_model=AIModelSettingsResponse)
def patch_ai_model_settings_route(payload: AIModelSettingsPatchRequest) -> dict:
    return update_ai_model_settings(
        provider=payload.provider,
        base_url=payload.base_url,
        text_model=payload.text_model,
        vision_model=payload.vision_model,
        endpoint=payload.endpoint,
        api_key=payload.api_key,
    )


@router.post("/ai-model:test", response_model=AIModelTestResponse)
def test_ai_model_settings_route() -> dict:
    return test_ai_model_settings()


@router.delete("/ai-model/key", response_model=AIModelSettingsResponse)
def delete_ai_model_key_route() -> dict:
    return delete_ai_model_key()
