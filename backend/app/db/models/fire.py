"""F.I.R.E. (Freedom Intelligent Routing Engine) database models."""

import uuid
import enum
from datetime import date
from typing import Optional

from sqlalchemy import ARRAY, Date, Float, ForeignKey, Integer, String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class TaskStatus(enum.StrEnum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class TaskAction(enum.StrEnum):
    START = "START"
    INFO = "INFO"
    WARN = "WARN"
    SUCCESS = "SUCCESS"
    ERROR = "ERROR"
    AI_ENRICHED = "AI_ENRICHED"
    GEOCODED = "GEOCODED"
    ROUTED = "ROUTED"


class ManagerRole(enum.StrEnum):
    """Manager seniority roles aligned with original managers.csv values."""
    SPECIALIST = "Специалист"
    LEAD_SPECIALIST = "Ведущий специалист"
    CHIEF_SPECIALIST = "Главный специалист"


class ClientSegment(enum.StrEnum):
    """Client segments from the FIRE spec."""
    MASS = "Mass"
    VIP = "VIP"
    PRIORITY = "Priority"


class TicketType(enum.StrEnum):
    """All 7 ticket classification categories from the FIRE spec §3.1."""
    COMPLAINT = "Жалоба"
    DATA_CHANGE = "Смена данных"
    CONSULTATION = "Консультация"
    CLAIM = "Претензия"
    APP_FAILURE = "Неработоспособность приложения"
    FRAUD = "Мошеннические действия"
    SPAM = "Спам"


class TicketTone(enum.StrEnum):
    """Sentiment / tone values from the FIRE spec §3.1."""
    POSITIVE = "Позитивный"
    NEUTRAL = "Нейтральный"
    NEGATIVE = "Негативный"


class TicketLanguage(enum.StrEnum):
    """Detected language values from the FIRE spec §3.1 (default: RU)."""
    KZ = "KZ"
    ENG = "ENG"
    RU = "RU"


class AssignmentMethod(enum.StrEnum):
    """How the ticket was routed (for audit traceability)."""
    GEO_NEAREST = "geo_nearest"          # Nearest office by geodesic distance
    GEO_FALLBACK_ASTANA = "geo_fallback_astana"   # Unknown/foreign → Astana (50/50)
    GEO_FALLBACK_ALMATY = "geo_fallback_almaty"   # Unknown/foreign → Almaty (50/50)
    ROUND_ROBIN = "round_robin"          # Round-robin within the top-2 lowest load
    SKIPPED_SPAM = "skipped_spam"        # Spam ticket, no assignment
    NO_ELIGIBLE_MANAGER = "no_eligible_manager"  # Routing failed — no manager matched


# ---------------------------------------------------------------------------
# Core FIRE Models
# ---------------------------------------------------------------------------

class BusinessUnit(Base):
    """Business Unit (office) model — §2 table 3."""

    __tablename__ = "business_units"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4, index=True
    )
    name: Mapped[str] = mapped_column(String, index=True)
    country: Mapped[Optional[str]] = mapped_column(String, nullable=True, default="Kazakhstan")
    city: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    address: Mapped[str] = mapped_column(String)
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Relationships
    managers: Mapped[list["Manager"]] = relationship(
        "Manager", back_populates="business_unit", cascade="all, delete-orphan"
    )
    routing_results: Mapped[list["RoutingResult"]] = relationship(
        "RoutingResult", back_populates="business_unit"
    )


class Manager(Base):
    """Manager model — §2 table 2."""

    __tablename__ = "managers"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4, index=True
    )
    full_name: Mapped[str] = mapped_column(String, index=True)
    # Stored in CSV-native form: Специалист | Ведущий специалист | Главный специалист
    role: Mapped[str] = mapped_column(String, index=True)
    skills: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)  # VIP | ENG | KZ
    business_unit_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("business_units.id"), index=True
    )
    # Current ticket load from CSV; incremented on each assignment
    current_load: Mapped[int] = mapped_column(Integer, default=0)
    # Relationships
    business_unit: Mapped["BusinessUnit"] = relationship(
        "BusinessUnit", back_populates="managers"
    )
    tickets: Mapped[list["Ticket"]] = relationship(
        "Ticket", back_populates="assigned_manager"
    )
    routing_results: Mapped[list["RoutingResult"]] = relationship(
        "RoutingResult", back_populates="assigned_manager"
    )


class Ticket(Base, TimestampMixin):
    """Ticket (lead) model — §2 table 1.

    Stores the raw CSV data from the client + geocoded coordinates.
    AI analysis is stored in the linked TicketAIAnalysis record (1-to-1).
    Final routing result is stored in the linked RoutingResult record (1-to-1).
    """

    __tablename__ = "tickets"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4, index=True
    )
    # GUID клиента — unique identifier from the CSV
    guid: Mapped[str] = mapped_column(
        String, unique=True, index=True, default=lambda: str(uuid.uuid4())
    )

    # --- Client demographic fields (§2 table 1) ---
    client_gender: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)   # Пол
    client_dob: Mapped[Optional[date]] = mapped_column(Date, nullable=True)            # Дата рождения
    client_segment: Mapped[str] = mapped_column(String(20), index=True)                # Mass | VIP | Priority

    # --- Ticket content ---
    description: Mapped[str] = mapped_column(Text)                                     # Описание
    attachment_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)      # Вложения

    # --- Client address fields (§2 table 1) — kept raw for audit ---
    client_country: Mapped[Optional[str]] = mapped_column(String, nullable=True)       # Страна
    client_region: Mapped[Optional[str]] = mapped_column(String, nullable=True)        # Область
    client_city: Mapped[Optional[str]] = mapped_column(String, nullable=True)          # Населённый пункт
    client_street: Mapped[Optional[str]] = mapped_column(String, nullable=True)        # Улица
    client_building: Mapped[Optional[str]] = mapped_column(String, nullable=True)      # Дом

    # --- Geocoded coordinates (populated after Yandex geocoding step) ---
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # --- Assignment shortcut FK (denormalized for quick queries) ---
    assigned_manager_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("managers.id"), nullable=True, index=True
    )

    # Relationships
    assigned_manager: Mapped[Optional["Manager"]] = relationship(
        "Manager", back_populates="tickets"
    )
    ai_analysis: Mapped[Optional["TicketAIAnalysis"]] = relationship(
        "TicketAIAnalysis", back_populates="ticket",
        uselist=False, cascade="all, delete-orphan"
    )
    routing_result: Mapped[Optional["RoutingResult"]] = relationship(
        "RoutingResult", back_populates="ticket",
        uselist=False, cascade="all, delete-orphan"
    )
    tasks: Mapped[list["BackgroundTask"]] = relationship(
        "BackgroundTask", back_populates="ticket", cascade="all, delete-orphan"
    )


