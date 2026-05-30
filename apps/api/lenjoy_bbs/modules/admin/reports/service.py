from sqlalchemy import or_, select
from sqlalchemy.orm import aliased
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.core.messages import Admin
from lenjoy_bbs.db.base import now_utc
from lenjoy_bbs.modules.admin.posts.service import apply_post_offline
from lenjoy_bbs.modules.messages.service import create_site_message
from lenjoy_bbs.modules.posts.models import Post, PostComment, ResourcePurchase
from lenjoy_bbs.modules.reports.models import CommentReport, PostReport, ResourceAppeal
from lenjoy_bbs.modules.users.models import UserAccount


def _matches_keyword(*columns, keyword: str | None):
    if not keyword:
        return None
    pattern = f"%{keyword.strip()}%"
    return or_(*(column.ilike(pattern) for column in columns))


async def list_reports(
    db: AsyncSession,
    *,
    status_value: str | None = None,
    target_type: str | None = None,
    keyword: str | None = None,
) -> list[dict]:
    items: list[dict] = []

    if target_type in {None, "", "POST"}:
        post_reporter = aliased(UserAccount)
        post_query = (
            select(PostReport, Post, post_reporter)
            .join(Post, Post.id == PostReport.post_id)
            .join(post_reporter, post_reporter.id == PostReport.reporter_id)
        )
        if status_value:
            post_query = post_query.where(PostReport.status == status_value)
        keyword_filter = _matches_keyword(
            Post.title,
            PostReport.reason,
            PostReport.detail,
            post_reporter.username,
            keyword=keyword,
        )
        if keyword_filter is not None:
            post_query = post_query.where(keyword_filter)
        post_rows = (await db.execute(post_query.order_by(PostReport.created_at.desc()))).all()
        items.extend(
            {
                "targetType": "POST",
                "reportId": report.id,
                "targetId": report.post_id,
                "reporterId": report.reporter_id,
                "reporterUsername": reporter.username,
                "reason": report.reason,
                "detail": report.detail,
                "status": report.status,
                "resolutionNote": report.resolution_note,
                "handledBy": report.handled_by,
                "createdAt": report.created_at.isoformat(),
                "handledAt": report.handled_at.isoformat() if report.handled_at else None,
                "targetTitle": post.title,
            }
            for report, post, reporter in post_rows
        )

    if target_type in {None, "", "COMMENT"}:
        comment_reporter = aliased(UserAccount)
        comment_query = (
            select(CommentReport, PostComment, Post, comment_reporter)
            .join(PostComment, PostComment.id == CommentReport.comment_id)
            .join(Post, Post.id == PostComment.post_id)
            .join(comment_reporter, comment_reporter.id == CommentReport.reporter_id)
        )
        if status_value:
            comment_query = comment_query.where(CommentReport.status == status_value)
        keyword_filter = _matches_keyword(
            Post.title,
            PostComment.content,
            CommentReport.reason,
            CommentReport.detail,
            comment_reporter.username,
            keyword=keyword,
        )
        if keyword_filter is not None:
            comment_query = comment_query.where(keyword_filter)
        comment_rows = (await db.execute(comment_query.order_by(CommentReport.created_at.desc()))).all()
        items.extend(
            {
                "targetType": "COMMENT",
                "reportId": report.id,
                "targetId": report.comment_id,
                "reporterId": report.reporter_id,
                "reporterUsername": reporter.username,
                "reason": report.reason,
                "detail": report.detail,
                "status": report.status,
                "resolutionNote": report.resolution_note,
                "handledBy": report.handled_by,
                "createdAt": report.created_at.isoformat(),
                "handledAt": report.handled_at.isoformat() if report.handled_at else None,
                "targetTitle": post.title,
            }
            for report, _comment, post, reporter in comment_rows
        )

    return sorted(items, key=lambda item: item["createdAt"], reverse=True)


