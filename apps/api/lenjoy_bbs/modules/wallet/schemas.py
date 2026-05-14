from pydantic import BaseModel, ConfigDict, Field


class WalletSummaryResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    available_coins: int = Field(alias="availableCoins")
    frozen_coins: int = Field(alias="frozenCoins")


class WalletLedgerItemResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: int
    direction: str
    change_amount: int = Field(alias="changeAmount")
    balance_after: int = Field(alias="balanceAfter")
    frozen_after: int = Field(alias="frozenAfter")
    biz_type: str = Field(alias="bizType")
    biz_key: str | None = Field(default=None, alias="bizKey")
    remark: str | None = None
    created_at: str = Field(alias="createdAt")
