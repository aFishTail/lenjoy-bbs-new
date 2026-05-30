import logging

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.core.logging import log_event
from lenjoy_bbs.modules.common import model_dict
from lenjoy_bbs.modules.posts.models import ResourcePurchase
from lenjoy_bbs.modules.wallet.asset_ledger import apply_admin_adjustment
from lenjoy_bbs.modules.wallet.models import Wallet, WalletLedger

logger = logging.getLogger("lenjoy_bbs.admin")


async def list_wallets(db: AsyncSession, status: str | None = None, keyword: str | None = None) -> list[dict]:
    from lenjoy_bbs.modules.users.models import UserAccount

    stmt = (
        select(Wallet, UserAccount)
        .join(UserAccount, UserAccount.id == Wallet.user_id)
        .order_by(Wallet.updated_at.desc())
    )
    if status:
        stmt = stmt.where(UserAccount.status == status)
    if keyword:
        kw = f"%{keyword}%"
        stmt = stmt.where(or_(
            UserAccount.username.ilike(kw),
            UserAccount.email.ilike(kw),
            UserAccount.phone.ilike(kw),
        ))

    rows = (await db.execute(stmt)).all()
    return [
        {
            "id": wallet.id,
            "userId": wallet.user_id,
            "username": user_account.username,
            "nickname": user_account.nickname,
            "email": user_account.email,
            "phone": user_account.phone,
            "status": user_account.status,
            "availableCoins": wallet.available_coins,
            "frozenCoins": wallet.frozen_coins,
            "totalCoins": wallet.available_coins + wallet.frozen_coins,
            "createdAt": user_account.created_at.isoformat(),
            "updatedAt": wallet.updated_at.isoformat(),
        }
        for wallet, user_account in rows
    ]


async def list_wallet_ledger(
    db: AsyncSession,
    user_id: int | None = None,
    biz_type: str | None = None,
    limit: int = 100,
) -> list[dict]:
    stmt = (
        select(WalletLedger)
        .order_by(WalletLedger.created_at.desc())
        .limit(limit)
    )
    if user_id:
        stmt = stmt.where(WalletLedger.user_id == user_id)
    if biz_type:
        stmt = stmt.where(WalletLedger.biz_type == biz_type)

    rows = (await db.scalars(stmt)).all()
    return [
        model_dict(row, [
            "id", "user_id", "direction", "change_amount", "balance_after",
            "frozen_after", "biz_type", "operated_by", "remark", "created_at"
        ]) for row in rows
    ]


async def list_resource_trades(
    db: AsyncSession,
    user_id: int | None = None,
    post_id: int | None = None,
    limit: int = 100,
) -> list[dict]:
    stmt = (
        select(ResourcePurchase)
        .order_by(ResourcePurchase.created_at.desc())
        .limit(limit)
    )
    if user_id:
        stmt = stmt.where(
            (ResourcePurchase.buyer_id == user_id) |
            (ResourcePurchase.seller_id == user_id)
        )
    if post_id:
        stmt = stmt.where(ResourcePurchase.post_id == post_id)

    rows = (await db.scalars(stmt)).all()
    return [
        model_dict(row, [
            "id", "post_id", "buyer_id", "seller_id", "price", "refunded_amount",
            "status", "created_at"
        ]) for row in rows
    ]


async def update_wallet_coins(db: AsyncSession, user_id: int, amount: int,
                              reason: str | None, admin_id: int) -> dict:
    wallet = await apply_admin_adjustment(db, user_id, amount, reason,
                                          admin_id)
    await db.commit()
    log_event(logger,
              logging.INFO,
              "admin.wallet_adjusted",
              target_user_id=user_id,
              user_id=admin_id,
              amount=amount)
    return {
        "userId": user_id,
        "availableCoins": wallet.available_coins,
        "frozenCoins": wallet.frozen_coins,
        "totalCoins": wallet.available_coins + wallet.frozen_coins,
    }


__all__ = [
    "list_resource_trades", "list_wallet_ledger", "list_wallets",
    "update_wallet_coins"
]
