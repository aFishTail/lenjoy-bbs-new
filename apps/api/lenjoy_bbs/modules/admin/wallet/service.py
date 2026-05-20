import logging

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.core.logging import log_event
from lenjoy_bbs.modules.posts.models import ResourcePurchase
from lenjoy_bbs.modules.wallet.asset_ledger import apply_admin_adjustment
from lenjoy_bbs.modules.wallet.models import Wallet, WalletLedger

logger = logging.getLogger("lenjoy_bbs.admin")


async def list_wallets(db: AsyncSession) -> list[dict]:
    rows = (await db.scalars(select(Wallet))).all()
    return [
        model_dict(
            wallet,
            ["id", "user_id", "available_coins", "frozen_coins", "updated_at"])
        for wallet in rows
    ]


async def list_wallet_ledger(db: AsyncSession) -> list[dict]:
    rows = (await db.scalars(
        select(WalletLedger).order_by(
            WalletLedger.created_at.desc()).limit(100))).all()
    return [
        model_dict(row, [
            "id", "user_id", "direction", "change_amount", "balance_after",
            "biz_type", "created_at"
        ]) for row in rows
    ]


async def list_resource_trades(db: AsyncSession) -> list[dict]:
    rows = (await db.scalars(
        select(ResourcePurchase).order_by(
            ResourcePurchase.created_at.desc()).limit(100))).all()
    return [
        model_dict(row, [
            "id", "post_id", "buyer_id", "seller_id", "price", "status",
            "created_at"
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
        "frozenCoins": wallet.frozen_coins
    }


__all__ = [
    "list_resource_trades", "list_wallet_ledger", "list_wallets",
    "update_wallet_coins"
]
