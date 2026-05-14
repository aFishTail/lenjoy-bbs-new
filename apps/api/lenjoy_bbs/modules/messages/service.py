from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.db.base import now_utc
from lenjoy_bbs.modules.common import model_dict
from lenjoy_bbs.modules.messages.models import SiteMessage


async def list_messages(db: AsyncSession, user_id: int, limit: int) -> list[dict]:
    rows = (
        await db.scalars(
            select(SiteMessage).where(SiteMessage.user_id == user_id).order_by(SiteMessage.created_at.desc()).limit(limit)
        )
    ).all()
    return [model_dict(row, ["id", "title", "content", "message_type", "is_read", "read_at", "created_at"]) for row in rows]


async def unread_count(db: AsyncSession, user_id: int) -> int:
    return await db.scalar(select(func.count()).select_from(SiteMessage).where(SiteMessage.user_id == user_id, SiteMessage.is_read.is_(False))) or 0


async def mark_message_read(db: AsyncSession, user_id: int, message_id: int) -> None:
    message = await db.scalar(select(SiteMessage).where(SiteMessage.id == message_id, SiteMessage.user_id == user_id))
    if not message:
        return
    message.is_read = True
    message.read_at = now_utc()
    await db.commit()


async def mark_all_messages_read(db: AsyncSession, user_id: int) -> int:
    rows = (
        await db.scalars(select(SiteMessage).where(SiteMessage.user_id == user_id, SiteMessage.is_read.is_(False)))
    ).all()
    for row in rows:
        row.is_read = True
        row.read_at = now_utc()
    await db.commit()
    return len(rows)


__all__ = ["list_messages", "mark_all_messages_read", "mark_message_read", "unread_count"]
