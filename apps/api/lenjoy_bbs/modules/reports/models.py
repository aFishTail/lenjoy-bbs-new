from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from lenjoy_bbs.db.base import Base, IdType, now_utc


class ResourceAppeal(Base):
    __tablename__ = "resource_appeal"

    id: Mapped[int] = mapped_column(IdType, primary_key=True, autoincrement=True)
    purchase_id: Mapped[int] = mapped_column(ForeignKey("resource_purchase.id"), unique=True, nullable=False)
    post_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    buyer_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    seller_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    reason: Mapped[str] = mapped_column(String(255), nullable=False)
    detail: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    requested_refund_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    resolved_refund_amount: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    resolution_note: Mapped[str | None] = mapped_column(String(255))
    resolved_by: Mapped[int | None] = mapped_column(BigInteger)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc, onupdate=now_utc, nullable=False)


class PostReport(Base):
    __tablename__ = "post_report"

    id: Mapped[int] = mapped_column(IdType, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("bbs_post.id"), nullable=False)
    reporter_id: Mapped[int] = mapped_column(ForeignKey("user_account.id"), nullable=False)
    reason: Mapped[str] = mapped_column(String(64), nullable=False)
    detail: Mapped[str | None] = mapped_column(String(1000))
    status: Mapped[str] = mapped_column(String(32), default="PENDING", nullable=False)
    resolution_note: Mapped[str | None] = mapped_column(String(255))
    handled_by: Mapped[int | None] = mapped_column(BigInteger)
    handled_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc, onupdate=now_utc, nullable=False)


class BountyDeleteRequest(Base):
    __tablename__ = "bounty_delete_request"

    id: Mapped[int] = mapped_column(IdType, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("bbs_post.id"), nullable=False)
    author_id: Mapped[int] = mapped_column(ForeignKey("user_account.id"), nullable=False)
    reason: Mapped[str] = mapped_column(String(1000), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="PENDING", nullable=False)
    resolution_note: Mapped[str | None] = mapped_column(String(255))
    handled_by: Mapped[int | None] = mapped_column(BigInteger)
    handled_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc, onupdate=now_utc, nullable=False)


class CommentReport(Base):
    __tablename__ = "comment_report"

    id: Mapped[int] = mapped_column(IdType, primary_key=True, autoincrement=True)
    comment_id: Mapped[int] = mapped_column(ForeignKey("post_comment.id"), nullable=False)
    reporter_id: Mapped[int] = mapped_column(ForeignKey("user_account.id"), nullable=False)
    reason: Mapped[str] = mapped_column(String(64), nullable=False)
    detail: Mapped[str | None] = mapped_column(String(1000))
    status: Mapped[str] = mapped_column(String(32), default="PENDING", nullable=False)
    resolution_note: Mapped[str | None] = mapped_column(String(255))
    handled_by: Mapped[int | None] = mapped_column(BigInteger)
    handled_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc, onupdate=now_utc, nullable=False)
