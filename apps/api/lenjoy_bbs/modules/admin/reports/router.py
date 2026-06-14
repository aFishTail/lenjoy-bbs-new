from fastapi import APIRouter, Depends

from lenjoy_bbs.core.dependencies import AdminUser, DbSession
from lenjoy_bbs.core.legacy_admin import require_legacy_admin_mutations_enabled
from lenjoy_bbs.core.responses import success
from lenjoy_bbs.modules.admin.reports.schemas import ReportReviewRequest, ResourceAppealReviewRequest
from lenjoy_bbs.modules.admin.reports.service import (
    list_reports,
    list_resource_appeals,
    review_comment_report,
    review_post_report,
    review_resource_appeal,
)

router = APIRouter(tags=["admin"])
LegacyMutationGate = Depends(require_legacy_admin_mutations_enabled)


@router.get("/reports")
async def reports(
    db: DbSession,
    _: AdminUser,
    status: str | None = None,
    targetType: str | None = None,
    keyword: str | None = None,
):
    return success(await list_reports(db, status_value=status, target_type=targetType, keyword=keyword))


@router.patch("/reports/posts/{report_id}", dependencies=[LegacyMutationGate])
async def post_report_status(report_id: int, payload: ReportReviewRequest, db: DbSession, admin: AdminUser):
    return success(
        await review_post_report(
            db,
            report_id,
            status_value=payload.status,
            note=payload.resolutionNote,
            action=payload.action,
            admin_id=admin.id,
        )
    )


@router.patch("/reports/comments/{report_id}", dependencies=[LegacyMutationGate])
async def comment_report_status(report_id: int, payload: ReportReviewRequest, db: DbSession, admin: AdminUser):
    return success(
        await review_comment_report(
            db,
            report_id,
            status_value=payload.status,
            note=payload.resolutionNote,
            action=payload.action,
            admin_id=admin.id,
        )
    )


@router.get("/resource-appeals")
async def resource_appeals(db: DbSession, _: AdminUser, status: str | None = None, keyword: str | None = None):
    return success(await list_resource_appeals(db, status_value=status, keyword=keyword))


@router.patch("/resource-appeals/{appeal_id}", dependencies=[LegacyMutationGate])
async def resource_appeal_status(appeal_id: int, payload: ResourceAppealReviewRequest, db: DbSession, admin: AdminUser):
    return success(
        await review_resource_appeal(
            db,
            appeal_id,
            action=payload.action,
            refund_amount=payload.refundAmount,
            note=payload.resolutionNote,
            admin_id=admin.id,
        )
    )
