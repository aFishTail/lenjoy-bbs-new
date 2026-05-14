import secrets
import logging

from fastapi import status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.core.logging import log_event
from lenjoy_bbs.core.security import hash_password
from lenjoy_bbs.modules.open_api.constants import OPEN_API_CLIENT_KEY_PREFIX, OPEN_API_SYSTEM_EMAIL, OPEN_API_SYSTEM_USERNAME
from lenjoy_bbs.modules.open_api.models import OpenApiClient
from lenjoy_bbs.modules.posts.models import Post
from lenjoy_bbs.modules.posts.schemas import PostCreateRequest
from lenjoy_bbs.modules.posts.service import create_post_for_author_id
from lenjoy_bbs.modules.users.models import UserAccount

logger = logging.getLogger("lenjoy_bbs.open_api")


async def list_clients(db: AsyncSession) -> list[dict]:
    items = (await db.scalars(select(OpenApiClient))).all()
    return [{"id": item.id, "name": item.name, "apiKey": item.api_key, "status": item.status, "remark": item.remark} for item in items]


async def _get_or_create_open_api_user(db: AsyncSession) -> UserAccount:
    user_by_username = await db.scalar(select(UserAccount).where(UserAccount.username == OPEN_API_SYSTEM_USERNAME))
    if user_by_username is not None:
        if user_by_username.email != OPEN_API_SYSTEM_EMAIL:
            raise ApiError("OPEN_API_SYSTEM_USER_CONFLICT", "Open API system user is reserved", status.HTTP_500_INTERNAL_SERVER_ERROR)
        return user_by_username

    user_by_email = await db.scalar(select(UserAccount).where(UserAccount.email == OPEN_API_SYSTEM_EMAIL))
    if user_by_email is not None:
        raise ApiError("OPEN_API_SYSTEM_USER_CONFLICT", "Open API system user is reserved", status.HTTP_500_INTERNAL_SERVER_ERROR)

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
        user_by_username = await db.scalar(select(UserAccount).where(UserAccount.username == OPEN_API_SYSTEM_USERNAME))
        if user_by_username is not None and user_by_username.email == OPEN_API_SYSTEM_EMAIL:
            return user_by_username
        raise ApiError("OPEN_API_SYSTEM_USER_CONFLICT", "Open API system user is reserved", status.HTTP_500_INTERNAL_SERVER_ERROR)


async def create_client(
    db: AsyncSession,
    *,
    name: str,
    remark: str | None,
    status_value: str,
) -> OpenApiClient:
    try:
        client = OpenApiClient(
            name=name,
            api_key=OPEN_API_CLIENT_KEY_PREFIX + secrets.token_urlsafe(24),
            status=status_value,
            remark=remark,
        )
        db.add(client)
        await db.flush()
        await db.commit()
        await db.refresh(client)
        log_event(logger, logging.INFO, "open_api.client_created", client_id=client.id, status=client.status)
        return client
    except Exception:
        await db.rollback()
        logger.exception("open_api.client_create_failed", extra={"event": "open_api.client_create_failed", "client_name": name})
        raise


async def create_open_post(db: AsyncSession, *, api_key: str | None, payload: PostCreateRequest) -> Post:
    try:
        client = await db.scalar(select(OpenApiClient).where(OpenApiClient.api_key == api_key, OpenApiClient.status == "ACTIVE"))
        if not client:
            log_event(logger, logging.WARNING, "open_api.auth_failed", reason="invalid_api_key")
            raise ApiError("OPEN_API_UNAUTHORIZED", "Open API key is invalid", status.HTTP_401_UNAUTHORIZED)

        user = await _get_or_create_open_api_user(db)
        post = await create_post_for_author_id(db, payload, user.id, commit=False)
        post.status = "PUBLISHED"
        await db.commit()
        await db.refresh(post)
        log_event(logger, logging.INFO, "open_api.post_published", client_id=client.id, post_id=post.id)
        return post
    except Exception:
        await db.rollback()
        logger.exception("open_api.post_publish_failed", extra={"event": "open_api.post_publish_failed"})
        raise


__all__ = ["create_client", "create_open_post", "list_clients"]
