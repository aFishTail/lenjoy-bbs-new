from typing import Annotated

from fastapi import Depends, Header, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.core.logging import set_request_user
from lenjoy_bbs.core.tokens import decode_access_token, load_role_codes
from lenjoy_bbs.db.session import get_db
from lenjoy_bbs.modules.users.models import UserAccount


async def current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
) -> UserAccount:
    if not authorization or not authorization.startswith("Bearer "):
        raise ApiError("UNAUTHORIZED", "Authentication is required", status.HTTP_401_UNAUTHORIZED)

    claims = decode_access_token(authorization.removeprefix("Bearer ").strip())
    user = await db.get(UserAccount, claims["user_id"])
    if not user:
        raise ApiError("UNAUTHORIZED", "User does not exist", status.HTTP_401_UNAUTHORIZED)
    if user.status == "BANNED":
        raise ApiError("ACCOUNT_DISABLED", "Account has been disabled", status.HTTP_403_FORBIDDEN)
    user.role_codes = await load_role_codes(db, user.id)
    request.state.authenticated_user_id = user.id
    set_request_user(user.id)
    return user


async def optional_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
) -> UserAccount | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        claims = decode_access_token(authorization.removeprefix("Bearer ").strip())
    except ApiError:
        return None
    user = await db.get(UserAccount, claims["user_id"])
    if not user or user.status == "BANNED":
        return None
    user.role_codes = await load_role_codes(db, user.id)
    request.state.authenticated_user_id = user.id
    set_request_user(user.id)
    return user


def require_admin(user: Annotated[UserAccount, Depends(current_user)]) -> UserAccount:
    if "ADMIN" not in getattr(user, "role_codes", []):
        raise ApiError("FORBIDDEN", "Administrator permission is required", status.HTTP_403_FORBIDDEN)
    return user
