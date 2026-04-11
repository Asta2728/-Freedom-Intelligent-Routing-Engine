"""Pydantic schemas for the FIRE ingestion API."""

from pydantic import Field

from app.schemas.base import BaseSchema


class IngestionResponse(BaseSchema):
    """Response from starting a background CSV ingestion run."""

    message: str
    task_id: str
