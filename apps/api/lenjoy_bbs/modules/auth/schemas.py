from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    username: str = Field(min_length=3, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    password: str = Field(min_length=8, max_length=128)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=32)
    captcha_id: str = Field(alias="captchaId", min_length=1, max_length=128)
    captcha_code: str = Field(alias="captchaCode", min_length=1, max_length=16)


class LoginRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    account: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=1, max_length=128)
    captcha_id: str = Field(alias="captchaId", min_length=1, max_length=128)
    captcha_code: str = Field(alias="captchaCode", min_length=1, max_length=16)


class CaptchaResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    captcha_id: str = Field(alias="captchaId")
    image_url: str = Field(alias="imageUrl")
    expire_at: int = Field(alias="expireAt")
    debug_code: str | None = Field(default=None, alias="debugCode")


class AuthTokenResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    access_token: str = Field(alias="accessToken")
    token_type: str = Field(alias="tokenType")
    expires_in: int = Field(alias="expiresIn")
    user: "UserPublicResponse"


from lenjoy_bbs.modules.users.schemas import UserPublicResponse
