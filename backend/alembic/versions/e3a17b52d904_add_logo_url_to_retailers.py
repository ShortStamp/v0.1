"""add logo_url to retailers

Revision ID: e3a17b52d904
Revises: c7d92e81f3a5
Create Date: 2026-02-20

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "e3a17b52d904"
down_revision = "c7d92e81f3a5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("retailers", sa.Column("logo_url", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("retailers", "logo_url")
