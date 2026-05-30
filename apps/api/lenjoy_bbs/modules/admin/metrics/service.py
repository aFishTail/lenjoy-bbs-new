from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.modules.posts.models import Post
from lenjoy_bbs.modules.reports.models import CommentReport, PostReport
from lenjoy_bbs.modules.users.models import UserAccount


async def dashboard_metrics(db: AsyncSession) -> dict[str, int]:
    return {
        "userCount": await db.scalar(select(func.count()).select_from(UserAccount)) or 0,
        "postCount": await db.scalar(select(func.count()).select_from(Post)) or 0,
        "reportCount": (await db.scalar(select(func.count()).select_from(PostReport)) or 0)
        + (await db.scalar(select(func.count()).select_from(CommentReport)) or 0),
    }
