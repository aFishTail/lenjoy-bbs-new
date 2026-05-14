from typing import Literal

from pydantic import BaseModel, Field


class TaxonomyRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    slug: str = Field(min_length=1, max_length=120)
    contentType: Literal["NORMAL", "RESOURCE", "BOUNTY"] | None = None
    parentId: int = 0
    sort: int = 0
    status: str = "ACTIVE"
    isLeaf: bool = True
    source: str = "CUSTOM"

