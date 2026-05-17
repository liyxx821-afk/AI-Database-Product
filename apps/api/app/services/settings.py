from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.core.config import get_settings

DEFAULT_LANGUAGE = "zh-CN"
ALLOWED_LANGUAGES = {"zh-CN", "en-US"}
FEEDBACK_EXPORT_HISTORY_LIMIT = 20
FEEDBACK_EXPORT_HISTORY_KEY = "feedback_export_history"


def _config_path() -> Path:
    settings = get_settings()
    settings.app_data_dir.mkdir(parents=True, exist_ok=True)
    return settings.config_path


def _read_config() -> dict[str, Any]:
    path = _config_path()
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    return payload if isinstance(payload, dict) else {}


def _write_config(payload: dict[str, Any]) -> None:
    path = _config_path()
    tmp_path = path.with_suffix(".json.tmp")
    with tmp_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    tmp_path.replace(path)


def get_user_settings() -> dict[str, str | None]:
    payload = _read_config()
    language = payload.get("language")
    if language not in ALLOWED_LANGUAGES:
        language = DEFAULT_LANGUAGE
    updated_at = payload.get("updated_at")
    return {
        "language": language,
        "persistence": "config_json",
        "updated_at": updated_at if isinstance(updated_at, str) else None,
    }


def update_user_settings(*, language: str) -> dict[str, str | None]:
    payload = _read_config()
    payload["language"] = language
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    _write_config(payload)
    return get_user_settings()


def get_feedback_export_history() -> list[dict[str, Any]]:
    payload = _read_config()
    history = payload.get(FEEDBACK_EXPORT_HISTORY_KEY)
    if not isinstance(history, list):
        return []
    return [item for item in history[:FEEDBACK_EXPORT_HISTORY_LIMIT] if isinstance(item, dict)]


def append_feedback_export_history(record: dict[str, Any]) -> list[dict[str, Any]]:
    payload = _read_config()
    history = payload.get(FEEDBACK_EXPORT_HISTORY_KEY)
    existing = (
        [item for item in history if isinstance(item, dict)]
        if isinstance(history, list)
        else []
    )
    payload[FEEDBACK_EXPORT_HISTORY_KEY] = [record, *existing][:FEEDBACK_EXPORT_HISTORY_LIMIT]
    payload["feedback_export_history_updated_at"] = datetime.now(timezone.utc).isoformat()
    _write_config(payload)
    return get_feedback_export_history()


def delete_feedback_export_history(history_id: str) -> bool:
    payload = _read_config()
    history = payload.get(FEEDBACK_EXPORT_HISTORY_KEY)
    if not isinstance(history, list):
        return False
    kept = [
        item
        for item in history
        if not (isinstance(item, dict) and item.get("id") == history_id)
    ]
    deleted = len(kept) != len(history)
    if deleted:
        payload[FEEDBACK_EXPORT_HISTORY_KEY] = kept[:FEEDBACK_EXPORT_HISTORY_LIMIT]
        payload["feedback_export_history_updated_at"] = datetime.now(timezone.utc).isoformat()
        _write_config(payload)
    return deleted
