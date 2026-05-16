"""backfill post types

Revision ID: 20260515_0002
Revises: 20260512_0001
Create Date: 2026-05-15
"""

from alembic import op

revision = "20260515_0002"
down_revision = "20260512_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        UPDATE bbs_post
        SET post_type = 'BOUNTY'
        WHERE post_type = 'NORMAL'
          AND (
            bounty_amount IS NOT NULL
            OR bounty_status IS NOT NULL
            OR bounty_expire_at IS NOT NULL
            OR bounty_settled_at IS NOT NULL
            OR accepted_comment_id IS NOT NULL
          )
        """)
    op.execute("""
        UPDATE bbs_post
        SET post_type = 'RESOURCE'
        WHERE post_type = 'NORMAL'
          AND (
            hidden_content IS NOT NULL
            OR COALESCE(price, 0) > 0
            OR id IN (SELECT post_id FROM resource_purchase)
            OR id IN (SELECT post_id FROM resource_appeal)
          )
        """)


def downgrade() -> None:
    pass
