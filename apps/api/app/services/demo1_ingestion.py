from __future__ import annotations

import base64
import binascii
import hashlib
import html
import json
import os
import re
import subprocess
import tempfile
import unicodedata
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from app.core.errors import AppError
from app.db.sqlite import db, json_dumps
from app.services.ai_model_settings import configured_ai_model_runtime

DEMO1_PROFILE = "demo1_model_ingestion_preprocess_v1"
DEFAULT_OPENAI_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
DEFAULT_DEMO1_MODEL = "qwen-plus"
DEFAULT_DEMO1_VISION_MODEL = "qwen-vl-ocr-latest"
SYSTEM_TAGS = ["#demo1", "#入库预处理", "#candidate-ku", "#pending"]
MAX_DEMO1_FILE_BYTES = 5 * 1024 * 1024
MAX_DEMO1_PDF_OCR_PAGES = 10
DEMO1_PDF_OCR_RENDER_ZOOM = 2.0
SUPPORTED_TEXT_EXTENSIONS = {
    ".txt",
    ".text",
    ".md",
    ".markdown",
    ".csv",
    ".tsv",
    ".json",
    ".log",
    ".html",
    ".htm",
}
SUPPORTED_PDF_EXTENSIONS = {".pdf"}
SUPPORTED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}
SUPPORTED_DEMO1_FILE_EXTENSIONS = (
    SUPPORTED_TEXT_EXTENSIONS | SUPPORTED_PDF_EXTENSIONS | SUPPORTED_IMAGE_EXTENSIONS
)
PLAIN_TEXT_EXTENSIONS = SUPPORTED_TEXT_EXTENSIONS - {".html", ".htm"}
IMAGE_MIME_BY_EXTENSION = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
}
PIPELINE_STEPS = [
    ("received", "资料进入系统"),
    ("source_created", "创建 source 来源记录"),
    ("parsed", "内容解析与结构识别"),
    ("cleaned", "规则清洗与模型语义清洗"),
    ("chunked", "按 400 字切片并保留 50 字 overlap"),
    ("candidate_generated", "调用外部模型生成 pending Candidate KU"),
    ("completed", "预处理链路完成"),
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def preview_ingestion(payload: Any) -> dict[str, Any]:
    parsed_input = parse_demo1_input(payload)
    return build_preview(
        file_name=parsed_input["file_name"],
        input_type=parsed_input["input_type"],
        raw_text=parsed_input["raw_text"],
        parse_note=parsed_input["parse_note"],
        parser_profile=parsed_input["parser_profile"],
        file_size_bytes=parsed_input["file_size_bytes"],
        parse_metadata=parsed_input["parse_metadata"],
        project_id=payload.project_id,
        commit_status="preview_only",
    )


def commit_ingestion(payload: Any) -> dict[str, Any]:
    if payload.preview_result is not None:
        result = payload.preview_result.model_dump()
        project_id = payload.project_id
    elif payload.file_name:
        parsed_input = parse_demo1_input(payload)
        result = build_preview(
            file_name=parsed_input["file_name"],
            input_type=parsed_input["input_type"],
            raw_text=parsed_input["raw_text"],
            parse_note=parsed_input["parse_note"],
            parser_profile=parsed_input["parser_profile"],
            file_size_bytes=parsed_input["file_size_bytes"],
            parse_metadata=parsed_input["parse_metadata"],
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
        source_type = "text" if source["input_type"] == "text" else "file"
        source_origin = (
            "demo1_text_input" if source["input_type"] == "text" else "demo1_file_upload"
        )
        conn.execute(
            """
            INSERT INTO sources
              (id, project_id, title, source_type, source_origin,
               content_hash, metadata_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                source["source_id"],
                project_id,
                source["file_name"],
                source_type,
                source_origin,
                content_hash,
                json_dumps(
                    {
                        "input_type": source["input_type"],
                        "raw_text_length": source["raw_text_length"],
                        "clean_text_length": source["clean_text_length"],
                        "chunk_count": source["chunk_count"],
                        "candidate_ku_count": source["candidate_ku_count"],
                        "parser_profile": result["metadata"]["parser_profile"],
                        "parser_kind": result["metadata"].get("parser_kind"),
                        "parser_status": result["metadata"].get("parser_status"),
                        "parser_warnings": result["metadata"].get("parser_warnings", []),
                        "page_count": result["metadata"].get("page_count"),
                        "image_count": result["metadata"].get("image_count"),
                        "ocr_model_name": result["metadata"].get("ocr_model_name"),
                        "parsed_page_count": result["metadata"].get("parsed_page_count"),
                        "ocr_page_count": result["metadata"].get("ocr_page_count"),
                        "skipped_page_count": result["metadata"].get("skipped_page_count"),
                        "file_size_bytes": result["metadata"].get("file_size_bytes"),
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
                            "chunk_basis": chunk["chunk_basis"],
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


def parse_demo1_input(payload: Any) -> dict[str, Any]:
    if payload.input_type == "text":
        return {
            "file_name": payload.file_name,
            "input_type": "text",
            "raw_text": payload.raw_text or "",
            "parse_note": "当前为文本输入模式，未做 PDF / Word / OCR 解析。",
            "parser_profile": "demo1_text_input_direct_v1",
            "file_size_bytes": None,
            "parse_metadata": parser_metadata(
                parser_kind="text_input",
                parser_status="parsed",
            ),
        }

    file_bytes = decode_demo1_file(payload.file_content_base64 or "")
    if len(file_bytes) > MAX_DEMO1_FILE_BYTES:
        raise AppError(
            "demo1_file_too_large",
            "Demo 1 file input is limited to 5 MB.",
            status_code=413,
        )
    parsed_file = parse_demo1_file(
        file_name=payload.file_name,
        file_bytes=file_bytes,
        content_type=payload.content_type,
    )
    return {
        "file_name": payload.file_name,
        "input_type": "file",
        "raw_text": parsed_file["raw_text"],
        "parse_note": parsed_file["parse_note"],
        "parser_profile": parsed_file["parser_profile"],
        "file_size_bytes": len(file_bytes),
        "parse_metadata": parsed_file["parse_metadata"],
    }


def decode_demo1_file(file_content_base64: str) -> bytes:
    try:
        return base64.b64decode(file_content_base64, validate=True)
    except (binascii.Error, ValueError) as error:
        raise AppError(
            "demo1_file_base64_invalid",
            "Uploaded file payload is not valid base64.",
            status_code=422,
        ) from error


def parse_demo1_file(
    *,
    file_name: str,
    file_bytes: bytes,
    content_type: Optional[str],
) -> dict[str, Any]:
    extension = Path(file_name).suffix.lower()
    if extension not in SUPPORTED_DEMO1_FILE_EXTENSIONS:
        raise AppError(
            "demo1_file_type_unsupported",
            "Demo 1 supports text files, PDF, and common image/screenshot formats.",
            status_code=415,
        )
    if extension in SUPPORTED_PDF_EXTENSIONS:
        return parse_pdf_file(file_name=file_name, file_bytes=file_bytes)
    if extension in SUPPORTED_IMAGE_EXTENSIONS:
        return parse_image_file(
            file_name=file_name,
            file_bytes=file_bytes,
            content_type=content_type,
            extension=extension,
        )
    decoded = decode_text_bytes(file_bytes)
    if extension in PLAIN_TEXT_EXTENSIONS:
        profile = f"demo1_plain_text_file_parser_v1:{extension.lstrip('.')}"
        return {
            "raw_text": decoded,
            "parser_profile": profile,
            "parse_note": f"已在后端按文本文件解析上传文件，解析器：{profile}。",
            "parse_metadata": parser_metadata(
                parser_kind="text_file",
                parser_status="parsed",
            ),
        }
    profile = "demo1_html_text_parser_v1"
    return {
        "raw_text": strip_html_to_text(decoded),
        "parser_profile": profile,
        "parse_note": f"已在后端按 HTML 文本解析上传文件，解析器：{profile}。",
        "parse_metadata": parser_metadata(
            parser_kind="html_text",
            parser_status="parsed",
        ),
    }


def parser_metadata(
    *,
    parser_kind: str,
    parser_status: str,
    parser_warnings: Optional[list[str]] = None,
    page_count: Optional[int] = None,
    image_count: Optional[int] = None,
    ocr_model_name: Optional[str] = None,
    parsed_page_count: Optional[int] = None,
    ocr_page_count: Optional[int] = None,
    skipped_page_count: Optional[int] = None,
) -> dict[str, Any]:
    return {
        "parser_kind": parser_kind,
        "parser_status": parser_status,
        "parser_warnings": parser_warnings or [],
        "page_count": page_count,
        "image_count": image_count,
        "ocr_model_name": ocr_model_name,
        "parsed_page_count": parsed_page_count,
        "ocr_page_count": ocr_page_count,
        "skipped_page_count": skipped_page_count,
    }


def parse_pdf_file(*, file_name: str, file_bytes: bytes) -> dict[str, Any]:
    try:
        import fitz  # type: ignore[import-untyped]
    except ImportError as error:
        raise AppError(
            "demo1_pdf_parser_unavailable",
            "PyMuPDF is required to parse PDF files in Demo 1.",
            status_code=503,
        ) from error

    try:
        document = fitz.open(stream=file_bytes, filetype="pdf")
    except Exception as error:  # noqa: BLE001 - PyMuPDF raises several concrete types.
        raise AppError(
            "demo1_pdf_parse_failed",
            "The uploaded PDF could not be opened by the local PDF parser.",
            status_code=422,
        ) from error

    warnings: list[str] = []
    page_texts: list[str] = []
    text_page_count = 0
    ocr_page_count = 0
    ocr_attempted_page_count = 0
    skipped_page_count = 0
    ocr_model_name: Optional[str] = None
    try:
        page_count = document.page_count
        for page_index in range(page_count):
            page = document.load_page(page_index)
            text = page.get_text("text").strip()
            if text:
                text_page_count += 1
                page_texts.append(f"[page {page_index + 1}]\n{text}")
            else:
                if ocr_attempted_page_count >= MAX_DEMO1_PDF_OCR_PAGES:
                    skipped_page_count += 1
                    warnings.append(f"page_{page_index + 1}_skipped_pdf_ocr_page_limit")
                    continue
                ocr_attempted_page_count += 1
                ocr_text, ocr_warnings, ocr_model_name = ocr_pdf_page(
                    page=page,
                    page_number=page_index + 1,
                )
                if ocr_text:
                    ocr_page_count += 1
                    page_texts.append(f"[page {page_index + 1} OCR]\n{ocr_text}")
                else:
                    warnings.append(f"page_{page_index + 1}_ocr_empty_text")
                warnings.extend(ocr_warnings)
    finally:
        document.close()

    parsed_text = "\n\n".join(page_texts).strip()
    if not parsed_text:
        raise AppError(
            "demo1_pdf_ocr_empty_text",
            "The PDF parser and OCR model did not extract usable text from this PDF.",
            status_code=409,
        )

    parser_kind = "pdf_text"
    if text_page_count and ocr_page_count:
        parser_kind = "pdf_mixed"
    elif ocr_page_count and not text_page_count:
        parser_kind = "pdf_ocr"
    profile = f"demo1_{parser_kind}_parser_v1:pymupdf"
    return {
        "raw_text": parsed_text,
        "parser_profile": profile,
        "parse_note": (
            f"已在后端用 PyMuPDF 解析 PDF，解析器：{profile}。"
            "可复制文本页直接提取；扫描页已渲染为图片并调用视觉 OCR。"
        ),
        "parse_metadata": parser_metadata(
            parser_kind=parser_kind,
            parser_status="parsed",
            parser_warnings=warnings,
            page_count=page_count,
            image_count=ocr_attempted_page_count or None,
            ocr_model_name=ocr_model_name,
            parsed_page_count=text_page_count,
            ocr_page_count=ocr_attempted_page_count,
            skipped_page_count=skipped_page_count,
        ),
    }


def ocr_pdf_page(*, page: Any, page_number: int) -> tuple[str, list[str], Optional[str]]:
    config = demo1_vision_model_config()
    if not config["api_key"]:
        raise AppError(
            "demo1_ocr_model_unconfigured",
            "KB_AI_API_KEY or OPENAI_API_KEY is required for Demo 1 scanned PDF OCR.",
            status_code=409,
        )
    import fitz  # type: ignore[import-untyped]

    pixmap = page.get_pixmap(
        matrix=fitz.Matrix(DEMO1_PDF_OCR_RENDER_ZOOM, DEMO1_PDF_OCR_RENDER_ZOOM),
        alpha=False,
    )
    png_bytes = pixmap.tobytes("png")
    try:
        ocr_result = call_vision_ocr_model(config, file_bytes=png_bytes, mime_type="image/png")
    except urllib.error.HTTPError as error:
        raise AppError(
            "demo1_ocr_model_http_error",
            f"OCR model API returned HTTP {error.code} while parsing PDF page {page_number}.",
            status_code=502,
        ) from error
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError) as error:
        raise AppError("demo1_ocr_model_failed", str(error), status_code=502) from error

    warnings = [
        f"page_{page_number}_{warning}"
        for warning in normalize_string_list(ocr_result.get("warnings"), max_count=8, max_len=120)
    ]
    return clean_ocr_text(ocr_result.get("text")), warnings, config["model"]


def parse_image_file(
    *,
    file_name: str,
    file_bytes: bytes,
    content_type: Optional[str],
    extension: str,
) -> dict[str, Any]:
    mime_type = content_type if content_type and content_type.startswith("image/") else None
    mime_type = mime_type or IMAGE_MIME_BY_EXTENSION[extension]
    config = demo1_vision_model_config()
    if not config["api_key"]:
        raise AppError(
            "demo1_ocr_model_unconfigured",
            "KB_AI_API_KEY or OPENAI_API_KEY is required for Demo 1 image OCR.",
            status_code=409,
        )

    try:
        ocr_result = call_vision_ocr_model(config, file_bytes=file_bytes, mime_type=mime_type)
    except urllib.error.HTTPError as error:
        raise AppError(
            "demo1_ocr_model_http_error",
            f"OCR model API returned HTTP {error.code}.",
            status_code=502,
        ) from error
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError) as error:
        raise AppError(
            "demo1_ocr_model_failed",
            str(error),
            status_code=502,
        ) from error

    parsed_text = clean_ocr_text(ocr_result.get("text"))
    if not parsed_text:
        raise AppError(
            "demo1_ocr_empty_text",
            "The OCR model did not detect usable text in this image.",
            status_code=409,
        )

    profile = f"demo1_image_ocr_parser_v1:{config['model']}"
    warnings = normalize_string_list(
        ocr_result.get("warnings"), max_count=8, max_len=120
    )
    return {
        "raw_text": parsed_text,
        "parser_profile": profile,
        "parse_note": (
            f"已在后端调用视觉 OCR 模型解析图片/截图，解析器：{profile}。"
            "OCR 结果会继续进入规则清洗、语义清洗、chunk 和 Candidate KU 流程。"
        ),
        "parse_metadata": parser_metadata(
            parser_kind="image_ocr",
            parser_status="parsed",
            parser_warnings=warnings,
            image_count=1,
            ocr_model_name=config["model"],
        ),
    }


def decode_text_bytes(file_bytes: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "gb18030"):
        try:
            return file_bytes.decode(encoding)
        except UnicodeDecodeError:
            continue
    return file_bytes.decode("latin-1", errors="replace")


def strip_html_to_text(text: str) -> str:
    without_script = re.sub(r"(?is)<(script|style).*?>.*?</\1>", "\n", text)
    without_tags = re.sub(r"(?s)<[^>]+>", "\n", without_script)
    return html.unescape(without_tags)


def clean_ocr_text(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    text = value.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t\f\v]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()[:20000]


def build_preview(
    *,
    file_name: str,
    input_type: str,
    raw_text: str,
    parse_note: str,
    parser_profile: str,
    file_size_bytes: Optional[int],
    parse_metadata: dict[str, Any],
    project_id: str,
    commit_status: str,
) -> dict[str, Any]:
    timestamp = now_iso()
    source_id = new_id("source")
    rule_clean_text = clean_text_for_demo(raw_text)
    rule_cleaning = {
        "content": rule_clean_text,
        "status": "cleaned",
        "before_char_count": len(raw_text),
        "after_char_count": len(rule_clean_text),
        "note": cleaning_note(raw_text, rule_clean_text),
        "operations": rule_cleaning_operations(raw_text, rule_clean_text),
    }
    semantic_result = semantic_preprocess_with_model(
        raw_text=raw_text,
        rule_clean_text=rule_clean_text,
        source_id=source_id,
        file_name=file_name,
        input_type=input_type,
    )
    semantic_result = guard_semantic_preprocess_result(semantic_result, rule_clean_text)
    final_clean_text = semantic_result["semantic_cleaning"]["content"]
    chunk_basis = semantic_result["chunk_basis"]
    chunks = split_chunks(final_clean_text, source_id, chunk_basis)
    model_result = analyze_chunks_with_model(
        chunks=chunks,
        source_id=source_id,
        project_id=project_id,
    )
    candidates = model_result.get("candidate_knowledge_units", [])
    raw_length = len(raw_text)
    cleaned_length = len(final_clean_text)
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
            "file_size_bytes": file_size_bytes,
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
            "parser_profile": parser_profile,
            "file_size_bytes": file_size_bytes,
            "parser_kind": parse_metadata.get("parser_kind", "unknown"),
            "parser_status": parse_metadata.get("parser_status", "parsed"),
            "parser_warnings": parse_metadata.get("parser_warnings", []),
            "page_count": parse_metadata.get("page_count"),
            "image_count": parse_metadata.get("image_count"),
            "ocr_model_name": parse_metadata.get("ocr_model_name"),
            "parsed_page_count": parse_metadata.get("parsed_page_count"),
            "ocr_page_count": parse_metadata.get("ocr_page_count"),
            "skipped_page_count": parse_metadata.get("skipped_page_count"),
        },
        "parsed": {
            "content": raw_text,
            "status": "parsed",
            "note": parse_note,
        },
        "semantic_parsing": semantic_result["semantic_parsing"],
        "rule_cleaning": rule_cleaning,
        "semantic_cleaning": semantic_result["semantic_cleaning"],
        "cleaning": {
            "content": final_clean_text,
            "status": "cleaned",
            "before_char_count": raw_length,
            "after_char_count": cleaned_length,
            "note": final_cleaning_note(chunk_basis, semantic_result["semantic_cleaning"]),
        },
        "chunk_basis": chunk_basis,
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
    cleaned = unicodedata.normalize("NFKC", text)
    cleaned = cleaned.replace("\r\n", "\n").replace("\r", "\n")
    cleaned = cleaned.replace("\ufeff", "")
    cleaned = cleaned.replace("\ufffd", "")
    cleaned = re.sub(r"[\u200b\u200c\u200d\u2060]", "", cleaned)
    cleaned = re.sub(r"(锟斤拷|锟|�)+", "", cleaned)
    cleaned = re.sub(r"[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]", "", cleaned)
    cleaned = remove_abnormal_characters(cleaned)
    cleaned = re.sub(r"[ \t\f\v]+", " ", cleaned)
    cleaned = re.sub(r" *\n *", "\n", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    cleaned = "\n".join(line.strip() for line in cleaned.split("\n"))
    return cleaned.strip()


def remove_abnormal_characters(text: str) -> str:
    kept: list[str] = []
    for char in text:
        if char == "\n":
            kept.append(char)
            continue
        category = unicodedata.category(char)
        if category.startswith(("L", "N", "P", "S")) or category == "Zs":
            kept.append(char)
    return "".join(kept)


def cleaning_note(raw_text: str, clean_text: str) -> str:
    if raw_text == clean_text:
        return "清洗前后无明显变化。"
    return (
        "已执行 Unicode 规范化、BOM/零宽字符移除、控制字符移除、"
        "明显乱码清理、连续空格合并、多余空行合并和首尾空格清理。"
    )


def rule_cleaning_operations(raw_text: str, clean_text: str) -> list[str]:
    operations = [
        "unicode_normalization",
        "newline_normalization",
        "bom_zero_width_removal",
        "control_character_removal",
        "mojibake_marker_removal",
        "space_collapse",
        "blank_line_collapse",
        "edge_trim",
    ]
    if raw_text == clean_text:
        return operations + ["no_visible_change"]
    return operations


def final_cleaning_note(chunk_basis: str, semantic_cleaning: dict[str, Any]) -> str:
    if chunk_basis == "semantic_clean_text":
        return "已使用模型语义清洗文本作为 chunk 输入；规则清洗文本保留用于对照。"
    fallback = semantic_cleaning.get("fallback_reason") or "模型语义清洗不可用。"
    return f"已回退使用规则清洗文本作为 chunk 输入；原因：{fallback}"


def split_chunks(text: str, source_id: str, chunk_basis: str) -> list[dict[str, Any]]:
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
                "chunk_basis": chunk_basis,
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


def semantic_preprocess_with_model(
    *,
    raw_text: str,
    rule_clean_text: str,
    source_id: str,
    file_name: str,
    input_type: str,
) -> dict[str, Any]:
    config = demo1_model_config()
    if not config["api_key"] or not rule_clean_text:
        reason = (
            "模型未配置，无法执行语义解析/清洗。"
            if not config["api_key"]
            else "规则清洗文本为空，无法执行语义解析/清洗。"
        )
        return semantic_preprocess_fallback(rule_clean_text, reason)

    prompt = build_semantic_preprocess_prompt(
        raw_text=raw_text,
        rule_clean_text=rule_clean_text,
        source_id=source_id,
        file_name=file_name,
        input_type=input_type,
    )
    try:
        payload = (
            call_responses_api(
                config,
                prompt,
                system_content=(
                    "You perform semantic parsing and semantic cleaning for a "
                    "knowledge ingestion demo. "
                    "Return strict JSON only. Preserve meaning and do not add facts."
                ),
            )
            if config["endpoint"] == "responses"
            else call_chat_completions_api(
                config,
                prompt,
                system_content=(
                    "You perform semantic parsing and semantic cleaning for a "
                    "knowledge ingestion demo. "
                    "Return strict JSON only. Preserve meaning and do not add facts."
                ),
            )
        )
        content = extract_model_text(payload, config["endpoint"])
        model_json = parse_model_json(content)
        return normalize_semantic_preprocess(model_json, rule_clean_text)
    except (
        urllib.error.HTTPError,
        urllib.error.URLError,
        TimeoutError,
        json.JSONDecodeError,
        KeyError,
        IndexError,
        TypeError,
        ValueError,
    ) as error:
        return semantic_preprocess_fallback(rule_clean_text, str(error))


def semantic_preprocess_fallback(rule_clean_text: str, reason: str) -> dict[str, Any]:
    return {
        "chunk_basis": "rule_clean_text",
        "semantic_parsing": {
            "status": "fallback",
            "summary": "模型语义解析不可用，当前仅展示规则解析结果。",
            "titles": [],
            "paragraph_notes": [],
            "possible_toc": [],
            "citations": [],
            "noise_blocks": [],
        },
        "semantic_cleaning": {
            "content": rule_clean_text,
            "status": "fallback_rule_cleaned",
            "before_char_count": len(rule_clean_text),
            "after_char_count": len(rule_clean_text),
            "note": "语义清洗失败或未配置，已回退到规则清洗文本。",
            "cleaning_report": (
                "模型语义清洗不可用，系统使用规则清洗文本继续执行 "
                "chunk 和 Candidate KU 流程。"
            ),
            "noise_findings": [],
            "quality_score": quality_score_for_text(rule_clean_text),
            "fallback_reason": reason,
        },
    }


def guard_semantic_preprocess_result(
    semantic_result: dict[str, Any],
    rule_clean_text: str,
) -> dict[str, Any]:
    semantic_cleaning = semantic_result.get("semantic_cleaning", {})
    semantic_clean_text = semantic_cleaning.get("content")
    if (
        semantic_result.get("chunk_basis") != "semantic_clean_text"
        or not isinstance(semantic_clean_text, str)
        or not semantic_clean_text.strip()
        or not is_semantic_cleaning_over_compressed(rule_clean_text, semantic_clean_text)
    ):
        return semantic_result

    guarded_cleaning = {
        **semantic_cleaning,
        "content": rule_clean_text,
        "status": "fallback_rule_cleaned",
        "after_char_count": len(rule_clean_text),
        "note": "模型语义清洗结果疑似过度压缩，已回退到规则清洗文本用于 chunk。",
        "cleaning_report": (
            f"{semantic_cleaning.get('cleaning_report') or '模型已返回语义清洗结果。'} "
            "系统检测到 semantic_clean_text 明显短于规则清洗文本，可能变成摘要；"
            "为保证入库预处理不丢失原始信息，本次切片改用规则清洗文本。"
        ),
        "fallback_reason": "semantic_clean_text appears over-compressed",
    }
    return {
        **semantic_result,
        "chunk_basis": "rule_clean_text",
        "semantic_cleaning": guarded_cleaning,
    }


def is_semantic_cleaning_over_compressed(rule_clean_text: str, semantic_clean_text: str) -> bool:
    rule_len = len(rule_clean_text.strip())
    semantic_len = len(semantic_clean_text.strip())
    if rule_len < 450:
        return False
    if semantic_len < 320 and rule_len >= 700:
        return True
    return semantic_len < int(rule_len * 0.65)


def build_semantic_preprocess_prompt(
    *,
    raw_text: str,
    rule_clean_text: str,
    source_id: str,
    file_name: str,
    input_type: str,
) -> str:
    payload = {
        "source_id": source_id,
        "file_name": file_name,
        "input_type": input_type,
        "raw_text": raw_text,
        "rule_clean_text": rule_clean_text,
    }
    return (
        "请对资料做 Demo 1 的语义解析和语义清洗。\n"
        "所有文本无论长短都必须处理；短文本也要给出语义解析、清洗文本和质量判断。\n"
        "边界：只能整理段落、统一表达、识别标题/层级/目录/引用/噪声/重复内容；"
        "不得新增事实，不得补写原文没有的信息，不得把短文本过滤掉。\n"
        "semantic_clean_text 应保留原意和主要内容，适合作为后续 chunk 输入；"
        "不得把长文本总结成短摘要，不得删除非噪声正文。\n"
        "只返回 JSON，结构为："
        "{\"semantic_clean_text\":\"...\",\"parse_structure\":{\"summary\":\"...\","
        "\"titles\":[\"...\"],\"paragraph_notes\":[\"...\"],\"possible_toc\":[\"...\"],"
        "\"citations\":[\"...\"],\"noise_blocks\":[\"...\"]},"
        "\"cleaning_report\":\"...\",\"noise_findings\":[\"...\"],\"quality_score\":0.0}。\n"
        f"输入：{json.dumps(payload, ensure_ascii=False)}"
    )


def normalize_semantic_preprocess(
    model_json: dict[str, Any],
    rule_clean_text: str,
) -> dict[str, Any]:
    semantic_clean_text = clean_semantic_text(model_json.get("semantic_clean_text"))
    if not semantic_clean_text:
        raise ValueError("semantic_clean_text is empty")
    parse_structure = model_json.get("parse_structure")
    if not isinstance(parse_structure, dict):
        parse_structure = {}
    cleaning_report = clean_short_text(model_json.get("cleaning_report"), max_len=400)
    noise_findings = normalize_string_list(
        model_json.get("noise_findings"), max_count=8, max_len=80
    )
    quality_score = normalize_quality_score(model_json.get("quality_score"), semantic_clean_text)
    return {
        "chunk_basis": "semantic_clean_text",
        "semantic_parsing": {
            "status": "semantic_parsed",
            "summary": clean_short_text(parse_structure.get("summary"), max_len=240)
            or "模型已完成语义解析。",
            "titles": normalize_string_list(parse_structure.get("titles"), max_count=8, max_len=80),
            "paragraph_notes": normalize_string_list(
                parse_structure.get("paragraph_notes"), max_count=12, max_len=140
            ),
            "possible_toc": normalize_string_list(
                parse_structure.get("possible_toc"), max_count=8, max_len=80
            ),
            "citations": normalize_string_list(
                parse_structure.get("citations"), max_count=8, max_len=120
            ),
            "noise_blocks": normalize_string_list(
                parse_structure.get("noise_blocks"), max_count=8, max_len=120
            ),
        },
        "semantic_cleaning": {
            "content": semantic_clean_text,
            "status": "semantic_cleaned",
            "before_char_count": len(rule_clean_text),
            "after_char_count": len(semantic_clean_text),
            "note": "模型已基于规则清洗文本完成语义清洗，未新增事实。",
            "cleaning_report": cleaning_report or "模型完成语义清洗，未返回额外报告。",
            "noise_findings": noise_findings,
            "quality_score": quality_score,
            "fallback_reason": None,
        },
    }


def clean_semantic_text(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    cleaned = value.replace("\r\n", "\n").replace("\r", "\n")
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    cleaned = "\n".join(line.rstrip() for line in cleaned.split("\n"))
    return cleaned.strip()


def normalize_string_list(value: Any, *, max_count: int, max_len: int) -> list[str]:
    if not isinstance(value, list):
        return []
    items: list[str] = []
    for item in value:
        text = clean_short_text(item, max_len=max_len)
        if text and text not in items:
            items.append(text)
        if len(items) >= max_count:
            break
    return items


def normalize_quality_score(value: Any, text: str) -> float:
    max_score = max_quality_score_for_text(text)
    if isinstance(value, (int, float)):
        return round(min(max(float(value), 0.0), max_score), 2)
    return quality_score_for_text(text)


def max_quality_score_for_text(text: str) -> float:
    length = len(text.strip())
    if length <= 12:
        return 0.35
    if length < 80:
        return 0.55
    if length < 320:
        return 0.8
    return 1.0


def quality_score_for_text(text: str) -> float:
    length = len(text.strip())
    if length <= 12:
        return 0.25
    if length < 80:
        return 0.45
    if length < 320:
        return 0.68
    return 0.82


def analyze_chunks_with_model(
    *,
    chunks: list[dict[str, Any]],
    source_id: str,
    project_id: str,
) -> dict[str, Any]:
    config = demo1_model_config()
    if not config["api_key"]:
        return model_failure(
            "unconfigured",
            "demo1_model_unconfigured",
            "KB_AI_API_KEY or OPENAI_API_KEY is required for Demo 1 model analysis.",
            config["model"],
        )
    if not chunks:
        return {
            "model_status": "available",
            "model_name": config["model"],
            "candidate_knowledge_units": [],
        }

    prompt = build_model_prompt(chunks=chunks, source_id=source_id, project_id=project_id)
    try:
        payload = (
            call_responses_api(config, prompt)
            if config["endpoint"] == "responses"
            else call_chat_completions_api(config, prompt)
        )
    except urllib.error.HTTPError as error:
        return model_failure(
            "error",
            "demo1_model_http_error",
            f"Model API returned HTTP {error.code}.",
            config["model"],
        )
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        return model_failure("error", "demo1_model_call_failed", str(error), config["model"])

    try:
        content = extract_model_text(payload, config["endpoint"])
        model_json = parse_model_json(content)
        candidates = normalize_model_candidates(model_json, chunks, source_id)
    except (KeyError, IndexError, TypeError, ValueError) as error:
        return model_failure(
            "invalid_response",
            "demo1_model_invalid_response",
            str(error),
            config["model"],
        )

    return {
        "model_status": "available",
        "model_name": config["model"],
        "candidate_knowledge_units": candidates,
    }


def demo1_model_config() -> dict[str, str]:
    return configured_ai_model_runtime()


def demo1_vision_model_config() -> dict[str, str]:
    config = demo1_model_config()
    return {
        **config,
        "model": config.get("vision_model", DEFAULT_DEMO1_VISION_MODEL).strip(),
        "endpoint": "chat_completions",
    }


def call_vision_ocr_model(
    config: dict[str, str],
    *,
    file_bytes: bytes,
    mime_type: str,
) -> dict[str, Any]:
    data_url = f"data:{mime_type};base64,{base64.b64encode(file_bytes).decode('ascii')}"
    request_body = json.dumps(
        {
            "model": config["model"],
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are an OCR parser for a knowledge ingestion demo. "
                        "Extract visible text faithfully. Return strict JSON only."
                    ),
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                "请识别图片或截图中的可见文字。只返回 JSON："
                                "{\"text\":\"识别出的原文\",\"warnings\":[\"可选警告\"]}。"
                                "不要总结，不要新增事实；如果没有文字，text 返回空字符串。"
                            ),
                        },
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                },
            ],
            "temperature": 0,
        },
        ensure_ascii=False,
    ).encode("utf-8")
    payload = post_model_json(
        f"{config['base_url']}/chat/completions",
        config["api_key"],
        request_body,
        timeout=90,
    )
    content = extract_model_text(payload, "chat_completions")
    return normalize_ocr_model_response(content)


def normalize_ocr_model_response(content: str) -> dict[str, Any]:
    try:
        parsed = parse_model_json(content)
    except (json.JSONDecodeError, TypeError, ValueError):
        return {"text": content.strip(), "warnings": ["ocr_response_was_not_json"]}
    text = parsed.get("text")
    if not isinstance(text, str):
        text = ""
    warnings = parsed.get("warnings")
    if not isinstance(warnings, list):
        warnings = []
    return {"text": text.strip(), "warnings": warnings}


def call_responses_api(
    config: dict[str, str],
    prompt: str,
    *,
    system_content: str = (
        "You generate pending Candidate Knowledge Units for an ingestion demo. "
        "Return only strict JSON. Do not include markdown."
    ),
) -> dict[str, Any]:
    request_body = json.dumps(
        {
            "model": config["model"],
            "input": [
                {
                    "role": "developer",
                    "content": system_content,
                },
                {"role": "user", "content": prompt},
            ],
        }
    ).encode("utf-8")
    return post_model_json(
        f"{config['base_url']}/responses",
        config["api_key"],
        request_body,
        timeout=45,
    )


def call_chat_completions_api(
    config: dict[str, str],
    prompt: str,
    *,
    system_content: str = (
        "You generate pending Candidate Knowledge Units for an ingestion demo. "
        "Return only strict JSON. Do not include markdown."
    ),
) -> dict[str, Any]:
    request_body = json.dumps(
        {
            "model": config["model"],
            "messages": [
                {
                    "role": "system",
                    "content": system_content,
                },
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
        }
    ).encode("utf-8")
    return post_model_json(
        f"{config['base_url']}/chat/completions",
        config["api_key"],
        request_body,
        timeout=45,
    )


def post_model_json(url: str, api_key: str, request_body: bytes, *, timeout: int) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        data=request_body,
        headers={
            "authorization": f"Bearer {api_key}",
            "content-type": "application/json; charset=utf-8",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError:
        raise
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        if os.name != "nt":
            raise
        try:
            return post_model_json_with_curl(url, api_key, request_body, timeout=timeout)
        except (subprocess.SubprocessError, OSError, ValueError) as curl_error:
            message = f"{error}; curl fallback failed: {curl_error}"
            raise urllib.error.URLError(message) from curl_error


def post_model_json_with_curl(
    url: str,
    api_key: str,
    request_body: bytes,
    *,
    timeout: int,
) -> dict[str, Any]:
    temp_path: Optional[Path] = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".json") as handle:
            handle.write(request_body)
            temp_path = Path(handle.name)
        curl_config = "\n".join(
            [
                f'url = "{url}"',
                'request = "POST"',
                f'header = "authorization: Bearer {api_key}"',
                'header = "content-type: application/json; charset=utf-8"',
                f'data-binary = "@{temp_path.as_posix()}"',
                "silent",
                "show-error",
                "fail-with-body",
            ]
        )
        process = subprocess.run(
            ["curl.exe", "--config", "-"],
            input=f"{curl_config}\n".encode(),
            capture_output=True,
            timeout=timeout + 15,
            check=False,
        )
        stdout = process.stdout.decode("utf-8", errors="replace")
        stderr = process.stderr.decode("utf-8", errors="replace").strip()
        if process.returncode != 0:
            message = stderr or stdout[:300] or f"curl exited with code {process.returncode}"
            raise ValueError(message)
        return json.loads(stdout)
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)


def extract_model_text(payload: dict[str, Any], endpoint: str) -> str:
    if endpoint == "chat_completions":
        return payload["choices"][0]["message"]["content"]
    if isinstance(payload.get("output_text"), str):
        return payload["output_text"]
    parts: list[str] = []
    for item in payload.get("output", []):
        if not isinstance(item, dict):
            continue
        for content in item.get("content", []):
            if isinstance(content, dict) and isinstance(content.get("text"), str):
                parts.append(content["text"])
    if not parts:
        raise ValueError("Responses API payload did not include output_text")
    return "\n".join(parts)


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
