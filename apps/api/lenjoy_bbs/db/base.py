from datetime import UTC, datetime

from sqlalchemy import BigInteger, Integer
from sqlalchemy.orm import DeclarativeBase


def now_utc() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class Base(DeclarativeBase):
    pass


IdType = Integer().with_variant(BigInteger(), "postgresql")
