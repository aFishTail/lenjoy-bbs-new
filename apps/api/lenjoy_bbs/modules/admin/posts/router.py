from fastapi import APIRouter

from lenjoy_bbs.core.dependencies import AdminUser, DbSession
from lenjoy_bbs.core.responses import success
from lenjoy_bbs.modules.admin.posts.service import list_bounties, list_posts, offline_post, online_post

router = APIRouter(tags=["admin"])


@router.get("/posts")
async def posts(
    db: DbSession,
    _: AdminUser,
    status: str | None = None,
    postType: str | None = None,
    author: str | None = None,
    categoryId: int | None = None,
    tagId: int | None = None,
):
    return success(
        await list_posts(
            db,
            status_value=status,
            post_type=postType,
            author=author,
            category_id=categoryId,
            tag_id=tagId,
        )
    )


@router.get("/bounties")
async def bounties(db: DbSession, _: AdminUser, status: str | None = None, keyword: str | None = None):
    return success(await list_bounties(db, bounty_status=status, keyword=keyword))


@router.patch("/posts/{post_id}/offline")
async def offline(post_id: int, db: DbSession, admin: AdminUser):
    await offline_post(db, post_id, admin.id)
    return success(None)


@router.patch("/posts/{post_id}/online")
async def online(post_id: int, db: DbSession, _: AdminUser):
    await online_post(db, post_id)
    return success(None)
