import logging

from fastapi import status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.core.logging import log_event
from lenjoy_bbs.db.base import now_utc
from lenjoy_bbs.modules.messages.service import create_site_message
from lenjoy_bbs.modules.posts.lifecycle import refund_active_bounty_reserve
from lenjoy_bbs.modules.posts.models import PostComment
from lenjoy_bbs.modules.posts.repository import find_post
from lenjoy_bbs.modules.users.models import UserAccount
from lenjoy_bbs.modules.wallet.asset_ledger import settle_bounty_reward

logger = logging.getLogger("lenjoy_bbs.posts.bounty_settlement")


async def accept_bounty_answer_settlement(db: AsyncSession, post_id: int,
                                          comment_id: int,
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
        try:
            await refund_active_bounty_reserve(db, post, "expired", actor.id)
            post.bounty_status = "EXPIRED"
            await db.commit()
        except Exception:
            await db.rollback()
            logger.exception("posts.bounty_expire_failed",
                             extra={
                                 "event": "posts.bounty_expire_failed",
                                 "post_id": post_id,
                                 "user_id": actor.id,
                             })
            raise
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
            await settle_bounty_reward(db, actor.id, comment.author_id,
                                       post.id, comment.id, bounty_amount)

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


__all__ = ["accept_bounty_answer_settlement"]
