"""Legacy admin read-only enforcement.

These tests pin the behaviour of the production-default
``LEGACY_ADMIN_MUTATIONS_ENABLED=false`` gate introduced in MB7 of
the pre-cutover remediation plan:

* every legacy browser-facing admin mutation returns the stable
  ``LEGACY_ADMIN_READ_ONLY`` error,
* legacy admin reads remain available (operators can audit history),
* the trusted internal admin API (``/api/internal/v1/admin/*``) is
  unaffected by the gate, and
* flipping the gate to ``true`` lets mutations through (positive
  control for the test harness).

The tests are hermetic: they use the same in-memory SQLite seed
fixtures as the rest of the suite and toggle the gate via
``monkeypatch.setenv`` so the default production value remains
``False``.
"""
from __future__ import annotations

import asyncio
import os

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("CAPTCHA_DEBUG_ENABLED", "true")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from lenjoy_bbs.core.config import get_settings
from lenjoy_bbs.core.security import hash_password
from lenjoy_bbs.core.tokens import create_access_token
from lenjoy_bbs.db.session import SessionLocal
from lenjoy_bbs.main import app
from lenjoy_bbs.modules.posts.models import Post
from lenjoy_bbs.modules.reports.models import PostReport, ResourceAppeal
from lenjoy_bbs.modules.taxonomy.models import Tag
from lenjoy_bbs.modules.users.models import Role, UserAccount, UserRole
from lenjoy_bbs.modules.wallet.models import Wallet

LEGACY_PREFIX = "/api/v1/admin"
INTERNAL_PREFIX = "/api/internal/v1/admin"
SERVICE_TOKEN = "legacy-readonly-test-token"

STABLE_CODE = "LEGACY_ADMIN_READ_ONLY"
STABLE_MESSAGE_FRAGMENT = "/ops/"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _env(monkeypatch):
    """Pin the gate to the production default for every test in this module.

    Tests that exercise the opt-in behaviour override this explicitly.
    """
    get_settings.cache_clear()
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", SERVICE_TOKEN)
    monkeypatch.setenv("LEGACY_ADMIN_MUTATIONS_ENABLED", "false")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def _unwrap(response) -> dict:
    payload = response.json()
    assert set(payload) == {"data", "error", "meta"}
    return payload


def _admin_headers() -> dict[str, str]:
    """Promote a user to admin and return a Bearer token for them."""

    async def _build() -> str:
        async with SessionLocal() as db:
            user = await db.scalar(
                select(UserAccount).where(UserAccount.username == "legacy-ro-admin")
            )
            if user is None:
                user = UserAccount(
                    username="legacy-ro-admin",
                    nickname="legacy-ro-admin",
                    email="legacy-ro-admin@example.com",
                    password_hash=hash_password("correct-horse-12345"),
                )
                db.add(user)
                await db.flush()
            role = await db.scalar(select(Role).where(Role.role_code == "ADMIN"))
            assert role is not None
            existing = await db.scalar(
                select(UserRole).where(
                    UserRole.user_id == user.id, UserRole.role_id == role.id
                )
            )
            if existing is None:
                db.add(UserRole(user_id=user.id, role_id=role.id))
            await db.commit()
            return create_access_token(user, ["ADMIN"])

    token = asyncio.run(_build())
    return {"Authorization": f"Bearer {token}"}


def _internal_headers(**overrides) -> dict[str, str]:
    headers = {
        "X-Service-Token": SERVICE_TOKEN,
        "X-Operator-Id": overrides.get("operator_id", "ops-legacy-ro"),
        "Idempotency-Key": overrides.get("idempotency_key", "idem-legacy-ro"),
        "X-Request-Id": overrides.get("request_id", "req-legacy-ro"),
    }
    return headers


