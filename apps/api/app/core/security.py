from __future__ import annotations

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import get_settings
from app.core.errors import error_payload

PUBLIC_PATH_PREFIXES = ("/api/health", "/openapi.json", "/docs", "/redoc")


class LocalTokenMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        settings = get_settings()
        if request.method == "OPTIONS":
            return await call_next(request)
        if settings.local_token and not request.url.path.startswith(PUBLIC_PATH_PREFIXES):
            token = request.headers.get("x-kb-local-token")
            if token != settings.local_token:
                return JSONResponse(
                    status_code=401,
                    content=error_payload(
                        getattr(request.state, "request_id", ""),
                        "sidecar_auth_failed",
                        "Local sidecar token is missing or invalid.",
                        recoverable=True,
                    ),
                )
        return await call_next(request)
