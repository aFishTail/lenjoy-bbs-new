from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class PostCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    type: Literal["NORMAL", "RESOURCE", "BOUNTY"] = "NORMAL"
    title: str = Field(min_length=1, max_length=255)
    content: str | None = Field(default=None, max_length=20_000)
    hidden_content: str | None = Field(default=None, alias="hiddenContent", max_length=20_000)
    price: int | None = Field(default=None, ge=0, le=1_000_000)
    bounty_amount: int | None = Field(default=None, alias="bountyAmount", ge=0, le=1_000_000)
    bounty_expire_at: datetime | None = Field(default=None, alias="bountyExpireAt")
    category_id: int | None = Field(default=None, alias="categoryId")
    tag_ids: list[int] = Field(default_factory=list, alias="tagIds")


class PostUpdateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: str | None = Field(default=None, min_length=1, max_length=255)
    content: str | None = Field(default=None, max_length=20_000)
    hidden_content: str | None = Field(default=None, alias="hiddenContent", max_length=20_000)
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
    type: str
    title: str
    content: str | None = None
    hidden_content: str | None = Field(default=None, alias="hiddenContent")
    price: int
    status: str
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")


class CommentResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: int
    post_id: int = Field(alias="postId")
    author_id: int = Field(alias="authorId")
    parent_id: int | None = Field(default=None, alias="parentId")
    reply_to_user_id: int | None = Field(default=None, alias="replyToUserId")
    content: str
    is_accepted: bool = Field(alias="isAccepted")
    created_at: str = Field(alias="createdAt")


class PostPurchaseResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: int
    post_id: int = Field(alias="postId")
    buyer_id: int = Field(alias="buyerId")
    seller_id: int = Field(alias="sellerId")
    price: int
