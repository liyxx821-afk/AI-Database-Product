from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    app_name: str
    app_version: str
    bundle_id: str
    local_token: str
    app_data_dir: Path
    database_path: Path
    config_path: Path
    max_upload_bytes: int
    default_upload_part_size: int


def _default_data_dir() -> Path:
    if os.environ.get("KB_APP_DATA_DIR"):
        return Path(os.environ["KB_APP_DATA_DIR"]).expanduser().resolve()
    return (Path.home() / "Library" / "Application Support" / "KnowledgeBaseDev").resolve()


def get_settings() -> Settings:
    data_dir = _default_data_dir()
    return Settings(
        app_name="KnowledgeBaseDev",
        app_version="0.1.0-alpha",
        bundle_id="dev.local.knowledgebase",
        local_token=os.environ.get("KB_LOCAL_TOKEN", ""),
        app_data_dir=data_dir,
        database_path=data_dir / "knowledgebase-dev.sqlite3",
        config_path=data_dir / "config.json",
        max_upload_bytes=int(os.environ.get("KB_MAX_UPLOAD_BYTES", str(50 * 1024 * 1024))),
        default_upload_part_size=int(os.environ.get("KB_UPLOAD_PART_SIZE", str(4 * 1024 * 1024))),
    )
