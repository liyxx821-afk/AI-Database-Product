from __future__ import annotations

import uuid
from typing import Callable

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


class AppError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400, recoverable: bool = True):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.recoverable = recoverable


def error_payload(request_id: str, code: str, message: str, recoverable: bool = True) -> dict:
    return {
        "request_id": request_id,
        "error": {
            "code": code,
            "message": message,
            "recoverable": recoverable,
            "fallback_reason": None,
        },
    }


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable):
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["x-request-id"] = request_id
        return response


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    return JSONResponse(
        status_code=exc.status_code,
        content=error_payload(request_id, exc.code, exc.message, exc.recoverable),
    )


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    return JSONResponse(
        status_code=422,
        content=error_payload(
            request_id,
            "validation_error",
            "Invalid request payload.",
            recoverable=True,
        ),
    )


async def generic_error_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    return JSONResponse(
        status_code=500,
        content=error_payload(request_id, "internal_error", str(exc), recoverable=True),
    )
