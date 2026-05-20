import logging
from datetime import UTC, datetime, timedelta
from typing import Protocol

from fastapi import status
from redis.asyncio import Redis
from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.core.config import get_settings
from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.core.logging import log_event
from lenjoy_bbs.db.base import now_utc
from lenjoy_bbs.modules.messages.service import create_site_message
from lenjoy_bbs.modules.posts.models import Post, PostComment, PostFavorite, PostLike, PostTag, ResourcePurchase
from lenjoy_bbs.modules.posts.repository import find_post, find_published_post
from lenjoy_bbs.modules.posts.schemas import CommentCreateRequest, PostCreateRequest, PostUpdateRequest
from lenjoy_bbs.modules.taxonomy.models import Tag
from lenjoy_bbs.modules.users.models import UserAccount
from lenjoy_bbs.modules.wallet.service import adjust_available, freeze_available, lock_wallet, spend_frozen

logger = logging.getLogger("lenjoy_bbs.posts")
POST_VIEW_KEY_PREFIX = "post:view:"
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
        return f"{POST_VIEW_KEY_PREFIX}{post_id}:{viewer_key}"


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
        return f"{POST_VIEW_KEY_PREFIX}{post_id}:{viewer_key}"


_memory_post_view_store = MemoryPostViewStore()


def get_post_view_store() -> PostViewStore:
    settings = get_settings()
    if settings.is_test or settings.uses_sqlite:
        return _memory_post_view_store
    return RedisPostViewStore()


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
        raise ApiError("TAG_NOT_FOUND", "One or more tags do not exist",
                       status.HTTP_400_BAD_REQUEST)
    return normalized_tag_ids


async def _replace_post_tags(db: AsyncSession, post_id: int,
                             tag_ids: list[int]) -> None:
    await db.execute(delete(PostTag).where(PostTag.post_id == post_id))
    for tag_id in await _validated_tag_ids(db, tag_ids):
        db.add(PostTag(post_id=post_id, tag_id=tag_id))


async def create_post_for_author_id(
    db: AsyncSession,
    payload: PostCreateRequest,
    author_id: int,
    *,
    commit: bool = True,
) -> Post:
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
    if payload.post_type == "BOUNTY":
        bounty_amount = payload.bounty_amount or 0
        if bounty_amount <= 0:
            raise ApiError("INVALID_BOUNTY_AMOUNT",
                           "Bounty amount must be greater than zero",
                           status.HTTP_400_BAD_REQUEST)
        await freeze_available(
            db, author_id, bounty_amount, "BOUNTY_FREEZE",
            f"bounty:freeze:{post.id}",
            "Bounty post created")
    await _replace_post_tags(db, post.id, payload.tag_ids)
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
            raise ApiError("POST_NOT_FOUND", "Post does not exist",
                           status.HTTP_404_NOT_FOUND)
        if post.author_id != author_id:
            raise ApiError("FORBIDDEN", "Only the author can update this post",
                           status.HTTP_403_FORBIDDEN)
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
        raise ApiError("POST_NOT_FOUND", "Post does not exist",
                       status.HTTP_404_NOT_FOUND)
    if post.author_id != author_id:
        raise ApiError("FORBIDDEN", "Only the author can delete this post",
                       status.HTTP_403_FORBIDDEN)
    post.is_deleted = True
    await db.commit()
    log_event(logger,
              logging.INFO,
              "posts.deleted",
              post_id=post.id,
              user_id=author_id)


async def create_comment(db: AsyncSession, post_id: int,
                         payload: CommentCreateRequest,
                         author: UserAccount) -> PostComment:
    author_id = author.id
    if not await find_published_post(db, post_id):
        raise ApiError("POST_NOT_FOUND", "Post does not exist",
                       status.HTTP_404_NOT_FOUND)
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
        raise ApiError("POST_NOT_FOUND", "Post does not exist",
                       status.HTTP_404_NOT_FOUND)

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


async def record_post_view(db: AsyncSession, post_id: int,
                           viewer_key: str) -> tuple[Post, bool]:
    post = await find_published_post(db, post_id)
    if not post:
        raise ApiError("POST_NOT_FOUND", "Post does not exist",
                       status.HTTP_404_NOT_FOUND)

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
        raise ApiError("POST_NOT_FOUND", "Post does not exist",
                       status.HTTP_404_NOT_FOUND)

    log_event(logger,
              logging.INFO,
              "posts.view_recorded",
              post_id=post_id,
              viewer_key=viewer_key)
    return refreshed_post, True


