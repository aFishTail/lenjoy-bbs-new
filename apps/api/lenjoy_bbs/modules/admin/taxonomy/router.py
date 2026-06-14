from fastapi import APIRouter, Depends

from lenjoy_bbs.core.dependencies import AdminUser, DbSession
from lenjoy_bbs.core.legacy_admin import require_legacy_admin_mutations_enabled
from lenjoy_bbs.core.responses import success
from lenjoy_bbs.modules.admin.taxonomy.schemas import StatusRequest, TagMergeRequest, TaxonomyRequest
from lenjoy_bbs.modules.admin.taxonomy.service import (
    create_category,
    create_tag,
    delete_category,
    delete_tag,
    list_categories,
    list_tags,
    merge_tag,
    update_category,
    update_category_status,
    update_tag,
    update_tag_status,
)

router = APIRouter(tags=["admin"])
LegacyMutationGate = Depends(require_legacy_admin_mutations_enabled)


@router.get("/categories")
async def categories(db: DbSession, _: AdminUser, contentType: str | None = None):
    return success(await list_categories(db, contentType))


@router.post("/categories", dependencies=[LegacyMutationGate])
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


@router.put("/categories/{category_id}", dependencies=[LegacyMutationGate])
async def update_category_route(category_id: int, payload: TaxonomyRequest, db: DbSession, _: AdminUser):
    return success(
        await update_category(
            db,
            category_id,
            name=payload.name,
            slug=payload.slug,
            content_type=payload.contentType or "NORMAL",
            parent_id=payload.parentId,
            sort=payload.sort,
            status_value=payload.status,
            is_leaf=payload.isLeaf,
        )
    )


@router.patch("/categories/{category_id}/status", dependencies=[LegacyMutationGate])
async def category_status(category_id: int, payload: StatusRequest, db: DbSession, _: AdminUser):
    return success(await update_category_status(db, category_id, payload.status))


@router.delete("/categories/{category_id}", dependencies=[LegacyMutationGate])
async def delete_category_route(category_id: int, db: DbSession, _: AdminUser):
    await delete_category(db, category_id)
    return success(None)


@router.get("/tags")
async def tags(db: DbSession, _: AdminUser, keyword: str | None = None):
    return success(await list_tags(db, keyword))


@router.post("/tags", dependencies=[LegacyMutationGate])
async def create_tag_route(payload: TaxonomyRequest, db: DbSession, _: AdminUser):
    return success(await create_tag(db, name=payload.name, slug=payload.slug, status_value=payload.status, source=payload.source))


@router.put("/tags/{tag_id}", dependencies=[LegacyMutationGate])
async def update_tag_route(tag_id: int, payload: TaxonomyRequest, db: DbSession, _: AdminUser):
    return success(await update_tag(db, tag_id, name=payload.name, slug=payload.slug, status_value=payload.status, source=payload.source))


@router.patch("/tags/{tag_id}/status", dependencies=[LegacyMutationGate])
async def tag_status(tag_id: int, payload: StatusRequest, db: DbSession, _: AdminUser):
    return success(await update_tag_status(db, tag_id, payload.status))


@router.post("/tags/{tag_id}/merge", dependencies=[LegacyMutationGate])
async def merge_tag_route(tag_id: int, payload: TagMergeRequest, db: DbSession, _: AdminUser):
    return success(await merge_tag(db, tag_id, payload.targetTagId))


@router.delete("/tags/{tag_id}", dependencies=[LegacyMutationGate])
async def delete_tag_route(tag_id: int, db: DbSession, _: AdminUser):
    await delete_tag(db, tag_id)
    return success(None)
