"""merge analytics branch with main head

Revision ID: i7j8k9l0m1n2
Revises: b2c3d4e5f6a7, h6i7j8k9l0m1
Create Date: 2026-03-01 00:00:00.000000

Merges:
  b2c3d4e5f6a7 (drop compat build_id FK)  — current DB head
  h6i7j8k9l0m1 (analytics events, reasons col, sequence fix)
"""
from typing import Sequence, Union

from alembic import op

revision: str = "i7j8k9l0m1n2"
down_revision: Union[str, tuple, None] = ("b2c3d4e5f6a7", "h6i7j8k9l0m1")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
