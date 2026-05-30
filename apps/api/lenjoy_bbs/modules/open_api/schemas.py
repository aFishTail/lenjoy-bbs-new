from pydantic import BaseModel


class ClientRequest(BaseModel):
    name: str
    remark: str | None = None
    status: str = "ACTIVE"


class ClientStatusRequest(BaseModel):
    status: str


class BindingRequest(BaseModel):
    bindingCode: str
    userId: int
    remark: str | None = None
    status: str = "ACTIVE"

