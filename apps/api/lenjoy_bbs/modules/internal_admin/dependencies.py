"""FastAPI dependencies for the internal admin API.

The internal admin API is reachable only by trusted downstream services
(notably the Operations API). Authentication is based on a shared
``X-Service-Token`` header, and is mutually exclusive with BBS user JWT
authentication. Mutations additionally require ``X-Operator-Id`` and
``Idempotency-Key`` headers.
"""
from __future__ import annotations

import secrets
from dataclasses import dataclass
from typing import Annotated
from uuid import uuid4

from fastapi import Header, Request

from lenjoy_bbs.core.config import get_settings
from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.core.logging import bind_request_context
from lenjoy_bbs.core.messages import Common

from .models import InternalAdminAuditLog  # noqa: F401  (re-exported for tests)

_MAX_OPERATOR_ID_LEN = 128
_MAX_IDEMPOTENCY_KEY_LEN = 128


@dataclass(frozen=True)
class InternalCaller:
    """Identity carried by every internal admin request."""

    operator_id: str
    request_id: str
    idempotency_key: str | None


def _unauthorized(code: str, text: str) -> ApiError:
    """Build a 401 ApiError without depending on the Auth.* message texts."""
    err = ApiError(Common.HTTP_ERROR)
    err.code = code
    err.message = text
    err.http_status = 401
    return err


def _bad_request(code: str, text: str) -> ApiError:
    err = ApiError(Common.VALIDATION_ERROR)
    err.code = code
    err.message = text
    err.http_status = 400
    return err


def require_service_token(
    x_service_token: Annotated[str | None, Header(alias="X-Service-Token")] = None,
    authorization: Annotated[str | None, Header()] = None,
) -> str:
    """Validate ``X-Service-Token`` and reject BBS user JWTs.

    A JWT in the ``Authorization`` header is ALWAYS rejected with 401, even
    if a valid service token is also provided. The internal admin API is
    not user-facing and must never accept end-user credentials.
    """
    if authorization and authorization.strip().lower().startswith("bearer "):
        raise _unauthorized(
            "INTERNAL_AUTH_REJECTED",
            "BBS user authentication is not accepted on the internal admin API",
        )
    if not x_service_token:
        raise _unauthorized(
            "INTERNAL_SERVICE_TOKEN_REQUIRED",
            "X-Service-Token header is required",
        )
    settings = get_settings()
    expected = settings.internal_service_token
    if not expected or not secrets.compare_digest(x_service_token, expected):
        raise _unauthorized(
            "INTERNAL_SERVICE_TOKEN_INVALID",
            "X-Service-Token is invalid",
        )
    return x_service_token


def get_request_context_headers(
    request: Request,
    x_request_id: Annotated[str | None, Header(alias="X-Request-Id")] = None,
) -> str:
    """Resolve the request ID, generating one if missing.

    The value is bound to the logging context for the duration of the
    request and is mirrored on the response.
    """
    request_id = (
        (x_request_id or "").strip()
        or getattr(request.state, "request_id", None)
        or uuid4().hex
    )
    bind_request_context(internal_request_id=request_id)
    return request_id


def require_mutation_headers(
    request: Request,
    x_operator_id: Annotated[str | None, Header(alias="X-Operator-Id")] = None,
    x_idempotency_key: Annotated[
        str | None, Header(alias="Idempotency-Key", max_length=_MAX_IDEMPOTENCY_KEY_LEN)
    ] = None,
    x_request_id: Annotated[str | None, Header(alias="X-Request-Id")] = None,
) -> InternalCaller:
    """Validate the headers required on every internal admin mutation."""
    operator_id = (x_operator_id or "").strip()
    if not operator_id:
        raise _bad_request(
            "INTERNAL_OPERATOR_ID_REQUIRED",
            "X-Operator-Id header is required for mutations",
        )
    if len(operator_id) > _MAX_OPERATOR_ID_LEN:
        raise _bad_request(
            "INTERNAL_OPERATOR_ID_TOO_LONG",
            f"X-Operator-Id must be <= {_MAX_OPERATOR_ID_LEN} characters",
        )
    idempotency_key = (x_idempotency_key or "").strip()
    if not idempotency_key:
        raise _bad_request(
            "INTERNAL_IDEMPOTENCY_KEY_REQUIRED",
            "Idempotency-Key header is required for mutations",
        )
    if len(idempotency_key) > _MAX_IDEMPOTENCY_KEY_LEN:
        raise _bad_request(
            "INTERNAL_IDEMPOTENCY_KEY_TOO_LONG",
            f"Idempotency-Key must be <= {_MAX_IDEMPOTENCY_KEY_LEN} characters",
        )
    request_id = (
        (x_request_id or "").strip()
        or getattr(request.state, "request_id", None)
        or uuid4().hex
    )
    request.state.internal_request_id = request_id
    bind_request_context(internal_request_id=request_id, internal_operator_id=operator_id)
    return InternalCaller(
        operator_id=operator_id,
        request_id=request_id,
        idempotency_key=idempotency_key,
    )


# Re-export for tests / consumers that need to construct the audit model.
__all__ = [
    "InternalCaller",
    "get_request_context_headers",
    "require_mutation_headers",
    "require_service_token",
]
