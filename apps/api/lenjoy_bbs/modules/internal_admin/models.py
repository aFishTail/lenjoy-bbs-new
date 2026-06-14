from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from lenjoy_bbs.db.base import Base, IdType, now_utc


class InternalAdminAuditLog(Base):
    """Audit trail for mutations performed via the internal admin API.

    Every mutation handled by ``internal_admin`` must record a row here so
    that the BBS can attribute the change back to the trusted operator and
    the originating request.
    """

    __tablename__ = "internal_admin_audit_log"

    id: Mapped[int] = mapped_column(IdType, primary_key=True, autoincrement=True)
    domain: Mapped[str] = mapped_column(String(64), nullable=False)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    target_id: Mapped[str | None] = mapped_column(String(64))
    operator_id: Mapped[str] = mapped_column(String(128), nullable=False)
    request_id: Mapped[str] = mapped_column(String(128), nullable=False)
    idempotency_key: Mapped[str | None] = mapped_column(String(128))
    payload: Mapped[str | None] = mapped_column(Text)
    status_code: Mapped[int] = mapped_column(Integer, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=now_utc, nullable=False
    )


__all__ = ["InternalAdminAuditLog"]
