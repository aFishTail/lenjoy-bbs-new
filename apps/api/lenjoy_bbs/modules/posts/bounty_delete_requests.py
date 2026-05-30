from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.core.messages import Posts
from lenjoy_bbs.modules.posts.lifecycle import bounty_has_external_answer
from lenjoy_bbs.modules.posts.repository import find_post
from lenjoy_bbs.modules.reports.models import BountyDeleteRequest
from lenjoy_bbs.modules.users.models import UserAccount


async def create_bounty_delete_request(
    db: AsyncSession,
    post_id: int,
    author: UserAccount,
    reason: str,
) -> BountyDeleteRequest:
    post = await find_post(db, post_id)
    if not post:
        raise ApiError(Posts.POST_NOT_FOUND)
    if post.author_id != author.id:
        raise ApiError(Posts.DELETE_FORBIDDEN)
    if post.post_type != "BOUNTY":
        raise ApiError(Posts.POST_NOT_BOUNTY)
    if not await bounty_has_external_answer(db, post):
        raise ApiError(Posts.BOUNTY_DELETE_REQUEST_NOT_ALLOWED)

    pending = await db.scalar(
        select(BountyDeleteRequest).where(
            BountyDeleteRequest.post_id == post.id,
            BountyDeleteRequest.status == "PENDING",
        ))
    if pending:
        raise ApiError(Posts.BOUNTY_DELETE_REQUEST_PENDING)

    item = BountyDeleteRequest(
        post_id=post.id,
        author_id=author.id,
        reason=reason.strip(),
        status="PENDING",
    )
    try:
        db.add(item)
        await db.commit()
        await db.refresh(item)
    except IntegrityError:
        await db.rollback()
        raise ApiError(Posts.BOUNTY_DELETE_REQUEST_PENDING)
    except Exception:
        await db.rollback()
        raise
    return item


def serialize_bounty_delete_request(
        item: BountyDeleteRequest) -> dict[str, int | str]:
    return {
        "id": item.id,
        "postId": item.post_id,
        "authorId": item.author_id,
        "reason": item.reason,
        "status": item.status,
        "createdAt": item.created_at.isoformat(),
    }
