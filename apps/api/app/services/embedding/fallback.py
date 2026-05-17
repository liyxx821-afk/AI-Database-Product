from __future__ import annotations

import hashlib
import sqlite3
import uuid
from datetime import datetime, timezone

from app.db.sqlite import json_dumps

MOCK_FIXED_PROFILE = "mock_fixed_384"
MOCK_FIXED_DIMENSION = 384


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def create_mock_vector(text: str) -> list[float]:
    seed = hashlib.sha256(text.encode("utf-8")).digest()
    vector: list[float] = []
    counter = 0
    while len(vector) < MOCK_FIXED_DIMENSION:
        block = hashlib.sha256(seed + counter.to_bytes(4, "big")).digest()
        for byte in block:
            vector.append(round((byte / 127.5) - 1.0, 6))
            if len(vector) == MOCK_FIXED_DIMENSION:
                break
        counter += 1
    return vector


def ensure_mock_embedding(
    conn: sqlite3.Connection,
    *,
    owner_type: str,
    owner_id: str,
    text: str,
    timestamp: str | None = None,
) -> str:
    existing = conn.execute(
        """
        SELECT id FROM embeddings
        WHERE owner_type = ? AND owner_id = ? AND embedding_profile = ?
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (owner_type, owner_id, MOCK_FIXED_PROFILE),
    ).fetchone()
    if existing:
        return existing["id"]

    embedding_id = new_id("emb")
    conn.execute(
        """
        INSERT INTO embeddings
          (id, owner_type, owner_id, embedding_profile, dimension,
           vector_json, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'fallback', ?)
        """,
        (
            embedding_id,
            owner_type,
            owner_id,
            MOCK_FIXED_PROFILE,
            MOCK_FIXED_DIMENSION,
            json_dumps(create_mock_vector(text)),
            timestamp or now_iso(),
        ),
    )
    return embedding_id
