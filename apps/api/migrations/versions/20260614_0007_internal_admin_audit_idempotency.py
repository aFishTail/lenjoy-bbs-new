"""add internal admin audit and idempotency

Revision ID: 20260614_0007
Revises: 20260612_0006
Create Date: 2026-06-14
"""

import sqlalchemy as sa
from alembic import op

revision = "20260614_0007"
down_revision = "20260612_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    id_type = sa.Integer().with_variant(sa.BigInteger(), "postgresql")
    op.create_table(
        "internal_admin_audit_log",
        sa.Column("id", id_type, primary_key=True, autoincrement=True),
        sa.Column("domain", sa.String(64), nullable=False),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("target_id", sa.String(64)),
        sa.Column("operator_id", sa.String(128), nullable=False),
        sa.Column("request_id", sa.String(128), nullable=False),
        sa.Column("idempotency_key", sa.String(128)),
        sa.Column("payload", sa.Text()),
        sa.Column("status_code", sa.Integer(), nullable=False),
        sa.Column("error_message", sa.Text()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "internal_admin_idempotency_record",
        sa.Column("id", id_type, primary_key=True, autoincrement=True),
        sa.Column("operation_scope", sa.String(255), nullable=False),
        sa.Column("idempotency_key", sa.String(128), nullable=False),
        sa.Column("request_fingerprint", sa.String(64), nullable=False),
        sa.Column("state", sa.String(16), nullable=False),
        sa.Column("status_code", sa.Integer()),
        sa.Column("response_body", sa.Text()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint(
            "operation_scope",
            "idempotency_key",
            name="uq_internal_admin_idempotency_scope_key",
        ),
    )


def downgrade() -> None:
    op.drop_table("internal_admin_idempotency_record")
    op.drop_table("internal_admin_audit_log")
