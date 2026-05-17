from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    auth,
    feedback_memory,
    knowledge,
    organization,
    settings,
    sources,
    system,
    uploads,
    z0a,
)
from app.core.errors import (
    AppError,
    RequestContextMiddleware,
    app_error_handler,
    generic_error_handler,
    validation_error_handler,
)
from app.core.security import LocalTokenMiddleware
from app.db.sqlite import initialize_database


@asynccontextmanager
async def lifespan(_app: FastAPI):
    initialize_database()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="KnowledgeBaseDev API", version="0.1.0-alpha", lifespan=lifespan)
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(LocalTokenMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"^http://127\.0\.0\.1:\d+$",
        allow_methods=["*"],
        allow_headers=["content-type", "x-kb-local-token"],
    )
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(Exception, generic_error_handler)
    app.include_router(system.router, prefix="/api")
    app.include_router(auth.router, prefix="/api")
    app.include_router(settings.router, prefix="/api")
    app.include_router(organization.router, prefix="/api")
    app.include_router(uploads.router, prefix="/api")
    app.include_router(sources.router, prefix="/api")
    app.include_router(knowledge.router, prefix="/api")
    app.include_router(feedback_memory.router, prefix="/api")
    app.include_router(z0a.router, prefix="/api")

    return app


app = create_app()
