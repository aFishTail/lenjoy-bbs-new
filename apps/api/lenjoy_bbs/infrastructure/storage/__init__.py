"""Storage infrastructure adapters."""

from .image_storage import MinioImageStorage, validate_image_upload

__all__ = ["MinioImageStorage", "validate_image_upload"]
