from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from lenjoy_bbs.db.base import now_utc
from lenjoy_bbs.modules.messages.models import SiteMessage
from lenjoy_bbs.modules.posts.models import Post, ResourcePurchase
from lenjoy_bbs.modules.users.models import UserAccount


async def create_site_message(
    db: AsyncSession,
    *,
    user_id: int,
    title: str,
    content: str,
    message_type: str,
) -> SiteMessage:
    message = SiteMessage(
        user_id=user_id,
        title=title,
        content=content,
        message_type=message_type,
    )
    db.add(message)
    await db.flush()
    return message


async def _backfill_trade_messages_if_missing(db: AsyncSession,
                                              user_id: int) -> None:
    existing_count = await db.scalar(
        select(func.count()).select_from(SiteMessage).where(
            SiteMessage.user_id == user_id)) or 0
    if existing_count:
        return

    buyer = aliased(UserAccount)
    seller = aliased(UserAccount)
    rows = (await db.execute(
        select(
            ResourcePurchase,
            Post.title,
            buyer.username,
            seller.username,
        ).join(Post, Post.id == ResourcePurchase.post_id).join(
            buyer, buyer.id == ResourcePurchase.buyer_id).join(
                seller, seller.id == ResourcePurchase.seller_id).where(
                    or_(
                        ResourcePurchase.buyer_id == user_id,
                        ResourcePurchase.seller_id == user_id,
                    )).order_by(ResourcePurchase.created_at.desc()).limit(50)))
    trade_rows = rows.all()
    if not trade_rows:
        return

    for purchase, post_title, buyer_username, _seller_username in trade_rows:
        if purchase.buyer_id == user_id:
            db.add(
                SiteMessage(
                    user_id=user_id,
                    title="资源购买成功",
                    content=f"你已购买资源《{post_title}》，支付 {purchase.price} 金币。",
                    message_type="RESOURCE_PURCHASED",
                    created_at=purchase.created_at,
                ))
            continue

        db.add(
            SiteMessage(
                user_id=user_id,
                title="资源售出提醒",
                content=
                f"{buyer_username or '有用户'}购买了你的资源《{post_title}》，你已获得 {purchase.price} 金币。",
                message_type="RESOURCE_SOLD",
                created_at=purchase.created_at,
            ))
    await db.commit()


def serialize_message(row: SiteMessage) -> dict:
    return {
        "id": row.id,
        "title": row.title,
        "content": row.content,
        "messageType": row.message_type,
        "read": row.is_read,
        "readAt": row.read_at.isoformat() if row.read_at else None,
        "createdAt": row.created_at.isoformat(),
        "actionUrl": None,
    }


async def list_messages(db: AsyncSession, user_id: int,
                        limit: int) -> list[dict]:
    await _backfill_trade_messages_if_missing(db, user_id)
    rows = (await db.scalars(
        select(SiteMessage).where(SiteMessage.user_id == user_id).order_by(
            SiteMessage.created_at.desc()).limit(limit))).all()
    return [serialize_message(row) for row in rows]


async def unread_count(db: AsyncSession, user_id: int) -> int:
    await _backfill_trade_messages_if_missing(db, user_id)
    return await db.scalar(
        select(func.count()).select_from(SiteMessage).where(
            SiteMessage.user_id == user_id, SiteMessage.is_read.is_(False))
    ) or 0


async def mark_message_read(db: AsyncSession, user_id: int,
                            message_id: int) -> dict | None:
    message = await db.scalar(
        select(SiteMessage).where(SiteMessage.id == message_id,
                                  SiteMessage.user_id == user_id))
    if not message:
        return
    message.is_read = True
    message.read_at = now_utc()
    await db.commit()
    await db.refresh(message)
    return serialize_message(message)


async def mark_all_messages_read(db: AsyncSession, user_id: int) -> int:
    rows = (await db.scalars(
        select(SiteMessage).where(SiteMessage.user_id == user_id,
                                  SiteMessage.is_read.is_(False)))).all()
    for row in rows:
        row.is_read = True
        row.read_at = now_utc()
    await db.commit()
    return len(rows)


__all__ = [
    "create_site_message",
    "list_messages",
    "mark_all_messages_read",
    "mark_message_read",
    "serialize_message",
    "unread_count",
]
