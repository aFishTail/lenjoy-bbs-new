import logging
import secrets

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.core.logging import log_event
from lenjoy_bbs.modules.open_api.constants import OPEN_API_CLIENT_KEY_PREFIX
from lenjoy_bbs.modules.open_api.models import OpenApiClient

logger = logging.getLogger("lenjoy_bbs.open_api")


async def list_clients(db: AsyncSession) -> list[dict]:
    items = (await db.scalars(select(OpenApiClient))).all()
    return [{
        "id": item.id,
        "name": item.name,
        "apiKey": item.api_key,
        "status": item.status,
        "remark": item.remark
    } for item in items]


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
        log_event(logger,
                  logging.INFO,
                  "open_api.client_created",
                  client_id=client.id,
                  status=client.status)
        return client
    except Exception:
        await db.rollback()
        logger.exception("open_api.client_create_failed",
                         extra={
                             "event": "open_api.client_create_failed",
                             "client_name": name
                         })
        raise


__all__ = ["create_client", "list_clients"]
