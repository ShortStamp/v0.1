"""merge heads

Revision ID: f640240f6b54
Revises: d4f1a9e73c02, e3a17b52d904
Create Date: 2026-02-21 19:31:39.710887

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f640240f6b54'
down_revision: Union[str, None] = ('d4f1a9e73c02', 'e3a17b52d904')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
