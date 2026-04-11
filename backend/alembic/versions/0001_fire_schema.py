"""add_ticket_fields_ai_analysis_routing_result

Revision ID: 0001_fire_schema
Revises: 
Create Date: 2026-02-22

Adds:
- All missing Ticket client fields (gender, dob, address columns, attachment_path)
- TicketAIAnalysis table (1-to-1 with tickets, for AI enrichment results)
- RoutingResult table (1-to-1 with tickets, for the Lead→AI→Manager chain)
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0001_fire_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -----------------------------------------------------------------------
    # 1. Create business_units table
    # -----------------------------------------------------------------------
    op.create_table(
        "business_units",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(), nullable=False, index=True),
        sa.Column("country", sa.String(), nullable=True, server_default="Kazakhstan"),
        sa.Column("city", sa.String(), nullable=True),
        sa.Column("address", sa.String(), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
    )

    # -----------------------------------------------------------------------
    # 2. Create managers table
    # -----------------------------------------------------------------------
    op.create_table(
        "managers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("full_name", sa.String(), nullable=False, index=True),
        sa.Column("role", sa.String(), nullable=False, index=True),
        sa.Column("skills", postgresql.ARRAY(sa.String()), nullable=False, server_default="{}"),
        sa.Column("business_unit_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("business_units.id"), nullable=False, index=True),
        sa.Column("current_load", sa.Integer(), nullable=False, server_default="0"),
    )

    # -----------------------------------------------------------------------
    # 3. Create tickets table (with ALL client fields from §2)
    # -----------------------------------------------------------------------
    op.create_table(
        "tickets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("guid", sa.String(), nullable=False, unique=True, index=True),
        # Client demographic fields
        sa.Column("client_gender", sa.String(20), nullable=True),
        sa.Column("client_dob", sa.Date(), nullable=True),
        sa.Column("client_segment", sa.String(20), nullable=False, index=True),
        # Ticket content
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("attachment_path", sa.String(), nullable=True),
        # Client address fields (raw, for audit)
        sa.Column("client_country", sa.String(), nullable=True),
        sa.Column("client_region", sa.String(), nullable=True),
        sa.Column("client_city", sa.String(), nullable=True),
        sa.Column("client_street", sa.String(), nullable=True),
        sa.Column("client_building", sa.String(), nullable=True),
        # Geocoded coordinates
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        # Assignment shortcut FK
        sa.Column("assigned_manager_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("managers.id"), nullable=True, index=True),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    # -----------------------------------------------------------------------
    # 4. Create ticket_ai_analyses table (1-to-1 with tickets)
    # -----------------------------------------------------------------------
    op.create_table(
        "ticket_ai_analyses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("ticket_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False, unique=True, index=True),
        sa.Column("ai_type", sa.String(50), nullable=True, index=True),
        sa.Column("ai_tone", sa.String(20), nullable=True),
        sa.Column("ai_priority", sa.Integer(), nullable=True),
        sa.Column("ai_language", sa.String(5), nullable=True),
        sa.Column("ai_summary", sa.Text(), nullable=True),
        sa.Column("ai_recommendation", sa.Text(), nullable=True),
        sa.Column("model_name", sa.String(100), nullable=True),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    # -----------------------------------------------------------------------
    # 5. Create routing_results table (1-to-1 with tickets — §4 requirement)
    # -----------------------------------------------------------------------
    op.create_table(
        "routing_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("ticket_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False, unique=True, index=True),
        sa.Column("assigned_manager_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("managers.id"), nullable=True, index=True),
        sa.Column("business_unit_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("business_units.id"), nullable=True, index=True),
        # Routing metadata
        sa.Column("office_distance_km", sa.Float(), nullable=True),
        sa.Column("assignment_method", sa.String(40), nullable=False, server_default="geo_nearest"),
        sa.Column("round_robin_position", sa.Integer(), nullable=True),
        sa.Column("manager_load_at_assignment", sa.Integer(), nullable=True),
        sa.Column("routing_error", sa.Text(), nullable=True),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    # -----------------------------------------------------------------------
    # 6. Create background_tasks table
    # -----------------------------------------------------------------------
    op.create_table(
        "background_tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("ticket_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tickets.id", ondelete="CASCADE"), nullable=True, index=True),
        sa.Column("task_id", sa.String(), nullable=True, index=True),
        sa.Column("task_name", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="PENDING"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("payload", postgresql.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    # -----------------------------------------------------------------------
    # 7. Create task_logs table
    # -----------------------------------------------------------------------
    op.create_table(
        "task_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("background_tasks.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("action", sa.String(), nullable=False, server_default="INFO"),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("data", postgresql.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("task_logs")
    op.drop_table("background_tasks")
    op.drop_table("routing_results")
    op.drop_table("ticket_ai_analyses")
    op.drop_table("tickets")
    op.drop_table("managers")
    op.drop_table("business_units")
