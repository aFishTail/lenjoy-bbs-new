import json
from datetime import UTC, datetime
import logging
from threading import Lock
from uuid import uuid4

import anyio
from fastapi import UploadFile
from minio import Minio
from minio.error import S3Error

from lenjoy_bbs.core.config import get_settings
from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.core.logging import log_event
from lenjoy_bbs.core.messages import Files

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
}
logger = logging.getLogger("lenjoy_bbs.files")


def validate_image_upload(file: UploadFile, size: int) -> str:
    if size <= 0:
        raise ApiError(Files.FILE_REQUIRED)
    if size > get_settings().minio_max_file_size_bytes:
        raise ApiError(Files.FILE_TOO_LARGE)
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise ApiError(Files.FILE_TYPE_INVALID)
    return content_type


class MinioImageStorage:
    _bucket_ready = False
    _bucket_ready_lock = Lock()

    def __init__(self) -> None:
        settings = get_settings()
        endpoint, secure = settings.minio_client_endpoint
        self._settings = settings
        self._client = Minio(
            endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=secure,
        )

    async def upload_image(self, file: UploadFile) -> dict:
        content = await _read_bounded_bytes(file, get_settings().minio_max_file_size_bytes)
        content_type = validate_image_upload(file, len(content))
        object_key = self._object_key(content_type)
        await anyio.to_thread.run_sync(self._ensure_bucket_is_publicly_readable)
        try:
            await anyio.to_thread.run_sync(
                lambda: self._client.put_object(
                    bucket_name=self._settings.minio_bucket,
                    object_name=object_key,
                    data=_file_like(content),
                    length=len(content),
                    content_type=content_type,
                )
            )
        except S3Error as exc:
            logger.exception(
                "files.upload_failed",
                extra={"event": "files.upload_failed", "dependency": "minio", "operation": "put_object", "error_type": type(exc).__name__},
            )
            raise ApiError(Files.UPLOAD_FAILED) from exc
        log_event(logger, logging.INFO, "files.upload_succeeded", object_key=object_key, size=len(content))
        return {
            "url": self._public_url(object_key),
            "filename": file.filename or "upload.bin",
            "objectKey": object_key,
            "contentType": content_type,
            "size": len(content),
        }

    def _ensure_bucket_is_publicly_readable(self) -> None:
        cls = type(self)
        if cls._bucket_ready:
            return
        with cls._bucket_ready_lock:
            if cls._bucket_ready:
                return
            try:
                if not self._client.bucket_exists(self._settings.minio_bucket):
                    self._client.make_bucket(self._settings.minio_bucket)
                self._client.set_bucket_policy(self._settings.minio_bucket, self._anonymous_read_policy())
            except S3Error as exc:
                logger.exception(
                    "files.bucket_prepare_failed",
                    extra={"event": "files.bucket_prepare_failed", "dependency": "minio", "operation": "bucket_policy", "error_type": type(exc).__name__},
                )
                raise ApiError(Files.STORAGE_UNAVAILABLE) from exc
            cls._bucket_ready = True

    def _object_key(self, content_type: str) -> str:
        today = datetime.now(UTC).strftime("%Y%m%d")
        return f"posts/{today}/{uuid4()}.{ALLOWED_IMAGE_TYPES[content_type]}"

    def _public_url(self, object_key: str) -> str:
        return f"{self._settings.minio_public_base_url.rstrip('/')}/{object_key}"

    def _anonymous_read_policy(self) -> str:
        bucket = self._settings.minio_bucket
        return json.dumps(
            {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Principal": {"AWS": ["*"]},
                        "Action": ["s3:GetObject"],
                        "Resource": [f"arn:aws:s3:::{bucket}/*"],
                    }
                ],
            }
        )


def _file_like(content: bytes):
    from io import BytesIO

    return BytesIO(content)


async def _read_bounded_bytes(file: UploadFile, max_size: int, chunk_size: int = 64 * 1024) -> bytes:
    chunks = bytearray()
    while len(chunks) <= max_size:
        chunk = await file.read(min(chunk_size, max_size + 1 - len(chunks)))
        if not chunk:
            break
        chunks.extend(chunk)
    return bytes(chunks)


__all__ = ["MinioImageStorage", "validate_image_upload"]
