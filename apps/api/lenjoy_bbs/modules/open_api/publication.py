import logging

from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.core.logging import log_event
from lenjoy_bbs.modules.open_api.client_auth import require_active_client
from lenjoy_bbs.modules.open_api.publisher_identity import get_or_create_open_api_user
from lenjoy_bbs.modules.posts.lifecycle import create_post_for_author_id
from lenjoy_bbs.modules.posts.models import Post
from lenjoy_bbs.modules.posts.schemas import PostCreateRequest

logger = logging.getLogger("lenjoy_bbs.open_api")


async def create_open_post(db: AsyncSession, *, api_key: str | None,
                           payload: PostCreateRequest) -> Post:
    try:
        client = await require_active_client(db, api_key)
        user = await get_or_create_open_api_user(db)
        post = await create_post_for_author_id(db,
                                               payload,
                                               user.id,
                                               commit=False)
        post.status = "PUBLISHED"
        await db.commit()
        await db.refresh(post)
        log_event(logger,
                  logging.INFO,
                  "open_api.post_published",
                  client_id=client.id,
                  post_id=post.id)
        return post
    except Exception:
        await db.rollback()
        logger.exception("open_api.post_publish_failed",
                         extra={"event": "open_api.post_publish_failed"})
        raise


__all__ = ["create_open_post"]
