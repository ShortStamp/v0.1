"""add_chemist_known_ingredients

Revision ID: a1b2c3d4e5f6
Revises: f640240f6b54, f1a2b3c4d5e6
Create Date: 2026-02-22 00:00:00.000000

Changes:
  1. Merge heads f640240f6b54 and f1a2b3c4d5e6.
  2. Create chemist_known_ingredients table for INCI ingredient reference data.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, tuple] = ("f640240f6b54", "f1a2b3c4d5e6")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "chemist_known_ingredients",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("inci_name", sa.String(200), nullable=False, unique=True),
        sa.Column("conflict_category", sa.String(50), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_chemist_known_ingredients_category",
        "chemist_known_ingredients",
        ["conflict_category"],
    )


def downgrade() -> None:
    op.drop_index("ix_chemist_known_ingredients_category", table_name="chemist_known_ingredients")
    op.drop_table("chemist_known_ingredients")
