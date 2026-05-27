from __future__ import annotations

import base64
import ctypes
import json
import os
import urllib.error
from ctypes import wintypes
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from app.core.config import get_settings
from app.core.errors import AppError

DEFAULT_AI_PROVIDER = "dashscope"
DEFAULT_AI_PROVIDER_LABEL = "DashScope / Alibaba Bailian"
DEFAULT_AI_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
DEFAULT_AI_TEXT_MODEL = "qwen-plus"
DEFAULT_AI_VISION_MODEL = "qwen-vl-ocr-latest"
DEFAULT_AI_ENDPOINT = "chat_completions"
AI_MODEL_CONFIG_KEY = "ai_model"


def get_ai_model_settings() -> dict[str, Any]:
    config = _read_ai_model_config()
    key_source = _key_source()
    return {
        "provider": config["provider"],
        "provider_label": config["provider_label"],
        "base_url": config["base_url"],
        "text_model": config["text_model"],
        "vision_model": config["vision_model"],
        "endpoint": config["endpoint"],
        "key_status": "configured" if key_source != "none" else "missing",
        "key_source": key_source,
        "storage_status": _storage_status(),
        "last_test": config.get("last_test"),
        "updated_at": config.get("updated_at"),
    }


def update_ai_model_settings(
    *,
    provider: Optional[str] = None,
    base_url: Optional[str] = None,
    text_model: Optional[str] = None,
    vision_model: Optional[str] = None,
    endpoint: Optional[str] = None,
    api_key: Optional[str] = None,
) -> dict[str, Any]:
    payload = _read_config()
    current = _read_ai_model_config(payload)
    current.update(
        {
            "provider": _clean_setting(provider, current["provider"]),
            "provider_label": DEFAULT_AI_PROVIDER_LABEL,
            "base_url": _clean_base_url(base_url, current["base_url"]),
            "text_model": _clean_setting(text_model, current["text_model"]),
            "vision_model": _clean_setting(vision_model, current["vision_model"]),
            "endpoint": _clean_endpoint(endpoint, current["endpoint"]),
            "updated_at": _now(),
        }
    )
    payload[AI_MODEL_CONFIG_KEY] = current
    _write_config(payload)

    if api_key is not None:
        trimmed_key = api_key.strip()
        if trimmed_key:
            save_encrypted_api_key(trimmed_key)

    return get_ai_model_settings()


def delete_ai_model_key() -> dict[str, Any]:
    key_path = _encrypted_key_path()
    if key_path.exists():
        key_path.unlink()
    return get_ai_model_settings()


def configured_ai_model_runtime() -> dict[str, str]:
    saved = _read_ai_model_config()
    saved_key = load_encrypted_api_key()
    base_url = (
        os.environ.get("KB_AI_BASE_URL")
        or os.environ.get("OPENAI_BASE_URL")
        or saved["base_url"]
        or DEFAULT_AI_BASE_URL
    ).strip().rstrip("/")
    endpoint = (os.environ.get("KB_AI_ENDPOINT") or saved["endpoint"] or "").strip()
    if not endpoint:
        endpoint = "responses" if "api.openai.com" in base_url else DEFAULT_AI_ENDPOINT
    return {
        "api_key": (
            os.environ.get("KB_AI_API_KEY")
            or os.environ.get("OPENAI_API_KEY")
            or saved_key
            or ""
        ).strip(),
        "base_url": base_url,
        "model": (
            os.environ.get("KB_AI_MODEL")
            or os.environ.get("OPENAI_MODEL")
            or saved["text_model"]
            or DEFAULT_AI_TEXT_MODEL
        ).strip(),
        "vision_model": (
            os.environ.get("KB_AI_VISION_MODEL")
            or saved["vision_model"]
            or DEFAULT_AI_VISION_MODEL
        ).strip(),
        "endpoint": endpoint,
    }


