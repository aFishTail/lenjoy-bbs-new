"""Service helpers for Open API account bindings.

The legacy admin did not expose a binding service, so this module
implements the minimal CRUD that the internal admin API needs to
re-use the existing ``OpenApiAccountBinding`` model.
"""
from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.core.logging import log_event
from lenjoy_bbs.core.messages import Admin
from lenjoy_bbs.modules.open_api.models import OpenApiAccountBinding, OpenApiClient
from lenjoy_bbs.modules.users.models import UserAccount

logger = logging.getLogger("lenjoy_bbs.open_api")


def _binding_dict(row: OpenApiAccountBinding) -> dict:
    return {
        "id": row.id,
        "clientId": row.client_id,
        "userId": row.user_id,
        "bindingCode": row.binding_code,
        "status": row.status,
        "remark": row.remark,
        "createdAt": row.created_at.isoformat(),
        "updatedAt": row.updated_at.isoformat(),
    }


async def list_bindings(
    db: AsyncSession,
    *,
    client_id: int | None = None,
    user_id: int | None = None,
    status_value: str | None = None,
) -> list[dict]:
    stmt = select(OpenApiAccountBinding).order_by(
        OpenApiAccountBinding.id.desc())
    if client_id:
        stmt = stmt.where(OpenApiAccountBinding.client_id == client_id)
    if user_id:
        stmt = stmt.where(OpenApiAccountBinding.user_id == user_id)
    if status_value:
        stmt = stmt.where(OpenApiAccountBinding.status == status_value)
    rows = (await db.scalars(stmt)).all()
    return [_binding_dict(row) for row in rows]


async def create_binding(
    db: AsyncSession,
    *,
    client_id: int,
    user_id: int,
    binding_code: str,
    remark: str | None,
    status_value: str,
) -> dict:
    client = await db.get(OpenApiClient, client_id)
    if not client:
        raise ApiError(Admin.OPEN_API_CLIENT_NOT_FOUND) if hasattr(Admin, "OPEN_API_CLIENT_NOT_FOUND") else ApiError(_client_not_found_msg())
    user = await db.get(UserAccount, user_id)
    if not user:
        raise ApiError(_user_not_found_msg())

    binding = OpenApiAccountBinding(
        client_id=client_id,
        user_id=user_id,
        binding_code=binding_code,
        status=status_value,
        remark=remark,
    )
    db.add(binding)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise ApiError(_binding_conflict_msg())
    await db.commit()
    await db.refresh(binding)
    log_event(
        logger,
        logging.INFO,
        "open_api.binding_created",
        client_id=client_id,
        user_id=user_id,
        binding_id=binding.id,
    )
    return _binding_dict(binding)


async def update_binding_status(
    db: AsyncSession,
    binding_id: int,
    *,
    status_value: str,
) -> dict:
    binding = await db.get(OpenApiAccountBinding, binding_id)
    if not binding:
        raise ApiError(_binding_not_found_msg())
    binding.status = status_value
    await db.commit()
    await db.refresh(binding)
    return _binding_dict(binding)


async def delete_binding(db: AsyncSession, binding_id: int) -> None:
    binding = await db.get(OpenApiAccountBinding, binding_id)
    if not binding:
        raise ApiError(_binding_not_found_msg())
    await db.delete(binding)
    await db.commit()


def _client_not_found_msg():
    from lenjoy_bbs.core.messages import OpenApi

    return OpenApi.CLIENT_NOT_FOUND


def _user_not_found_msg():
    from lenjoy_bbs.core.messages import Users

    return Users.USER_NOT_FOUND


def _binding_not_found_msg():
    from lenjoy_bbs.core.messages import OpenApi

    return OpenApi.BINDING_NOT_FOUND


def _binding_conflict_msg():
    from lenjoy_bbs.core.messages import OpenApi

    return OpenApi.BINDING_CONFLICT


__all__ = [
    "create_binding",
    "delete_binding",
    "list_bindings",
    "update_binding_status",
]
