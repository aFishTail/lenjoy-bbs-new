from typing import Literal

from pydantic import BaseModel, Field


class BountyDeleteRequestReviewRequest(BaseModel):
    action: Literal["APPROVE", "REJECT"]
    resolutionNote: str | None = Field(default=None, max_length=255)
