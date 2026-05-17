from typing import Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class TaxonomyRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(min_length=1, max_length=100)
    slug: str | None = Field(default=None, min_length=1, max_length=120)
    contentType: Literal["NORMAL", "RESOURCE", "BOUNTY"] | None = None
    parentId: int = 0
    sort: int = 0
    status: str = "ACTIVE"
    isLeaf: bool = Field(
        default=True,
        validation_alias=AliasChoices("isLeaf", "leaf"),
    )
    source: str = "CUSTOM"


class StatusRequest(BaseModel):
    status: Literal["ACTIVE", "INACTIVE"]


class TagMergeRequest(BaseModel):
    targetTagId: int = Field(gt=0)

