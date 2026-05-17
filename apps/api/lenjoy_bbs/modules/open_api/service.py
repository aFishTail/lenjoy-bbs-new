import secrets
import logging

from fastapi import status
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.core.logging import log_event
from lenjoy_bbs.core.security import hash_password
from lenjoy_bbs.modules.open_api.constants import OPEN_API_CLIENT_KEY_PREFIX, OPEN_API_SYSTEM_EMAIL, OPEN_API_SYSTEM_USERNAME
from lenjoy_bbs.modules.open_api.models import OpenApiAccountBinding, OpenApiClient
from lenjoy_bbs.modules.posts.models import Post
from lenjoy_bbs.modules.posts.schemas import PostCreateRequest
from lenjoy_bbs.modules.posts.service import create_post_for_author_id
from lenjoy_bbs.modules.users.models import UserAccount

logger = logging.getLogger("lenjoy_bbs.open_api")


def _mask_api_key(api_key: str) -> str:
    if len(api_key) <= 12:
        return api_key
    return f"{api_key[:8]}...{api_key[-4:]}"


async def _client_dict(db: AsyncSession, item: OpenApiClient) -> dict:
    binding_count = await db.scalar(
        select(func.count())
        .select_from(OpenApiAccountBinding)
        .where(OpenApiAccountBinding.client_id == item.id)
    ) or 0
    return {
        "id": item.id,
        "name": item.name,
        "apiKeyMasked": _mask_api_key(item.api_key),
        "apiKeyPlaintext": item.api_key,
        "status": item.status,
        "remark": item.remark,
        "bindingCount": binding_count,
        "createdAt": item.created_at.isoformat(),
        "updatedAt": item.updated_at.isoformat(),
    }


def _binding_dict(binding: OpenApiAccountBinding, user: UserAccount | None) -> dict:
    return {
        "id": binding.id,
        "clientId": binding.client_id,
        "bindingCode": binding.binding_code,
        "status": binding.status,
        "remark": binding.remark,
        "userId": binding.user_id,
        "username": user.username if user else None,
        "email": user.email if user else None,
        "phone": user.phone if user else None,
        "createdAt": binding.created_at.isoformat(),
        "updatedAt": binding.updated_at.isoformat(),
    }


async def list_clients(db: AsyncSession) -> list[dict]:
    items = (await db.scalars(select(OpenApiClient).order_by(OpenApiClient.id.desc()))).all()
    return [await _client_dict(db, item) for item in items]


async def get_client(db: AsyncSession, client_id: int) -> dict:
    client = await db.get(OpenApiClient, client_id)
    if not client:
        raise ApiError("OPEN_API_CLIENT_NOT_FOUND", "Open API client does not exist", status.HTTP_404_NOT_FOUND)
    return await _client_dict(db, client)


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


async def update_client(db: AsyncSession, client_id: int, *, name: str, remark: str | None, status_value: str) -> dict:
    client = await db.get(OpenApiClient, client_id)
    if not client:
        raise ApiError("OPEN_API_CLIENT_NOT_FOUND", "Open API client does not exist", status.HTTP_404_NOT_FOUND)
    client.name = name
    client.remark = remark
    client.status = status_value
    await db.commit()
    await db.refresh(client)
    return await _client_dict(db, client)


async def update_client_status(db: AsyncSession, client_id: int, status_value: str) -> dict:
    client = await db.get(OpenApiClient, client_id)
    if not client:
        raise ApiError("OPEN_API_CLIENT_NOT_FOUND", "Open API client does not exist", status.HTTP_404_NOT_FOUND)
    client.status = status_value
    await db.commit()
    await db.refresh(client)
    return await _client_dict(db, client)


async def delete_client(db: AsyncSession, client_id: int) -> None:
    client = await db.get(OpenApiClient, client_id)
    if not client:
        raise ApiError("OPEN_API_CLIENT_NOT_FOUND", "Open API client does not exist", status.HTTP_404_NOT_FOUND)
    await db.execute(delete(OpenApiAccountBinding).where(OpenApiAccountBinding.client_id == client_id))
    await db.delete(client)
    await db.commit()


async def list_bindings(db: AsyncSession, client_id: int) -> list[dict]:
    if not await db.get(OpenApiClient, client_id):
        raise ApiError("OPEN_API_CLIENT_NOT_FOUND", "Open API client does not exist", status.HTTP_404_NOT_FOUND)
    rows = (
        await db.execute(
            select(OpenApiAccountBinding, UserAccount)
            .join(UserAccount, UserAccount.id == OpenApiAccountBinding.user_id)
            .where(OpenApiAccountBinding.client_id == client_id)
            .order_by(OpenApiAccountBinding.id.desc())
        )
    ).all()
    return [_binding_dict(binding, user) for binding, user in rows]


async def create_binding(
    db: AsyncSession,
    client_id: int,
    *,
    binding_code: str,
    user_id: int,
    remark: str | None,
    status_value: str,
) -> dict:
    if not await db.get(OpenApiClient, client_id):
        raise ApiError("OPEN_API_CLIENT_NOT_FOUND", "Open API client does not exist", status.HTTP_404_NOT_FOUND)
    user = await db.get(UserAccount, user_id)
    if not user:
        raise ApiError("USER_NOT_FOUND", "User does not exist", status.HTTP_404_NOT_FOUND)
    binding = OpenApiAccountBinding(
        client_id=client_id,
        user_id=user_id,
        binding_code=binding_code,
        remark=remark,
        status=status_value,
    )
    db.add(binding)
    await db.flush()
    await db.commit()
    await db.refresh(binding)
    return _binding_dict(binding, user)


async def update_binding(
    db: AsyncSession,
    client_id: int,
    binding_id: int,
    *,
    binding_code: str,
    user_id: int,
    remark: str | None,
    status_value: str,
) -> dict:
    binding = await db.get(OpenApiAccountBinding, binding_id)
    if not binding or binding.client_id != client_id:
        raise ApiError("OPEN_API_BINDING_NOT_FOUND", "Open API binding does not exist", status.HTTP_404_NOT_FOUND)
    user = await db.get(UserAccount, user_id)
    if not user:
        raise ApiError("USER_NOT_FOUND", "User does not exist", status.HTTP_404_NOT_FOUND)
    binding.binding_code = binding_code
    binding.user_id = user_id
    binding.remark = remark
    binding.status = status_value
    await db.commit()
    await db.refresh(binding)
    return _binding_dict(binding, user)


async def update_binding_status(db: AsyncSession, client_id: int, binding_id: int, status_value: str) -> dict:
    binding = await db.get(OpenApiAccountBinding, binding_id)
    if not binding or binding.client_id != client_id:
        raise ApiError("OPEN_API_BINDING_NOT_FOUND", "Open API binding does not exist", status.HTTP_404_NOT_FOUND)
    user = await db.get(UserAccount, binding.user_id)
    binding.status = status_value
    await db.commit()
    await db.refresh(binding)
    return _binding_dict(binding, user)


async def delete_binding(db: AsyncSession, client_id: int, binding_id: int) -> None:
    binding = await db.get(OpenApiAccountBinding, binding_id)
    if not binding or binding.client_id != client_id:
        raise ApiError("OPEN_API_BINDING_NOT_FOUND", "Open API binding does not exist", status.HTTP_404_NOT_FOUND)
    await db.delete(binding)
    await db.commit()


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


__all__ = [
    "create_binding",
    "create_client",
    "create_open_post",
    "delete_binding",
    "delete_client",
    "get_client",
    "list_bindings",
    "list_clients",
    "update_binding",
    "update_binding_status",
    "update_client",
    "update_client_status",
]
