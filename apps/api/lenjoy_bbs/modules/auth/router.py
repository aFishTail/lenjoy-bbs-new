from fastapi import APIRouter, status
from fastapi.responses import Response

from lenjoy_bbs.core.api_schemas import ApiEnvelope
from lenjoy_bbs.core.dependencies import DbSession
from lenjoy_bbs.core.responses import success
from lenjoy_bbs.modules.auth.captcha import get_captcha_image, issue_captcha
from lenjoy_bbs.modules.auth.service import login_user, register_user
from lenjoy_bbs.modules.auth.schemas import AuthTokenResponse, CaptchaResponse, LoginRequest, RegisterRequest

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/captcha", response_model=ApiEnvelope[CaptchaResponse], response_model_exclude_unset=True)
async def captcha():
    return success(await issue_captcha())


@router.get("/captcha/{captcha_id}/image")
async def captcha_image(captcha_id: str) -> Response:
    return Response(content=await get_captcha_image(captcha_id), media_type="image/png")


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=ApiEnvelope[AuthTokenResponse])
async def register(payload: RegisterRequest, db: DbSession):
    return success(await register_user(db, payload))


@router.post("/login", response_model=ApiEnvelope[AuthTokenResponse])
async def login(payload: LoginRequest, db: DbSession):
    return success(await login_user(db, payload))
