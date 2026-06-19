from fastapi import APIRouter, Request, status
from fastapi.responses import Response

from lenjoy_bbs.core.api_schemas import ApiEnvelope
from lenjoy_bbs.core.dependencies import DbSession
from lenjoy_bbs.core.rate_limiting import limiter
from lenjoy_bbs.core.responses import success
from lenjoy_bbs.modules.auth.captcha import get_captcha_image, issue_captcha
from lenjoy_bbs.modules.auth.schemas import AuthTokenResponse, CaptchaResponse, LoginRequest, RegisterRequest
from lenjoy_bbs.modules.auth.service import login_user, register_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/captcha", response_model=ApiEnvelope[CaptchaResponse], response_model_exclude_unset=True)
@limiter.limit("20/minute")
async def captcha(request: Request):
    return success(await issue_captcha())


@router.get("/captcha/{captcha_id}/image")
@limiter.limit("20/minute")
async def captcha_image(request: Request, captcha_id: str) -> Response:
    return Response(content=await get_captcha_image(captcha_id), media_type="image/png")


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=ApiEnvelope[AuthTokenResponse])
@limiter.limit("5/minute")
async def register(request: Request, payload: RegisterRequest, db: DbSession):
    return success(await register_user(db, payload))


@router.post("/login", response_model=ApiEnvelope[AuthTokenResponse])
@limiter.limit("10/minute")
async def login(request: Request, payload: LoginRequest, db: DbSession):
    return success(await login_user(db, payload))
