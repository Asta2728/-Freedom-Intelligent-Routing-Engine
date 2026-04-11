"""Database models module."""

from .conversation import Conversation, Message, ToolCall
from .fire import (
    BusinessUnit,
    Manager,
    Ticket,
    TicketAIAnalysis,
    RoutingResult,
    BackgroundTask,
    TaskLog,
    # Enums
    TaskStatus,
    TaskAction,
    ManagerRole,
    ClientSegment,
    TicketType,
    TicketTone,
    TicketLanguage,
    AssignmentMethod,
)
from .item import Item
from .notification import Notification
from .user import User

__all__ = [
    "User",
    "Item",
    "Conversation",
    "Message",
    "ToolCall",
    "Notification",
    # FIRE core
    "BusinessUnit",
    "Manager",
    "Ticket",
    "TicketAIAnalysis",
    "RoutingResult",
    "BackgroundTask",
    "TaskLog",
    # FIRE enums
    "TaskStatus",
    "TaskAction",
    "ManagerRole",
    "ClientSegment",
    "TicketType",
    "TicketTone",
    "TicketLanguage",
    "AssignmentMethod",
]
