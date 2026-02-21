"""add_product_variants_and_sephora_fields

Revision ID: d4f1a9e73c02
Revises: c7d92e81f3a5
Create Date: 2026-02-21 00:00:00.000000

Changes:
  1. Add nullable `sephora_product_id` (String 20, indexed) to `products`.
  2. Add nullable `extra_image_urls` (JSON) to `products`.
  3. Create `product_variants` table with shade/color/image/price per SKU.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d4f1a9e73c02"
down_revision: Union[str, None] = "c7d92e81f3a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. New columns on products
    op.add_column(
        "products",
        sa.Column("sephora_product_id", sa.String(length=20), nullable=True),
    )
    op.add_column(
        "products",
        sa.Column("extra_image_urls", sa.JSON(), nullable=True),
    )
    op.create_index(
        "ix_products_sephora_product_id",
        "products",
        ["sephora_product_id"],
        unique=False,
    )

    # 2. New product_variants table
    op.create_table(
        "product_variants",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "product_id",
            sa.String(length=36),
            sa.ForeignKey("products.id"),
            nullable=False,
        ),
        sa.Column("source", sa.String(length=50), nullable=False, server_default="sephora"),
        sa.Column("external_sku_id", sa.String(length=100), nullable=True),
        sa.Column("shade_name", sa.String(length=200), nullable=True),
        sa.Column("hex_color", sa.String(length=10), nullable=True),
        sa.Column("image_url", sa.String(length=500), nullable=True),
        sa.Column("price", sa.Float(), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
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
        sa.UniqueConstraint("product_id", "external_sku_id", name="uq_variant_sku"),
    )
    op.create_index(
        "ix_product_variants_product_id",
        "product_variants",
        ["product_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_product_variants_product_id", table_name="product_variants")
    op.drop_table("product_variants")

    op.drop_index("ix_products_sephora_product_id", table_name="products")
    with op.batch_alter_table("products") as batch_op:
        batch_op.drop_column("extra_image_urls")
        batch_op.drop_column("sephora_product_id")
