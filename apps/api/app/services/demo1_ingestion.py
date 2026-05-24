from __future__ import annotations

import hashlib
import json
import os
import re
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from app.core.errors import AppError
from app.db.sqlite import db, json_dumps

DEMO1_PROFILE = "demo1_model_ingestion_preprocess_v1"
SYSTEM_TAGS = ["#demo1", "#入库预处理", "#candidate-ku", "#pending"]
PIPELINE_STEPS = [
    ("received", "资料进入系统"),
    ("source_created", "创建 source 来源记录"),
    ("parsed", "内容解析为原始输入文本"),
    ("cleaned", "执行基础文本清洗"),
    ("chunked", "按 400 字切片并保留 50 字 overlap"),
    ("candidate_generated", "调用外部模型生成 pending Candidate KU"),
    ("completed", "预处理链路完成"),
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def preview_ingestion(payload: Any) -> dict[str, Any]:
    return build_preview(
        file_name=payload.file_name,
        input_type=payload.input_type,
        raw_text=payload.raw_text,
        project_id=payload.project_id,
        commit_status="preview_only",
    )


def commit_ingestion(payload: Any) -> dict[str, Any]:
    if payload.preview_result is not None:
        result = payload.preview_result.model_dump()
        project_id = payload.project_id
    elif payload.file_name and payload.raw_text:
        result = build_preview(
            file_name=payload.file_name,
            input_type=payload.input_type,
            raw_text=payload.raw_text,
            project_id=payload.project_id,
            commit_status="preview_only",
        )
        project_id = payload.project_id
    else:
        raise AppError(
            "demo1_commit_payload_missing",
            "Commit requires either preview_result or file_name/raw_text.",
            status_code=422,
        )

    if not result["candidate_knowledge_units"]:
        raise AppError(
            "demo1_model_analysis_unavailable",
            "Candidate KU cannot be committed because model analysis is unavailable.",
            status_code=409,
        )

    timestamp = now_iso()
    job_id = new_id("job")
    trace_id = new_id("trace")
    review_task_ids: list[str] = []
    source = result["source"]
    cleaning = result["cleaning"]
    chunks = result["chunks"]
    candidates = result["candidate_knowledge_units"]

    with db() as conn:
        conn.execute(
            """
            INSERT INTO processing_jobs
              (id, job_type, status, trace_id, payload_json, result_json, created_at, updated_at)
            VALUES (?, 'demo1_ingestion_commit', 'running', ?, ?, '{}', ?, ?)
            """,
            (
                job_id,
                trace_id,
                json_dumps(
                    {
                        "source_id": source["source_id"],
                        "file_name": source["file_name"],
                        "project_id": project_id,
                        "profile": DEMO1_PROFILE,
                    }
                ),
                timestamp,
                timestamp,
            ),
        )
        insert_event(
            conn,
            job_id,
            1,
            "received",
            "Demo 1 commit received.",
            result["received_file"],
        )

        content_hash = hashlib.sha256(cleaning["content"].encode("utf-8")).hexdigest()
        conn.execute(
            """
            INSERT INTO sources
              (id, project_id, title, source_type, source_origin,
               content_hash, metadata_json, created_at)
            VALUES (?, ?, ?, 'text', 'demo1_text_input', ?, ?, ?)
            """,
            (
                source["source_id"],
                project_id,
                source["file_name"],
                content_hash,
                json_dumps(
                    {
                        "input_type": source["input_type"],
                        "raw_text_length": source["raw_text_length"],
                        "clean_text_length": source["clean_text_length"],
                        "chunk_count": source["chunk_count"],
                        "candidate_ku_count": source["candidate_ku_count"],
                        "ingestion_profile": DEMO1_PROFILE,
                        "trace_id": trace_id,
                    }
                ),
                timestamp,
            ),
        )
        insert_event(conn, job_id, 2, "source_created", "Source record created.", source)

        for chunk in chunks:
            conn.execute(
                """
                INSERT INTO chunks
                  (id, source_id, project_id, content, chunk_index,
                   citation_label, metadata_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    chunk["chunk_id"],
                    chunk["source_id"],
                    project_id,
                    chunk["content"],
                    chunk["chunk_index"],
                    f"{source['file_name']} · chunk {chunk['chunk_index']}",
                    json_dumps(
                        {
                            "chunk_type": chunk["chunk_type"],
                            "char_count": chunk["char_count"],
                            "start_offset": chunk["start_offset"],
                            "end_offset": chunk["end_offset"],
                            "chunk_strategy": "fixed_400_chars_overlap_50",
                            "ingestion_profile": DEMO1_PROFILE,
                            "trace_id": trace_id,
                        }
                    ),
                    timestamp,
                ),
            )
            conn.execute(
                """
                INSERT INTO chunks_fts (content, chunk_id, source_id, knowledge_unit_id)
                VALUES (?, ?, ?, '')
                """,
                (chunk["content"], chunk["chunk_id"], chunk["source_id"]),
            )
        insert_event(
            conn,
            job_id,
            3,
            "chunked",
            "Chunk records created.",
            {"chunk_ids": [chunk["chunk_id"] for chunk in chunks]},
        )

        for candidate in candidates:
            chunk_content = next(
                (
                    chunk["content"]
                    for chunk in chunks
                    if chunk["chunk_id"] == candidate["chunk_id"]
                ),
                "",
            )
            conn.execute(
                """
                INSERT INTO knowledge_units
                  (id, source_id, chunk_id, project_id, title, type, content, status,
                   user_verified, metadata_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'claim', ?, 'pending_review', 0, ?, ?, ?)
                """,
                (
                    candidate["ku_id"],
                    candidate["source_id"],
                    candidate["chunk_id"],
                    project_id,
                    candidate["title"],
                    candidate["summary"] or chunk_content,
                    json_dumps(
                        {
                            "summary": candidate["summary"],
                            "keywords": candidate["keywords"],
                            "tags": candidate["tags"],
                            "confidence": candidate["confidence"],
                            "quality_note": candidate["quality_note"],
                            "content_type": candidate["content_type"],
                            "source_id": candidate["source_id"],
                            "chunk_id": candidate["chunk_id"],
                            "extraction_profile": DEMO1_PROFILE,
                            "extraction_method": "openai_compatible_chat_completion",
                            "llm_used": True,
                            "trace_id": trace_id,
                        }
                    ),
                    timestamp,
                    timestamp,
                ),
            )
            conn.execute(
                """
                UPDATE chunks_fts
                SET knowledge_unit_id = ?
                WHERE chunk_id = ? AND (knowledge_unit_id = '' OR knowledge_unit_id IS NULL)
                """,
                (candidate["ku_id"], candidate["chunk_id"]),
            )

            review_task_id = new_id("review")
            review_task_ids.append(review_task_id)
            conn.execute(
                """
                INSERT INTO review_tasks
                  (id, target_type, target_id, status, payload_json, created_at, updated_at)
                VALUES (?, 'knowledge_unit', ?, 'pending_review', ?, ?, ?)
                """,
                (
                    review_task_id,
                    candidate["ku_id"],
                    json_dumps(
                        {
                            **candidate,
                            "suggestion_type": "candidate_knowledge_unit",
                            "review_reason": "demo1_model_candidate_pending_review",
                            "trace_id": trace_id,
                        }
                    ),
                    timestamp,
                    timestamp,
                ),
            )
        insert_event(
            conn,
            job_id,
            4,
            "candidate_generated",
            "Candidate KU records created.",
            {"candidate_knowledge_unit_ids": [candidate["ku_id"] for candidate in candidates]},
        )

        committed_result = {
            "source_id": source["source_id"],
            "chunk_ids": [chunk["chunk_id"] for chunk in chunks],
            "candidate_knowledge_unit_ids": [candidate["ku_id"] for candidate in candidates],
            "review_task_ids": review_task_ids,
        }
        conn.execute(
            """
            UPDATE processing_jobs
            SET status = 'completed', result_json = ?, updated_at = ?
            WHERE id = ?
            """,
            (json_dumps(committed_result), timestamp, job_id),
        )
        insert_event(conn, job_id, 5, "completed", "Demo 1 commit completed.", committed_result)

    result["metadata"]["commit_status"] = "committed"
    result["persisted"] = True
    result["job_id"] = job_id
    result["review_task_ids"] = review_task_ids
    return result


def build_preview(
    *,
    file_name: str,
    input_type: str,
    raw_text: str,
    project_id: str,
    commit_status: str,
) -> dict[str, Any]:
    timestamp = now_iso()
    source_id = new_id("source")
    clean_text = clean_text_for_demo(raw_text)
    chunks = split_chunks(clean_text, source_id)
    model_result = analyze_chunks_with_model(
        chunks=chunks,
        source_id=source_id,
        project_id=project_id,
    )
    candidates = model_result.get("candidate_knowledge_units", [])
    raw_length = len(raw_text)
    cleaned_length = len(clean_text)
    source = {
        "source_id": source_id,
        "file_name": file_name,
        "input_type": input_type,
        "created_at": timestamp,
        "status": "source_created",
        "raw_text_length": raw_length,
        "clean_text_length": cleaned_length,
        "chunk_count": len(chunks),
        "candidate_ku_count": len(candidates),
    }
    model_status = model_result["model_status"]
    return {
        "received_file": {
            "file_name": file_name,
            "input_type": input_type,
            "received_at": timestamp,
            "raw_text_length": raw_length,
            "process_status": "received" if model_status != "available" else "completed",
        },
        "source": source,
        "metadata": {
            "raw_length": raw_length,
            "cleaned_length": cleaned_length,
            "chunk_count": len(chunks),
            "candidate_ku_count": len(candidates),
            "model_provider": "openai-compatible",
            "model_name": model_result.get("model_name"),
            "model_status": model_status,
            "commit_status": commit_status,
        },
        "parsed": {
            "content": raw_text,
            "status": "parsed",
            "note": "当前为文本输入模式，未做 PDF / Word / OCR 解析。",
        },
        "cleaning": {
            "content": clean_text,
            "status": "cleaned",
            "before_char_count": raw_length,
            "after_char_count": cleaned_length,
            "note": cleaning_note(raw_text, clean_text),
        },
        "chunks": chunks,
        "candidate_knowledge_units": candidates,
        "candidate_ku_message": (
            "候选知识单元由 OpenAI-compatible 外部模型基于 chunk 自动生成，"
            "不代表最终知识结论；后续需要进入 Demo 2 做 schema 匹配、标签优化、"
            "实体关系抽取和人工确认。"
        ),
        "pipeline_statuses": pipeline_statuses(model_status),
        "model_error_code": model_result.get("model_error_code"),
        "model_error_message": model_result.get("model_error_message"),
        "persisted": False,
        "job_id": None,
        "review_task_ids": [],
    }


def clean_text_for_demo(text: str) -> str:
    cleaned = text.replace("\r\n", "\n").replace("\r", "\n")
    cleaned = re.sub(r"[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]", "", cleaned)
    cleaned = cleaned.replace("\ufffd", "")
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    cleaned = re.sub(r" *\n *", "\n", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def cleaning_note(raw_text: str, clean_text: str) -> str:
    if raw_text == clean_text:
        return "清洗前后无明显变化。"
    return "已执行首尾空格、连续空格、多余空行、统一换行和明显异常字符清洗。"


def split_chunks(text: str, source_id: str) -> list[dict[str, Any]]:
    if not text:
        return []
    max_chars = 400
    overlap = 50
    chunks: list[dict[str, Any]] = []
    start = 0
    index = 1
    while start < len(text):
        end = min(start + max_chars, len(text))
        content = text[start:end]
        chunks.append(
            {
                "chunk_id": f"{source_id}_chunk_{index:03d}",
                "source_id": source_id,
                "chunk_index": index,
                "content": content,
                "char_count": len(content),
                "chunk_type": chunk_type(len(content)),
                "start_offset": start,
                "end_offset": end,
            }
        )
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
        index += 1
    return chunks


def chunk_type(char_count: int) -> str:
    if char_count <= 12:
        return "very_short_chunk"
    if char_count < 80:
        return "short_chunk"
    if char_count < 320:
        return "normal_chunk"
    return "long_chunk"


def analyze_chunks_with_model(
    *,
    chunks: list[dict[str, Any]],
    source_id: str,
    project_id: str,
) -> dict[str, Any]:
    api_key = os.environ.get("KB_AI_API_KEY", "").strip()
    base_url = os.environ.get("KB_AI_BASE_URL", "").strip().rstrip("/")
    model = os.environ.get("KB_AI_MODEL", "").strip()
    if not api_key or not base_url or not model:
        return model_failure(
            "unconfigured",
            "demo1_model_unconfigured",
            "KB_AI_API_KEY, KB_AI_BASE_URL, and KB_AI_MODEL are required.",
        )
    if not chunks:
        return {
            "model_status": "available",
            "model_name": model,
            "candidate_knowledge_units": [],
        }

    prompt = build_model_prompt(chunks=chunks, source_id=source_id, project_id=project_id)
    request_body = json.dumps(
        {
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You generate pending Candidate Knowledge Units for an ingestion demo. "
                        "Return only strict JSON. Do not include markdown."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        f"{base_url}/chat/completions",
        data=request_body,
        headers={
            "authorization": f"Bearer {api_key}",
            "content-type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        return model_failure(
            "error",
            "demo1_model_http_error",
            f"Model API returned HTTP {error.code}.",
            model,
        )
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        return model_failure("error", "demo1_model_call_failed", str(error), model)

    try:
        content = payload["choices"][0]["message"]["content"]
        model_json = parse_model_json(content)
        candidates = normalize_model_candidates(model_json, chunks, source_id)
    except (KeyError, IndexError, TypeError, ValueError) as error:
        return model_failure("invalid_response", "demo1_model_invalid_response", str(error), model)

    return {
        "model_status": "available",
        "model_name": model,
        "candidate_knowledge_units": candidates,
    }


def build_model_prompt(*, chunks: list[dict[str, Any]], source_id: str, project_id: str) -> str:
    chunk_payload = [
        {
            "source_id": source_id,
            "chunk_id": chunk["chunk_id"],
            "chunk_index": chunk["chunk_index"],
            "char_count": chunk["char_count"],
            "chunk_type": chunk["chunk_type"],
            "content": chunk["content"],
        }
        for chunk in chunks
    ]
    return (
        "请基于以下 chunk 生成 Candidate KU。Candidate KU 是待确认候选材料，不是最终知识结论。\n"
        "要求：每个 chunk 必须生成 1 个 Candidate KU；短文本也生成，但给低 confidence 和质量提示；"
        "不要把整段原文机械复制为 title、summary、keywords、tags；keywords 最多 5 个短词；"
        "tags 必须包含 #demo1、#入库预处理、#candidate-ku、#pending，可追加少量主题标签。\n"
        "只返回 JSON，结构为："
        "{\"candidate_knowledge_units\":[{\"chunk_id\":\"...\",\"title\":\"...\","
        "\"summary\":\"...\",\"keywords\":[\"...\"],\"tags\":[\"#demo1\"],\"confidence\":0.3,"
        "\"quality_note\":\"...\",\"content_type\":\"very_short_text|short_note|paragraph_note|long_chunk\"}]}。\n"
        f"project_id: {project_id}\nsource_id: {source_id}\nchunks:\n"
        f"{json.dumps(chunk_payload, ensure_ascii=False)}"
    )


def parse_model_json(content: str) -> dict[str, Any]:
    text = content.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text).strip()
        text = re.sub(r"```$", "", text).strip()
    return json.loads(text)


def normalize_model_candidates(
    model_json: dict[str, Any],
    chunks: list[dict[str, Any]],
    source_id: str,
) -> list[dict[str, Any]]:
    raw_candidates = model_json.get("candidate_knowledge_units")
    if not isinstance(raw_candidates, list):
        raise ValueError("candidate_knowledge_units must be a list")
    by_chunk = {item.get("chunk_id"): item for item in raw_candidates if isinstance(item, dict)}
    candidates: list[dict[str, Any]] = []
    for index, chunk in enumerate(chunks, start=1):
        raw = by_chunk.get(chunk["chunk_id"])
        if not raw:
            raise ValueError(f"missing candidate for chunk {chunk['chunk_id']}")
        content_type = raw.get("content_type")
        if content_type not in {"very_short_text", "short_note", "paragraph_note", "long_chunk"}:
            content_type = content_type_for_chunk(chunk["char_count"])
        title = clean_short_text(raw.get("title"), max_len=40)
        summary = clean_short_text(raw.get("summary"), max_len=160)
        quality_note = clean_short_text(raw.get("quality_note"), max_len=160)
        if not title or not summary or not quality_note:
            raise ValueError(f"candidate text fields are incomplete for {chunk['chunk_id']}")
        keywords = normalize_terms(
            raw.get("keywords"),
            max_count=5,
            max_len=18,
            chunk_content=chunk["content"],
        )
        tags = normalize_tags(raw.get("tags"), keywords)
        confidence = normalize_confidence(raw.get("confidence"), content_type)
        candidates.append(
            {
                "ku_id": f"{source_id}_candidate_ku_{index:03d}",
                "source_id": source_id,
                "chunk_id": chunk["chunk_id"],
                "title": title,
                "summary": summary,
                "keywords": keywords,
                "tags": tags,
                "status": "pending",
                "confidence": confidence,
                "quality_note": quality_note,
                "content_type": content_type,
            }
        )
    return candidates


def clean_short_text(value: Any, *, max_len: int) -> str:
    if not isinstance(value, str):
        return ""
    return re.sub(r"\s+", " ", value).strip()[:max_len]


def normalize_terms(value: Any, *, max_count: int, max_len: int, chunk_content: str) -> list[str]:
    if not isinstance(value, list):
        return []
    terms: list[str] = []
    compact_chunk = re.sub(r"\s+", "", chunk_content)
    for item in value:
        if not isinstance(item, str):
            continue
        term = item.strip().strip("#")
        if not term or len(term) > max_len:
            continue
        if term in terms:
            continue
        if len(term) > 8 and term in compact_chunk and len(term) > len(compact_chunk) * 0.5:
            continue
        terms.append(term)
        if len(terms) >= max_count:
            break
    return terms


def normalize_tags(value: Any, keywords: list[str]) -> list[str]:
    tags = list(SYSTEM_TAGS)
    if isinstance(value, list):
        for item in value:
            if not isinstance(item, str):
                continue
            tag = item.strip()
            if not tag:
                continue
            tag = tag if tag.startswith("#") else f"#{tag}"
            if len(tag) > 24 or tag in tags:
                continue
            tags.append(tag)
            if len(tags) >= 7:
                return tags
    for keyword in keywords[:2]:
        tag = f"#{keyword}"
        if len(tag) <= 24 and tag not in tags:
            tags.append(tag)
    return tags[:7]


def normalize_confidence(value: Any, content_type: str) -> float:
    default = {
        "very_short_text": 0.3,
        "short_note": 0.45,
        "paragraph_note": 0.68,
        "long_chunk": 0.8,
    }[content_type]
    if isinstance(value, (int, float)):
        return round(min(max(float(value), 0.0), 1.0), 2)
    return default


def content_type_for_chunk(char_count: int) -> str:
    if char_count <= 12:
        return "very_short_text"
    if char_count < 80:
        return "short_note"
    if char_count < 320:
        return "paragraph_note"
    return "long_chunk"


def model_failure(
    status: str,
    code: str,
    message: str,
    model_name: Optional[str] = None,
) -> dict[str, Any]:
    return {
        "model_status": status,
        "model_name": model_name,
        "candidate_knowledge_units": [],
        "model_error_code": code,
        "model_error_message": message,
    }


def pipeline_statuses(model_status: str) -> list[dict[str, str]]:
    statuses: list[dict[str, str]] = []
    for key, label in PIPELINE_STEPS:
        if key == "candidate_generated" and model_status != "available":
            state = "error"
        elif key == "completed" and model_status != "available":
            state = "empty"
        else:
            state = "done"
        statuses.append({"key": key, "label": label, "state": state})
    return statuses


def insert_event(
    conn: Any,
    job_id: str,
    seq: int,
    event_type: str,
    message: str,
    payload: dict[str, Any],
) -> None:
    conn.execute(
        """
        INSERT INTO processing_status_events
          (id, job_id, event_seq, event_type, message, payload_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (new_id("event"), job_id, seq, event_type, message, json_dumps(payload), now_iso()),
    )
