from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

DataT = TypeVar("DataT")


class ErrorPayload(BaseModel):
    code: str
    message: str


class MetaPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    api_version: str = Field(alias="apiVersion")


class PageData(BaseModel, Generic[DataT]):
    model_config = ConfigDict(populate_by_name=True)

    items: list[DataT]
    page: int
    page_size: int = Field(alias="pageSize")
    total: int
    total_pages: int = Field(alias="totalPages")
    has_next: bool = Field(alias="hasNext")
    has_previous: bool = Field(alias="hasPrevious")


class ApiEnvelope(BaseModel, Generic[DataT]):
    data: DataT | None
    error: ErrorPayload | None
    meta: MetaPayload
