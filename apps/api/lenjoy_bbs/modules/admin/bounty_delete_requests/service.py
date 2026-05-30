from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.core.messages import Admin
from lenjoy_bbs.db.base import now_utc
from lenjoy_bbs.modules.messages.service import create_site_message
from lenjoy_bbs.modules.posts.lifecycle import refund_active_bounty_reserve
from lenjoy_bbs.modules.posts.models import Post, PostComment
from lenjoy_bbs.modules.reports.models import BountyDeleteRequest
from lenjoy_bbs.modules.users.models import UserAccount


def _keyword_filter(keyword: str | None):
    if not keyword:
        return None
    pattern = f"%{keyword.strip()}%"
    return or_(
        Post.title.ilike(pattern),
        BountyDeleteRequest.reason.ilike(pattern),
        UserAccount.username.ilike(pattern),
    )


async def list_bounty_delete_requests(
    db: AsyncSession,
    *,
    status_value: str | None = None,
    keyword: str | None = None,
) -> list[dict]:
    answer_count = func.count(PostComment.id).label("answer_count")
    query = (
        select(BountyDeleteRequest, Post, UserAccount, answer_count)
        .join(Post, Post.id == BountyDeleteRequest.post_id)
        .join(UserAccount, UserAccount.id == BountyDeleteRequest.author_id)
        .outerjoin(
            PostComment,
            (PostComment.post_id == Post.id)
            & (PostComment.parent_id.is_(None))
            & (PostComment.is_deleted.is_(False)),
        )
        .group_by(BountyDeleteRequest.id, Post.id, UserAccount.id)
    )
    if status_value:
        query = query.where(BountyDeleteRequest.status == status_value)
    keyword_filter = _keyword_filter(keyword)
    if keyword_filter is not None:
        query = query.where(keyword_filter)
    rows = (await db.execute(
        query.order_by(BountyDeleteRequest.created_at.desc()))).all()
    return [
        {
            "id": item.id,
            "postId": item.post_id,
            "postTitle": post.title,
            "authorId": item.author_id,
            "authorUsername": author.username,
            "reason": item.reason,
            "status": item.status,
            "resolutionNote": item.resolution_note,
            "handledBy": item.handled_by,
            "createdAt": item.created_at.isoformat(),
            "handledAt": item.handled_at.isoformat() if item.handled_at else None,
            "bountyAmount": post.bounty_amount,
            "answerCount": row_answer_count,
        }
        for item, post, author, row_answer_count in rows
    ]


async def review_bounty_delete_request(
    db: AsyncSession,
    request_id: int,
    *,
    action: str,
    note: str | None,
    admin_id: int,
) -> dict:
    try:
        row = await db.execute(
            select(BountyDeleteRequest, Post)
            .join(Post, Post.id == BountyDeleteRequest.post_id)
            .where(BountyDeleteRequest.id == request_id))
        request, post = row.one_or_none() or (None, None)
        if not request or not post:
            raise ApiError(Admin.BOUNTY_DELETE_REQUEST_NOT_FOUND)
        if request.status != "PENDING":
            raise ApiError(Admin.BOUNTY_DELETE_REQUEST_ALREADY_HANDLED)

        if action == "APPROVE" and not _can_approve_request(post):
            raise ApiError(Admin.BOUNTY_DELETE_REQUEST_NOT_APPROVABLE)

        handled_at = now_utc()
        request.resolution_note = note
        request.handled_by = admin_id
        request.handled_at = handled_at

        if action == "APPROVE":
            await refund_active_bounty_reserve(db, post,
                                               "bounty_delete_request",
                                               admin_id)
            if post.post_type == "BOUNTY" and post.bounty_status == "ACTIVE":
                post.bounty_status = "CANCELLED"
            post.is_deleted = True
            request.status = "APPROVED"
            await create_site_message(
                db,
                user_id=request.author_id,
                title="悬赏删除申请已通过",
                content=_message_content(post.title, note, approved=True),
                message_type="BOUNTY_DELETE_REQUEST_APPROVED",
            )
        else:
            request.status = "REJECTED"
            await create_site_message(
                db,
                user_id=request.author_id,
                title="悬赏删除申请已驳回",
                content=_message_content(post.title, note, approved=False),
                message_type="BOUNTY_DELETE_REQUEST_REJECTED",
            )

        await db.commit()
        return {"id": request.id, "status": request.status}
    except Exception:
        await db.rollback()
        raise


def _message_content(post_title: str, note: str | None, *,
                     approved: bool) -> str:
    status_text = "已通过，帖子已删除，未结算赏金已退回。" if approved else "已驳回，帖子将继续展示。"
    content = f"你对《{post_title}》提交的悬赏删除申请{status_text}"
    if note:
        content = f"{content}处理说明：{note}"
    return content


def _can_approve_request(post: Post) -> bool:
    return (post.post_type == "BOUNTY" and post.bounty_status == "ACTIVE"
            and post.accepted_comment_id is None)


__all__ = ["list_bounty_delete_requests", "review_bounty_delete_request"]
