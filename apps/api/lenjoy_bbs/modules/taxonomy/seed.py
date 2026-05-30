from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.modules.taxonomy.models import Category, Tag

DEFAULT_CATEGORIES = (
    {
        "name": "综合讨论",
        "slug": "general",
        "content_type": "NORMAL",
        "sort": 1,
    },
    {
        "name": "资源分享",
        "slug": "resources",
        "content_type": "RESOURCE",
        "sort": 2,
    },
    {
        "name": "悬赏问答",
        "slug": "bounties",
        "content_type": "BOUNTY",
        "sort": 3,
    },
)

DEFAULT_TAGS = (
    {"name": "Python", "slug": "python"},
    {"name": "FastAPI", "slug": "fastapi"},
)


async def seed_taxonomy(db: AsyncSession) -> None:
    for category in DEFAULT_CATEGORIES:
        exists = await db.scalar(
            select(Category).where(
                Category.slug == category["slug"],
                Category.content_type == category["content_type"],
            )
        )
        if not exists:
            db.add(Category(**category))

    for tag in DEFAULT_TAGS:
        if not await db.scalar(select(Tag).where(Tag.slug == tag["slug"])):
            db.add(Tag(**tag))
