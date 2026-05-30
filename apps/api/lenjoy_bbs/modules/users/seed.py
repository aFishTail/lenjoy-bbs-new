from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.modules.users.models import Role

DEFAULT_ROLES = {
    "USER": "普通用户",
    "ADMIN": "管理员",
}


async def seed_roles(db: AsyncSession) -> None:
    for code, name in DEFAULT_ROLES.items():
        if not await db.scalar(select(Role).where(Role.role_code == code)):
            db.add(Role(role_code=code, role_name=name))
