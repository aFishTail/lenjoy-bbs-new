from pydantic import BaseModel, Field


class CoinRequest(BaseModel):
    amount: int = Field(ge=-1_000_000, le=1_000_000)
    reason: str | None = Field(default=None, max_length=255)

