"""Pydantic schemas for FIRE models."""

from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import Field

from app.schemas.base import BaseSchema, TimestampSchema, PaginatedResponse


from app.db.models.fire import (
    TicketType,
    TicketTone,
    TicketLanguage,
    ManagerRole,
    ClientSegment,
    AssignmentMethod,
    TaskStatus,
    TaskAction,
)


class BulkDeleteSchema(BaseSchema):
    """Schema for bulk deletion requests."""
    ids: list[UUID]


# ---------------------------------------------------------------------------
# Background Task Schemas
# ---------------------------------------------------------------------------

class BackgroundTaskRead(TimestampSchema):
    """Schema for reading a BackgroundTask."""
    id: UUID
    ticket_id: Optional[UUID] = None
    task_id: Optional[str] = None
    task_name: str
    status: TaskStatus
    error_message: Optional[str] = None
    payload: Optional[dict] = None


class TaskLogRead(TimestampSchema):
    """Schema for reading a TaskLog."""
    id: UUID
    task_id: UUID
    action: TaskAction
    message: str
    data: Optional[dict] = None


# ---------------------------------------------------------------------------
# BusinessUnit Schemas
# ---------------------------------------------------------------------------

class BusinessUnitRead(BaseSchema):
    id: UUID
    name: str
    country: Optional[str] = None
    city: Optional[str] = None
    address: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None


# ---------------------------------------------------------------------------
# Manager Schemas
# ---------------------------------------------------------------------------

class ManagerRead(BaseSchema):
    id: UUID
    full_name: str
    role: str
    skills: list[str]
    current_load: int
    business_unit_id: UUID
    business_unit: Optional[BusinessUnitRead] = None


# ---------------------------------------------------------------------------
# Ticket Schemas
# ---------------------------------------------------------------------------

class TicketBase(BaseSchema):
    guid: str
    description: str
    client_segment: str
    client_gender: Optional[str] = None
    client_dob: Optional[date] = None
    client_country: Optional[str] = None
    client_region: Optional[str] = None
    client_city: Optional[str] = None
    client_street: Optional[str] = None
    client_building: Optional[str] = None
    attachment_path: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class TicketRead(TicketBase, TimestampSchema):
    id: UUID
    assigned_manager_id: Optional[UUID] = None
    # Nested AI analysis and routing result included when available
    ai_analysis: Optional["TicketAIAnalysisRead"] = None
    routing_result: Optional["RoutingResultRead"] = None
    assigned_manager: Optional[ManagerRead] = None


# ---------------------------------------------------------------------------
# TicketAIAnalysis Schemas (matches the notebook's TicketAnalysis Pydantic schema)
# ---------------------------------------------------------------------------

class TicketAIAnalysisRead(TimestampSchema):
    """AI analysis result — mirrors TicketAnalysis from the notebook."""
    id: UUID
    ticket_id: UUID
    ai_type: Optional[TicketType] = None
    ai_tone: Optional[TicketTone] = None
    ai_priority: Optional[int] = Field(None, ge=1, le=10)
    ai_language: Optional[TicketLanguage] = None
    ai_summary: Optional[str] = None
    ai_recommendation: Optional[str] = None
    model_name: Optional[str] = None


class TicketAIAnalysisCreate(BaseSchema):
    """Input schema for creating an AI analysis record (used by pipeline)."""
    ticket_id: UUID
    ai_type: TicketType
    ai_tone: TicketTone
    ai_priority: int = Field(..., ge=1, le=10)
    ai_language: TicketLanguage = TicketLanguage.RU
    ai_summary: str
    ai_recommendation: Optional[str] = None
    model_name: Optional[str] = None


# ---------------------------------------------------------------------------
# RoutingResult Schemas — Lead → AI Analysis → Manager (§4 DB requirement)
# ---------------------------------------------------------------------------

class RoutingResultRead(TimestampSchema):
    """Full routing result record — the JOIN view from the spec."""
    id: UUID
    ticket_id: UUID
    assigned_manager_id: Optional[UUID] = None
    business_unit_id: Optional[UUID] = None
    office_distance_km: Optional[float] = None
    assignment_method: AssignmentMethod
    round_robin_position: Optional[int] = None
    manager_load_at_assignment: Optional[int] = None
    routing_error: Optional[str] = None
    # Nested relations
    assigned_manager: Optional[ManagerRead] = None
    business_unit: Optional[BusinessUnitRead] = None


class RoutingResultCreate(BaseSchema):
    """Input schema for creating a routing result (used by routing pipeline)."""
    ticket_id: UUID
    assigned_manager_id: Optional[UUID] = None
    business_unit_id: Optional[UUID] = None
    office_distance_km: Optional[float] = None
    assignment_method: AssignmentMethod = AssignmentMethod.GEO_NEAREST
    round_robin_position: Optional[int] = None
    manager_load_at_assignment: Optional[int] = None
    routing_error: Optional[str] = None


# Enable forward references for nested schemas
TicketRead.model_rebuild()


# ---------------------------------------------------------------------------
# Paginated Response Schemas
# ---------------------------------------------------------------------------

class PaginatedTickets(PaginatedResponse[TicketRead]):
    pass


class PaginatedManagers(PaginatedResponse[ManagerRead]):
    pass


class PaginatedBusinessUnits(PaginatedResponse[BusinessUnitRead]):
    pass


class PaginatedTasks(PaginatedResponse[BackgroundTaskRead]):
    pass


class PaginatedTaskLogs(PaginatedResponse[TaskLogRead]):
    pass


# ---------------------------------------------------------------------------
# Dashboard Analytics Schemas
# ---------------------------------------------------------------------------

class PriorityBucket(BaseSchema):
    """One bar in the priority histogram."""
    priority: int = Field(..., ge=1, le=10, description="Priority level 1-10")
    count: int


class LanguageSlice(BaseSchema):
    """One slice in the language pie chart."""
    language: str
    count: int


class RoutingMethodSlice(BaseSchema):
    """One slice in the routing method donut chart."""
    method: str
    count: int


class TicketGeoPoint(BaseSchema):
    """A single geolocated ticket point for the Kazakhstan map."""
    ticket_id: UUID
    latitude: float
    longitude: float
    ai_priority: Optional[int] = None
    client_city: Optional[str] = None
    client_segment: Optional[str] = None


class ManagerLoadPoint(BaseSchema):
    """Manager load for the bar/grid chart."""
    manager_id: UUID
    full_name: str
    business_unit: Optional[str] = None
    current_load: int


class DashboardAnalyticsResponse(BaseSchema):
    """Aggregated analytics payload for the main dashboard.

    Covers the 4-card grid:
      1. Geographic Distribution  → geo_points
      2. Priority Histogram       → priority_distribution
      3. Language Breakdown       → language_distribution
      4. Routing Success Donut    → routing_method_distribution
    """
    # Card 1 — Map
    geo_points: list[TicketGeoPoint]

    # Card 2 — Priority histogram
    priority_distribution: list[PriorityBucket]

    # Card 3 — Language pie
    language_distribution: list[LanguageSlice]

    # Card 4 — Routing method donut
    routing_method_distribution: list[RoutingMethodSlice]

    # Summary counters (for the existing stats row)
    total_tickets: int
    total_managers: int
    total_business_units: int
    routed_count: int
    unrouted_count: int
