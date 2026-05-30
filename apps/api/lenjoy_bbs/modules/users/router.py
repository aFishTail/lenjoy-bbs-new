from fastapi import APIRouter

from lenjoy_bbs.core.api_schemas import ApiEnvelope
from lenjoy_bbs.core.dependencies import CurrentUser, DbSession, OptionalCurrentUser
from lenjoy_bbs.core.responses import success
from lenjoy_bbs.modules.users.schemas import MyProfileResponse, ProfileUpdateRequest, PublicUserProfileResponse, ResourcePurchaseSummaryResponse, ToggleFollowResponse, UserRelationResponse
from lenjoy_bbs.modules.users.service import build_my_profile, build_public_profile, list_my_followers, list_my_following, list_my_resource_purchases, list_my_resource_sales, toggle_follow, update_profile

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=ApiEnvelope[MyProfileResponse])
async def my_profile(db: DbSession, user: CurrentUser):
    return success(await build_my_profile(db, user))


@router.put("/me", response_model=ApiEnvelope[MyProfileResponse])
@router.patch("/me", response_model=ApiEnvelope[MyProfileResponse])
async def update_profile_route(
    payload: ProfileUpdateRequest,
    db: DbSession,
    user: CurrentUser,
):
    return success(await update_profile(db, user, payload))


@router.get("/me/resource-purchases",
            response_model=ApiEnvelope[list[ResourcePurchaseSummaryResponse]])
async def my_resource_purchases(db: DbSession, user: CurrentUser):
    return success(await list_my_resource_purchases(db, user.id))


@router.get("/me/resource-sales",
            response_model=ApiEnvelope[list[ResourcePurchaseSummaryResponse]])
async def my_resource_sales(db: DbSession, user: CurrentUser):
    return success(await list_my_resource_sales(db, user.id))


@router.get("/me/followers",
            response_model=ApiEnvelope[list[UserRelationResponse]])
async def my_followers(db: DbSession, user: CurrentUser):
    return success(await list_my_followers(db, user.id))


@router.get("/me/following",
            response_model=ApiEnvelope[list[UserRelationResponse]])
async def my_following(db: DbSession, user: CurrentUser):
    return success(await list_my_following(db, user.id))


@router.get("/{user_id}", response_model=ApiEnvelope[PublicUserProfileResponse])
async def public_profile(user_id: int, db: DbSession,
                         user: OptionalCurrentUser):
    return success(await build_public_profile(db, user_id, user))


@router.post("/{user_id}/follow/toggle",
             response_model=ApiEnvelope[ToggleFollowResponse])
async def toggle_follow_route(user_id: int, db: DbSession, user: CurrentUser):
    return success(await toggle_follow(db, user, user_id))
