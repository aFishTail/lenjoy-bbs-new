from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.core.config import get_settings
from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.modules.wallet.models import Wallet
from lenjoy_bbs.modules.wallet.service import adjust_available, ensure_wallet, freeze_available, lock_wallet, spend_frozen, unfreeze_available


async def grant_registration_gift(db: AsyncSession, user_id: int) -> Wallet:
    await ensure_wallet(db, user_id)
    return await adjust_available(
        db,
        user_id,
        get_settings().initial_register_coins,
        "REGISTER_GIFT",
        f"register:{user_id}",
        "Initial registration coins",
    )


async def apply_admin_adjustment(
    db: AsyncSession,
    user_id: int,
    amount: int,
    reason: str | None,
    admin_id: int,
) -> Wallet:
    return await adjust_available(
        db,
        user_id,
        amount,
        "ADMIN_ADJUST",
        f"admin:{user_id}:{admin_id}:{uuid4()}",
        reason or "Admin adjustment",
        admin_id,
    )


async def reserve_bounty_funds(
    db: AsyncSession,
    author_id: int,
    post_id: int,
    bounty_amount: int,
) -> Wallet:
    return await freeze_available(
        db,
        author_id,
        bounty_amount,
        "BOUNTY_RESERVE",
        f"bounty:reserve:{post_id}:{author_id}",
        "Bounty amount reserved",
    )


async def settle_bounty_reward(
    db: AsyncSession,
    asker_id: int,
    answerer_id: int,
    post_id: int,
    comment_id: int,
    bounty_amount: int,
) -> tuple[Wallet, Wallet]:
    asker_wallet = await spend_frozen(
        db,
        asker_id,
        bounty_amount,
        "BOUNTY_ACCEPTED",
        f"bounty:accept:debit:{post_id}:{comment_id}",
        "Bounty accepted payout",
    )
    answerer_wallet = await adjust_available(
        db,
        answerer_id,
        bounty_amount,
        "BOUNTY_REWARD",
        f"bounty:accept:credit:{post_id}:{comment_id}",
        "Bounty reward",
    )
    return asker_wallet, answerer_wallet


async def refund_bounty_reserve(
    db: AsyncSession,
    author_id: int,
    post_id: int,
    bounty_amount: int,
    reason: str,
    operated_by: int | None = None,
) -> Wallet:
    return await unfreeze_available(
        db,
        author_id,
        bounty_amount,
        "BOUNTY_REFUND",
        f"bounty:refund:{post_id}:{reason}",
        "Bounty reserve refunded",
        operated_by,
    )


async def settle_resource_purchase(
    db: AsyncSession,
    buyer_id: int,
    seller_id: int,
    post_id: int,
    price: int,
) -> tuple[Wallet, Wallet]:
    buyer_wallet = await lock_wallet(db, buyer_id)
    if buyer_wallet.available_coins < price:
        raise ApiError("INSUFFICIENT_COINS", "Insufficient coins")

    buyer_wallet = await adjust_available(
        db,
        buyer_id,
        -price,
        "RESOURCE_PURCHASE",
        f"resource:buy:{post_id}:{buyer_id}",
        "Resource purchase",
    )
    seller_wallet = await adjust_available(
        db,
        seller_id,
        price,
        "RESOURCE_SALE",
        f"resource:sell:{post_id}:{buyer_id}",
        "Resource sale",
    )
    return buyer_wallet, seller_wallet


__all__ = [
    "apply_admin_adjustment",
    "grant_registration_gift",
    "reserve_bounty_funds",
    "refund_bounty_reserve",
    "settle_resource_purchase",
    "settle_bounty_reward",
]
