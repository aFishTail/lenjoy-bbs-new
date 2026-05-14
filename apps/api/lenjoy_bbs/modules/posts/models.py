from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from lenjoy_bbs.db.base import Base, IdType, now_utc


class Post(Base):
    __tablename__ = "bbs_post"

    id: Mapped[int] = mapped_column(IdType, primary_key=True, autoincrement=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("user_account.id"), nullable=False)
    post_type: Mapped[str] = mapped_column(String(32), nullable=False)
    category_id: Mapped[int | None] = mapped_column(BigInteger)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str | None] = mapped_column(Text)
    hidden_content: Mapped[str | None] = mapped_column(Text)
    price: Mapped[int | None] = mapped_column(Integer)
    bounty_amount: Mapped[int | None] = mapped_column(Integer)
    bounty_status: Mapped[str | None] = mapped_column(String(32))
    bounty_expire_at: Mapped[datetime | None] = mapped_column(DateTime)
    bounty_settled_at: Mapped[datetime | None] = mapped_column(DateTime)
    accepted_comment_id: Mapped[int | None] = mapped_column(BigInteger)
    status: Mapped[str] = mapped_column(String(32), default="PUBLISHED", nullable=False)
    offline_reason: Mapped[str | None] = mapped_column(String(255))
    offlined_at: Mapped[datetime | None] = mapped_column(DateTime)
    offlined_by: Mapped[int | None] = mapped_column(BigInteger)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc, onupdate=now_utc, nullable=False)


class PostTag(Base):
    __tablename__ = "bbs_post_tag"
    __table_args__ = (UniqueConstraint("post_id", "tag_id"),)

    id: Mapped[int] = mapped_column(IdType, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("bbs_post.id"), nullable=False)
    tag_id: Mapped[int] = mapped_column(ForeignKey("bbs_tag.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc, nullable=False)


class PostComment(Base):
    __tablename__ = "post_comment"

    id: Mapped[int] = mapped_column(IdType, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("bbs_post.id"), nullable=False)
    author_id: Mapped[int] = mapped_column(ForeignKey("user_account.id"), nullable=False)
    parent_id: Mapped[int | None] = mapped_column(BigInteger)
    reply_to_user_id: Mapped[int | None] = mapped_column(BigInteger)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_accepted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    deleted_reason: Mapped[str | None] = mapped_column(String(255))
    deleted_by: Mapped[int | None] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc, onupdate=now_utc, nullable=False)


class PostLike(Base):
    __tablename__ = "post_like"
    __table_args__ = (UniqueConstraint("post_id", "user_id"),)

    id: Mapped[int] = mapped_column(IdType, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("bbs_post.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("user_account.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc, nullable=False)


class PostFavorite(Base):
    __tablename__ = "post_favorite"
    __table_args__ = (UniqueConstraint("post_id", "user_id"),)

    id: Mapped[int] = mapped_column(IdType, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("bbs_post.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("user_account.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc, nullable=False)


class CommentLike(Base):
    __tablename__ = "comment_like"
    __table_args__ = (UniqueConstraint("comment_id", "user_id"),)

    id: Mapped[int] = mapped_column(IdType, primary_key=True, autoincrement=True)
    comment_id: Mapped[int] = mapped_column(ForeignKey("post_comment.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("user_account.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc, nullable=False)


class ResourcePurchase(Base):
    __tablename__ = "resource_purchase"
    __table_args__ = (UniqueConstraint("post_id", "buyer_id"),)

    id: Mapped[int] = mapped_column(IdType, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("bbs_post.id"), nullable=False)
    buyer_id: Mapped[int] = mapped_column(ForeignKey("user_account.id"), nullable=False)
    seller_id: Mapped[int] = mapped_column(ForeignKey("user_account.id"), nullable=False)
    price: Mapped[int] = mapped_column(Integer, nullable=False)
    refunded_amount: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc, onupdate=now_utc, nullable=False)
    refunded_at: Mapped[datetime | None] = mapped_column(DateTime)
