from fastapi import APIRouter

from lenjoy_bbs.modules.admin.bounty_delete_requests.router import router as bounty_delete_requests_router
from lenjoy_bbs.modules.admin.metrics.router import router as metrics_router
from lenjoy_bbs.modules.admin.posts.router import router as posts_router
from lenjoy_bbs.modules.admin.reports.router import router as reports_router
from lenjoy_bbs.modules.admin.taxonomy.router import router as taxonomy_router
from lenjoy_bbs.modules.admin.users.router import router as users_router
from lenjoy_bbs.modules.admin.wallet.router import router as wallet_router

router = APIRouter(prefix="/admin", tags=["admin"])

router.include_router(metrics_router)
router.include_router(users_router)
router.include_router(posts_router)
router.include_router(bounty_delete_requests_router)
router.include_router(reports_router)
router.include_router(wallet_router)
router.include_router(taxonomy_router)
