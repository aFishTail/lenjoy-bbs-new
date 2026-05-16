from pydantic import BaseModel, ConfigDict, Field


class ProfileUpdateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    username: str | None = None
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


class MyProfileResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: int
    username: str
    email: str | None = None
    phone: str | None = None
    avatar_url: str | None = Field(default=None, alias="avatarUrl")
    bio: str | None = None
    post_count: int = Field(default=0, alias="postCount")
    following_count: int = Field(default=0, alias="followingCount")
    follower_count: int = Field(default=0, alias="followerCount")


class ResourcePurchaseSummaryResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    purchase_id: int = Field(alias="purchaseId")
    post_id: int = Field(alias="postId")
    post_title: str = Field(alias="postTitle")
    buyer_id: int = Field(alias="buyerId")
    buyer_username: str | None = Field(default=None, alias="buyerUsername")
    seller_id: int = Field(alias="sellerId")
    seller_username: str | None = Field(default=None, alias="sellerUsername")
    price: int
    refunded_amount: int = Field(alias="refundedAmount")
    status: str
    appeal_status: str | None = Field(default=None, alias="appealStatus")
    purchased_at: str = Field(alias="purchasedAt")
    updated_at: str = Field(alias="updatedAt")


class ToggleFollowResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    following: bool
    follower_count: int = Field(alias="followerCount")
    following_count: int = Field(alias="followingCount")


class UserRelationResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: int
    username: str
    avatar_url: str | None = Field(default=None, alias="avatarUrl")
    followed_at: str = Field(alias="followedAt")
