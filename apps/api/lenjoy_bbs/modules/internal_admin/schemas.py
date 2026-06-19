"""Pydantic schemas for the internal admin API."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Auth context
# ---------------------------------------------------------------------------


class MutationAck(BaseModel):
    """Base shape of a successful mutation response.

    All mutations include the operator and request IDs so downstream
    consumers can correlate the response with their own audit trail.
    """

    operatorId: str
    requestId: str
    idempotencyKey: str


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------


class UserStatusRequest(BaseModel):
    status: Literal["ACTIVE", "MUTED", "BANNED"]
    reason: str | None = Field(default=None, max_length=255)


# ---------------------------------------------------------------------------
# Posts / Comments / Bounties
# ---------------------------------------------------------------------------


class PostMutationAck(MutationAck):
    postId: int


class CommentMutationAck(MutationAck):
    commentId: int


# ---------------------------------------------------------------------------
# Bounty delete requests
# ---------------------------------------------------------------------------


class BountyDeleteRequestReviewRequest(BaseModel):
    action: Literal["APPROVE", "REJECT"]
    resolutionNote: str | None = Field(default=None, max_length=255)


class BountyDeleteRequestReviewAck(MutationAck):
    requestId: int
    status: str


# ---------------------------------------------------------------------------
# Reports / Appeals
# ---------------------------------------------------------------------------


class ReportReviewRequest(BaseModel):
    status: str
    resolutionNote: str | None = Field(default=None, max_length=255)
    action: str | None = None


class ReportReviewAck(MutationAck):
    reportId: int
    status: str


class ResourceAppealReviewRequest(BaseModel):
    action: str
    refundAmount: int = Field(default=0, ge=0)
    resolutionNote: str | None = Field(default=None, max_length=255)


class ResourceAppealReviewAck(MutationAck):
    appealId: int
    status: str


# ---------------------------------------------------------------------------
# Coins / Wallet
# ---------------------------------------------------------------------------


class CoinAdjustRequest(BaseModel):
    amount: int = Field(ge=-1_000_000, le=1_000_000)
    reason: str | None = Field(default=None, max_length=255)


class CoinAdjustAck(MutationAck):
    userId: int
    availableCoins: int
    frozenCoins: int
    totalCoins: int


# ---------------------------------------------------------------------------
# Categories / Tags
# ---------------------------------------------------------------------------


class CategoryRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    slug: str | None = Field(default=None, min_length=1, max_length=120)
    contentType: Literal["NORMAL", "RESOURCE", "BOUNTY"] | None = "NORMAL"
    parentId: int = 0
    sort: int = 0
    status: str = "ACTIVE"
    isLeaf: bool = True


class CategoryStatusRequest(BaseModel):
    status: Literal["ACTIVE", "INACTIVE"]


class TagRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    slug: str | None = Field(default=None, min_length=1, max_length=120)
    status: str = "ACTIVE"
    source: str = "CUSTOM"


class TagStatusRequest(BaseModel):
    status: Literal["ACTIVE", "INACTIVE", "MERGED"]


class TagMergeRequest(BaseModel):
    targetTagId: int = Field(gt=0)


# ---------------------------------------------------------------------------
# Open API clients / bindings
# ---------------------------------------------------------------------------


class OpenApiClientRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    remark: str | None = Field(default=None, max_length=255)
    status: str = "ACTIVE"


class OpenApiClientStatusRequest(BaseModel):
    status: str = Field(min_length=1, max_length=32)


class OpenApiBindingRequest(BaseModel):
    partnerUserId: int = Field(gt=0)
    scope: str = Field(min_length=1, max_length=128)
    remark: str | None = Field(default=None, max_length=255)
    status: str = "ACTIVE"


class OpenApiBindingStatusRequest(BaseModel):
    status: str = Field(min_length=1, max_length=32)


__all__ = [
    "BountyDeleteRequestReviewAck",
    "BountyDeleteRequestReviewRequest",
    "CategoryRequest",
    "CategoryStatusRequest",
    "CoinAdjustAck",
    "CoinAdjustRequest",
    "CommentMutationAck",
    "MutationAck",
    "OpenApiBindingRequest",
    "OpenApiBindingStatusRequest",
    "OpenApiClientRequest",
    "OpenApiClientStatusRequest",
    "PostMutationAck",
    "ReportReviewAck",
    "ReportReviewRequest",
    "ResourceAppealReviewAck",
    "ResourceAppealReviewRequest",
    "TagMergeRequest",
    "TagRequest",
    "TagStatusRequest",
    "UserStatusRequest",
]
