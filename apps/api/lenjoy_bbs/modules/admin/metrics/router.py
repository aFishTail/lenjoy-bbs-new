from fastapi import APIRouter

from lenjoy_bbs.core.dependencies import AdminUser, DbSession
from lenjoy_bbs.core.responses import success
from lenjoy_bbs.modules.admin.metrics.service import dashboard_metrics

router = APIRouter(tags=["admin"])


@router.get("/metrics/dashboard")
async def dashboard(db: DbSession, _: AdminUser):
    return success(await dashboard_metrics(db))

