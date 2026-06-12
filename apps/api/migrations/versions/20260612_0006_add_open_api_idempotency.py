"""add open api idempotency records

Revision ID: 20260612_0006
Revises: 20260530_0005
Create Date: 2026-06-12
"""

import sqlalchemy as sa
from alembic import op

revision = "20260612_0006"
down_revision = "20260530_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "open_api_idempotency_record",
        sa.Column("id", sa.Integer().with_variant(sa.BigInteger(), "postgresql"),
                  primary_key=True, autoincrement=True),
        sa.Column("client_id", sa.Integer().with_variant(sa.BigInteger(), "postgresql"),
                  sa.ForeignKey("open_api_client.id"), nullable=False),
        sa.Column("idempotency_key", sa.String(128), nullable=False),
        sa.Column("post_id", sa.Integer().with_variant(sa.BigInteger(), "postgresql"),
                  sa.ForeignKey("bbs_post.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("client_id", "idempotency_key"),
    )
    op.create_index(
        "ix_open_api_idempotency_record_post_id",
        "open_api_idempotency_record",
        ["post_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_open_api_idempotency_record_post_id",
        table_name="open_api_idempotency_record",
    )
    op.drop_table("open_api_idempotency_record")
