from fastapi import APIRouter

from lenjoy_bbs.core.api_schemas import ApiEnvelope
from lenjoy_bbs.core.dependencies import CurrentUser, DbSession
from lenjoy_bbs.core.responses import success
from lenjoy_bbs.modules.common import user_public
from lenjoy_bbs.modules.users.schemas import ProfileUpdateRequest, UserPublicResponse
from lenjoy_bbs.modules.users.service import update_profile

router = APIRouter(prefix="/me", tags=["me"])


@router.get("", response_model=ApiEnvelope[UserPublicResponse])
async def my_profile(user: CurrentUser):
    return success(user_public(user))


@router.put("", response_model=ApiEnvelope[UserPublicResponse])
async def update_profile_route(
    payload: ProfileUpdateRequest,
    db: DbSession,
    user: CurrentUser,
):
    return success(await update_profile(db, user, payload))