def _ensure_user(username: str) -> int:
    async def _build() -> int:
        async with SessionLocal() as db:
            user = await db.scalar(
                select(UserAccount).where(UserAccount.username == username)
            )
            if user is not None:
                return user.id
            user = UserAccount(
                username=username,
                nickname=username,
                email=f"{username}@example.com",
                password_hash=hash_password("correct-horse-12345"),
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
            return user.id

    return asyncio.run(_build())


def _ensure_post(author_id: int, *, status_value: str = "PUBLISHED") -> int:
    from lenjoy_bbs.db.base import now_utc

    async def _build() -> int:
        async with SessionLocal() as db:
            post = Post(
                author_id=author_id,
                title="Legacy RO test post",
                content="hello",
                post_type="NORMAL",
                status=status_value,
                created_at=now_utc(),
                updated_at=now_utc(),
            )
            db.add(post)
            await db.commit()
            await db.refresh(post)
            return post.id

    return asyncio.run(_build())


def _ensure_post_report(reporter_id: int, post_id: int) -> int:
    from lenjoy_bbs.db.base import now_utc

    async def _build() -> int:
        async with SessionLocal() as db:
            report = PostReport(
                reporter_id=reporter_id,
                post_id=post_id,
                reason="spam",
                detail="please review",
                status="PENDING",
                created_at=now_utc(),
            )
            db.add(report)
            await db.commit()
            await db.refresh(report)
            return report.id

    return asyncio.run(_build())


def _ensure_resource_appeal(buyer_id: int, seller_id: int) -> int:
    from lenjoy_bbs.modules.posts.models import ResourcePurchase
    from lenjoy_bbs.db.base import now_utc

    async def _build() -> int:
        async with SessionLocal() as db:
            purchase = ResourcePurchase(
                post_id=1,
                buyer_id=buyer_id,
                seller_id=seller_id,
                price=10,
                status="COMPLETED",
                created_at=now_utc(),
            )
            db.add(purchase)
            await db.flush()
            appeal = ResourceAppeal(
                purchase_id=purchase.id,
                post_id=1,
                buyer_id=buyer_id,
                seller_id=seller_id,
                reason="dup",
                detail="dup",
                status="PENDING",
                requested_refund_amount=10,
                created_at=now_utc(),
                updated_at=now_utc(),
            )
            db.add(appeal)
            await db.commit()
            await db.refresh(appeal)
            return appeal.id

    return asyncio.run(_build())


def _ensure_tag(name: str) -> int:
    async def _build() -> int:
        async with SessionLocal() as db:
            tag = await db.scalar(select(Tag).where(Tag.name == name))
            if tag is not None:
                return tag.id
            tag = Tag(name=name, slug=name.lower())
            db.add(tag)
            await db.commit()
            await db.refresh(tag)
            return tag.id

    return asyncio.run(_build())


# ---------------------------------------------------------------------------
# Default (gate off) — every mutation must be rejected with the stable code
# ---------------------------------------------------------------------------


def _assert_read_only(response) -> None:
    """A legacy admin mutation response must carry the stable error."""
    assert response.status_code == 410, response.text
    payload = _unwrap(response)
    assert payload["error"] is not None
    assert payload["error"]["code"] == STABLE_CODE
    assert STABLE_MESSAGE_FRAGMENT in payload["error"]["message"]


def test_user_status_mutation_is_rejected(client):
    user_id = _ensure_user("legacy-ro-user-1")
    headers = _admin_headers()
    response = client.patch(
        f"{LEGACY_PREFIX}/users/{user_id}/status",
        json={"status": "MUTED"},
        headers=headers,
    )
    _assert_read_only(response)


def test_post_offline_mutation_is_rejected(client):
    user_id = _ensure_user("legacy-ro-author-1")
    post_id = _ensure_post(user_id)
    headers = _admin_headers()
    response = client.patch(
        f"{LEGACY_PREFIX}/posts/{post_id}/offline",
        headers=headers,
    )
    _assert_read_only(response)


def test_post_online_mutation_is_rejected(client):
    user_id = _ensure_user("legacy-ro-author-2")
    post_id = _ensure_post(user_id, status_value="OFFLINE")
    headers = _admin_headers()
    response = client.patch(
        f"{LEGACY_PREFIX}/posts/{post_id}/online",
        headers=headers,
    )
    _assert_read_only(response)


def test_bounty_delete_request_review_is_rejected(client):
    headers = _admin_headers()
    response = client.patch(
        f"{LEGACY_PREFIX}/bounty-delete-requests/1",
        json={"action": "APPROVE", "resolutionNote": "ok"},
        headers=headers,
    )
    _assert_read_only(response)


def test_post_report_review_is_rejected(client):
    reporter_id = _ensure_user("legacy-ro-reporter-1")
    author_id = _ensure_user("legacy-ro-reported-1")
    post_id = _ensure_post(author_id)
    report_id = _ensure_post_report(reporter_id, post_id)
    headers = _admin_headers()
    response = client.patch(
        f"{LEGACY_PREFIX}/reports/posts/{report_id}",
        json={"status": "RESOLVED", "resolutionNote": "ok"},
        headers=headers,
    )
    _assert_read_only(response)


def test_resource_appeal_review_is_rejected(client):
    buyer_id = _ensure_user("legacy-ro-buyer-1")
    seller_id = _ensure_user("legacy-ro-seller-1")
    appeal_id = _ensure_resource_appeal(buyer_id, seller_id)
    headers = _admin_headers()
    response = client.patch(
        f"{LEGACY_PREFIX}/resource-appeals/{appeal_id}",
        json={"action": "APPROVE", "refundAmount": 10, "resolutionNote": "ok"},
        headers=headers,
    )
    _assert_read_only(response)


def test_tag_merge_is_rejected(client):
    src = _ensure_tag("LegacyROSrc")
    tgt = _ensure_tag("LegacyROTgt")
    headers = _admin_headers()
    response = client.post(
        f"{LEGACY_PREFIX}/tags/{src}/merge",
        json={"targetTagId": tgt},
        headers=headers,
    )
    _assert_read_only(response)


def test_category_create_is_rejected(client):
    headers = _admin_headers()
    response = client.post(
        f"{LEGACY_PREFIX}/categories",
        json={"name": "LegacyROCat", "slug": "legacy-ro-cat"},
        headers=headers,
    )
    _assert_read_only(response)


def test_open_api_client_create_is_rejected(client):
    headers = _admin_headers()
    response = client.post(
        f"{LEGACY_PREFIX}/open-api/clients",
        json={"name": "LegacyROClient", "remark": "x"},
        headers=headers,
    )
    _assert_read_only(response)


def test_coin_adjust_is_rejected(client):
    user_id = _ensure_user("legacy-ro-coin-user")
    headers = _admin_headers()
    response = client.patch(
        f"{LEGACY_PREFIX}/coins/users/{user_id}",
        json={"amount": 10, "reason": "test"},
        headers=headers,
    )
    _assert_read_only(response)


# ---------------------------------------------------------------------------
# Reads remain available even when the gate is closed
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "path",
    [
        "/users",
        "/posts",
        "/bounties",
        "/reports",
        "/resource-appeals",
        "/bounty-delete-requests",
        "/categories",
        "/tags",
        "/coins/users",
        "/audit/wallet-ledger",
        "/audit/resource-trades",
        "/metrics/dashboard",
        "/open-api/clients",
    ],
)
def test_legacy_admin_reads_remain_available(client, path):
    headers = _admin_headers()
    response = client.get(f"{LEGACY_PREFIX}{path}", headers=headers)
    assert response.status_code == 200, response.text
    payload = _unwrap(response)
    assert payload["error"] is None
    assert "data" in payload


