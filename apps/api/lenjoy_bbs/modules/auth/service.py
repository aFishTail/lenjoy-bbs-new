import logging

from fastapi import status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.core.config import get_settings
from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.core.logging import log_event
from lenjoy_bbs.core.security import create_access_token, hash_password, verify_password
from lenjoy_bbs.core.tokens import load_role_codes
from lenjoy_bbs.modules.auth.captcha import verify_captcha
from lenjoy_bbs.modules.auth.repository import assign_user_role, find_user_by_account, find_user_by_any_identifier
from lenjoy_bbs.modules.auth.schemas import LoginRequest, RegisterRequest
from lenjoy_bbs.modules.common import user_public
from lenjoy_bbs.modules.open_api.constants import OPEN_API_SYSTEM_EMAIL, OPEN_API_SYSTEM_USERNAME
from lenjoy_bbs.modules.users.models import UserAccount
from lenjoy_bbs.modules.wallet.service import adjust_available, ensure_wallet

logger = logging.getLogger("lenjoy_bbs.auth")


def auth_payload(user: UserAccount, roles: list[str]) -> dict:
    return {
        "accessToken": create_access_token(user, roles),
        "tokenType": "Bearer",
        "expiresIn": get_settings().jwt_access_token_ttl_seconds,
        "user": user_public(user, roles),
    }


async def register_user(db: AsyncSession, payload: RegisterRequest) -> dict:
    await verify_captcha(payload.captcha_id, payload.captcha_code)
    if payload.username.lower() == OPEN_API_SYSTEM_USERNAME or (payload.email and payload.email.lower() == OPEN_API_SYSTEM_EMAIL):
        raise ApiError("ACCOUNT_RESERVED", "Account identifier is reserved", status.HTTP_400_BAD_REQUEST)
    identifiers = [payload.username]
    if payload.email:
        identifiers.append(payload.email)
    if payload.phone:
        identifiers.append(payload.phone)
    if len(set(identifiers)) != len(identifiers):
        raise ApiError("ACCOUNT_IDENTIFIER_CONFLICT", "Account identifiers must be globally unique", status.HTTP_400_BAD_REQUEST)
    if await find_user_by_any_identifier(db, identifiers):
        raise ApiError("ACCOUNT_IDENTIFIER_CONFLICT", "Account identifiers must be globally unique", status.HTTP_400_BAD_REQUEST)

    user = UserAccount(
        username=payload.username,
        email=payload.email,
        phone=payload.phone,
        password_hash=hash_password(payload.password),
    )
    try:
        db.add(user)
        await db.flush()
        await assign_user_role(db, user)
        await ensure_wallet(db, user.id)
        await adjust_available(
            db,
            user.id,
            get_settings().initial_register_coins,
            "REGISTER_GIFT",
            f"register:{user.id}",
            "Initial registration coins",
        )
        await db.commit()
        await db.refresh(user)
    except IntegrityError as exc:
        await db.rollback()
        log_event(logger, logging.WARNING, "auth.register_conflict", username=payload.username)
        raise ApiError("ACCOUNT_EXISTS", "Username, email, or phone already exists") from exc
    except Exception:
        await db.rollback()
        logger.exception(
            "auth.register_failed",
            extra={"event": "auth.register_failed", "username": payload.username, "error_type": "unexpected"},
        )
        raise

    log_event(logger, logging.INFO, "auth.register_succeeded", user_id=user.id)
    return auth_payload(user, ["USER"])


async def login_user(db: AsyncSession, payload: LoginRequest) -> dict:
    await verify_captcha(payload.captcha_id, payload.captcha_code)
    user = await find_user_by_account(db, payload.account)
    if not user or not verify_password(payload.password, user.password_hash):
        log_event(logger, logging.WARNING, "auth.login_failed", account=payload.account, reason="bad_credentials")
        raise ApiError("BAD_CREDENTIALS", "Account or password is incorrect", status.HTTP_401_UNAUTHORIZED)
    if user.status != "ACTIVE":
        log_event(logger, logging.WARNING, "auth.login_failed", user_id=user.id, reason="account_disabled")
        raise ApiError("ACCOUNT_DISABLED", "Account is not active", status.HTTP_403_FORBIDDEN)
    log_event(logger, logging.INFO, "auth.login_succeeded", user_id=user.id)
    return auth_payload(user, await load_role_codes(db, user.id))


__all__ = ["auth_payload", "login_user", "register_user"]
