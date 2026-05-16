from datetime import datetime
from typing import Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class PostCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    post_type: Literal["NORMAL", "RESOURCE", "BOUNTY"] = Field(
        default="NORMAL",
        validation_alias=AliasChoices("postType", "type"),
        serialization_alias="postType",
    )
    title: str = Field(min_length=1, max_length=255)
    content: str | None = Field(default=None, max_length=20_000)
    hidden_content: str | None = Field(default=None,
                                       alias="hiddenContent",
                                       max_length=20_000)
    price: int | None = Field(default=None, ge=0, le=1_000_000)
    bounty_amount: int | None = Field(default=None,
                                      alias="bountyAmount",
                                      ge=0,
                                      le=1_000_000)
    bounty_expire_at: datetime | None = Field(default=None,
                                              alias="bountyExpireAt")
    category_id: int | None = Field(default=None, alias="categoryId")
    tag_ids: list[int] = Field(default_factory=list, alias="tagIds")


class PostUpdateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: str | None = Field(default=None, min_length=1, max_length=255)
    content: str | None = Field(default=None, max_length=20_000)
    hidden_content: str | None = Field(default=None,
                                       alias="hiddenContent",
                                       max_length=20_000)
    price: int | None = Field(default=None, ge=0, le=1_000_000)
    category_id: int | None = Field(default=None, alias="categoryId")
    tag_ids: list[int] = Field(default_factory=list, alias="tagIds")


class CommentCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    content: str = Field(min_length=1, max_length=5_000)
    parent_id: int | None = Field(default=None, alias="parentId")
    reply_to_user_id: int | None = Field(default=None, alias="replyToUserId")


class PostResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: int
    author_id: int = Field(alias="authorId")
    author_username: str | None = Field(default=None, alias="authorUsername")
    post_type: str = Field(
        validation_alias=AliasChoices("postType", "type"),
        serialization_alias="postType",
    )
    category_id: int | None = Field(default=None, alias="categoryId")
    category_name: str | None = Field(default=None, alias="categoryName")
    tags: list[dict] = Field(default_factory=list)
    title: str
    content: str | None = None
    hidden_content: str | None = Field(default=None, alias="hiddenContent")
    price: int
    bounty_amount: int | None = Field(default=None, alias="bountyAmount")
    bounty_status: str | None = Field(default=None, alias="bountyStatus")
    bounty_expire_at: str | None = Field(default=None, alias="bountyExpireAt")
    bounty_settled_at: str | None = Field(default=None,
                                          alias="bountySettledAt")
    accepted_comment_id: int | None = Field(default=None,
                                            alias="acceptedCommentId")
    status: str
    view_count: int = Field(default=0, alias="viewCount")
    like_count: int = Field(default=0, alias="likeCount")
    collect_count: int = Field(default=0, alias="collectCount")
    comment_count: int = Field(default=0, alias="commentCount")
    answer_count: int = Field(default=0, alias="answerCount")
    liked: bool = False
    collected: bool = False
    resource_unlocked: bool = Field(default=False, alias="resourceUnlocked")
    purchased: bool = False
    can_purchase: bool = Field(default=False, alias="canPurchase")
    purchase_id: int | None = Field(default=None, alias="purchaseId")
    purchase_status: str | None = Field(default=None, alias="purchaseStatus")
    refunded_amount: int = Field(default=0, alias="refundedAmount")
    appeal_status: str | None = Field(default=None, alias="appealStatus")
    offline_reason: str | None = Field(default=None, alias="offlineReason")
    offlined_at: str | None = Field(default=None, alias="offlinedAt")
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")


class CommentResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: int
    post_id: int = Field(alias="postId")
    author_id: int = Field(alias="authorId")
    author_username: str | None = Field(default=None, alias="authorUsername")
    parent_id: int | None = Field(default=None, alias="parentId")
    reply_to_user_id: int | None = Field(default=None, alias="replyToUserId")
    reply_to_username: str | None = Field(default=None,
                                          alias="replyToUsername")
    content: str | None = None
    is_accepted: bool = Field(alias="isAccepted")
    can_view_content: bool = Field(default=True, alias="canViewContent")
    masked_summary: str | None = Field(default=None, alias="maskedSummary")
    deleted: bool = False
    created_at: str = Field(alias="createdAt")
    updated_at: str | None = Field(default=None, alias="updatedAt")
    replies: list["CommentResponse"] = Field(default_factory=list)


class PostPurchaseResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: int
    post_id: int = Field(alias="postId")
    buyer_id: int = Field(alias="buyerId")
    seller_id: int = Field(alias="sellerId")
    price: int


class PostViewResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    post_id: int = Field(alias="postId")
    view_count: int = Field(alias="viewCount")


class InteractionToggleResponse(BaseModel):
    active: bool
    count: int


CommentResponse.model_rebuild()