def test_ai_model_settings() -> dict[str, Any]:
    from app.services import demo1_ingestion

    config = configured_ai_model_runtime()
    if not config["api_key"]:
        raise AppError(
            "model_key_missing",
            "DashScope API Key is not configured.",
            status_code=409,
        )

    text_status = _test_text_model(demo1_ingestion, config)
    vision_status = _test_vision_model(demo1_ingestion, config)
    result = {
        "tested_at": _now(),
        "provider": DEFAULT_AI_PROVIDER,
        "base_url": config["base_url"],
        "text_model": config["model"],
        "vision_model": config["vision_model"],
        "endpoint": config["endpoint"],
        "text_model_status": text_status["status"],
        "vision_model_status": vision_status["status"],
        "ok": text_status["status"] == "available" and vision_status["status"] == "available",
        "error_code": text_status.get("error_code") or vision_status.get("error_code"),
        "error_message": text_status.get("error_message") or vision_status.get("error_message"),
    }
    _persist_last_test(result)
    return result


def save_encrypted_api_key(api_key: str) -> None:
    if os.name != "nt":
        raise AppError(
            "model_secret_storage_unavailable",
            "Encrypted local model key storage currently requires Windows DPAPI.",
            status_code=409,
        )
    encrypted = _dpapi_protect(api_key.encode("utf-8"))
    key_path = _encrypted_key_path()
    key_path.parent.mkdir(parents=True, exist_ok=True)
    with key_path.open("w", encoding="utf-8") as handle:
        json.dump(
            {
                "version": 1,
                "provider": DEFAULT_AI_PROVIDER,
                "storage": "windows_dpapi",
                "ciphertext": base64.b64encode(encrypted).decode("ascii"),
                "updated_at": _now(),
            },
            handle,
            ensure_ascii=False,
            indent=2,
        )
        handle.write("\n")


def load_encrypted_api_key() -> str:
    key_path = _encrypted_key_path()
    if not key_path.exists() or os.name != "nt":
        return ""
    try:
        with key_path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
        ciphertext = payload.get("ciphertext")
        if not isinstance(ciphertext, str) or not ciphertext:
            return ""
        return _dpapi_unprotect(base64.b64decode(ciphertext)).decode("utf-8").strip()
    except (OSError, ValueError, json.JSONDecodeError):
        return ""


def _test_text_model(demo1_ingestion: Any, config: dict[str, str]) -> dict[str, str]:
    prompt = (
        "请只返回严格 JSON：{\"ok\": true, \"message\": \"pong\"}。"
        "不要输出 Markdown，不要输出解释。"
    )
    try:
        payload = (
            demo1_ingestion.call_responses_api(config, prompt)
            if config["endpoint"] == "responses"
            else demo1_ingestion.call_chat_completions_api(config, prompt)
        )
        text = demo1_ingestion.extract_model_text(payload, config["endpoint"])
        demo1_ingestion.parse_model_json(text)
    except urllib.error.HTTPError as error:
        return {
            "status": "error",
            "error_code": "model_text_http_error",
            "error_message": f"Text model returned HTTP {error.code}.",
        }
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError) as error:
        return {
            "status": "error",
            "error_code": "model_text_test_failed",
            "error_message": str(error),
        }
    return {"status": "available"}


def _test_vision_model(demo1_ingestion: Any, config: dict[str, str]) -> dict[str, str]:
    vision_config = {**config, "model": config["vision_model"], "endpoint": DEFAULT_AI_ENDPOINT}
    try:
        demo1_ingestion.call_vision_ocr_model(
            vision_config,
            file_bytes=_tiny_png_bytes(),
            mime_type="image/png",
        )
    except urllib.error.HTTPError as error:
        return {
            "status": "error",
            "error_code": "model_vision_http_error",
            "error_message": f"OCR model returned HTTP {error.code}.",
        }
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError) as error:
        return {
            "status": "error",
            "error_code": "model_vision_test_failed",
            "error_message": str(error),
        }
    return {"status": "available"}


def _persist_last_test(result: dict[str, Any]) -> None:
    payload = _read_config()
    model_config = _read_ai_model_config(payload)
    model_config["last_test"] = {
        key: result.get(key)
        for key in (
            "tested_at",
            "text_model_status",
            "vision_model_status",
            "ok",
            "error_code",
            "error_message",
        )
    }
    model_config["updated_at"] = _now()
    payload[AI_MODEL_CONFIG_KEY] = model_config
    _write_config(payload)


