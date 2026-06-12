import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.core.logging import log_event
from lenjoy_bbs.core.messages import Posts
from lenjoy_bbs.modules.open_api.client_auth import require_active_client
from lenjoy_bbs.modules.open_api.models import OpenApiIdempotencyRecord
from lenjoy_bbs.modules.open_api.publisher_identity import get_or_create_open_api_user
from lenjoy_bbs.modules.posts.lifecycle import create_post_for_author_id
from lenjoy_bbs.modules.posts.models import Post
from lenjoy_bbs.modules.posts.schemas import PostCreateRequest

logger = logging.getLogger("lenjoy_bbs.open_api")


async def create_open_post(
    db: AsyncSession,
    *,
    api_key: str | None,
    payload: PostCreateRequest,
    idempotency_key: str | None = None,
) -> Post:
    try:
        client = await require_active_client(db, api_key)
        if idempotency_key:
            existing_post = await db.scalar(
                select(Post)
                .join(OpenApiIdempotencyRecord,
                      OpenApiIdempotencyRecord.post_id == Post.id)
                .where(
                    OpenApiIdempotencyRecord.client_id == client.id,
                    OpenApiIdempotencyRecord.idempotency_key == idempotency_key,
                )
            )
            if existing_post is not None:
                return existing_post

        user = await get_or_create_open_api_user(db)
        post = await create_post_for_author_id(db,
                                               payload,
                                               user.id,
                                               commit=False)
        post.status = "PUBLISHED"
        await db.flush()
        if idempotency_key:
            db.add(OpenApiIdempotencyRecord(
                client_id=client.id,
                idempotency_key=idempotency_key,
                post_id=post.id,
            ))
        await db.commit()
        await db.refresh(post)
        log_event(logger,
                  logging.INFO,
                  "open_api.post_published",
                  client_id=client.id,
                  post_id=post.id,
                  idempotency_key=idempotency_key)
        return post
    except Exception:
        await db.rollback()
        logger.exception("open_api.post_publish_failed",
                         extra={"event": "open_api.post_publish_failed"})
        raise


async def delete_open_post(
    db: AsyncSession,
    *,
    api_key: str | None,
    post_id: int,
) -> None:
    try:
        client = await require_active_client(db, api_key)
        post = await db.scalar(
            select(Post)
            .join(
                OpenApiIdempotencyRecord,
                OpenApiIdempotencyRecord.post_id == Post.id,
            )
            .where(
                Post.id == post_id,
                OpenApiIdempotencyRecord.client_id == client.id,
            )
        )
        if post is None:
            raise ApiError(Posts.POST_NOT_FOUND)
        post.is_deleted = True
        await db.commit()
        log_event(
            logger,
            logging.INFO,
            "open_api.post_deleted",
            client_id=client.id,
            post_id=post.id,
        )
    except Exception:
        await db.rollback()
        logger.exception(
            "open_api.post_delete_failed",
            extra={"event": "open_api.post_delete_failed", "post_id": post_id},
        )
        raise


__all__ = ["create_open_post", "delete_open_post"]
