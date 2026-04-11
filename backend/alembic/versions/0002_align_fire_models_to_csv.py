"""Align FIRE core tables to CSV-first schema

Revision ID: 0002_align_fire_models_to_csv
Revises: 0001_fire_schema
Create Date: 2026-02-22

Changes:
- business_units: make country/city/latitude/longitude nullable
- business_units: drop near_address (unused)
- managers: drop round_robin_assignment_count (unused)
"""

from alembic import op
import sqlalchemy as sa


revision = "0002_align_fire_models_to_csv"
down_revision = "0001_fire_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("business_units") as batch_op:
        batch_op.alter_column("country", existing_type=sa.String(), nullable=True)
        batch_op.alter_column("city", existing_type=sa.String(), nullable=True)
        batch_op.alter_column("latitude", existing_type=sa.Float(), nullable=True)
        batch_op.alter_column("longitude", existing_type=sa.Float(), nullable=True)
        batch_op.drop_column("near_address")

    with op.batch_alter_table("managers") as batch_op:
        batch_op.drop_column("round_robin_assignment_count")


def downgrade() -> None:
    with op.batch_alter_table("managers") as batch_op:
        batch_op.add_column(
            sa.Column(
                "round_robin_assignment_count",
                sa.Integer(),
                nullable=False,
                server_default="0",
            )
        )

    with op.batch_alter_table("business_units") as batch_op:
        batch_op.add_column(sa.Column("near_address", sa.String(), nullable=True))
        batch_op.alter_column("longitude", existing_type=sa.Float(), nullable=False)
        batch_op.alter_column("latitude", existing_type=sa.Float(), nullable=False)
        batch_op.alter_column("city", existing_type=sa.String(), nullable=False)
        batch_op.alter_column("country", existing_type=sa.String(), nullable=False)
