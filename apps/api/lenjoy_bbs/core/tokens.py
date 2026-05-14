from datetime import UTC, datetime, timedelta
import logging

import jwt
from fastapi import status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.core.config import get_settings
from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.core.logging import log_event
from lenjoy_bbs.modules.users.models import Role, UserAccount, UserRole

logger = logging.getLogger("lenjoy_bbs.auth")


def create_access_token(user: UserAccount, roles: list[str]) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    claims = {
        "sub": str(user.id),
        "username": user.username,
        "roles": roles,
        "iat": now,
        "exp": now + timedelta(seconds=settings.jwt_access_token_ttl_seconds),
    }
    return jwt.encode(claims, settings.jwt_secret, algorithm="HS256")


async def load_role_codes(db: AsyncSession, user_id: int) -> list[str]:
    result = await db.execute(
        select(Role.role_code)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user_id)
    )
    rows = result.all()
    return [row[0] for row in rows] or ["USER"]


def decode_access_token(token: str) -> dict:
    try:
        claims = jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])
        subject = claims.get("sub")
        if subject is None:
            raise ValueError("missing subject")
        claims["user_id"] = int(subject)
        return claims
    except (jwt.PyJWTError, TypeError, ValueError) as exc:
        log_event(logger, logging.WARNING, "auth.token_invalid", error_type=type(exc).__name__)
        raise ApiError("UNAUTHORIZED", "Authentication token is invalid", status.HTTP_401_UNAUTHORIZED) from exc
