import logging

from fastapi import status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.core.logging import log_event
from lenjoy_bbs.modules.open_api.models import OpenApiClient

logger = logging.getLogger("lenjoy_bbs.open_api")


async def require_active_client(db: AsyncSession,
                                api_key: str | None) -> OpenApiClient:
    client = await db.scalar(
        select(OpenApiClient).where(OpenApiClient.api_key == api_key,
                                    OpenApiClient.status == "ACTIVE"))
    if client:
        return client

    log_event(logger,
              logging.WARNING,
              "open_api.auth_failed",
              reason="invalid_api_key")
    raise ApiError("OPEN_API_UNAUTHORIZED", "Open API key is invalid",
                   status.HTTP_401_UNAUTHORIZED)


__all__ = ["require_active_client"]
