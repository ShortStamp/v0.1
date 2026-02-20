"""add_inci_and_compat_cache

Revision ID: c7d92e81f3a5
Revises: 50421d840ff6
Create Date: 2026-02-20 00:00:00.000000

Changes:
  1. Add nullable `inci_ingredients` JSON column to the `products` table.
  2. Create the `compatibility_results` table for caching agent analysis results.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c7d92e81f3a5"
down_revision: Union[str, None] = "50421d840ff6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add inci_ingredients to products (nullable — no batch_alter needed for SQLite)
    op.add_column(
        "products",
        sa.Column("inci_ingredients", sa.JSON(), nullable=True),
    )

    # 2. Create compatibility_results cache table
    op.create_table(
        "compatibility_results",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "build_id",
            sa.String(length=36),
            sa.ForeignKey("builds.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "product_id",
            sa.String(length=36),
            sa.ForeignKey("products.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("is_compatible", sa.Boolean(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("severity", sa.String(length=10), nullable=False),
        sa.Column("source_agent", sa.String(length=20), nullable=False),
        sa.Column("conflicting_product_ids", sa.JSON(), nullable=True),
        sa.Column("evaluated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("build_fingerprint", sa.String(length=64), nullable=False),
        # TimestampMixin columns
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

    # Index on build_fingerprint for fast cache lookups
    op.create_index(
        "ix_compatibility_results_fingerprint",
        "compatibility_results",
        ["build_fingerprint"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_compatibility_results_fingerprint", table_name="compatibility_results")
    op.drop_table("compatibility_results")

    with op.batch_alter_table("products") as batch_op:
        batch_op.drop_column("inci_ingredients")
