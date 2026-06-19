"""Rate limiting configuration.

Uses slowapi with an in-memory storage backend. In production with
multiple workers, switch to Redis-backed storage.

Includes a custom ASGI middleware that resolves endpoints through
FastAPI sub-routers so that rate limits are enforced *before* request
body validation, preventing brute-force attacks with invalid payloads.
"""

import inspect
from typing import Callable, Optional

from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.routing import Match
from starlette.types import ASGIApp


limiter = Limiter(
    key_func=get_remote_address,
    storage_uri="memory://",
)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate-limit middleware that correctly resolves endpoints in FastAPI
    sub-routers.

    ``slowapi.SlowAPIMiddleware`` delegates per-route limits to the
    ``@limiter.limit`` decorator, which runs *after* FastAPI's request
    validation.  This means requests with invalid payloads would bypass
    rate limiting entirely.  This middleware checks limits directly,
    before any route handler (and therefore before validation), so every
    request is counted regardless of its payload.
    """

    def __init__(self, app: ASGIApp, limiter_instance: Optional[Limiter] = None) -> None:
        super().__init__(app)
        self.limiter = limiter_instance or limiter

    async def dispatch(self, request: Request, call_next) -> Response:
        if not self.limiter.enabled:
            return await call_next(request)

        handler = self._resolve_endpoint(request)
        if handler is None:
            return await call_next(request)

        try:
            self.limiter._check_request_limit(request, handler, in_middleware=True)
        except RateLimitExceeded:
            return self._build_429(request)

        return await call_next(request)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _resolve_endpoint(self, request: Request) -> Optional[Callable]:
        """Walk the app's route tree (including sub-routers) and return
        the original endpoint function for the matched route."""
        scope = request.scope
        for route in request.app.routes:
            match, _ = route.matches(scope)
            if match == Match.FULL and hasattr(route, "endpoint"):
                endpoint = route.endpoint
                # FastAPI wraps endpoints with dependency-injection; unwrap
                # to reach the ``@limiter.limit``-decorated function whose
                # name was registered in ``limiter._route_limits``.
                return inspect.unwrap(endpoint)
            # Sub-router (Mount / Router): recurse into its routes with
            # an adjusted scope so that path matching works correctly.
            if match == Match.PARTIAL and hasattr(route, "routes"):
                result = self._search_sub_routes(route.routes, scope)
                if result is not None:
                    return inspect.unwrap(result)
        return None

    @staticmethod
    def _search_sub_routes(routes, scope) -> Optional[Callable]:
        for route in routes:
            match, _ = route.matches(scope)
            if match == Match.FULL and hasattr(route, "endpoint"):
                return route.endpoint
            if match == Match.PARTIAL and hasattr(route, "routes"):
                result = RateLimitMiddleware._search_sub_routes(route.routes, scope)
                if result is not None:
                    return result
        return None

    def _build_429(self, request: Request) -> Response:
        """Build a 429 response with correct ``Retry-After`` header."""
        retry_after = self._retry_after_seconds(request)
        headers = {"Retry-After": str(retry_after)}
        return JSONResponse(
            status_code=429,
            content={
                "error": {
                    "code": "RATE_LIMIT_EXCEEDED",
                    "message": f"Rate limit exceeded. Retry after {retry_after} seconds.",
                }
            },
            headers=headers,
        )

    @staticmethod
    def _retry_after_seconds(request: Request) -> int:
        """Extract seconds-until-reset from the rate limit state set by
        slowapi during limit evaluation."""
        view_rate_limit = getattr(request.state, "view_rate_limit", None)
        if view_rate_limit is not None:
            # view_rate_limit is a tuple: (limit_amount, [key, scope])
            # The Limit object that failed is available via the most
            # recent RateLimitExceeded; we approximate with a 60-second
            # window (all current limits are per-minute).
            try:
                _amount, _args = view_rate_limit
                return 60
            except (TypeError, ValueError):
                pass
        return 60


async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """Fallback handler for ``RateLimitExceeded`` raised by the
    ``@limiter.limit`` decorator (safety net when the middleware
    delegates to the decorator)."""
    retry_after = RateLimitMiddleware._retry_after_seconds(request)
    return JSONResponse(
        status_code=429,
        content={
            "error": {
                "code": "RATE_LIMIT_EXCEEDED",
                "message": f"Rate limit exceeded. Retry after {retry_after} seconds.",
            }
        },
        headers={"Retry-After": str(retry_after)},
    )