async def purchase_post(db: AsyncSession, post_id: int,
                        buyer: UserAccount) -> ResourcePurchase:
    buyer_id = buyer.id
    post = await find_published_post(db, post_id)
    if not post:
        raise ApiError("POST_NOT_FOUND", "Post does not exist",
                       status.HTTP_404_NOT_FOUND)
    if post.post_type != "RESOURCE" or not post.hidden_content:
        raise ApiError("POST_NOT_PURCHASABLE",
                       "Post is not a purchasable resource")
    if post.author_id == buyer_id:
        raise ApiError("SELF_PURCHASE_DENIED",
                       "Author cannot purchase their own post")

    price = post.price or 0
    buyer_wallet = await lock_wallet(db, buyer_id)
    if buyer_wallet.available_coins < price:
        raise ApiError("INSUFFICIENT_COINS", "Insufficient coins")

    purchase = ResourcePurchase(post_id=post.id,
                                buyer_id=buyer.id,
                                seller_id=post.author_id,
                                price=price,
                                status="PAID")
    try:
        db.add(purchase)
        await db.flush()
        await adjust_available(db, buyer_id, -price, "RESOURCE_PURCHASE",
                               f"resource:buy:{post.id}:{buyer_id}",
                               "Resource purchase")
        await adjust_available(db, post.author_id, price, "RESOURCE_SALE",
                               f"resource:sell:{post.id}:{buyer_id}",
                               "Resource sale")
        await create_site_message(
            db,
            user_id=buyer_id,
            title="资源购买成功",
            content=f"你已成功购买《{post.title}》，支付 {price} 金币。",
            message_type="RESOURCE_PURCHASED",
        )
        await create_site_message(
            db,
            user_id=post.author_id,
            title="资源售出提醒",
            content=f"{buyer.username}购买了你的资源《{post.title}》，你已获得 {price} 金币。",
            message_type="RESOURCE_SOLD",
        )
        await db.commit()
        await db.refresh(purchase)
    except IntegrityError as exc:
        await db.rollback()
        log_event(logger,
                  logging.WARNING,
                  "posts.purchase_conflict",
                  post_id=post_id,
                  user_id=buyer_id)
        raise ApiError("ALREADY_PURCHASED",
                       "Resource has already been purchased") from exc
    except Exception:
        await db.rollback()
        logger.exception("posts.purchase_failed",
                         extra={
                             "event": "posts.purchase_failed",
                             "post_id": post_id,
                             "user_id": buyer_id
                         })
        raise
    log_event(
        logger,
        logging.INFO,
        "posts.purchase_succeeded",
        post_id=post.id,
        user_id=buyer_id,
        seller_id=post.author_id,
        price=price,
    )
    return purchase


async def accept_bounty_answer(db: AsyncSession, post_id: int, comment_id: int,
                               actor: UserAccount) -> PostComment:
    post = await find_post(db, post_id)
    if not post or post.is_deleted:
        raise ApiError("POST_NOT_FOUND", "Post does not exist",
                       status.HTTP_404_NOT_FOUND)
    if post.post_type != "BOUNTY":
        raise ApiError("POST_NOT_BOUNTY", "Post is not a bounty post",
                       status.HTTP_400_BAD_REQUEST)
    if post.author_id != actor.id:
        raise ApiError("FORBIDDEN", "Only the author can accept an answer",
                       status.HTTP_403_FORBIDDEN)
    if post.bounty_status != "ACTIVE":
        raise ApiError("BOUNTY_NOT_ACTIVE",
                       "Bounty is not active and cannot accept answers")
    if post.accepted_comment_id is not None:
        raise ApiError("BOUNTY_ALREADY_RESOLVED",
                       "Bounty answer has already been accepted")
    if post.bounty_expire_at and post.bounty_expire_at <= now_utc():
        raise ApiError("BOUNTY_EXPIRED",
                       "Bounty has expired and cannot accept answers")

    comment = await db.scalar(
        select(PostComment).where(PostComment.id == comment_id,
                                  PostComment.post_id == post_id))
    if not comment:
        raise ApiError("COMMENT_NOT_FOUND", "Comment does not exist",
                       status.HTTP_404_NOT_FOUND)
    if comment.parent_id is not None:
        raise ApiError("COMMENT_NOT_ACCEPTABLE",
                       "Only top-level answers can be accepted")
    if comment.is_deleted:
        raise ApiError("COMMENT_NOT_ACCEPTABLE",
                       "Deleted comments cannot be accepted")
    if comment.author_id == actor.id:
        raise ApiError("SELF_ACCEPT_DENIED",
                       "Author cannot accept their own answer")

    bounty_amount = post.bounty_amount or 0
    try:
        post.accepted_comment_id = comment.id
        post.bounty_status = "RESOLVED"
        post.bounty_settled_at = now_utc()
        comment.is_accepted = True

        if bounty_amount > 0:
            await spend_frozen(
                db, actor.id, bounty_amount, "BOUNTY_ACCEPTED",
                f"bounty:accept:spend:{post.id}:{comment.id}",
                "Bounty accepted payout")
            await adjust_available(
                db, comment.author_id, bounty_amount, "BOUNTY_REWARD",
                f"bounty:accept:credit:{post.id}:{comment.id}",
                "Bounty reward")

        await create_site_message(
            db,
            user_id=comment.author_id,
            title="悬赏答案被采纳",
            content=f"你在《{post.title}》下的答案已被采纳，获得 {bounty_amount} 金币。",
            message_type="BOUNTY_ACCEPTED",
        )
        await create_site_message(
            db,
            user_id=actor.id,
            title="悬赏已完成",
            content=f"你已采纳《{post.title}》的答案，赏金 {bounty_amount} 金币已结算。",
            message_type="BOUNTY_SETTLED",
        )
        await db.commit()
        await db.refresh(comment)
    except Exception:
        await db.rollback()
        logger.exception("posts.bounty_accept_failed",
                         extra={
                             "event": "posts.bounty_accept_failed",
                             "post_id": post_id,
                             "comment_id": comment_id,
                             "user_id": actor.id,
                         })
        raise

    log_event(logger,
              logging.INFO,
              "posts.bounty_answer_accepted",
              post_id=post_id,
              comment_id=comment_id,
              user_id=actor.id,
              answer_author_id=comment.author_id,
              bounty_amount=bounty_amount)
    return comment


__all__ = [
    "accept_bounty_answer", "create_comment", "create_post",
    "create_post_for_author_id", "delete_post", "purchase_post",
    "record_post_view", "toggle_post_favorite", "toggle_post_like",
    "update_post"
]
