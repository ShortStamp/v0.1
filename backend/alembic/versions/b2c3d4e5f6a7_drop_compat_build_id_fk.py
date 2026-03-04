"""drop compatibility_results build_id FK and make nullable

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-02-26 00:00:00.000000

The build_id FK to builds.id causes ForeignKeyViolationError for
unauthenticated users whose build_id is "local-build". The cache is
keyed by build_fingerprint, not build_id, so the FK serves no purpose.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"

    with op.batch_alter_table("compatibility_results") as batch_op:
        # The FK was auto-named by PostgreSQL; SQLite never created a named constraint
        if not is_sqlite:
            batch_op.drop_constraint(
                "compatibility_results_build_id_fkey",
                type_="foreignkey",
            )
        # Widen column to 100 chars and make nullable
        batch_op.alter_column(
            "build_id",
            existing_type=sa.String(36),
            type_=sa.String(100),
            nullable=True,
        )


def downgrade() -> None:
    # Delete rows with invalid build_ids before restoring the FK
    op.execute(
        "DELETE FROM compatibility_results "
        "WHERE build_id IS NULL OR build_id NOT IN (SELECT id FROM builds)"
    )
    op.alter_column(
        "compatibility_results",
        "build_id",
        existing_type=sa.String(100),
        type_=sa.String(36),
        nullable=False,
    )
    op.create_foreign_key(
        "compatibility_results_build_id_fkey",
        "compatibility_results",
        "builds",
        ["build_id"],
        ["id"],
    )
