import logging
import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.core.logging import log_event
from lenjoy_bbs.core.messages import Admin
from lenjoy_bbs.modules.common import model_dict
from lenjoy_bbs.modules.taxonomy.models import Category, Tag

logger = logging.getLogger("lenjoy_bbs.admin")


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or value.strip().lower()


def _category_dict(row: Category) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "slug": row.slug,
        "parentId": row.parent_id,
        "contentType": row.content_type,
        "sort": row.sort,
        "status": row.status,
        "leaf": row.is_leaf,
    }


def _tag_dict(row: Tag) -> dict:
    data = model_dict(row, ["id", "name", "slug", "status", "source"])
    data["usageCount"] = 0
    return data


async def list_categories(db: AsyncSession, content_type: str | None = None) -> list[dict]:
    query = select(Category)
    if content_type:
        query = query.where(Category.content_type == content_type)
    rows = (await db.scalars(query.order_by(Category.sort, Category.id))).all()
    return [_category_dict(row) for row in rows]


async def list_tags(db: AsyncSession, keyword: str | None = None) -> list[dict]:
    query = select(Tag)
    if keyword:
        query = query.where(Tag.name.ilike(f"%{keyword.strip()}%"))
    rows = (await db.scalars(query.order_by(Tag.id))).all()
    return [_tag_dict(row) for row in rows]


async def create_category(
    db: AsyncSession,
    *,
    name: str,
    slug: str | None,
    content_type: str,
    parent_id: int,
    sort: int,
    status_value: str,
    is_leaf: bool,
) -> dict:
    existing = await db.scalars(select(Category).where(Category.name == name).limit(1))
    if existing.first():
        raise ApiError(Admin.CATEGORY_NAME_CONFLICT)
    category = Category(
        name=name,
        slug=slug or _slugify(name),
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
    return _category_dict(category)


async def update_category(
    db: AsyncSession,
    category_id: int,
    *,
    name: str,
    slug: str | None,
    content_type: str,
    parent_id: int,
    sort: int,
    status_value: str,
    is_leaf: bool,
) -> dict:
    category = await db.get(Category, category_id)
    if not category:
        raise ApiError(Admin.CATEGORY_NOT_FOUND)
    duplicate = await db.scalars(select(Category).where(Category.name == name, Category.id != category_id).limit(1))
    if duplicate.first():
        raise ApiError(Admin.CATEGORY_NAME_CONFLICT)
    category.name = name
    category.slug = slug or _slugify(name)
    category.content_type = content_type
    category.parent_id = parent_id
    category.sort = sort
    category.status = status_value
    category.is_leaf = is_leaf
    await db.commit()
    await db.refresh(category)
    return _category_dict(category)


async def update_category_status(db: AsyncSession, category_id: int, status_value: str) -> dict:
    category = await db.get(Category, category_id)
    if not category:
        raise ApiError(Admin.CATEGORY_NOT_FOUND)
    category.status = status_value
    await db.commit()
    await db.refresh(category)
    return _category_dict(category)


async def delete_category(db: AsyncSession, category_id: int) -> None:
    category = await db.get(Category, category_id)
    if not category:
        raise ApiError(Admin.CATEGORY_NOT_FOUND)
    await db.delete(category)
    await db.commit()


async def create_tag(db: AsyncSession, *, name: str, slug: str | None, status_value: str, source: str) -> dict:
    existing = await db.scalars(select(Tag).where(Tag.name == name).limit(1))
    if existing.first():
        raise ApiError(Admin.TAG_NAME_CONFLICT)
    tag = Tag(name=name, slug=slug or _slugify(name), status=status_value, source=source)
    db.add(tag)
    await db.flush()
    await db.commit()
    await db.refresh(tag)
    log_event(logger, logging.INFO, "admin.tag_created", tag_id=tag.id, source=tag.source)
    return _tag_dict(tag)


async def update_tag(db: AsyncSession, tag_id: int, *, name: str, slug: str | None, status_value: str, source: str) -> dict:
    tag = await db.get(Tag, tag_id)
    if not tag:
        raise ApiError(Admin.TAG_NOT_FOUND)
    duplicate = await db.scalars(select(Tag).where(Tag.name == name, Tag.id != tag_id).limit(1))
    if duplicate.first():
        raise ApiError(Admin.TAG_NAME_CONFLICT)
    tag.name = name
    tag.slug = slug or _slugify(name)
    tag.status = status_value
    tag.source = source
    await db.commit()
    await db.refresh(tag)
    return _tag_dict(tag)


async def update_tag_status(db: AsyncSession, tag_id: int, status_value: str) -> dict:
    tag = await db.get(Tag, tag_id)
    if not tag:
        raise ApiError(Admin.TAG_NOT_FOUND)
    tag.status = status_value
    await db.commit()
    await db.refresh(tag)
    return _tag_dict(tag)


async def merge_tag(db: AsyncSession, tag_id: int, target_tag_id: int) -> dict:
    tag = await db.get(Tag, tag_id)
    target = await db.get(Tag, target_tag_id)
    if not tag or not target:
        raise ApiError(Admin.TAG_NOT_FOUND)
    if tag.id == target.id:
        raise ApiError(Admin.TAG_MERGE_INVALID)
    tag.status = "MERGED"
    await db.commit()
    await db.refresh(tag)
    return _tag_dict(tag)


async def delete_tag(db: AsyncSession, tag_id: int) -> None:
    tag = await db.get(Tag, tag_id)
    if not tag:
        raise ApiError(Admin.TAG_NOT_FOUND)
    await db.delete(tag)
    await db.commit()


__all__ = [
    "create_category",
    "create_tag",
    "delete_category",
    "delete_tag",
    "list_categories",
    "list_tags",
    "merge_tag",
    "update_category",
    "update_category_status",
    "update_tag",
    "update_tag_status",
]