# ---------------------------------------------------------------------------
# Positive control — with the gate enabled, mutations work again
# ---------------------------------------------------------------------------


def test_legacy_admin_mutation_works_when_gate_is_enabled(client, monkeypatch):
    get_settings.cache_clear()
    monkeypatch.setenv("LEGACY_ADMIN_MUTATIONS_ENABLED", "true")
    get_settings.cache_clear()
    headers = _admin_headers()
    response = client.patch(
        f"{LEGACY_PREFIX}/users/999999/status",
        json={"status": "MUTED"},
        headers=headers,
    )
    # 999999 is guaranteed not to exist; auth and gate passed, so the
    # service layer returns a domain error (not the gate error).
    assert response.status_code != 410, response.text
    payload = _unwrap(response)
    if payload["error"] is not None:
        assert payload["error"]["code"] != STABLE_CODE


# ---------------------------------------------------------------------------
# The trusted internal admin API must remain unaffected
# ---------------------------------------------------------------------------


def test_internal_admin_mutation_unaffected_by_legacy_gate(client):
    user_id = _ensure_user("legacy-ro-internal-user")
    headers = _internal_headers(
        operator_id="ops-internal-bypass",
        idempotency_key="idem-internal-bypass",
    )
    response = client.patch(
        f"{INTERNAL_PREFIX}/users/{user_id}/status",
        json={"status": "MUTED", "reason": "ops via internal API"},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    payload = _unwrap(response)
    assert payload["error"] is None
    assert payload["data"]["operatorId"] == "ops-internal-bypass"


def test_internal_admin_offline_mutation_unaffected_by_legacy_gate(client):
    author_id = _ensure_user("legacy-ro-internal-author")
    post_id = _ensure_post(author_id)
    headers = _internal_headers(
        operator_id="ops-internal-offline",
        idempotency_key="idem-internal-offline",
    )
    response = client.patch(
        f"{INTERNAL_PREFIX}/posts/{post_id}/offline",
        headers=headers,
    )
    assert response.status_code == 200, response.text


# ---------------------------------------------------------------------------
# Stable code sanity
# ---------------------------------------------------------------------------


def test_gate_returns_exactly_410_with_stable_code(client):
    user_id = _ensure_user("legacy-ro-stable")
    response = client.patch(
        f"{LEGACY_PREFIX}/users/{user_id}/status",
        json={"status": "BANNED"},
        headers=_admin_headers(),
    )
    assert response.status_code == 410
    payload = _unwrap(response)
    assert payload["error"]["code"] == "LEGACY_ADMIN_READ_ONLY"
    # The message must point operators to the new admin plane.
    assert "/ops/" in payload["error"]["message"]


def test_dependency_function_returns_none_when_enabled(monkeypatch):
    from lenjoy_bbs.core.legacy_admin import (
        require_legacy_admin_mutations_enabled,
    )

    get_settings.cache_clear()
    monkeypatch.setenv("LEGACY_ADMIN_MUTATIONS_ENABLED", "true")
    get_settings.cache_clear()
    settings = get_settings()
    assert require_legacy_admin_mutations_enabled(settings=settings) is None


def test_dependency_function_raises_when_disabled(monkeypatch):
    from lenjoy_bbs.core.errors import ApiError
    from lenjoy_bbs.core.legacy_admin import (
        require_legacy_admin_mutations_enabled,
    )

    get_settings.cache_clear()
    monkeypatch.setenv("LEGACY_ADMIN_MUTATIONS_ENABLED", "false")
    get_settings.cache_clear()
    settings = get_settings()
    with pytest.raises(ApiError) as exc_info:
        require_legacy_admin_mutations_enabled(settings=settings)
    assert exc_info.value.code == STABLE_CODE
    assert exc_info.value.http_status == 410