from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.modules.common import user_public
from lenjoy_bbs.modules.users.models import UserAccount
from lenjoy_bbs.modules.users.schemas import ProfileUpdateRequest


async def update_profile(db: AsyncSession, user: UserAccount, payload: ProfileUpdateRequest) -> dict:
    user.avatar_url = payload.avatar_url
    user.bio = payload.bio
    await db.flush()
    await db.commit()
    await db.refresh(user)
    return user_public(user)


__all__ = ["update_profile"]
