"""add analytics_events table

Revision ID: g5h6i7j8k9l0
Revises: f640240f6b54
Create Date: 2026-03-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "g5h6i7j8k9l0"
down_revision: Union[str, None] = "f640240f6b54"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE analytics_events (
            id            BIGSERIAL PRIMARY KEY,
            anonymous_id  VARCHAR(36)  NOT NULL,
            user_id       VARCHAR(36)  NULL,
            event_name    VARCHAR(100) NOT NULL,
            properties    JSONB        NOT NULL DEFAULT '{}',
            session_id    VARCHAR(36)  NOT NULL,
            occurred_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_analytics_events_occurred_at   ON analytics_events (occurred_at DESC)"
    )
    op.execute(
        "CREATE INDEX ix_analytics_events_name_occurred ON analytics_events (event_name, occurred_at DESC)"
    )
    op.execute(
        "CREATE INDEX ix_analytics_events_user_id       ON analytics_events (user_id) WHERE user_id IS NOT NULL"
    )
    op.execute(
        "CREATE INDEX ix_analytics_events_anon_id       ON analytics_events (anonymous_id, occurred_at DESC)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS analytics_events")
