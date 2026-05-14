import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.core.logging import log_event
from lenjoy_bbs.modules.common import model_dict
from lenjoy_bbs.modules.taxonomy.models import Category, Tag

logger = logging.getLogger("lenjoy_bbs.admin")


async def list_categories(db: AsyncSession) -> list[dict]:
    rows = (await db.scalars(select(Category))).all()
    return [model_dict(row, ["id", "name", "slug", "content_type", "status"]) for row in rows]


async def list_tags(db: AsyncSession) -> list[dict]:
    rows = (await db.scalars(select(Tag))).all()
    return [model_dict(row, ["id", "name", "slug", "status", "source"]) for row in rows]


async def create_category(
    db: AsyncSession,
    *,
    name: str,
    slug: str,
    content_type: str,
    parent_id: int,
    sort: int,
    status_value: str,
    is_leaf: bool,
) -> dict[str, int]:
    category = Category(
        name=name,
        slug=slug,
        content_type=content_type,
        parent_id=parent_id,
        sort=sort,
        status=status_value,
        is_leaf=is_leaf,
    )
    db.add(category)
    await db.flush()
    await db.commit()
    await db.refresh(category)
    log_event(logger, logging.INFO, "admin.category_created", category_id=category.id, content_type=category.content_type)
    return {"id": category.id}


async def create_tag(db: AsyncSession, *, name: str, slug: str, status_value: str, source: str) -> dict[str, int]:
    tag = Tag(name=name, slug=slug, status=status_value, source=source)
    db.add(tag)
    await db.flush()
    await db.commit()
    await db.refresh(tag)
    log_event(logger, logging.INFO, "admin.tag_created", tag_id=tag.id, source=tag.source)
    return {"id": tag.id}


__all__ = ["create_category", "create_tag", "list_categories", "list_tags"]
