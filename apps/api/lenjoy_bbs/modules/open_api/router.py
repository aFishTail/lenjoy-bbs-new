from typing import Annotated

from fastapi import APIRouter, Header, status

from lenjoy_bbs.core.dependencies import AdminUser, DbSession
from lenjoy_bbs.core.responses import success
from lenjoy_bbs.modules.open_api.schemas import BindingRequest, ClientRequest, ClientStatusRequest
from lenjoy_bbs.modules.open_api.service import (
    create_binding,
    create_client,
    create_open_post,
    delete_binding,
    delete_client,
    get_client,
    list_bindings,
    list_clients,
    update_binding,
    update_binding_status,
    update_client,
    update_client_status,
)
from lenjoy_bbs.modules.posts.schemas import PostCreateRequest

admin_router = APIRouter(prefix="/admin/open-api", tags=["admin-open-api"])
open_router = APIRouter(prefix="/open", tags=["open-api"])


@admin_router.get("/clients")
async def clients(db: DbSession, _: AdminUser):
    return success(await list_clients(db))


@admin_router.post("/clients", status_code=status.HTTP_201_CREATED)
async def create_client_route(payload: ClientRequest, db: DbSession, _: AdminUser):
    client = await create_client(
        db,
        name=payload.name,
        remark=payload.remark,
        status_value=payload.status,
    )
    return success(await get_client(db, client.id))


@admin_router.get("/clients/{client_id}")
async def client_detail(client_id: int, db: DbSession, _: AdminUser):
    return success(await get_client(db, client_id))


@admin_router.put("/clients/{client_id}")
async def update_client_route(client_id: int, payload: ClientRequest, db: DbSession, _: AdminUser):
    return success(
        await update_client(
            db,
            client_id,
            name=payload.name,
            remark=payload.remark,
            status_value=payload.status,
        )
    )


@admin_router.patch("/clients/{client_id}/status")
async def update_client_status_route(client_id: int, payload: ClientStatusRequest, db: DbSession, _: AdminUser):
    return success(await update_client_status(db, client_id, payload.status))


@admin_router.delete("/clients/{client_id}")
async def delete_client_route(client_id: int, db: DbSession, _: AdminUser):
    await delete_client(db, client_id)
    return success(None)


@admin_router.get("/clients/{client_id}/bindings")
async def bindings(client_id: int, db: DbSession, _: AdminUser):
    return success(await list_bindings(db, client_id))


@admin_router.post("/clients/{client_id}/bindings", status_code=status.HTTP_201_CREATED)
async def create_binding_route(client_id: int, payload: BindingRequest, db: DbSession, _: AdminUser):
    return success(
        await create_binding(
            db,
            client_id,
            binding_code=payload.bindingCode,
            user_id=payload.userId,
            remark=payload.remark,
            status_value=payload.status,
        )
    )


@admin_router.put("/clients/{client_id}/bindings/{binding_id}")
async def update_binding_route(client_id: int, binding_id: int, payload: BindingRequest, db: DbSession, _: AdminUser):
    return success(
        await update_binding(
            db,
            client_id,
            binding_id,
            binding_code=payload.bindingCode,
            user_id=payload.userId,
            remark=payload.remark,
            status_value=payload.status,
        )
    )


@admin_router.patch("/clients/{client_id}/bindings/{binding_id}/status")
async def update_binding_status_route(client_id: int, binding_id: int, payload: ClientStatusRequest, db: DbSession, _: AdminUser):
    return success(await update_binding_status(db, client_id, binding_id, payload.status))


@admin_router.delete("/clients/{client_id}/bindings/{binding_id}")
async def delete_binding_route(client_id: int, binding_id: int, db: DbSession, _: AdminUser):
    await delete_binding(db, client_id, binding_id)
    return success(None)


@open_router.post("/posts", status_code=status.HTTP_201_CREATED)
async def open_post_route(
    payload: PostCreateRequest,
    db: DbSession,
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
):
    post = await create_open_post(db, api_key=x_api_key, payload=payload)
    return success({"id": post.id})
