from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi import status

from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.modules.posts.models import Post
from lenjoy_bbs.modules.posts.presenters import serialize_post


async def list_posts(db: AsyncSession) -> list[dict]:
    posts = (await db.scalars(select(Post).order_by(Post.created_at.desc()))).all()
    return [await serialize_post(db, post) for post in posts]


async def offline_post(db: AsyncSession, post_id: int, admin_id: int) -> None:
    post = await db.get(Post, post_id)
    if not post:
        raise ApiError("POST_NOT_FOUND", "Post does not exist", status.HTTP_404_NOT_FOUND)
    post.status = "OFFLINE"
    post.offlined_by = admin_id
    await db.commit()


async def online_post(db: AsyncSession, post_id: int) -> None:
    post = await db.get(Post, post_id)
    if not post:
        raise ApiError("POST_NOT_FOUND", "Post does not exist", status.HTTP_404_NOT_FOUND)
    post.status = "PUBLISHED"
    post.offlined_by = None
    post.offlined_at = None
    await db.commit()


__all__ = ["list_posts", "offline_post", "online_post"]