async def review_post_report(
    db: AsyncSession,
    report_id: int,
    *,
    status_value: str,
    note: str | None,
    action: str | None,
    admin_id: int,
) -> dict:
    try:
        report = await db.get(PostReport, report_id)
        if not report:
            raise ApiError(Admin.REPORT_NOT_FOUND)
        report.status = status_value
        report.resolution_note = note
        report.handled_by = admin_id
        report.handled_at = now_utc()
        if action == "OFFLINE_POST":
            post = await db.get(Post, report.post_id)
            if post:
                await apply_post_offline(db, post, admin_id)
                content = f"你的帖子《{post.title}》因举报处理被下架。"
                if note:
                    content = f"{content}处理说明：{note}"
                await create_site_message(
                    db,
                    user_id=post.author_id,
                    title="帖子已下架",
                    content=content,
                    message_type="POST_OFFLINED",
                )
        await db.commit()
        return {"id": report.id, "status": report.status}
    except Exception:
        await db.rollback()
        raise


async def review_comment_report(
    db: AsyncSession,
    report_id: int,
    *,
    status_value: str,
    note: str | None,
    action: str | None,
    admin_id: int,
) -> dict:
    report = await db.get(CommentReport, report_id)
    if not report:
        raise ApiError(Admin.REPORT_NOT_FOUND)
    report.status = status_value
    report.resolution_note = note
    report.handled_by = admin_id
    report.handled_at = now_utc()
    if action == "DELETE_COMMENT":
        comment = await db.get(PostComment, report.comment_id)
        if comment:
            comment.is_deleted = True
            comment.deleted_by = admin_id
            comment.deleted_reason = note or "管理员处理举报"
    await db.commit()
    return {"id": report.id, "status": report.status}


async def list_resource_appeals(
    db: AsyncSession,
    *,
    status_value: str | None = None,
    keyword: str | None = None,
) -> list[dict]:
    buyer = aliased(UserAccount)
    seller = aliased(UserAccount)
    query = (
        select(ResourceAppeal, ResourcePurchase, Post, buyer, seller)
        .join(ResourcePurchase, ResourcePurchase.id == ResourceAppeal.purchase_id)
        .join(Post, Post.id == ResourceAppeal.post_id)
        .join(buyer, buyer.id == ResourceAppeal.buyer_id)
        .join(seller, seller.id == ResourceAppeal.seller_id)
    )
    if status_value:
        query = query.where(ResourceAppeal.status == status_value)
    keyword_filter = _matches_keyword(
        Post.title,
        buyer.username,
        seller.username,
        ResourceAppeal.reason,
        ResourceAppeal.detail,
        keyword=keyword,
    )
    if keyword_filter is not None:
        query = query.where(keyword_filter)
    rows = (await db.execute(query.order_by(ResourceAppeal.created_at.desc()))).all()
    return [
        {
            "id": appeal.id,
            "purchaseId": appeal.purchase_id,
            "postId": appeal.post_id,
            "postTitle": post.title,
            "reason": appeal.reason,
            "detail": appeal.detail,
            "status": appeal.status,
            "requestedRefundAmount": appeal.requested_refund_amount,
            "resolvedRefundAmount": appeal.resolved_refund_amount,
            "resolutionNote": appeal.resolution_note,
            "buyerId": appeal.buyer_id,
            "buyerUsername": buyer_user.username,
            "sellerId": appeal.seller_id,
            "sellerUsername": seller_user.username,
            "createdAt": appeal.created_at.isoformat(),
            "updatedAt": appeal.updated_at.isoformat(),
        }
        for appeal, _purchase, post, buyer_user, seller_user in rows
    ]


async def review_resource_appeal(
    db: AsyncSession,
    appeal_id: int,
    *,
    action: str,
    refund_amount: int,
    note: str | None,
    admin_id: int,
) -> dict:
    appeal = await db.get(ResourceAppeal, appeal_id)
    if not appeal:
        raise ApiError(Admin.APPEAL_NOT_FOUND)
    appeal.status = "APPROVED" if action == "APPROVE" else "REJECTED"
    appeal.resolved_refund_amount = refund_amount if action == "APPROVE" else 0
    appeal.resolution_note = note
    appeal.resolved_by = admin_id
    appeal.resolved_at = now_utc()
    await db.commit()
    return {"id": appeal.id, "status": appeal.status}
