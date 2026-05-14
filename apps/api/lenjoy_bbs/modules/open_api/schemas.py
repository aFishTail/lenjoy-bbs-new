from pydantic import BaseModel


class ClientRequest(BaseModel):
    name: str
    remark: str | None = None
    status: str = "ACTIVE"

