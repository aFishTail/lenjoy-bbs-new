import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi import status

from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.core.logging import log_event
from lenjoy_bbs.modules.common import user_public
from lenjoy_bbs.modules.users.models import UserAccount

logger = logging.getLogger("lenjoy_bbs.admin")


async def list_users(db: AsyncSession) -> list[dict]:
    rows = await db.scalars(select(UserAccount).order_by(UserAccount.created_at.desc()))
    return [user_public(user) for user in rows.all()]


async def update_user_status(db: AsyncSession, user_id: int, status_value: str) -> None:
    user = await db.get(UserAccount, user_id)
    if not user:
        raise ApiError("USER_NOT_FOUND", "User does not exist", status.HTTP_404_NOT_FOUND)
    user.status = status_value
    await db.commit()
    log_event(logger, logging.INFO, "admin.user_status_updated", target_user_id=user_id, result=status_value)


__all__ = ["list_users", "update_user_status"]
