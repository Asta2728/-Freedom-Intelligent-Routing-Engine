"""Exception handlers for FastAPI application.

These handlers convert domain exceptions to proper HTTP responses.
"""

import logging
import traceback

from fastapi import FastAPI, Request, WebSocket
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.exceptions import AppException

logger = logging.getLogger(__name__)


async def app_exception_handler(request: Request | WebSocket, exc: AppException) -> JSONResponse:
    """Handle application exceptions.

    Logs 5xx errors as errors and 4xx as warnings.
    Returns a standardized JSON error response.
    """
    method = getattr(request, "method", "WEBSOCKET")

    log_extra = {
        "error_code": exc.code,
        "status_code": exc.status_code,
        "details": exc.details,
        "path": request.url.path,
        "method": method,
    }

    if exc.status_code >= 500:
        logger.error(f"{exc.code}: {exc.message}", extra=log_extra)
    else:
        logger.warning(f"{exc.code}: {exc.message}", extra=log_extra)

    headers: dict[str, str] = {}
    if exc.status_code == 401:
        headers["WWW-Authenticate"] = "Bearer"

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details or None,
            }
        },
        headers=headers,
    )


async def unhandled_exception_handler(request: Request | WebSocket, exc: Exception) -> JSONResponse:
    """Handle unexpected exceptions.

    Always logs the full traceback to the server console.
    In development mode, also returns the error details to the client
    for easier debugging.
    """
    method = getattr(request, "method", "WEBSOCKET")
    request_id = getattr(getattr(request, "state", None), "request_id", None)

    # Explicitly print the traceback to console because Uvicorn sometimes swallows logger.exception
    import sys
    print(f"\n{'='*50}\nFATAL 500 ERROR: {exc}", file=sys.stderr)
    traceback.print_exc(file=sys.stderr)
    print(f"{'='*50}\n", file=sys.stderr)

    logger.exception(
        "Unhandled exception",
        extra={
            "path": request.url.path,
            "method": method,
            "request_id": request_id,
        },
    )

    tb = traceback.format_exception(type(exc), exc, exc.__traceback__)
    show_internal_details = settings.DEBUG or settings.ENVIRONMENT in {"local", "development", "staging"}
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": str(exc) if show_internal_details else "Internal server error",
                "type": type(exc).__name__ if show_internal_details else None,
                "traceback": tb if show_internal_details else None,
                "request_id": request_id,
            }
        },
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Register all exception handlers on the FastAPI app.

    Call this after creating the FastAPI application instance.
    """
    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
    pass
