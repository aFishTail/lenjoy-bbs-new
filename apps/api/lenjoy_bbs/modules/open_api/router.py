from typing import Annotated

from fastapi import APIRouter, Header, status

from lenjoy_bbs.core.dependencies import AdminUser, DbSession
from lenjoy_bbs.core.responses import success
from lenjoy_bbs.modules.open_api.schemas import ClientRequest
from lenjoy_bbs.modules.open_api.service import create_client, create_open_post, list_clients
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
    return success({"id": client.id, "name": client.name, "apiKey": client.api_key, "status": client.status, "remark": client.remark})


@open_router.post("/posts", status_code=status.HTTP_201_CREATED)
async def open_post_route(
    payload: PostCreateRequest,
    db: DbSession,
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
):
    post = await create_open_post(db, api_key=x_api_key, payload=payload)
    return success({"id": post.id})
