"""Notification API routes."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import paginate
from sqlalchemy import select

from app.api.deps import DBSession, CurrentUser
from app.db.models.notification import Notification
from app.schemas.notification import (
    NotificationFeedResponse,
    NotificationMarkAllReadResponse,
    NotificationRead,
)
from app.services.notification import NotificationService

router = APIRouter()


def get_notification_service(db: DBSession) -> NotificationService:
    return NotificationService(db)


NotificationSvc = Annotated[NotificationService, Depends(get_notification_service)]


@router.get("", response_model=Page[NotificationRead])
async def list_notifications(
    db: DBSession,
    current_user: CurrentUser,
):
    """List all notifications for the current user (paginated).

    Ordered newest first. Use `page` and `size` query params to paginate.
    """
    stmt = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
    )
    return await paginate(db, stmt)


@router.get("/feed", response_model=NotificationFeedResponse)
async def get_notification_feed(
    current_user: CurrentUser,
    svc: NotificationSvc,
    limit: int = Query(default=20, ge=1, le=100, description="Max notifications to return."),
):
    """Fetch recent notifications for the authenticated user.

    Returns the latest `limit` notifications (newest first) plus the total
    unread count. Clients should call this on every page load to stay synced.
    """
    items, unread_count = await svc.get_feed(current_user.id, limit=limit)
    return NotificationFeedResponse(
        items=items,
        unread_count=unread_count,
        total_fetched=len(items),
    )


@router.post("/{notification_id}/read", response_model=NotificationRead)
async def mark_notification_read(
    notification_id: UUID,
    current_user: CurrentUser,
    svc: NotificationSvc,
):
    """Mark a specific notification as read.

    The notification must belong to the authenticated user — otherwise 404 is returned.
    """
    notification = await svc.mark_read(notification_id, current_user.id)
    if notification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return notification


@router.post("/read-all", status_code=status.HTTP_200_OK, response_model=NotificationMarkAllReadResponse)
async def mark_all_notifications_read(
    current_user: CurrentUser,
    svc: NotificationSvc,
):
    """Mark all unread notifications as read for the current user."""
    updated = await svc.mark_all_read(current_user.id)
    return {"updated": updated}


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: UUID,
    current_user: CurrentUser,
    svc: NotificationSvc,
):
    """Delete a notification (must belong to current user)."""
    deleted = await svc.delete(notification_id, current_user.id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
