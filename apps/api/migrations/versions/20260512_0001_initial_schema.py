"""initial schema

Revision ID: 20260512_0001
Revises:
Create Date: 2026-05-12
"""

import sqlalchemy as sa
from alembic import op

revision = "20260512_0001"
down_revision = None
branch_labels = None
depends_on = None


def audit_columns() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "role",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("role_code", sa.String(64), nullable=False, unique=True),
        sa.Column("role_name", sa.String(128), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "user_account",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("username", sa.String(64), nullable=False, unique=True),
        sa.Column("email", sa.String(128), unique=True),
        sa.Column("phone", sa.String(32), unique=True),
        sa.Column("avatar_url", sa.String(512)),
        sa.Column("bio", sa.String(200)),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="ACTIVE"),
        *audit_columns(),
    )
    op.create_table(
        "user_role",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("user_account.id"), nullable=False),
        sa.Column("role_id", sa.BigInteger(), sa.ForeignKey("role.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "role_id"),
    )
    op.create_table(
        "user_follow",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("follower_id", sa.BigInteger(), sa.ForeignKey("user_account.id"), nullable=False),
        sa.Column("following_id", sa.BigInteger(), sa.ForeignKey("user_account.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("follower_id", "following_id"),
    )
    op.create_table(
        "wallet",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("user_account.id"), nullable=False, unique=True),
        sa.Column("available_coins", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("frozen_coins", sa.Integer(), nullable=False, server_default="0"),
        *audit_columns(),
    )
    op.create_table(
        "wallet_ledger",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("wallet_id", sa.BigInteger(), sa.ForeignKey("wallet.id"), nullable=False),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("user_account.id"), nullable=False),
        sa.Column("direction", sa.String(32), nullable=False),
        sa.Column("change_amount", sa.Integer(), nullable=False),
        sa.Column("balance_after", sa.Integer(), nullable=False),
        sa.Column("frozen_after", sa.Integer(), nullable=False),
        sa.Column("biz_type", sa.String(64), nullable=False),
        sa.Column("biz_key", sa.String(128), unique=True),
        sa.Column("remark", sa.String(255)),
        sa.Column("operated_by", sa.BigInteger()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "bbs_category",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("slug", sa.String(120), nullable=False),
        sa.Column("parent_id", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("content_type", sa.String(32), nullable=False),
        sa.Column("sort", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(32), nullable=False, server_default="ACTIVE"),
        sa.Column("is_leaf", sa.Boolean(), nullable=False, server_default=sa.true()),
        *audit_columns(),
        sa.UniqueConstraint("slug", "content_type"),
    )
    op.create_table(
        "bbs_tag",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("slug", sa.String(120), nullable=False, unique=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="ACTIVE"),
        sa.Column("source", sa.String(32), nullable=False, server_default="SYSTEM"),
        *audit_columns(),
    )
    op.create_table(
        "bbs_post",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("author_id", sa.BigInteger(), sa.ForeignKey("user_account.id"), nullable=False),
        sa.Column("post_type", sa.String(32), nullable=False),
        sa.Column("category_id", sa.BigInteger()),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("content", sa.Text()),
        sa.Column("hidden_content", sa.Text()),
        sa.Column("price", sa.Integer()),
        sa.Column("bounty_amount", sa.Integer()),
        sa.Column("bounty_status", sa.String(32)),
        sa.Column("bounty_expire_at", sa.DateTime()),
        sa.Column("bounty_settled_at", sa.DateTime()),
        sa.Column("accepted_comment_id", sa.BigInteger()),
        sa.Column("status", sa.String(32), nullable=False, server_default="PUBLISHED"),
        sa.Column("offline_reason", sa.String(255)),
        sa.Column("offlined_at", sa.DateTime()),
        sa.Column("offlined_by", sa.BigInteger()),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
        *audit_columns(),
    )
    op.create_table(
        "bbs_post_tag",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("post_id", sa.BigInteger(), sa.ForeignKey("bbs_post.id"), nullable=False),
        sa.Column("tag_id", sa.BigInteger(), sa.ForeignKey("bbs_tag.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("post_id", "tag_id"),
    )
    op.create_table(
        "post_comment",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("post_id", sa.BigInteger(), sa.ForeignKey("bbs_post.id"), nullable=False),
        sa.Column("author_id", sa.BigInteger(), sa.ForeignKey("user_account.id"), nullable=False),
        sa.Column("parent_id", sa.BigInteger()),
        sa.Column("reply_to_user_id", sa.BigInteger()),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("is_accepted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("deleted_reason", sa.String(255)),
        sa.Column("deleted_by", sa.BigInteger()),
        *audit_columns(),
    )
    op.create_table("post_like", sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True), sa.Column("post_id", sa.BigInteger(), sa.ForeignKey("bbs_post.id"), nullable=False), sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("user_account.id"), nullable=False), sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False), sa.UniqueConstraint("post_id", "user_id"))
    op.create_table("post_favorite", sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True), sa.Column("post_id", sa.BigInteger(), sa.ForeignKey("bbs_post.id"), nullable=False), sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("user_account.id"), nullable=False), sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False), sa.UniqueConstraint("post_id", "user_id"))
    op.create_table("comment_like", sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True), sa.Column("comment_id", sa.BigInteger(), sa.ForeignKey("post_comment.id"), nullable=False), sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("user_account.id"), nullable=False), sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False), sa.UniqueConstraint("comment_id", "user_id"))
    op.create_table(
        "resource_purchase",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("post_id", sa.BigInteger(), sa.ForeignKey("bbs_post.id"), nullable=False),
        sa.Column("buyer_id", sa.BigInteger(), sa.ForeignKey("user_account.id"), nullable=False),
        sa.Column("seller_id", sa.BigInteger(), sa.ForeignKey("user_account.id"), nullable=False),
        sa.Column("price", sa.Integer(), nullable=False),
        sa.Column("refunded_amount", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(32), nullable=False),
        *audit_columns(),
        sa.Column("refunded_at", sa.DateTime()),
        sa.UniqueConstraint("post_id", "buyer_id"),
    )
    op.create_table(
        "resource_appeal",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("purchase_id", sa.BigInteger(), sa.ForeignKey("resource_purchase.id"), nullable=False, unique=True),
        sa.Column("post_id", sa.BigInteger(), nullable=False),
        sa.Column("buyer_id", sa.BigInteger(), nullable=False),
        sa.Column("seller_id", sa.BigInteger(), nullable=False),
        sa.Column("reason", sa.String(255), nullable=False),
        sa.Column("detail", sa.Text()),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("requested_refund_amount", sa.Integer(), nullable=False),
        sa.Column("resolved_refund_amount", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("resolution_note", sa.String(255)),
        sa.Column("resolved_by", sa.BigInteger()),
        sa.Column("resolved_at", sa.DateTime()),
        *audit_columns(),
    )
    op.create_table("post_report", sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True), sa.Column("post_id", sa.BigInteger(), sa.ForeignKey("bbs_post.id"), nullable=False), sa.Column("reporter_id", sa.BigInteger(), sa.ForeignKey("user_account.id"), nullable=False), sa.Column("reason", sa.String(64), nullable=False), sa.Column("detail", sa.String(1000)), sa.Column("status", sa.String(32), nullable=False, server_default="PENDING"), sa.Column("resolution_note", sa.String(255)), sa.Column("handled_by", sa.BigInteger()), sa.Column("handled_at", sa.DateTime()), *audit_columns())
    op.create_table("comment_report", sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True), sa.Column("comment_id", sa.BigInteger(), sa.ForeignKey("post_comment.id"), nullable=False), sa.Column("reporter_id", sa.BigInteger(), sa.ForeignKey("user_account.id"), nullable=False), sa.Column("reason", sa.String(64), nullable=False), sa.Column("detail", sa.String(1000)), sa.Column("status", sa.String(32), nullable=False, server_default="PENDING"), sa.Column("resolution_note", sa.String(255)), sa.Column("handled_by", sa.BigInteger()), sa.Column("handled_at", sa.DateTime()), *audit_columns())
    op.create_table("open_api_client", sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True), sa.Column("name", sa.String(100), nullable=False), sa.Column("api_key", sa.String(128), nullable=False, unique=True), sa.Column("status", sa.String(32), nullable=False, server_default="ACTIVE"), sa.Column("remark", sa.String(255)), *audit_columns())
    op.create_table("open_api_account_binding", sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True), sa.Column("client_id", sa.BigInteger(), sa.ForeignKey("open_api_client.id"), nullable=False), sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("user_account.id"), nullable=False), sa.Column("binding_code", sa.String(128), nullable=False, unique=True), sa.Column("status", sa.String(32), nullable=False, server_default="ACTIVE"), sa.Column("remark", sa.String(255)), *audit_columns(), sa.UniqueConstraint("client_id", "user_id"))
    op.create_table("site_message", sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True), sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("user_account.id"), nullable=False), sa.Column("title", sa.String(120), nullable=False), sa.Column("content", sa.String(1000), nullable=False), sa.Column("message_type", sa.String(32), nullable=False), sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()), sa.Column("read_at", sa.DateTime()), sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False))


def downgrade() -> None:
    for table in [
        "site_message",
        "open_api_account_binding",
        "open_api_client",
        "comment_report",
        "post_report",
        "resource_appeal",
        "resource_purchase",
        "comment_like",
        "post_favorite",
        "post_like",
        "post_comment",
        "bbs_post_tag",
        "bbs_post",
        "bbs_tag",
        "bbs_category",
        "wallet_ledger",
        "wallet",
        "user_follow",
        "user_role",
        "user_account",
        "role",
    ]:
        op.drop_table(table)
