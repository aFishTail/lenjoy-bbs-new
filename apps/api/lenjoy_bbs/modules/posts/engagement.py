import logging
from datetime import UTC, datetime, timedelta
from typing import Protocol

from redis.asyncio import Redis
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.core.config import get_settings
from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.core.logging import log_event
from lenjoy_bbs.core.messages import Posts
from lenjoy_bbs.core.redis_keys import redis_key
from lenjoy_bbs.modules.messages.service import create_site_message
from lenjoy_bbs.modules.posts.models import CommentLike, Post, PostComment, PostFavorite, PostLike
from lenjoy_bbs.modules.posts.repository import find_published_post
from lenjoy_bbs.modules.posts.schemas import CommentCreateRequest
from lenjoy_bbs.modules.users.models import UserAccount

logger = logging.getLogger("lenjoy_bbs.posts.engagement")
POST_VIEW_TTL_SECONDS = 1800


class PostViewStore(Protocol):

    async def mark_seen(self, post_id: int, viewer_key: str,
                        ttl_seconds: int) -> bool:
        ...


class MemoryPostViewStore:

    def __init__(self) -> None:
        self._items: dict[str, datetime] = {}

    async def mark_seen(self, post_id: int, viewer_key: str,
                        ttl_seconds: int) -> bool:
        key = self._key(post_id, viewer_key)
        expires_at = self._items.get(key)
        now = datetime.now(UTC)
        if expires_at and now <= expires_at:
            return False
        self._items[key] = now + timedelta(seconds=ttl_seconds)
        return True

    def _key(self, post_id: int, viewer_key: str) -> str:
        return redis_key("post", "view", post_id, viewer_key)


class RedisPostViewStore:

    def __init__(self) -> None:
        self._redis = Redis.from_url(get_settings().resolved_redis_url,
                                     decode_responses=True)

    async def mark_seen(self, post_id: int, viewer_key: str,
                        ttl_seconds: int) -> bool:
        try:
            created = await self._redis.set(self._key(post_id, viewer_key),
                                            "1",
                                            ex=ttl_seconds,
                                            nx=True)
            return bool(created)
        except Exception:
            logger.exception("posts.view_dedupe_failed",
                             extra={
                                 "event": "posts.view_dedupe_failed",
                                 "post_id": post_id,
                                 "viewer_key": viewer_key,
                             })
            return True

    def _key(self, post_id: int, viewer_key: str) -> str:
        return redis_key("post", "view", post_id, viewer_key)


_memory_post_view_store = MemoryPostViewStore()


def get_post_view_store() -> PostViewStore:
    settings = get_settings()
    if settings.is_test or settings.uses_sqlite:
        return _memory_post_view_store
    return RedisPostViewStore()


async def create_comment(db: AsyncSession, post_id: int,
                         payload: CommentCreateRequest,
                         author: UserAccount) -> PostComment:
    author_id = author.id
    if not await find_published_post(db, post_id):
        raise ApiError(Posts.POST_NOT_FOUND)
    comment = PostComment(
        post_id=post_id,
        author_id=author.id,
        parent_id=payload.parent_id,
        reply_to_user_id=payload.reply_to_user_id,
        content=payload.content,
    )
    db.add(comment)
    await db.flush()
    await db.commit()
    await db.refresh(comment)
    log_event(logger,
              logging.INFO,
              "posts.comment_created",
              post_id=post_id,
              comment_id=comment.id,
              user_id=author_id)
    return comment


