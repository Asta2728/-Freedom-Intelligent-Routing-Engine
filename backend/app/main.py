"""FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import ORJSONResponse

from app.api.router import api_router
from app.core.config import settings


from app.core.logging_config import setup_logging

setup_logging()
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # === Startup ===
    from app.clients.redis import RedisClient

    redis_client = RedisClient()
    await redis_client.connect()

    yield {"redis": redis_client}

    # === Shutdown ===
    await redis_client.close()
    from app.db.session import close_db
    await close_db()


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    show_docs = settings.ENVIRONMENT in ("local", "staging", "development")
    openapi_url = f"{settings.API_V1_STR}/openapi.json" if show_docs else None
    
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version="0.1.0",
        openapi_url=openapi_url,
        docs_url="/docs" if show_docs else None,
        redoc_url="/redoc" if show_docs else None,
        lifespan=lifespan,
        default_response_class=ORJSONResponse,
        debug=settings.DEBUG,
    )

    from fastapi.middleware.cors import CORSMiddleware
    from app.core.middleware import RequestIDMiddleware
    from app.api.exception_handlers import register_exception_handlers

    # Request ID middleware
    app.add_middleware(RequestIDMiddleware)
    
    # Exception handlers
    register_exception_handlers(app)

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
        allow_methods=settings.CORS_ALLOW_METHODS,
        allow_headers=settings.CORS_ALLOW_HEADERS,
    )

    from app.api.routes.v1.files import media_router
    
    app.include_router(api_router, prefix=settings.API_V1_STR)
    app.include_router(media_router, prefix="/media", tags=["media"])

    return app

app = create_app()
