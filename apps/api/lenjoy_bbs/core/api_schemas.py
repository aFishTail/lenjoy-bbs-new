from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

DataT = TypeVar("DataT")


class ErrorPayload(BaseModel):
    code: str
    message: str


class MetaPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    api_version: str = Field(alias="apiVersion")


class ApiEnvelope(BaseModel, Generic[DataT]):
    data: DataT | None
    error: ErrorPayload | None
    meta: MetaPayload
