from fastapi import APIRouter, status
from lenjoy_bbs.core.dependencies import CurrentUser, DbSession
from lenjoy_bbs.core.responses import success
from lenjoy_bbs.modules.reports.schemas import ReportRequest
from lenjoy_bbs.modules.reports.service import create_comment_report, create_post_report

router = APIRouter(tags=["reports"])


@router.post("/posts/{post_id}/reports", status_code=status.HTTP_201_CREATED)
async def report_post(
    post_id: int,
    payload: ReportRequest,
    db: DbSession,
    user: CurrentUser,
):
    return success(await create_post_report(db, post_id, user.id, payload.reason, payload.detail))


@router.post("/comments/{comment_id}/reports", status_code=status.HTTP_201_CREATED)
async def report_comment(
    comment_id: int,
    payload: ReportRequest,
    db: DbSession,
    user: CurrentUser,
):
    return success(await create_comment_report(db, comment_id, user.id, payload.reason, payload.detail))
