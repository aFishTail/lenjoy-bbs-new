from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile

from lenjoy_bbs.core.dependencies import CurrentUser
from lenjoy_bbs.core.responses import success
from lenjoy_bbs.infrastructure.storage.image_storage import MinioImageStorage

router = APIRouter(prefix="/files", tags=["files"])


def get_storage_service() -> MinioImageStorage:
    return MinioImageStorage()


@router.post("/images")
async def upload_image(
    _: CurrentUser,
    storage: Annotated[MinioImageStorage, Depends(get_storage_service)],
    file: UploadFile = File(...),
):
    return success(await storage.upload_image(file))
