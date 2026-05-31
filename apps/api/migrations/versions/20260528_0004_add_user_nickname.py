"""add user nickname

Revision ID: 20260528_0004
Revises: 20260515_0003
Create Date: 2026-05-28
"""

import sqlalchemy as sa
from alembic import op

revision = "20260528_0004"
down_revision = "20260515_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    columns = {column["name"] for column in sa.inspect(bind).get_columns("user_account")}
    if "nickname" not in columns:
        op.add_column(
            "user_account",
            sa.Column("nickname", sa.String(64), nullable=True),
        )
    op.execute("UPDATE user_account SET nickname = username WHERE nickname IS NULL")
    op.alter_column("user_account", "nickname", nullable=False)


def downgrade() -> None:
    op.drop_column("user_account", "nickname")
