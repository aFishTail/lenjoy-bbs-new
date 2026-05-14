from fastapi import APIRouter

from lenjoy_bbs.core.dependencies import AdminUser, DbSession
from lenjoy_bbs.core.responses import success
from lenjoy_bbs.modules.admin.taxonomy.schemas import TaxonomyRequest
from lenjoy_bbs.modules.admin.taxonomy.service import create_category, create_tag, list_categories, list_tags

router = APIRouter(tags=["admin"])


@router.get("/categories")
async def categories(db: DbSession, _: AdminUser):
    return success(await list_categories(db))


@router.post("/categories")
async def create_category_route(payload: TaxonomyRequest, db: DbSession, _: AdminUser):
    return success(
        await create_category(
            db,
            name=payload.name,
            slug=payload.slug,
            content_type=payload.contentType or "NORMAL",
            parent_id=payload.parentId,
            sort=payload.sort,
            status_value=payload.status,
            is_leaf=payload.isLeaf,
        )
    )


@router.get("/tags")
async def tags(db: DbSession, _: AdminUser):
    return success(await list_tags(db))


@router.post("/tags")
async def create_tag_route(payload: TaxonomyRequest, db: DbSession, _: AdminUser):
    return success(await create_tag(db, name=payload.name, slug=payload.slug, status_value=payload.status, source=payload.source))