# ---------------------------------------------------------------------------
# AI Analysis Model (1-to-1 with Ticket)
# ---------------------------------------------------------------------------

class TicketAIAnalysis(Base, TimestampMixin):
    """Structured AI analysis result for a ticket — §3.1 NLP Module.

    Mirrors the `TicketAnalysis` Pydantic schema used in the notebook.
    One-to-one with Ticket; created by the AI enrichment pipeline step.
    """

    __tablename__ = "ticket_ai_analyses"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4, index=True
    )
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tickets.id", ondelete="CASCADE"), unique=True, index=True
    )

    # §3.1 — All 7 type categories
    ai_type: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, index=True  # See TicketType enum
    )
    # §3.1 — Sentiment
    ai_tone: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True              # See TicketTone enum
    )
    # §3.1 — Urgency 1-10
    ai_priority: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # §3.1 — Language (default: RU)
    ai_language: Mapped[Optional[str]] = mapped_column(
        String(5), nullable=True               # See TicketLanguage enum
    )
    # §3.1 — Summary: distillation of the issue
    ai_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # §3.1 — Manager recommendation (separate from summary for clarity)
    ai_recommendation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Raw LLM model used (for auditability)
    model_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Relationship
    ticket: Mapped["Ticket"] = relationship("Ticket", back_populates="ai_analysis")


# ---------------------------------------------------------------------------
# Routing Result Model (1-to-1 with Ticket) — §3.2 + §4 DB requirement
# ---------------------------------------------------------------------------

class RoutingResult(Base, TimestampMixin):
    """Final distribution result — connects Lead → AI Analysis → Assigned Manager.

    This is the primary output table described in §4:
    'схему, позволяющую просмотреть результат распределения
    (связь Лид → Аналитика ИИ → Назначенный менеджер)'

    Stores WHY a ticket was routed the way it was, enabling full audit trail
    and UI dashboard queries.
    """

    __tablename__ = "routing_results"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4, index=True
    )
    # Core FK links — the three-way relationship from the spec
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tickets.id", ondelete="CASCADE"), unique=True, index=True
    )
    assigned_manager_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("managers.id"), nullable=True, index=True
    )
    business_unit_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("business_units.id"), nullable=True, index=True
    )

    # --- Routing metadata (for audit and UI) ---
    # Distance from client to assigned office (km)
    office_distance_km: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    # How the routing decision was made (see AssignmentMethod enum)
    assignment_method: Mapped[str] = mapped_column(
        String(40), default=AssignmentMethod.GEO_NEAREST
    )
    # Position in round-robin cycle at the time of assignment (0 or 1)
    round_robin_position: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Manager load at the time of assignment (snapshot)
    manager_load_at_assignment: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # If routing failed — reason why
    routing_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    ticket: Mapped["Ticket"] = relationship("Ticket", back_populates="routing_result")
    assigned_manager: Mapped[Optional["Manager"]] = relationship(
        "Manager", back_populates="routing_results"
    )
    business_unit: Mapped[Optional["BusinessUnit"]] = relationship(
        "BusinessUnit", back_populates="routing_results"
    )


# ---------------------------------------------------------------------------
# Background Task Models (task tracking infrastructure)
# ---------------------------------------------------------------------------

class BackgroundTask(Base, TimestampMixin):
    """Tracks background processing tasks (ticket-specific or general)."""

    __tablename__ = "background_tasks"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4, index=True
    )
    ticket_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("tickets.id", ondelete="CASCADE"), index=True, nullable=True
    )
    task_id: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    task_name: Mapped[str] = mapped_column(String)
    status: Mapped[TaskStatus] = mapped_column(String, default=TaskStatus.PENDING)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    ticket: Mapped[Optional["Ticket"]] = relationship("Ticket", back_populates="tasks")
    logs: Mapped[list["TaskLog"]] = relationship(
        "TaskLog", back_populates="task", cascade="all, delete-orphan",
        order_by="TaskLog.created_at"
    )


class TaskLog(Base, TimestampMixin):
    """Detailed logs for tasks (can contain generic JSON info)."""

    __tablename__ = "task_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4, index=True
    )
    task_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("background_tasks.id", ondelete="CASCADE"), index=True
    )
    action: Mapped[TaskAction] = mapped_column(String, default=TaskAction.INFO)
    message: Mapped[str] = mapped_column(Text)
    data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    task: Mapped["BackgroundTask"] = relationship("BackgroundTask", back_populates="logs")
