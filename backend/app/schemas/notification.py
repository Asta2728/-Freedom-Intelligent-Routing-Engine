"""Notification schemas."""

from typing import Any
from uuid import UUID

from pydantic import Field

from app.schemas.base import BaseSchema, TimestampSchema


class NotificationRead(BaseSchema, TimestampSchema):
    """Schema for reading a notification."""

    id: UUID
    user_id: UUID
    type: str
    title: str
    body: str | None = None
    payload: dict[str, Any] | None = None
    is_read: bool


class NotificationFeedResponse(BaseSchema):
    """Feed response returned on page load.

    Contains the latest N notifications and the running unread count.
    """

    items: list[NotificationRead]
    unread_count: int = Field(description="Total number of unread notifications for this user.")
    total_fetched: int = Field(description="Number of notifications returned in this batch.")


class NotificationMarkAllReadResponse(BaseSchema):
    """Response payload for marking all notifications as read."""

    updated: int = Field(description="Number of notifications marked as read.")
