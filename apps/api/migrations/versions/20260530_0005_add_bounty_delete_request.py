"""add bounty delete request

Revision ID: 20260530_0005
Revises: 20260528_0004
Create Date: 2026-05-30
"""

import sqlalchemy as sa
from alembic import op

revision = "20260530_0005"
down_revision = "20260528_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "bounty_delete_request",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("post_id", sa.Integer(), sa.ForeignKey("bbs_post.id"), nullable=False),
        sa.Column("author_id", sa.Integer(), sa.ForeignKey("user_account.id"), nullable=False),
        sa.Column("reason", sa.String(1000), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="PENDING"),
        sa.Column("resolution_note", sa.String(255)),
        sa.Column("handled_by", sa.BigInteger()),
        sa.Column("handled_at", sa.DateTime()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_bounty_delete_request_post_id", "bounty_delete_request", ["post_id"])
    op.create_index("ix_bounty_delete_request_status", "bounty_delete_request", ["status"])


def downgrade() -> None:
    op.drop_index("ix_bounty_delete_request_status", table_name="bounty_delete_request")
    op.drop_index("ix_bounty_delete_request_post_id", table_name="bounty_delete_request")
    op.drop_table("bounty_delete_request")
