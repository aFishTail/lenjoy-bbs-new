from fastapi import status
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.modules.posts.models import PostComment
from lenjoy_bbs.modules.posts.repository import find_post
from lenjoy_bbs.modules.reports.models import CommentReport, PostReport


async def create_post_report(db: AsyncSession, post_id: int, reporter_id: int, reason: str, detail: str | None) -> dict:
    if not await find_post(db, post_id):
        raise ApiError("POST_NOT_FOUND", "Post does not exist", status.HTTP_404_NOT_FOUND)
    report = PostReport(post_id=post_id, reporter_id=reporter_id, reason=reason, detail=detail)
    db.add(report)
    await db.flush()
    await db.commit()
    await db.refresh(report)
    return {"id": report.id, "postId": post_id, "reporterId": reporter_id, "reason": report.reason}


async def create_comment_report(db: AsyncSession, comment_id: int, reporter_id: int, reason: str, detail: str | None) -> dict:
    comment = await db.get(PostComment, comment_id)
    if not comment:
        raise ApiError("COMMENT_NOT_FOUND", "Comment does not exist", status.HTTP_404_NOT_FOUND)
    report = CommentReport(comment_id=comment_id, reporter_id=reporter_id, reason=reason, detail=detail)
    db.add(report)
    await db.flush()
    await db.commit()
    await db.refresh(report)
    return {"id": report.id, "commentId": comment_id, "reporterId": reporter_id, "reason": report.reason}


__all__ = ["create_comment_report", "create_post_report"]
