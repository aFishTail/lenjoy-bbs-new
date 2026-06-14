from fastapi import APIRouter, Depends

from lenjoy_bbs.core.dependencies import AdminUser, DbSession
from lenjoy_bbs.core.legacy_admin import require_legacy_admin_mutations_enabled
from lenjoy_bbs.core.responses import success
from lenjoy_bbs.modules.admin.bounty_delete_requests.schemas import (
    BountyDeleteRequestReviewRequest,
)
from lenjoy_bbs.modules.admin.bounty_delete_requests.service import (
    list_bounty_delete_requests,
    review_bounty_delete_request,
)

router = APIRouter(tags=["admin"])
LegacyMutationGate = Depends(require_legacy_admin_mutations_enabled)


@router.get("/bounty-delete-requests")
async def bounty_delete_requests(
    db: DbSession,
    _: AdminUser,
    status: str | None = None,
    keyword: str | None = None,
):
    return success(await list_bounty_delete_requests(
        db, status_value=status, keyword=keyword))


@router.patch("/bounty-delete-requests/{request_id}", dependencies=[LegacyMutationGate])
async def bounty_delete_request_status(
    request_id: int,
    payload: BountyDeleteRequestReviewRequest,
    db: DbSession,
    admin: AdminUser,
):
    return success(
        await review_bounty_delete_request(
            db,
            request_id,
            action=payload.action,
            note=payload.resolutionNote,
            admin_id=admin.id,
        ))
