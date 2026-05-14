"""Compatibility shim for legacy imports.

Real storage implementation lives under lenjoy_bbs.infrastructure.storage.image_storage.
"""

from lenjoy_bbs.infrastructure.storage.image_storage import MinioImageStorage, validate_image_upload

__all__ = ["MinioImageStorage", "validate_image_upload"]
