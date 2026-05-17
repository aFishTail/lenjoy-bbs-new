from typing import Literal

from pydantic import BaseModel, Field


class StatusRequest(BaseModel):
    status: Literal["ACTIVE", "MUTED", "BANNED"]
    reason: str | None = Field(default=None, max_length=255)

