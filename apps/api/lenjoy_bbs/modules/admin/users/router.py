from fastapi import APIRouter, Depends

from lenjoy_bbs.core.dependencies import AdminUser, DbSession
from lenjoy_bbs.core.legacy_admin import require_legacy_admin_mutations_enabled
from lenjoy_bbs.core.responses import success
from lenjoy_bbs.modules.admin.users.schemas import StatusRequest
from lenjoy_bbs.modules.admin.users.service import list_users, update_user_status

router = APIRouter(tags=["admin"])
LegacyMutationGate = Depends(require_legacy_admin_mutations_enabled)


@router.get("/users")
async def users(db: DbSession, _: AdminUser, status: str | None = None, keyword: str | None = None):
    return success(await list_users(db, status, keyword))


@router.patch("/users/{user_id}/status", dependencies=[LegacyMutationGate])
async def user_status(user_id: int, payload: StatusRequest, db: DbSession, _: AdminUser):
    await update_user_status(db, user_id, payload.status)
    return success(None)
