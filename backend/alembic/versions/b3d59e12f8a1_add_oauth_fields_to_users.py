"""add_oauth_fields_to_users

Revision ID: b3d59e12f8a1
Revises: a2c48f34322d
Create Date: 2026-02-17 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3d59e12f8a1'
down_revision: Union[str, None] = 'a2c48f34322d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.alter_column('password_hash',
            existing_type=sa.String(length=200),
            nullable=True)
        batch_op.add_column(sa.Column('oauth_provider', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('oauth_id', sa.String(length=200), nullable=True))
        batch_op.create_unique_constraint('uq_user_oauth', ['oauth_provider', 'oauth_id'])


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_constraint('uq_user_oauth', type_='unique')
        batch_op.drop_column('oauth_id')
        batch_op.drop_column('oauth_provider')
        batch_op.alter_column('password_hash',
            existing_type=sa.String(length=200),
            nullable=False)