async def _toggle_post_interaction(
        db: AsyncSession, post_id: int, user: UserAccount,
        model: type[PostLike] | type[PostFavorite], created_event: str,
        removed_event: str, message_type: str, message_title: str,
        message_action: str) -> dict[str, int | bool]:
    post = await find_published_post(db, post_id)
    if not post:
        raise ApiError(Posts.POST_NOT_FOUND)

    user_id = user.id
    statement = select(model).where(model.post_id == post_id,
                                    model.user_id == user_id)
    existing = await db.scalar(statement)
    active = existing is None

    try:
        if existing is None:
            db.add(model(post_id=post_id, user_id=user_id))
            if post.author_id != user_id:
                await create_site_message(
                    db,
                    user_id=post.author_id,
                    title=message_title,
                    content=
                    f"{user.username}刚刚{message_action}了你的帖子《{post.title}》。",
                    message_type=message_type,
                )
        else:
            await db.delete(existing)
        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception("posts.interaction_toggle_failed",
                         extra={
                             "event": "posts.interaction_toggle_failed",
                             "post_id": post_id,
                             "user_id": user_id,
                             "model": model.__name__,
                         })
        raise

    count = await db.scalar(
        select(func.count()).select_from(model).where(model.post_id == post_id)
    ) or 0
    log_event(logger,
              logging.INFO,
              created_event if active else removed_event,
              post_id=post_id,
              user_id=user_id)
    return {"active": active, "count": count}


async def toggle_post_like(db: AsyncSession, post_id: int,
                           user: UserAccount) -> dict[str, int | bool]:
    return await _toggle_post_interaction(
        db,
        post_id,
        user,
        PostLike,
        "posts.like_added",
        "posts.like_removed",
        "POST_LIKED",
        "收到新点赞",
        "点赞",
    )


async def toggle_post_favorite(db: AsyncSession, post_id: int,
                               user: UserAccount) -> dict[str, int | bool]:
    return await _toggle_post_interaction(
        db,
        post_id,
        user,
        PostFavorite,
        "posts.favorite_added",
        "posts.favorite_removed",
        "POST_FAVORITED",
        "收到新收藏",
        "收藏",
    )


async def toggle_comment_like(db: AsyncSession, comment_id: int,
                              user: UserAccount) -> dict[str, int | bool]:
    comment = await db.scalar(
        select(PostComment).join(Post, Post.id == PostComment.post_id).where(
            PostComment.id == comment_id,
            PostComment.is_deleted.is_(False),
            Post.is_deleted.is_(False),
            Post.status == "PUBLISHED",
        ))
    if not comment:
        raise ApiError(Posts.COMMENT_NOT_FOUND)

    user_id = user.id
    existing = await db.scalar(
        select(CommentLike).where(CommentLike.comment_id == comment_id,
                                  CommentLike.user_id == user_id))
    active = existing is None

    try:
        if existing is None:
            db.add(CommentLike(comment_id=comment_id, user_id=user_id))
        else:
            await db.delete(existing)
        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception("posts.comment_like_toggle_failed",
                         extra={
                             "event": "posts.comment_like_toggle_failed",
                             "comment_id": comment_id,
                             "user_id": user_id,
                         })
        raise

    count = await db.scalar(
        select(func.count()).select_from(CommentLike).where(
            CommentLike.comment_id == comment_id)) or 0
    log_event(logger,
              logging.INFO,
              "posts.comment_like_added" if active else
              "posts.comment_like_removed",
              comment_id=comment_id,
              user_id=user_id)
    return {"active": active, "count": count}


async def record_post_view(db: AsyncSession, post_id: int,
                           viewer_key: str) -> tuple[Post, bool]:
    post = await find_published_post(db, post_id)
    if not post:
        raise ApiError(Posts.POST_NOT_FOUND)

    counted = await get_post_view_store().mark_seen(post_id, viewer_key,
                                                    POST_VIEW_TTL_SECONDS)
    if not counted:
        return post, False

    try:
        await db.execute(
            update(Post).where(Post.id == post_id).values(
                view_count=Post.view_count + 1))
        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception("posts.view_record_failed",
                         extra={
                             "event": "posts.view_record_failed",
                             "post_id": post_id,
                             "viewer_key": viewer_key,
                         })
        raise

    refreshed_post = await find_published_post(db, post_id)
    if not refreshed_post:
        raise ApiError(Posts.POST_NOT_FOUND)

    log_event(logger,
              logging.INFO,
              "posts.view_recorded",
              post_id=post_id,
              viewer_key=viewer_key)
    return refreshed_post, True


__all__ = [
    "create_comment", "record_post_view", "toggle_post_favorite",
    "toggle_post_like", "toggle_comment_like"
]
