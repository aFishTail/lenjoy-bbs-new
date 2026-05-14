import logging

from fastapi import status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.core.logging import log_event
from lenjoy_bbs.modules.posts.models import Post, PostComment, PostTag, ResourcePurchase
from lenjoy_bbs.modules.posts.repository import find_post, find_published_post
from lenjoy_bbs.modules.posts.schemas import CommentCreateRequest, PostCreateRequest, PostUpdateRequest
from lenjoy_bbs.modules.taxonomy.models import Tag
from lenjoy_bbs.modules.users.models import UserAccount
from lenjoy_bbs.modules.wallet.service import adjust_available, lock_wallet

logger = logging.getLogger("lenjoy_bbs.posts")


async def _validated_tag_ids(db: AsyncSession, tag_ids: list[int]) -> list[int]:
    normalized_tag_ids = list(dict.fromkeys(tag_ids))
    if not normalized_tag_ids:
        return normalized_tag_ids

    existing_tag_ids = set((await db.scalars(select(Tag.id).where(Tag.id.in_(normalized_tag_ids)))).all())
    missing_tag_ids = [tag_id for tag_id in normalized_tag_ids if tag_id not in existing_tag_ids]
    if missing_tag_ids:
        raise ApiError("TAG_NOT_FOUND", "One or more tags do not exist", status.HTTP_400_BAD_REQUEST)
    return normalized_tag_ids


async def _replace_post_tags(db: AsyncSession, post_id: int, tag_ids: list[int]) -> None:
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
        post_type=payload.type,
        title=payload.title,
        content=payload.content,
        hidden_content=payload.hidden_content,
        price=payload.price,
        category_id=payload.category_id,
        bounty_amount=payload.bounty_amount,
        bounty_expire_at=payload.bounty_expire_at,
        bounty_status="OPEN" if payload.type == "BOUNTY" else None,
    )
    db.add(post)
    await db.flush()
    await _replace_post_tags(db, post.id, payload.tag_ids)
    if commit:
        await db.commit()
        await db.refresh(post)
    return post


async def create_post(db: AsyncSession, payload: PostCreateRequest, author: UserAccount) -> Post:
    author_id = author.id
    try:
        post = await create_post_for_author_id(db, payload, author_id)
        log_event(logger, logging.INFO, "posts.created", post_id=post.id, user_id=author_id, post_type=post.post_type)
        return post
    except Exception:
        await db.rollback()
        logger.exception(
            "posts.create_failed",
            extra={"event": "posts.create_failed", "user_id": author_id, "post_type": payload.type},
        )
        raise


async def update_post(db: AsyncSession, post_id: int, payload: PostUpdateRequest, author: UserAccount) -> Post:
    author_id = author.id
    try:
        post = await find_post(db, post_id)
        if not post:
            raise ApiError("POST_NOT_FOUND", "Post does not exist", status.HTTP_404_NOT_FOUND)
        if post.author_id != author_id:
            raise ApiError("FORBIDDEN", "Only the author can update this post", status.HTTP_403_FORBIDDEN)
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
        log_event(logger, logging.INFO, "posts.updated", post_id=post.id, user_id=author_id)
        return post
    except Exception:
        await db.rollback()
        logger.exception("posts.update_failed", extra={"event": "posts.update_failed", "post_id": post_id, "user_id": author_id})
        raise


async def delete_post(db: AsyncSession, post_id: int, author: UserAccount) -> None:
    author_id = author.id
    post = await find_post(db, post_id)
    if not post:
        raise ApiError("POST_NOT_FOUND", "Post does not exist", status.HTTP_404_NOT_FOUND)
    if post.author_id != author_id:
        raise ApiError("FORBIDDEN", "Only the author can delete this post", status.HTTP_403_FORBIDDEN)
    post.is_deleted = True
    await db.commit()
    log_event(logger, logging.INFO, "posts.deleted", post_id=post.id, user_id=author_id)


async def create_comment(db: AsyncSession, post_id: int, payload: CommentCreateRequest, author: UserAccount) -> PostComment:
    author_id = author.id
    if not await find_published_post(db, post_id):
        raise ApiError("POST_NOT_FOUND", "Post does not exist", status.HTTP_404_NOT_FOUND)
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
    log_event(logger, logging.INFO, "posts.comment_created", post_id=post_id, comment_id=comment.id, user_id=author_id)
    return comment


async def purchase_post(db: AsyncSession, post_id: int, buyer: UserAccount) -> ResourcePurchase:
    buyer_id = buyer.id
    post = await find_published_post(db, post_id)
    if not post:
        raise ApiError("POST_NOT_FOUND", "Post does not exist", status.HTTP_404_NOT_FOUND)
    if post.post_type != "RESOURCE" or not post.hidden_content:
        raise ApiError("POST_NOT_PURCHASABLE", "Post is not a purchasable resource")
    if post.author_id == buyer_id:
        raise ApiError("SELF_PURCHASE_DENIED", "Author cannot purchase their own post")

    price = post.price or 0
    buyer_wallet = await lock_wallet(db, buyer_id)
    if buyer_wallet.available_coins < price:
        raise ApiError("INSUFFICIENT_COINS", "Insufficient coins")

    purchase = ResourcePurchase(post_id=post.id, buyer_id=buyer.id, seller_id=post.author_id, price=price, status="PAID")
    try:
        db.add(purchase)
        await db.flush()
        await adjust_available(db, buyer_id, -price, "RESOURCE_PURCHASE", f"resource:buy:{post.id}:{buyer_id}", "Resource purchase")
        await adjust_available(db, post.author_id, price, "RESOURCE_SALE", f"resource:sell:{post.id}:{buyer_id}", "Resource sale")
        await db.commit()
        await db.refresh(purchase)
    except IntegrityError as exc:
        await db.rollback()
        log_event(logger, logging.WARNING, "posts.purchase_conflict", post_id=post_id, user_id=buyer_id)
        raise ApiError("ALREADY_PURCHASED", "Resource has already been purchased") from exc
    except Exception:
        await db.rollback()
        logger.exception("posts.purchase_failed", extra={"event": "posts.purchase_failed", "post_id": post_id, "user_id": buyer_id})
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


__all__ = ["create_comment", "create_post", "create_post_for_author_id", "delete_post", "purchase_post", "update_post"]
