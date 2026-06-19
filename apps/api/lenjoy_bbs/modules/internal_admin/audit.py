"""Audit helpers for the internal admin API.

Every mutation routed through the internal admin module MUST record an
audit row carrying the operator ID, request ID, and the mutation outcome.
"""
from __future__ import annotations

import json
import logging
from contextlib import asynccontextmanager
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.modules.internal_admin.models import InternalAdminAuditLog

logger = logging.getLogger("lenjoy_bbs.internal_admin")
_SENSITIVE_KEYS = {"apikey", "api_key", "password", "secret", "token", "cookie"}


def _redact(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: "[REDACTED]" if key.lower() in _SENSITIVE_KEYS else _redact(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_redact(item) for item in value]
    return value


def _jsonify(value: Any) -> str | None:
    if value is None:
        return None
    try:
        return json.dumps(_redact(value), default=str, ensure_ascii=False)
    except TypeError:
        return str(value)


async def record_audit(
    db: AsyncSession,
    *,
    domain: str,
    action: str,
    operator_id: str,
    request_id: str,
    idempotency_key: str | None,
    target_id: str | int | None = None,
    payload: Any = None,
    status_code: int = 200,
    error_message: str | None = None,
) -> None:
    """Persist a single ``InternalAdminAuditLog`` row."""
    try:
        db.add(
            InternalAdminAuditLog(
                domain=domain,
                action=action,
                target_id=str(target_id) if target_id is not None else None,
                operator_id=operator_id,
                request_id=request_id,
                idempotency_key=idempotency_key,
                payload=_jsonify(payload),
                status_code=status_code,
                error_message=error_message,
            )
        )
        await db.commit()
    except Exception:  # pragma: no cover - audit must never mask the success
        try:
            await db.rollback()
        except Exception:
            pass
        logger.exception("internal_admin.audit_persist_failed")


@asynccontextmanager
async def audit_mutation(
    db: AsyncSession,
    *,
    domain: str,
    action: str,
    operator_id: str,
    request_id: str,
    idempotency_key: str | None,
    target_id: str | int | None = None,
    payload: Any = None,
    expected_status: int | None = None,
):
    """Async context manager that records an audit row when the block exits.

    The handler may assign the produced result dict to ``state["result"]``
    and the desired HTTP status to ``state["status_code"]``. The default
    ``status_code`` is :data:`expected_status` (which itself defaults to
    ``200``), so the common case — passing ``expected_status=201`` for
    create routes — needs no per-handler bookkeeping.
    """
    default_status = expected_status if expected_status is not None else 200
    state: dict[str, Any] = {"status_code": default_status, "result": None}
    try:
        yield state
    except Exception as exc:
        # Roll back any pending transaction so the audit write is clean.
        try:
            await db.rollback()
        except Exception:  # pragma: no cover
            pass
        try:
            await record_audit(
                db,
                domain=domain,
                action=action,
                operator_id=operator_id,
                request_id=request_id,
                idempotency_key=idempotency_key,
                target_id=target_id,
                payload={"request": payload, "error": True},
                status_code=500,
                error_message=str(exc) or exc.__class__.__name__,
            )
        except Exception:  # pragma: no cover
            logger.exception("internal_admin.audit_persist_failed")
        raise
    else:
        try:
            await record_audit(
                db,
                domain=domain,
                action=action,
                operator_id=operator_id,
                request_id=request_id,
                idempotency_key=idempotency_key,
                target_id=target_id,
                payload={"request": payload, "result": state["result"]},
                status_code=int(state["status_code"]),
            )
        except Exception:  # pragma: no cover
            logger.exception("internal_admin.audit_persist_failed")


__all__ = ["audit_mutation", "record_audit"]
