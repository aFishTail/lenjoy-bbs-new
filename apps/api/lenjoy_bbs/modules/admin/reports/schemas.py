from pydantic import BaseModel, Field


class ReportReviewRequest(BaseModel):
    status: str
    resolutionNote: str | None = Field(default=None, max_length=255)
    action: str | None = None


class ResourceAppealReviewRequest(BaseModel):
    action: str
    refundAmount: int = Field(default=0, ge=0)
    resolutionNote: str | None = Field(default=None, max_length=255)
