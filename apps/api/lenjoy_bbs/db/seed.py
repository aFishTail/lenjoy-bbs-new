from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.modules.taxonomy.seed import seed_taxonomy
from lenjoy_bbs.modules.users.seed import seed_roles


async def seed_database(db: AsyncSession) -> None:
    await seed_roles(db)
    await seed_taxonomy(db)
    await db.commit()
