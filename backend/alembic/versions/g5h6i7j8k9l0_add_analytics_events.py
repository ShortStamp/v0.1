"""add analytics_events table

Revision ID: g5h6i7j8k9l0
Revises: f640240f6b54
Create Date: 2026-03-01 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "g5h6i7j8k9l0"
down_revision: Union[str, None] = "f640240f6b54"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "analytics_events",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("anonymous_id", sa.String(36), nullable=False),
        sa.Column("user_id", sa.String(36), nullable=True),
        sa.Column("event_name", sa.String(100), nullable=False),
        sa.Column("properties", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("session_id", sa.String(36), nullable=False),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index("ix_analytics_events_occurred_at", "analytics_events", ["occurred_at"])
    op.create_index("ix_analytics_events_name_occurred", "analytics_events", ["event_name", "occurred_at"])
    op.create_index("ix_analytics_events_user_id", "analytics_events", ["user_id"])
    op.create_index("ix_analytics_events_anon_id", "analytics_events", ["anonymous_id", "occurred_at"])


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS analytics_events")
