"""Legacy administration read-only enforcement.

The legacy browser-facing admin surface (``/api/v1/admin/*``) is kept
mounted during the migration window so operators can read audit
history while the new platform admin (``/ops/``) becomes the source
of truth for state changes. Once the cutover plan flips the flag,
mutations against the legacy surface are rejected with a stable
error code that the existing ``AdminReadOnlyBanner`` can display.

This module is intentionally tiny: a single FastAPI dependency that
the legacy admin routers can attach to every mutation route. The
trusted internal admin API (``/api/internal/v1/admin/*``) does NOT
use this dependency and is unaffected by the gate.
"""
from __future__ import annotations

from fastapi import Depends

from lenjoy_bbs.core.config import Settings, get_settings
from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.core.messages import Admin


def require_legacy_admin_mutations_enabled(
    settings: Settings = Depends(get_settings),
) -> None:
    """Reject the request when legacy admin mutations are disabled.

    Returns ``None`` on success (the dependency is "satisfied"). When
    the gate is off, raises an :class:`ApiError` whose stable code is
    ``LEGACY_ADMIN_READ_ONLY`` and whose HTTP status is ``410 Gone``
    to signal that this entry point has been retired in favour of
    the new ``/ops/`` admin plane.

    The gate defaults to ``False`` for production safety — operators
    must explicitly opt in (``LEGACY_ADMIN_MUTATIONS_ENABLED=true``)
    during cutover dry-runs.
    """
    if settings.legacy_admin_mutations_enabled:
        return
    raise ApiError(Admin.LEGACY_READ_ONLY)


__all__ = ["require_legacy_admin_mutations_enabled"]