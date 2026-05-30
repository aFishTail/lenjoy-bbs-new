from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.core.messages import Posts
from lenjoy_bbs.modules.posts.models import Post, PostTag
from lenjoy_bbs.modules.posts.lifecycle import refund_active_bounty_reserve
from lenjoy_bbs.modules.posts.presenters import serialize_post
from lenjoy_bbs.modules.posts.read_service import read_post_comments
from lenjoy_bbs.modules.users.models import UserAccount


async def list_posts(
    db: AsyncSession,
    *,
    status_value: str | None = None,
    post_type: str | None = None,
    author: str | None = None,
    category_id: int | None = None,
    tag_id: int | None = None,
) -> list[dict]:
    query = select(Post)
    if author:
        pattern = f"%{author.strip()}%"
        query = query.join(UserAccount, UserAccount.id == Post.author_id).where(
            or_(UserAccount.username.ilike(pattern), UserAccount.email.ilike(pattern))
        )
    if tag_id:
        query = query.join(PostTag, PostTag.post_id == Post.id).where(PostTag.tag_id == tag_id)
    if status_value:
        query = query.where(Post.status == status_value)
    if post_type:
        query = query.where(Post.post_type == post_type)
    if category_id:
        query = query.where(Post.category_id == category_id)
    posts = (await db.scalars(query.order_by(Post.created_at.desc()))).unique().all()
    return [await serialize_post(db, post) for post in posts]


async def list_bounty_comments(db: AsyncSession, post_id: int) -> list[dict]:
    post = await db.get(Post, post_id)
    if not post:
        raise ApiError(Posts.POST_NOT_FOUND)
    return await read_post_comments(db, post_id, None)


async def list_bounties(
    db: AsyncSession,
    *,
    bounty_status: str | None = None,
    keyword: str | None = None,
) -> list[dict]:
    query = select(Post).where(Post.post_type == "BOUNTY")
    if bounty_status:
        query = query.where(Post.bounty_status == bounty_status)
    if keyword:
        query = query.where(Post.title.ilike(f"%{keyword.strip()}%"))
    posts = (await db.scalars(query.order_by(Post.created_at.desc()))).all()
    return [await serialize_post(db, post) for post in posts]


async def apply_post_offline(db: AsyncSession, post: Post, admin_id: int) -> None:
    await refund_active_bounty_reserve(db, post, "offline", admin_id)
    if post.post_type == "BOUNTY" and post.bounty_status == "ACTIVE":
        post.bounty_status = "CANCELLED"
    post.status = "OFFLINE"
    post.offlined_by = admin_id


async def offline_post(db: AsyncSession, post_id: int, admin_id: int) -> None:
    post = await db.get(Post, post_id)
    if not post:
        raise ApiError(Posts.POST_NOT_FOUND)
    await apply_post_offline(db, post, admin_id)
    await db.commit()


async def online_post(db: AsyncSession, post_id: int) -> None:
    post = await db.get(Post, post_id)
    if not post:
        raise ApiError(Posts.POST_NOT_FOUND)
    post.status = "PUBLISHED"
    post.offlined_by = None
    post.offlined_at = None
    await db.commit()


__all__ = ["apply_post_offline", "list_bounties", "list_posts", "offline_post", "online_post"]
