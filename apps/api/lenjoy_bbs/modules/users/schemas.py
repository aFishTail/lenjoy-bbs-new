from pydantic import BaseModel, ConfigDict, Field


class ProfileUpdateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    avatar_url: str | None = Field(default=None, alias="avatarUrl")
    bio: str | None = None


class UserPublicResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: int
    username: str
    email: str | None = None
    phone: str | None = None
    avatar_url: str | None = Field(default=None, alias="avatarUrl")
    bio: str | None = None
    roles: list[str] = Field(default_factory=list)
