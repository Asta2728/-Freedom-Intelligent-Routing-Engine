"""Notification service.

Provides the business logic for creating and managing user notifications.

Other services should call `NotificationService.notify(db, ...)` to create
new notifications programmatically. The API routes use the instance methods
for querying and marking as read.
"""

from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.notification import Notification


class NotificationService:
    """Service for managing in-app notifications."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ──────────────────────────────────────────────────────────────────────
    # Creation helpers (call these from other services)
    # ──────────────────────────────────────────────────────────────────────

    async def notify(
        self,
        *,
        user_id: UUID,
        type: str,
        title: str,
        body: str | None = None,
        payload: dict[str, Any] | None = None,
    ) -> Notification:
        """Create a new notification for a user.

        This is the primary entry-point for other services wanting to send
        notifications programmatically. Example usage::

            notification_svc = NotificationService(db)
            await notification_svc.notify(
                user_id=ticket.assigned_manager_id,
                type="ticket_assigned",
                title="New Ticket Assigned",
                body=f"You have been assigned ticket #{ticket.guid}",
                payload={"ticket_id": str(ticket.id)},
            )

        Args:
            user_id:  The UUID of the recipient user.
            type:     A machine-readable event type (e.g. 'ticket_assigned').
            title:    Short human-readable title shown in the bell.
            body:     Optional longer message body.
            payload:  Optional JSON dict for deep-linking / extra context.

        Returns:
            The persisted Notification instance.
        """
        notification = Notification(
            user_id=user_id,
            type=type,
            title=title,
            body=body,
            payload=payload,
        )
        self.db.add(notification)
        await self.db.commit()
        await self.db.refresh(notification)
        return notification

    # ──────────────────────────────────────────────────────────────────────
    # Feed helpers (used by API routes)
    # ──────────────────────────────────────────────────────────────────────

    async def get_feed(
        self,
        user_id: UUID,
        *,
        limit: int = 20,
    ) -> tuple[list[Notification], int]:
        """Return the most recent notifications and the total unread count.

        Args:
            user_id: The authenticated user's UUID.
            limit:   Maximum number of recent notifications to return.

        Returns:
            A tuple of (notifications list, total_unread_count).
        """
        # Fetch recent notifications ordered by newest-first
        stmt = (
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        items = list(result.scalars().all())

        # Count total unread separately so we get the real number
        # even if it exceeds the `limit` batch.
        count_stmt = (
            select(func.count())
            .select_from(Notification)
            .where(Notification.user_id == user_id, Notification.is_read.is_(False))
        )
        count_result = await self.db.execute(count_stmt)
        unread_count: int = count_result.scalar_one()

        return items, unread_count

    async def mark_read(self, notification_id: UUID, user_id: UUID) -> Notification | None:
        """Mark a single notification as read.

        Validates that the notification belongs to the requesting user to
        prevent IDOR attacks.

        Args:
            notification_id: UUID of the notification to mark.
            user_id:         UUID of the authenticated user (ownership check).

        Returns:
            The updated Notification, or None if not found / not owned.
        """
        stmt = select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
        result = await self.db.execute(stmt)
        notification = result.scalar_one_or_none()

        if notification is None:
            return None

        notification.is_read = True
        await self.db.commit()
        await self.db.refresh(notification)
        return notification

    async def mark_all_read(self, user_id: UUID) -> int:
        """Mark all unread notifications as read for a user.

        Returns:
            The number of notifications that were updated.
        """
        from sqlalchemy import update

        stmt = (
            update(Notification)
            .where(Notification.user_id == user_id, Notification.is_read.is_(False))
            .values(is_read=True)
            .returning(Notification.id)
        )
        result = await self.db.execute(stmt)
        await self.db.commit()
        rows = result.fetchall()
        return len(rows)

    async def delete(self, notification_id: UUID, user_id: UUID) -> bool:
        """Delete a notification (ownership validated).

        Returns:
            True if deleted, False if not found or not owned.
        """
        stmt = select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
        result = await self.db.execute(stmt)
        notification = result.scalar_one_or_none()

        if notification is None:
            return False

        await self.db.delete(notification)
        await self.db.commit()
        return True
