from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from lenjoy_bbs.db.base import Base, IdType, now_utc


class Wallet(Base):
    __tablename__ = "wallet"

    id: Mapped[int] = mapped_column(IdType, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user_account.id"), unique=True, nullable=False)
    available_coins: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    frozen_coins: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc, onupdate=now_utc, nullable=False)


class WalletLedger(Base):
    __tablename__ = "wallet_ledger"

    id: Mapped[int] = mapped_column(IdType, primary_key=True, autoincrement=True)
    wallet_id: Mapped[int] = mapped_column(ForeignKey("wallet.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("user_account.id"), nullable=False)
    direction: Mapped[str] = mapped_column(String(32), nullable=False)
    change_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    balance_after: Mapped[int] = mapped_column(Integer, nullable=False)
    frozen_after: Mapped[int] = mapped_column(Integer, nullable=False)
    biz_type: Mapped[str] = mapped_column(String(64), nullable=False)
    biz_key: Mapped[str | None] = mapped_column(String(128), unique=True)
    remark: Mapped[str | None] = mapped_column(String(255))
    operated_by: Mapped[int | None] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc, nullable=False)