def _read_ai_model_config(payload: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    source = payload if payload is not None else _read_config()
    config = source.get(AI_MODEL_CONFIG_KEY)
    config = config if isinstance(config, dict) else {}
    updated_at = config.get("updated_at")
    return {
        "provider": _clean_setting(config.get("provider"), DEFAULT_AI_PROVIDER),
        "provider_label": DEFAULT_AI_PROVIDER_LABEL,
        "base_url": _clean_base_url(config.get("base_url"), DEFAULT_AI_BASE_URL),
        "text_model": _clean_setting(config.get("text_model"), DEFAULT_AI_TEXT_MODEL),
        "vision_model": _clean_setting(config.get("vision_model"), DEFAULT_AI_VISION_MODEL),
        "endpoint": _clean_endpoint(config.get("endpoint"), DEFAULT_AI_ENDPOINT),
        "last_test": config.get("last_test") if isinstance(config.get("last_test"), dict) else None,
        "updated_at": updated_at if isinstance(updated_at, str) else None,
    }


def _read_config() -> dict[str, Any]:
    path = get_settings().config_path
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    return payload if isinstance(payload, dict) else {}


def _write_config(payload: dict[str, Any]) -> None:
    settings = get_settings()
    settings.app_data_dir.mkdir(parents=True, exist_ok=True)
    tmp_path = settings.config_path.with_suffix(".json.tmp")
    with tmp_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    tmp_path.replace(settings.config_path)


def _encrypted_key_path() -> Path:
    return get_settings().app_data_dir / "secrets" / "ai_model_key.dpapi.json"


def _key_source() -> str:
    if os.environ.get("KB_AI_API_KEY") or os.environ.get("OPENAI_API_KEY"):
        return "environment"
    if load_encrypted_api_key():
        return "encrypted_local"
    return "none"


def _storage_status() -> str:
    return "windows_dpapi" if os.name == "nt" else "unavailable"


def _clean_setting(value: Any, fallback: str) -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return fallback


def _clean_base_url(value: Any, fallback: str) -> str:
    return _clean_setting(value, fallback).rstrip("/")


def _clean_endpoint(value: Any, fallback: str) -> str:
    endpoint = _clean_setting(value, fallback)
    return endpoint if endpoint in {"chat_completions", "responses"} else fallback


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _tiny_png_bytes() -> bytes:
    return base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8BQDwAFgwJ/"
        "lqNqNwAAAABJRU5ErkJggg=="
    )


class _DataBlob(ctypes.Structure):
    _fields_ = [
        ("cbData", wintypes.DWORD),
        ("pbData", ctypes.POINTER(ctypes.c_byte)),
    ]


def _dpapi_protect(data: bytes) -> bytes:
    in_buffer = ctypes.create_string_buffer(data)
    in_blob = _DataBlob(len(data), ctypes.cast(in_buffer, ctypes.POINTER(ctypes.c_byte)))
    out_blob = _DataBlob()
    if not ctypes.windll.crypt32.CryptProtectData(
        ctypes.byref(in_blob),
        None,
        None,
        None,
        None,
        0,
        ctypes.byref(out_blob),
    ):
        raise AppError("model_secret_encrypt_failed", "Windows DPAPI encryption failed.", 500)
    try:
        return ctypes.string_at(out_blob.pbData, out_blob.cbData)
    finally:
        ctypes.windll.kernel32.LocalFree(out_blob.pbData)


def _dpapi_unprotect(data: bytes) -> bytes:
    in_buffer = ctypes.create_string_buffer(data)
    in_blob = _DataBlob(len(data), ctypes.cast(in_buffer, ctypes.POINTER(ctypes.c_byte)))
    out_blob = _DataBlob()
    if not ctypes.windll.crypt32.CryptUnprotectData(
        ctypes.byref(in_blob),
        None,
        None,
        None,
        None,
        0,
        ctypes.byref(out_blob),
    ):
        raise ValueError("Windows DPAPI decryption failed.")
    try:
        return ctypes.string_at(out_blob.pbData, out_blob.cbData)
    finally:
        ctypes.windll.kernel32.LocalFree(out_blob.pbData)
