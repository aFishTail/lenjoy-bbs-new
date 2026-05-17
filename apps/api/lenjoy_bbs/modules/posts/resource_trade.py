import logging

from fastapi import status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.core.logging import log_event
from lenjoy_bbs.modules.messages.service import create_site_message
from lenjoy_bbs.modules.posts.models import ResourcePurchase
from lenjoy_bbs.modules.posts.repository import find_published_post
from lenjoy_bbs.modules.users.models import UserAccount
from lenjoy_bbs.modules.wallet.asset_ledger import settle_resource_purchase

logger = logging.getLogger("lenjoy_bbs.posts.resource_trade")


async def purchase_resource_post(db: AsyncSession, post_id: int,
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

    purchase = ResourcePurchase(post_id=post.id,
                                buyer_id=buyer.id,
                                seller_id=post.author_id,
                                price=price,
                                status="PAID")
    try:
        db.add(purchase)
        await db.flush()
        await settle_resource_purchase(db, buyer_id, post.author_id, post.id,
                                       price)
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


__all__ = ["purchase_resource_post"]
