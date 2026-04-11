"""Notification database model."""

import uuid
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class Notification(Base, TimestampMixin):
    """Notification model.
    
    Stores in-app notifications for users. Each notification belongs to a
    specific user and tracks whether they have read it.
    """

    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Notification type (e.g., "ticket_assigned", "system", "alert")
    type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    # Short title displayed in the notification bell
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    # Longer body text (optional)
    body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Arbitrary JSON payload for deep linking / action context
    payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # Whether the user has read this notification
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationship back to User (lazy so we don't load user every time)
    user: Mapped["User"] = relationship("User", lazy="select")  # type: ignore[name-defined]

    def __repr__(self) -> str:
        return f"<Notification(id={self.id}, user_id={self.user_id}, type={self.type}, is_read={self.is_read})>"
