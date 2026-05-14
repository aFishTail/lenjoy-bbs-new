from fastapi import APIRouter

from lenjoy_bbs.core.responses import success

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    return success({"status": "UP"})
