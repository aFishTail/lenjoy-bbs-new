from fastapi import APIRouter

from lenjoy_bbs.modules.admin.router import router as admin_router
from lenjoy_bbs.modules.auth.router import router as auth_router
from lenjoy_bbs.modules.files.router import router as files_router
from lenjoy_bbs.modules.health.router import router as health_router
from lenjoy_bbs.modules.messages.router import router as messages_router
from lenjoy_bbs.modules.open_api.router import admin_router as open_api_admin_router
from lenjoy_bbs.modules.open_api.router import open_router
from lenjoy_bbs.modules.posts.router import router as posts_router
from lenjoy_bbs.modules.reports.router import router as reports_router
from lenjoy_bbs.modules.taxonomy.router import router as taxonomy_router
from lenjoy_bbs.modules.users.router import router as users_router
from lenjoy_bbs.modules.wallet.router import router as wallet_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(wallet_router)
api_router.include_router(posts_router)
api_router.include_router(taxonomy_router)
api_router.include_router(files_router)
api_router.include_router(messages_router)
api_router.include_router(reports_router)
api_router.include_router(admin_router)
api_router.include_router(open_api_admin_router)
api_router.include_router(open_router)
