"""API v1 router aggregation."""
# ruff: noqa: I001 - Imports structured for Jinja2 template conditionals

from fastapi import APIRouter

from app.api.routes.v1 import health
from app.api.routes.v1 import auth, users
from app.api.routes.v1 import items
from app.api.routes.v1 import files
from app.api.routes.v1 import conversations
from app.api.routes.v1 import notifications
from app.api.routes.v1 import ingestion, fire
from app.api.routes.v1 import agent

v1_router = APIRouter()

# Health check routes (no auth required)
v1_router.include_router(health.router, tags=["health"])

# Authentication routes
v1_router.include_router(auth.router, prefix="/auth", tags=["auth"])

# User routes
v1_router.include_router(users.router, prefix="/users", tags=["users"])

# Example CRUD routes (items)
v1_router.include_router(items.router, prefix="/items", tags=["items"])

# File routes
v1_router.include_router(files.router, prefix="/files", tags=["files"])

# Conversation routes (AI chat persistence)
v1_router.include_router(conversations.router, prefix="/conversations", tags=["conversations"])

# Notification routes
v1_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])

# FIRE ingestion and filtering routes
v1_router.include_router(ingestion.router, prefix="/fire", tags=["fire"])
v1_router.include_router(fire.router, prefix="/fire", tags=["fire"])

# AI Agent routes
v1_router.include_router(agent.router, tags=["agent"])
