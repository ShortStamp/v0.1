"""Add ingestion pipeline tables and product fields.

Revision ID: 001_ingestion
Revises: (initial — no prior migrations)
Create Date: 2026-02-13

Changes:
- Create ingestion_locks table (job locking)
- Recreate ingestion_runs with UUID PK and expanded fields
- Recreate stamp_score_history with UUID PK and expanded fields
- Add columns to products: source, source_id, walmart_item_id, last_seen_at
- Make products.upc unique (if not already)
- Add columns to product_prices: source, currency, availability
- Add unique constraint on product_prices(product_id, source)
"""

from alembic import op
import sqlalchemy as sa

revision = "001_ingestion"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- ingestion_locks ---
    op.create_table(
        "ingestion_locks",
        sa.Column("job_name", sa.String(100), primary_key=True),
        sa.Column(
            "locked_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("locked_by", sa.String(200), nullable=False),
    )

    # --- ingestion_runs: drop old (int pk) and recreate ---
    # If the old table exists, drop it. This is safe because run history
    # is operational data, not user data.
    op.execute("DROP TABLE IF EXISTS ingestion_runs CASCADE")

    op.create_table(
        "ingestion_runs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("job_name", sa.String(100), nullable=False, index=True),
        sa.Column("source", sa.String(100), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="STARTED"),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_ms", sa.Integer, nullable=True),
        sa.Column("stats", sa.JSON, nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("error_stack", sa.Text, nullable=True),
        sa.Column("parameters", sa.JSON, nullable=True),
        sa.Column("attempt", sa.Integer, nullable=False, server_default="1"),
    )

    # --- stamp_score_history: drop old and recreate ---
    op.execute("DROP TABLE IF EXISTS stamp_score_history CASCADE")

    op.create_table(
        "stamp_score_history",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("product_id", sa.String(36), nullable=False, index=True),
        sa.Column("old_score", sa.Integer, nullable=False),
        sa.Column("new_score", sa.Integer, nullable=False),
        sa.Column("score_version", sa.String(20), nullable=False, server_default="v0"),
        sa.Column("components", sa.JSON, nullable=True),
        sa.Column("weights", sa.JSON, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # --- products: add new columns ---
    op.add_column(
        "products",
        sa.Column("source", sa.String(50), nullable=False, server_default="manual_seed"),
    )
    op.add_column(
        "products",
        sa.Column("source_id", sa.String(200), nullable=True),
    )
    op.add_column(
        "products",
        sa.Column("walmart_item_id", sa.String(50), nullable=True),
    )
    op.create_index("ix_products_walmart_item_id", "products", ["walmart_item_id"])
    op.add_column(
        "products",
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Make upc unique. First de-duplicate any existing rows that share a upc.
    # Keep the row with the lowest rowid (oldest) for each duplicate upc.
    op.execute("""
        DELETE FROM products
        WHERE id IN (
            SELECT id FROM (
                SELECT id,
                       ROW_NUMBER() OVER (PARTITION BY upc ORDER BY created_at) AS rn
                FROM products
                WHERE upc IS NOT NULL
            ) dupes
            WHERE rn > 1
        )
    """)

    # Drop the old non-unique index (if it exists) before creating unique one
    op.execute("DROP INDEX IF EXISTS ix_products_upc")
    op.create_index("ix_products_upc", "products", ["upc"], unique=True)

    # --- product_prices: add new columns ---
    op.add_column(
        "product_prices",
        sa.Column("source", sa.String(50), nullable=True),
    )
    op.create_index("ix_product_prices_source", "product_prices", ["source"])
    op.add_column(
        "product_prices",
        sa.Column("currency", sa.String(10), nullable=False, server_default="USD"),
    )
    op.add_column(
        "product_prices",
        sa.Column("availability", sa.String(20), nullable=False, server_default="unknown"),
    )

    # Make retailer_id nullable (new rows from ingestion may not have one)
    op.alter_column("product_prices", "retailer_id", nullable=True)

    # Unique constraint on (product_id, source) — NULL sources are exempt
    op.create_unique_constraint(
        "uq_product_price_source", "product_prices", ["product_id", "source"]
    )


def downgrade() -> None:
    # product_prices
    op.drop_constraint("uq_product_price_source", "product_prices", type_="unique")
    op.drop_column("product_prices", "availability")
    op.drop_column("product_prices", "currency")
    op.drop_index("ix_product_prices_source", table_name="product_prices")
    op.drop_column("product_prices", "source")
    op.alter_column("product_prices", "retailer_id", nullable=False)

    # products
    op.drop_index("ix_products_upc", table_name="products")
    op.create_index("ix_products_upc", "products", ["upc"], unique=False)
    op.drop_column("products", "last_seen_at")
    op.drop_index("ix_products_walmart_item_id", table_name="products")
    op.drop_column("products", "walmart_item_id")
    op.drop_column("products", "source_id")
    op.drop_column("products", "source")

    # stamp_score_history — restore old schema
    op.drop_table("stamp_score_history")
    op.create_table(
        "stamp_score_history",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("product_id", sa.String(36), index=True),
        sa.Column("old_score", sa.Integer),
        sa.Column("new_score", sa.Integer),
        sa.Column("components", sa.JSON, nullable=True),
        sa.Column(
            "calculated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )

    # ingestion_runs — restore old schema
    op.drop_table("ingestion_runs")
    op.create_table(
        "ingestion_runs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("source", sa.String(100)),
        sa.Column("status", sa.String(20), server_default="running"),
        sa.Column("products_added", sa.Integer, server_default="0"),
        sa.Column("products_updated", sa.Integer, server_default="0"),
        sa.Column("prices_updated", sa.Integer, server_default="0"),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.drop_table("ingestion_locks")
