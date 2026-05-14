from fastapi import APIRouter
from sqlalchemy import desc, select

from lenjoy_bbs.core.api_schemas import ApiEnvelope
from lenjoy_bbs.core.dependencies import CurrentUser, DbSession
from lenjoy_bbs.core.responses import success
from lenjoy_bbs.modules.common import model_dict
from lenjoy_bbs.modules.wallet.models import WalletLedger
from lenjoy_bbs.modules.wallet.schemas import WalletLedgerItemResponse, WalletSummaryResponse
from lenjoy_bbs.modules.wallet.service import get_wallet_or_default

router = APIRouter(prefix="/me", tags=["me"])


@router.get("/wallet", response_model=ApiEnvelope[WalletSummaryResponse])
async def my_wallet(db: DbSession, user: CurrentUser):
    wallet = await get_wallet_or_default(db, user.id)
    return success({"availableCoins": wallet.available_coins, "frozenCoins": wallet.frozen_coins})


@router.get("/ledger", response_model=ApiEnvelope[list[WalletLedgerItemResponse]])
async def my_ledger(db: DbSession, user: CurrentUser):
    rows = (
        await db.scalars(
            select(WalletLedger)
            .where(WalletLedger.user_id == user.id)
            .order_by(desc(WalletLedger.created_at))
            .limit(100)
        )
    ).all()
    return success(
        [
            model_dict(
                row,
                [
                    "id",
                    "direction",
                    "change_amount",
                    "balance_after",
                    "frozen_after",
                    "biz_type",
                    "biz_key",
                    "remark",
                    "created_at",
                ],
            )
            for row in rows
        ]
    )
