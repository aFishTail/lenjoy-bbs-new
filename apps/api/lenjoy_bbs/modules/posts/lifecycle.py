import logging

from fastapi import status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.core.logging import log_event
from lenjoy_bbs.core.messages import Posts
from lenjoy_bbs.modules.posts.models import Post, PostTag
from lenjoy_bbs.modules.posts.repository import find_post
from lenjoy_bbs.modules.posts.schemas import PostCreateRequest, PostUpdateRequest
from lenjoy_bbs.modules.taxonomy.models import Tag
from lenjoy_bbs.modules.users.models import UserAccount
from lenjoy_bbs.modules.wallet.asset_ledger import refund_bounty_reserve, reserve_bounty_funds

logger = logging.getLogger("lenjoy_bbs.posts.lifecycle")


async def refund_active_bounty_reserve(db: AsyncSession, post: Post,
                                       reason: str,
                                       operated_by: int | None = None) -> None:
    bounty_amount = post.bounty_amount or 0
    if (post.post_type != "BOUNTY" or post.bounty_status != "ACTIVE"
            or post.accepted_comment_id is not None or bounty_amount <= 0):
        return
    await refund_bounty_reserve(db, post.author_id, post.id, bounty_amount,
                                reason, operated_by)


async def _validated_tag_ids(db: AsyncSession,
                             tag_ids: list[int]) -> list[int]:
    normalized_tag_ids = list(dict.fromkeys(tag_ids))
    if not normalized_tag_ids:
        return normalized_tag_ids

    existing_tag_ids = set(
        (await
         db.scalars(select(Tag.id).where(Tag.id.in_(normalized_tag_ids))
                    )).all())
    missing_tag_ids = [
        tag_id for tag_id in normalized_tag_ids
        if tag_id not in existing_tag_ids
    ]
    if missing_tag_ids:
        raise ApiError(Posts.TAG_NOT_FOUND)
    return normalized_tag_ids


async def _replace_post_tags(db: AsyncSession, post_id: int,
                             tag_ids: list[int]) -> None:
    await db.execute(delete(PostTag).where(PostTag.post_id == post_id))
    for tag_id in await _validated_tag_ids(db, tag_ids):
        db.add(PostTag(post_id=post_id, tag_id=tag_id))


async def create_post_for_author_id(db: AsyncSession,
                                    payload: PostCreateRequest,
                                    author_id: int,
                                    *,
                                    commit: bool = True) -> Post:
    post = Post(
        author_id=author_id,
        post_type=payload.post_type,
        title=payload.title,
        content=payload.content,
        hidden_content=payload.hidden_content,
        price=payload.price,
        category_id=payload.category_id,
        bounty_amount=payload.bounty_amount,
        bounty_expire_at=payload.bounty_expire_at,
        bounty_status="ACTIVE" if payload.post_type == "BOUNTY" else None,
        view_count=0,
    )
    db.add(post)
    await db.flush()
    await _replace_post_tags(db, post.id, payload.tag_ids)
    bounty_amount = post.bounty_amount or 0
    if post.post_type == "BOUNTY" and bounty_amount > 0:
        await reserve_bounty_funds(db, author_id, post.id, bounty_amount)
    if commit:
        await db.commit()
        await db.refresh(post)
    return post


async def create_post(db: AsyncSession, payload: PostCreateRequest,
                      author: UserAccount) -> Post:
    author_id = author.id
    try:
        post = await create_post_for_author_id(db, payload, author_id)
        log_event(logger,
                  logging.INFO,
                  "posts.created",
                  post_id=post.id,
                  user_id=author_id,
                  post_type=post.post_type)
        return post
    except Exception:
        await db.rollback()
        logger.exception(
            "posts.create_failed",
            extra={
                "event": "posts.create_failed",
                "user_id": author_id,
                "post_type": payload.post_type
            },
        )
        raise


async def update_post(db: AsyncSession, post_id: int,
                      payload: PostUpdateRequest, author: UserAccount) -> Post:
    author_id = author.id
    try:
        post = await find_post(db, post_id)
        if not post:
            raise ApiError(Posts.POST_NOT_FOUND)
        if post.author_id != author_id:
            raise ApiError(Posts.UPDATE_FORBIDDEN)
        if payload.title is not None:
            post.title = payload.title
        for field in ["content", "hidden_content", "price", "category_id"]:
            if field in payload.model_fields_set:
                setattr(post, field, getattr(payload, field))
        if "tag_ids" in payload.model_fields_set:
            await _replace_post_tags(db, post.id, payload.tag_ids)
        await db.flush()
        await db.commit()
        await db.refresh(post)
        log_event(logger,
                  logging.INFO,
                  "posts.updated",
                  post_id=post.id,
                  user_id=author_id)
        return post
    except Exception:
        await db.rollback()
        logger.exception("posts.update_failed",
                         extra={
                             "event": "posts.update_failed",
                             "post_id": post_id,
                             "user_id": author_id
                         })
        raise


async def delete_post(db: AsyncSession, post_id: int,
                      author: UserAccount) -> None:
    author_id = author.id
    post = await find_post(db, post_id)
    if not post:
        raise ApiError(Posts.POST_NOT_FOUND)
    if post.author_id != author_id:
        raise ApiError(Posts.DELETE_FORBIDDEN)
    try:
        await refund_active_bounty_reserve(db, post, "deleted", author_id)
        if post.post_type == "BOUNTY" and post.bounty_status == "ACTIVE":
            post.bounty_status = "CANCELLED"
        post.is_deleted = True
        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception("posts.delete_failed",
                         extra={
                             "event": "posts.delete_failed",
                             "post_id": post_id,
                             "user_id": author_id
                         })
        raise
    log_event(logger,
              logging.INFO,
              "posts.deleted",
              post_id=post.id,
              user_id=author_id)


__all__ = [
    "create_post", "create_post_for_author_id", "delete_post",
    "refund_active_bounty_reserve", "update_post"
]
