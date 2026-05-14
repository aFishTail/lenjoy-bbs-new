from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.core.config import get_settings
from lenjoy_bbs.db.base import now_utc
from lenjoy_bbs.modules.wallet.models import Wallet, WalletLedger


async def get_wallet(db: AsyncSession, user_id: int) -> Wallet | None:
    return await db.scalar(select(Wallet).where(Wallet.user_id == user_id))


async def get_wallet_or_default(db: AsyncSession, user_id: int) -> Wallet:
    wallet = await get_wallet(db, user_id)
    if wallet is not None:
        return wallet
    return Wallet(user_id=user_id, available_coins=0, frozen_coins=0)


async def ensure_wallet(db: AsyncSession, user_id: int) -> Wallet:
    wallet = await get_wallet(db, user_id)
    if wallet:
        return wallet
    wallet = Wallet(user_id=user_id, available_coins=0, frozen_coins=0)
    db.add(wallet)
    await db.flush()
    return wallet


async def lock_wallet(db: AsyncSession, user_id: int) -> Wallet:
    query = select(Wallet).where(Wallet.user_id == user_id)
    if not get_settings().uses_sqlite:
        query = query.with_for_update()
    wallet = await db.scalar(query)
    if wallet:
        return wallet
    return await ensure_wallet(db, user_id)


async def add_ledger(
    db: AsyncSession,
    wallet: Wallet,
    user_id: int,
    direction: str,
    amount: int,
    biz_type: str,
    biz_key: str,
    remark: str,
    operated_by: int | None = None,
) -> WalletLedger:
    ledger = WalletLedger(
        wallet_id=wallet.id,
        user_id=user_id,
        direction=direction,
        change_amount=amount,
        balance_after=wallet.available_coins,
        frozen_after=wallet.frozen_coins,
        biz_type=biz_type,
        biz_key=biz_key,
        remark=remark,
        operated_by=operated_by,
    )
    db.add(ledger)
    return ledger


async def adjust_available(
    db: AsyncSession,
    user_id: int,
    delta: int,
    biz_type: str,
    biz_key: str,
    remark: str,
    operated_by: int | None = None,
) -> Wallet:
    wallet = await lock_wallet(db, user_id)
    wallet.available_coins += delta
    wallet.updated_at = now_utc()
    direction = "IN" if delta >= 0 else "OUT"
    await add_ledger(db, wallet, user_id, direction, abs(delta), biz_type, biz_key, remark, operated_by)
    return wallet
