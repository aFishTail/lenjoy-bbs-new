"""add post view count

Revision ID: 20260515_0003
Revises: 20260515_0002
Create Date: 2026-05-15
"""

import sqlalchemy as sa
from alembic import op

revision = "20260515_0003"
down_revision = "20260515_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "bbs_post",
        sa.Column("view_count",
                  sa.Integer(),
                  nullable=False,
                  server_default="0"),
    )
    op.execute("UPDATE bbs_post SET view_count = 0 WHERE view_count IS NULL")


def downgrade() -> None:
    op.drop_column("bbs_post", "view_count")
