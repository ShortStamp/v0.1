"""add reasons to compatibility_results and fix pk sequences

Revision ID: h6i7j8k9l0m1
Revises: g5h6i7j8k9l0
Create Date: 2026-03-01 00:00:00.000000

Changes:
  1. Add `reasons` JSON column (nullable, default []) to compatibility_results.
     The column exists in the SQLAlchemy model but was missing from the
     original c7d92e81f3a5 migration.
  2. Reset all out-of-sync PostgreSQL sequences.
     The SQLite→Supabase data migration inserted rows with explicit integer
     IDs without advancing the sequences, causing duplicate key errors on
     the next INSERT (e.g. refresh_tokens_pkey duplicate key id=3).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "h6i7j8k9l0m1"
down_revision: Union[str, None] = "g5h6i7j8k9l0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add reasons column
    op.add_column(
        "compatibility_results",
        sa.Column(
            "reasons",
            sa.JSON(),
            nullable=True,
            server_default=sa.text("'[]'"),
        ),
    )

    # 2. Reset out-of-sync PK sequences (PostgreSQL only — SQLite uses AUTOINCREMENT)
    bind = op.get_bind()
    if bind.dialect.name != "sqlite":
        op.execute(
            """
            DO $$
            DECLARE
                r        RECORD;
                max_id   BIGINT;
                seq_name TEXT;
            BEGIN
                FOR r IN
                    SELECT c.table_name
                    FROM information_schema.columns c
                    WHERE c.column_name   = 'id'
                      AND c.table_schema  = 'public'
                      AND c.data_type    IN ('integer', 'bigint')
                LOOP
                    seq_name := pg_get_serial_sequence(r.table_name, 'id');
                    IF seq_name IS NOT NULL THEN
                        EXECUTE format(
                            'SELECT COALESCE(MAX(id), 0) FROM %I', r.table_name
                        ) INTO max_id;
                        PERFORM setval(seq_name, GREATEST(max_id, 1));
                    END IF;
                END LOOP;
            END;
            $$;
            """
        )


def downgrade() -> None:
    with op.batch_alter_table("compatibility_results") as batch_op:
        batch_op.drop_column("reasons")
    # Sequences are not restored — that would be unsafe
