from uuid import uuid4
import logging

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.core.logging import log_event
from lenjoy_bbs.modules.posts.models import ResourcePurchase
from lenjoy_bbs.modules.users.models import UserAccount
from lenjoy_bbs.modules.wallet.models import Wallet, WalletLedger
from lenjoy_bbs.modules.wallet.service import adjust_available

logger = logging.getLogger("lenjoy_bbs.admin")


async def list_wallets(db: AsyncSession, status_value: str | None = None, keyword: str | None = None) -> list[dict]:
    query = select(Wallet, UserAccount).join(UserAccount, UserAccount.id == Wallet.user_id)
    if status_value:
        query = query.where(UserAccount.status == status_value)
    if keyword:
        pattern = f"%{keyword.strip()}%"
        query = query.where(
            or_(
                UserAccount.username.ilike(pattern),
                UserAccount.email.ilike(pattern),
                UserAccount.phone.ilike(pattern),
            )
        )
    rows = (
        await db.execute(query.order_by(UserAccount.id))
    ).all()
    return [
        {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "phone": user.phone,
            "status": user.status,
            "availableCoins": wallet.available_coins,
            "frozenCoins": wallet.frozen_coins,
            "totalCoins": wallet.available_coins + wallet.frozen_coins,
            "createdAt": user.created_at.isoformat(),
            "updatedAt": wallet.updated_at.isoformat(),
        }
        for wallet, user in rows
    ]


async def list_wallet_ledger(
    db: AsyncSession,
    *,
    user_id: int | None = None,
    biz_type: str | None = None,
    limit: int = 100,
) -> list[dict]:
    query = select(WalletLedger)
    if user_id:
        query = query.where(WalletLedger.user_id == user_id)
    if biz_type:
        query = query.where(WalletLedger.biz_type == biz_type)
    rows = (await db.scalars(query.order_by(WalletLedger.created_at.desc()).limit(limit))).all()
    return [
        {
            "id": row.id,
            "direction": row.direction,
            "changeAmount": row.change_amount,
            "balanceAfter": row.balance_after,
            "frozenAfter": row.frozen_after,
            "bizType": row.biz_type,
            "remark": row.remark,
            "operatedBy": row.operated_by,
            "createdAt": row.created_at.isoformat(),
        }
        for row in rows
    ]


async def list_resource_trades(
    db: AsyncSession,
    *,
    user_id: int | None = None,
    post_id: int | None = None,
    limit: int = 100,
) -> list[dict]:
    query = select(ResourcePurchase)
    if user_id:
        query = query.where(or_(ResourcePurchase.buyer_id == user_id, ResourcePurchase.seller_id == user_id))
    if post_id:
        query = query.where(ResourcePurchase.post_id == post_id)
    rows = (await db.scalars(query.order_by(ResourcePurchase.created_at.desc()).limit(limit))).all()
    return [
        {
            "purchaseId": row.id,
            "postId": row.post_id,
            "buyerId": row.buyer_id,
            "sellerId": row.seller_id,
            "price": row.price,
            "refundedAmount": row.refunded_amount,
            "status": row.status,
            "createdAt": row.created_at.isoformat(),
            "updatedAt": row.updated_at.isoformat(),
        }
        for row in rows
    ]


async def update_wallet_coins(db: AsyncSession, user_id: int, amount: int, reason: str | None, admin_id: int) -> dict:
    wallet = await adjust_available(
        db,
        user_id,
        amount,
        "ADMIN_ADJUST",
        f"admin:{user_id}:{admin_id}:{uuid4()}",
        reason or "Admin adjustment",
        admin_id,
    )
    await db.commit()
    log_event(logger, logging.INFO, "admin.wallet_adjusted", target_user_id=user_id, user_id=admin_id, amount=amount)
    return {
        "availableCoins": wallet.available_coins,
        "frozenCoins": wallet.frozen_coins,
        "totalCoins": wallet.available_coins + wallet.frozen_coins,
        "updatedAt": wallet.updated_at.isoformat(),
    }


__all__ = ["list_resource_trades", "list_wallet_ledger", "list_wallets", "update_wallet_coins"]
