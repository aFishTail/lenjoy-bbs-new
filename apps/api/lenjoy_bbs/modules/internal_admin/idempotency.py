from __future__ import annotations

import hashlib
from fastapi import Request
from fastapi.responses import JSONResponse, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from starlette.middleware.base import BaseHTTPMiddleware

from lenjoy_bbs.core.responses import failure
from lenjoy_bbs.db.session import SessionLocal
from lenjoy_bbs.modules.internal_admin.models import InternalAdminIdempotencyRecord

_MUTATION_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
_PREFIX = "/api/internal/v1/admin/"


def _error(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content=failure(code, message))


class InternalAdminIdempotencyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method not in _MUTATION_METHODS or not request.url.path.startswith(_PREFIX):
            return await call_next(request)

        key = (request.headers.get("Idempotency-Key") or "").strip()
        if not key:
            return await call_next(request)

        body = await request.body()
        operator_id = (request.headers.get("X-Operator-Id") or "").strip()
        scope = f"{operator_id}:{request.method}:{request.url.path}"
        fingerprint = hashlib.sha256(body).hexdigest()

        async with SessionLocal() as db:
            record = await db.scalar(
                select(InternalAdminIdempotencyRecord).where(
                    InternalAdminIdempotencyRecord.operation_scope == scope,
                    InternalAdminIdempotencyRecord.idempotency_key == key,
                )
            )
            if record is not None:
                return self._replay_or_conflict(record, fingerprint)

            record = InternalAdminIdempotencyRecord(
                operation_scope=scope,
                idempotency_key=key,
                request_fingerprint=fingerprint,
                state="IN_PROGRESS",
            )
            db.add(record)
            try:
                await db.commit()
            except IntegrityError:
                await db.rollback()
                existing = await db.scalar(
                    select(InternalAdminIdempotencyRecord).where(
                        InternalAdminIdempotencyRecord.operation_scope == scope,
                        InternalAdminIdempotencyRecord.idempotency_key == key,
                    )
                )
                if existing is None:
                    raise
                return self._replay_or_conflict(existing, fingerprint)

        try:
            response = await call_next(request)
            response_body = b"".join([chunk async for chunk in response.body_iterator])
        except Exception:
            await self._delete_in_progress(scope, key)
            raise

        if response.status_code >= 500:
            await self._delete_in_progress(scope, key)
        else:
            async with SessionLocal() as db:
                record = await db.scalar(
                    select(InternalAdminIdempotencyRecord).where(
                        InternalAdminIdempotencyRecord.operation_scope == scope,
                        InternalAdminIdempotencyRecord.idempotency_key == key,
                    )
                )
                if record is not None:
                    record.state = "COMPLETED"
                    record.status_code = response.status_code
                    record.response_body = response_body.decode("utf-8")
                    await db.commit()

        return Response(
            content=response_body,
            status_code=response.status_code,
            headers=dict(response.headers),
            media_type=response.media_type,
            background=response.background,
        )

    @staticmethod
    def _replay_or_conflict(
        record: InternalAdminIdempotencyRecord, fingerprint: str
    ) -> Response:
        if record.request_fingerprint != fingerprint:
            return _error(
                409,
                "INTERNAL_IDEMPOTENCY_CONFLICT",
                "Idempotency-Key was already used with a different request",
            )
        if record.state != "COMPLETED" or record.response_body is None:
            return _error(
                409,
                "INTERNAL_IDEMPOTENCY_IN_PROGRESS",
                "A request with this Idempotency-Key is already in progress",
            )
        return Response(
            content=record.response_body,
            status_code=record.status_code or 200,
            media_type="application/json",
            headers={"X-Idempotent-Replay": "true"},
        )

    @staticmethod
    async def _delete_in_progress(scope: str, key: str) -> None:
        async with SessionLocal() as db:
            record = await db.scalar(
                select(InternalAdminIdempotencyRecord).where(
                    InternalAdminIdempotencyRecord.operation_scope == scope,
                    InternalAdminIdempotencyRecord.idempotency_key == key,
                )
            )
            if record is not None and record.state == "IN_PROGRESS":
                await db.delete(record)
                await db.commit()


__all__ = ["InternalAdminIdempotencyMiddleware"]
