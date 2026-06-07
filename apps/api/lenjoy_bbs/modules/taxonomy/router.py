from fastapi import APIRouter
from sqlalchemy import select

from lenjoy_bbs.core.dependencies import DbSession
from lenjoy_bbs.core.responses import success
from lenjoy_bbs.modules.taxonomy.models import Category, Tag
from lenjoy_bbs.modules.common import model_dict

router = APIRouter(prefix="/taxonomy", tags=["taxonomy"])


@router.get("/categories")
async def categories(db: DbSession, contentType: str | None = None):
    query = select(Category).where(Category.status == "ACTIVE")
    if contentType:
        query = query.where(Category.content_type == contentType)
    rows = (await
            db.scalars(query.order_by(Category.sort.asc(),
                                      Category.id.asc()))).all()
    return success([
        model_dict(row, [
            "id", "name", "slug", "parent_id", "content_type", "sort",
            "status", "is_leaf"
        ]) for row in rows
    ])


@router.get("/tags")
async def tags(db: DbSession, keyword: str | None = None):
    query = select(Tag).where(Tag.status == "ACTIVE")
    if keyword:
        query = query.where(Tag.name.like(f"%{keyword}%"))
    # TODO: limit 暂时写死，后续可以改成参数
    rows = (await db.scalars(query.order_by(Tag.id.asc()).limit(1000))).all()
    return success([
        model_dict(row, ["id", "name", "slug", "status", "source"])
        for row in rows
    ])


@router.get("/tags/hot")
async def hot_tags(db: DbSession, contentType: str | None = None):
    return await tags(db)
