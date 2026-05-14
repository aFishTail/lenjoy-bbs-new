from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.modules.posts.models import Post, PostComment, ResourcePurchase


async def find_post(db: AsyncSession, post_id: int, include_deleted: bool = False) -> Post | None:
    query = select(Post).where(Post.id == post_id)
    if not include_deleted:
        query = query.where(Post.is_deleted.is_(False))
    return await db.scalar(query)


async def find_published_post(db: AsyncSession, post_id: int) -> Post | None:
    return await db.scalar(
        select(Post).where(
            Post.id == post_id,
            Post.is_deleted.is_(False),
            Post.status == "PUBLISHED",
        )
    )


async def list_published_posts(db: AsyncSession, limit: int = 20, offset: int = 0) -> list[Post]:
    result = await db.scalars(
        select(Post)
        .where(Post.is_deleted.is_(False), Post.status == "PUBLISHED")
        .order_by(desc(Post.created_at))
        .limit(limit)
        .offset(offset)
    )
    return result.unique().all()


async def user_purchased_post(db: AsyncSession, post_id: int, user_id: int) -> bool:
    return bool(
        await db.scalar(
            select(ResourcePurchase).where(
                ResourcePurchase.post_id == post_id,
                ResourcePurchase.buyer_id == user_id,
                ResourcePurchase.status == "PAID",
            )
        )
    )


async def list_comments(db: AsyncSession, post_id: int) -> list[PostComment]:
    result = await db.scalars(
        select(PostComment)
        .where(PostComment.post_id == post_id, PostComment.is_deleted.is_(False))
        .order_by(PostComment.created_at.asc())
    )
    return result.unique().all()
