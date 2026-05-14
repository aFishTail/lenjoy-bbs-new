from fastapi import APIRouter

from lenjoy_bbs.core.dependencies import AdminUser, DbSession
from lenjoy_bbs.core.responses import success
from lenjoy_bbs.modules.admin.wallet.schemas import CoinRequest
from lenjoy_bbs.modules.admin.wallet.service import list_resource_trades, list_wallet_ledger, list_wallets, update_wallet_coins

router = APIRouter(tags=["admin"])


@router.get("/coins/users")
async def coin_users(db: DbSession, _: AdminUser):
    return success(await list_wallets(db))


@router.patch("/coins/users/{user_id}")
async def update_coins(user_id: int, payload: CoinRequest, db: DbSession, admin: AdminUser):
    return success(await update_wallet_coins(db, user_id, payload.amount, payload.reason, admin.id))


@router.get("/audit/wallet-ledger")
async def audit_wallet(db: DbSession, _: AdminUser):
    return success(await list_wallet_ledger(db))


@router.get("/audit/resource-trades")
async def audit_trades(db: DbSession, _: AdminUser):
    return success(await list_resource_trades(db))
