from fastapi import APIRouter

from lenjoy_bbs.core.dependencies import AdminUser, DbSession
from lenjoy_bbs.core.responses import success
from lenjoy_bbs.modules.admin.posts.service import list_posts, offline_post, online_post

router = APIRouter(tags=["admin"])


@router.get("/posts")
async def posts(db: DbSession, _: AdminUser):
    return success(await list_posts(db))


@router.patch("/posts/{post_id}/offline")
async def offline(post_id: int, db: DbSession, admin: AdminUser):
    await offline_post(db, post_id, admin.id)
    return success(None)


@router.patch("/posts/{post_id}/online")
async def online(post_id: int, db: DbSession, _: AdminUser):
    await online_post(db, post_id)
    return success(None)
