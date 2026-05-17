import secrets

from fastapi import status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.core.security import hash_password
from lenjoy_bbs.modules.open_api.constants import OPEN_API_SYSTEM_EMAIL, OPEN_API_SYSTEM_USERNAME
from lenjoy_bbs.modules.users.models import UserAccount


async def get_or_create_open_api_user(db: AsyncSession) -> UserAccount:
    user_by_username = await db.scalar(
        select(UserAccount).where(
            UserAccount.username == OPEN_API_SYSTEM_USERNAME))
    if user_by_username is not None:
        if user_by_username.email != OPEN_API_SYSTEM_EMAIL:
            raise ApiError("OPEN_API_SYSTEM_USER_CONFLICT",
                           "Open API system user is reserved",
                           status.HTTP_500_INTERNAL_SERVER_ERROR)
        return user_by_username

    user_by_email = await db.scalar(
        select(UserAccount).where(UserAccount.email == OPEN_API_SYSTEM_EMAIL))
    if user_by_email is not None:
        raise ApiError("OPEN_API_SYSTEM_USER_CONFLICT",
                       "Open API system user is reserved",
                       status.HTTP_500_INTERNAL_SERVER_ERROR)

    user = UserAccount(
        username=OPEN_API_SYSTEM_USERNAME,
        email=OPEN_API_SYSTEM_EMAIL,
        password_hash=hash_password(secrets.token_urlsafe(24)),
    )
    db.add(user)
    try:
        await db.flush()
        return user
    except IntegrityError:
        await db.rollback()
        user_by_username = await db.scalar(
            select(UserAccount).where(
                UserAccount.username == OPEN_API_SYSTEM_USERNAME))
        if user_by_username is not None and user_by_username.email == OPEN_API_SYSTEM_EMAIL:
            return user_by_username
        raise ApiError("OPEN_API_SYSTEM_USER_CONFLICT",
                       "Open API system user is reserved",
                       status.HTTP_500_INTERNAL_SERVER_ERROR)


__all__ = ["get_or_create_open_api_user"]
