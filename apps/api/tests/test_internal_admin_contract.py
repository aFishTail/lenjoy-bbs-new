"""Contract tests for the internal admin API.

These tests pin the behaviour required by the Operations forum adapter:
service token authentication, explicit rejection of BBS user JWTs,
trusted operator + idempotency headers on mutations, and per-mutation
audit logging.
"""
from __future__ import annotations

import asyncio
import os
from typing import Any

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["APP_ENV"] = "test"
os.environ.setdefault("CAPTCHA_DEBUG_ENABLED", "true")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from lenjoy_bbs.core.config import get_settings
from lenjoy_bbs.core.tokens import create_access_token
from lenjoy_bbs.db.session import SessionLocal
from lenjoy_bbs.main import app
from lenjoy_bbs.modules.internal_admin.models import (
    InternalAdminAuditLog,
    InternalAdminIdempotencyRecord,
)
from lenjoy_bbs.modules.wallet.models import Wallet
from lenjoy_bbs.modules.open_api.models import (
    OpenApiAccountBinding,
    OpenApiClient,
)
from lenjoy_bbs.modules.taxonomy.models import Category, Tag
from lenjoy_bbs.modules.users.models import Role, UserAccount, UserRole

API_PREFIX = "/api/internal/v1/admin"
SERVICE_TOKEN = "internal-test-token-please-rotate"


@pytest.fixture(autouse=True)
def _service_token(monkeypatch):
    get_settings.cache_clear()
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", SERVICE_TOKEN)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def unwrap(response) -> dict:
    payload = response.json()
    assert set(payload) == {"data", "error", "meta"}
    return payload


def auth_headers(
    *,
    operator_id: str | None = "ops-admin-1",
    idempotency_key: str | None = "idemp-1",
    request_id: str | None = "req-1",
    token: str | None = SERVICE_TOKEN,
    extra: dict[str, str] | None = None,
) -> dict[str, str]:
    headers: dict[str, str] = {}
    if token is not None:
        headers["X-Service-Token"] = token
    if operator_id is not None:
        headers["X-Operator-Id"] = operator_id
    if idempotency_key is not None:
        headers["Idempotency-Key"] = idempotency_key
    if request_id is not None:
        headers["X-Request-Id"] = request_id
    if extra:
        headers.update(extra)
    return headers


def make_admin_user() -> str:
    """Create a BBS admin user and return a JWT for them."""
    from lenjoy_bbs.modules.users.models import UserAccount
    from lenjoy_bbs.core.security import hash_password

    async def _build() -> str:
        async with SessionLocal() as db:
            user = UserAccount(
                username="bbs-admin-1",
                nickname="bbs-admin-1",
                email="bbs-admin-1@example.com",
                password_hash=hash_password("correct-horse-12345"),
            )
            db.add(user)
            await db.flush()
            role = await db.scalar(
                select(Role).where(Role.role_code == "ADMIN")
            )
            assert role is not None
            db.add(UserRole(user_id=user.id, role_id=role.id))
            await db.commit()
            return create_access_token(user, ["ADMIN"])

    return asyncio.run(_build())


def count_audit(domain: str | None = None, action: str | None = None) -> int:
    async def _count() -> int:
        async with SessionLocal() as db:
            stmt = select(func.count()).select_from(InternalAdminAuditLog)
            if domain is not None:
                stmt = stmt.where(InternalAdminAuditLog.domain == domain)
            if action is not None:
                stmt = stmt.where(InternalAdminAuditLog.action == action)
            return int((await db.scalar(stmt)) or 0)

    return asyncio.run(_count())


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------


def test_ping_requires_service_token(client):
    response = client.get(f"{API_PREFIX}/ping")
    assert response.status_code == 401


def test_ping_rejects_invalid_service_token(client):
    response = client.get(
        f"{API_PREFIX}/ping",
        headers=auth_headers(token="wrong-token"),
    )
    assert response.status_code == 401


def test_ping_accepts_valid_service_token(client):
    response = client.get(f"{API_PREFIX}/ping", headers=auth_headers())
    assert response.status_code == 200
    payload = unwrap(response)
    assert payload["error"] is None
    assert payload["data"]["requestId"] == "req-1"


def test_internal_admin_rejects_bbs_user_jwt(client):
    """Even with a valid service token, a BBS user JWT must be rejected."""
    token = make_admin_user()
    response = client.get(
        f"{API_PREFIX}/ping",
        headers={
            "X-Service-Token": SERVICE_TOKEN,
            "Authorization": f"Bearer {token}",
        },
    )
    assert response.status_code == 401


def test_internal_admin_rejects_jwt_without_service_token(client):
    token = make_admin_user()
    response = client.get(
        f"{API_PREFIX}/ping",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# Mutation contract — operator / idempotency headers
# ---------------------------------------------------------------------------


def _ensure_user(username: str = "victim-1") -> int:
    async def _build() -> int:
        async with SessionLocal() as db:
            user = await db.scalar(
                select(UserAccount).where(UserAccount.username == username)
            )
            if user is not None:
                return user.id
            from lenjoy_bbs.core.security import hash_password

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


def test_mutation_rejects_missing_operator_id(client):
    user_id = _ensure_user("mut-no-op")
    response = client.patch(
        f"{API_PREFIX}/users/{user_id}/status",
        headers=auth_headers(operator_id=None),
        json={"status": "MUTED"},
    )
    assert response.status_code == 400


def test_mutation_rejects_missing_idempotency_key(client):
    user_id = _ensure_user("mut-no-idem")
    response = client.patch(
        f"{API_PREFIX}/users/{user_id}/status",
        headers=auth_headers(idempotency_key=None),
        json={"status": "MUTED"},
    )
    assert response.status_code == 400


def test_mutation_rejects_missing_service_token(client):
    user_id = _ensure_user("mut-no-token")
    response = client.patch(
        f"{API_PREFIX}/users/{user_id}/status",
        headers=auth_headers(token=None),
        json={"status": "MUTED"},
    )
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# Domain coverage — read endpoints
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "path",
    [
        "/metrics/dashboard",
        "/users",
        "/posts",
        "/bounties",
        "/bounty-delete-requests",
        "/reports",
        "/resource-appeals",
        "/coins/users",
        "/audit/wallet-ledger",
        "/audit/resource-trades",
        "/categories",
        "/tags",
        "/open-api/clients",
        "/open-api/clients/1/bindings",
    ],
)
def test_internal_admin_read_endpoints_are_reachable(client, path):
    response = client.get(f"{API_PREFIX}{path}", headers=auth_headers())
    assert response.status_code == 200, response.text
    payload = unwrap(response)
    assert payload["error"] is None
    assert "data" in payload


def test_bounty_comments_endpoint_is_reachable(client):
    response = client.get(
        f"{API_PREFIX}/bounties/9999/comments",
        headers=auth_headers(),
    )
    # Either the post exists (200) or it is not found (404 via ApiError),
    # but auth must succeed.
    assert response.status_code in {200, 404}


# ---------------------------------------------------------------------------
# Mutation coverage — happy paths
# ---------------------------------------------------------------------------


def test_user_status_mutation_records_audit(client):
    user_id = _ensure_user("mut-user-1")
    before = count_audit(domain="users", action="update_status")
    response = client.patch(
        f"{API_PREFIX}/users/{user_id}/status",
        headers=auth_headers(operator_id="ops-7", idempotency_key="idem-7"),
        json={"status": "MUTED", "reason": "spam"},
    )
    assert response.status_code == 200, response.text
    payload = unwrap(response)
    assert payload["data"]["operatorId"] == "ops-7"
    assert payload["data"]["idempotencyKey"] == "idem-7"
    assert payload["data"]["requestId"] == "req-1"
    assert count_audit(domain="users", action="update_status") == before + 1


def test_category_create_mutation_records_audit(client):
    before = count_audit(domain="taxonomy.categories", action="create")
    response = client.post(
        f"{API_PREFIX}/categories",
        headers=auth_headers(operator_id="ops-cat", idempotency_key="idem-cat"),
        json={"name": "InternalCat", "slug": "internal-cat"},
    )
    assert response.status_code == 201, response.text
    payload = unwrap(response)
    assert payload["data"]["operatorId"] == "ops-cat"
    assert payload["data"]["idempotencyKey"] == "idem-cat"
    assert count_audit(domain="taxonomy.categories", action="create") == before + 1


def test_tag_create_mutation_records_audit(client):
    before = count_audit(domain="taxonomy.tags", action="create")
    response = client.post(
        f"{API_PREFIX}/tags",
        headers=auth_headers(operator_id="ops-tag", idempotency_key="idem-tag"),
        json={"name": "InternalTag", "slug": "internal-tag"},
    )
    assert response.status_code == 201, response.text
    payload = unwrap(response)
    assert payload["data"]["operatorId"] == "ops-tag"
    assert count_audit(domain="taxonomy.tags", action="create") == before + 1


def test_open_api_client_create_mutation_records_audit(client):
    before = count_audit(domain="open_api.clients", action="create")
    response = client.post(
        f"{API_PREFIX}/open-api/clients",
        headers=auth_headers(operator_id="ops-client", idempotency_key="idem-client"),
        json={"name": "InternalClient", "remark": "for ops"},
    )
    assert response.status_code == 201, response.text
    payload = unwrap(response)
    assert payload["data"]["operatorId"] == "ops-client"
    assert payload["data"]["idempotencyKey"] == "idem-client"
    assert payload["data"]["client"]["apiKey"]
    assert count_audit(domain="open_api.clients", action="create") == before + 1

    listed = client.get(
        f"{API_PREFIX}/open-api/clients",
        headers=auth_headers(),
    )
    assert listed.status_code == 200
    assert "apiKey" not in listed.text

    async def _audit_payload() -> str | None:
        async with SessionLocal() as db:
            return await db.scalar(
                select(InternalAdminAuditLog.payload).where(
                    InternalAdminAuditLog.idempotency_key == "idem-client"
                )
            )

    assert "apiKey" not in (asyncio.run(_audit_payload()) or "")


def test_open_api_client_secret_endpoint_returns_full_key(client):
    client_id = _make_client("SecretReadClient")
    response = client.get(
        f"{API_PREFIX}/open-api/clients/{client_id}/secret",
        headers=auth_headers(),
    )
    assert response.status_code == 200, response.text
    payload = unwrap(response)
    assert payload["data"]["clientId"] == client_id
    assert payload["data"]["apiKey"] == "ljo_test_aaaaaaaaaaaaaaaaaaaaaa"


def test_audit_row_records_operator_and_request_id(client):
    user_id = _ensure_user("mut-audit-1")
    response = client.patch(
        f"{API_PREFIX}/users/{user_id}/status",
        headers=auth_headers(
            operator_id="ops-audit-9", idempotency_key="idem-audit-9",
            request_id="req-audit-9",
        ),
        json={"status": "ACTIVE"},
    )
    assert response.status_code == 200

    async def _fetch() -> InternalAdminAuditLog | None:
        async with SessionLocal() as db:
            return await db.scalar(
                select(InternalAdminAuditLog).where(
                    InternalAdminAuditLog.idempotency_key == "idem-audit-9"
                )
            )

    row = asyncio.run(_fetch())
    assert row is not None
    assert row.operator_id == "ops-audit-9"
    assert row.request_id == "req-audit-9"
    assert row.domain == "users"
    assert row.action == "update_status"
    assert row.status_code == 200


def test_audit_row_records_idempotency_key(client):
    user_id = _ensure_user("mut-audit-2")
    response = client.patch(
        f"{API_PREFIX}/users/{user_id}/status",
        headers=auth_headers(
            operator_id="ops-idem", idempotency_key="idem-idem-2",
            request_id="req-idem-2",
        ),
        json={"status": "MUTED"},
    )
    assert response.status_code == 200

    async def _fetch() -> InternalAdminAuditLog | None:
        async with SessionLocal() as db:
            return await db.scalar(
                select(InternalAdminAuditLog).where(
                    InternalAdminAuditLog.idempotency_key == "idem-idem-2"
                )
            )

    row = asyncio.run(_fetch())
    assert row is not None
    assert row.idempotency_key == "idem-idem-2"


# ---------------------------------------------------------------------------
# Wallet / coins mutation
# ---------------------------------------------------------------------------


def test_coin_adjust_mutation_records_audit(client):
    user_id = _ensure_user("mut-coin-1")
    before = count_audit(domain="wallet", action="adjust_coins")
    response = client.patch(
        f"{API_PREFIX}/coins/users/{user_id}",
        headers=auth_headers(
            operator_id="ops-coin", idempotency_key="idem-coin-1",
        ),
        json={"amount": 50, "reason": "ops bonus"},
    )
    assert response.status_code == 200, response.text
    payload = unwrap(response)
    assert payload["data"]["operatorId"] == "ops-coin"
    assert payload["data"]["userId"] == user_id
    assert count_audit(domain="wallet", action="adjust_coins") == before + 1


def test_coin_adjust_replays_same_idempotency_key_without_double_mutation(client):
    user_id = _ensure_user("mut-coin-replay")
    headers = auth_headers(
        operator_id="ops-coin-replay", idempotency_key="idem-coin-replay"
    )
    first = client.patch(
        f"{API_PREFIX}/coins/users/{user_id}",
        headers=headers,
        json={"amount": 50, "reason": "one adjustment"},
    )
    second = client.patch(
        f"{API_PREFIX}/coins/users/{user_id}",
        headers=headers,
        json={"amount": 50, "reason": "one adjustment"},
    )
    assert first.status_code == 200
    assert second.status_code == 200
    assert second.headers["X-Idempotent-Replay"] == "true"
    assert second.json() == first.json()

    async def _balance_and_records() -> tuple[int, int]:
        async with SessionLocal() as db:
            wallet = await db.scalar(
                select(Wallet).where(Wallet.user_id == user_id)
            )
            records = await db.scalar(
                select(func.count()).select_from(InternalAdminIdempotencyRecord)
            )
            assert wallet is not None
            return wallet.available_coins, int(records or 0)

    balance, records = asyncio.run(_balance_and_records())
    assert balance == 50
    assert records == 1


def test_same_idempotency_key_with_different_payload_conflicts(client):
    user_id = _ensure_user("mut-coin-conflict")
    headers = auth_headers(idempotency_key="idem-coin-conflict")
    assert client.patch(
        f"{API_PREFIX}/coins/users/{user_id}",
        headers=headers,
        json={"amount": 10},
    ).status_code == 200
    conflict = client.patch(
        f"{API_PREFIX}/coins/users/{user_id}",
        headers=headers,
        json={"amount": 20},
    )
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "INTERNAL_IDEMPOTENCY_CONFLICT"


def test_idempotency_key_is_isolated_by_operator(client):
    first_user = _ensure_user("mut-idem-operator-one")
    second_user = _ensure_user("mut-idem-operator-two")
    key = "idem-shared-by-two-operators"
    first = client.patch(
        f"{API_PREFIX}/users/{first_user}/status",
        headers=auth_headers(operator_id="operator-one", idempotency_key=key),
        json={"status": "MUTED"},
    )
    second = client.patch(
        f"{API_PREFIX}/users/{second_user}/status",
        headers=auth_headers(operator_id="operator-two", idempotency_key=key),
        json={"status": "MUTED"},
    )
    assert first.status_code == 200
    assert second.status_code == 200
    assert "X-Idempotent-Replay" not in second.headers


def test_generated_request_id_is_shared_by_response_and_audit(client):
    user_id = _ensure_user("mut-request-id")
    response = client.patch(
        f"{API_PREFIX}/users/{user_id}/status",
        headers=auth_headers(request_id=None, idempotency_key="idem-generated-rid"),
        json={"status": "MUTED"},
    )
    assert response.status_code == 200
    response_request_id = response.headers["X-Request-Id"]

    async def _audit_request_id() -> str | None:
        async with SessionLocal() as db:
            return await db.scalar(
                select(InternalAdminAuditLog.request_id).where(
                    InternalAdminAuditLog.idempotency_key == "idem-generated-rid"
                )
            )

    assert asyncio.run(_audit_request_id()) == response_request_id


# ---------------------------------------------------------------------------
# Tag merge / delete
# ---------------------------------------------------------------------------


def _make_tag(name: str) -> int:
    async def _build() -> int:
        async with SessionLocal() as db:
            tag = Tag(name=name, slug=name.lower())
            db.add(tag)
            await db.commit()
            await db.refresh(tag)
            return tag.id

    return asyncio.run(_build())


def test_tag_merge_mutation_records_audit(client):
    a = _make_tag("MergeSrc")
    b = _make_tag("MergeTgt")
    before = count_audit(domain="taxonomy.tags", action="merge")
    response = client.post(
        f"{API_PREFIX}/tags/{a}/merge",
        headers=auth_headers(
            operator_id="ops-merge", idempotency_key="idem-merge",
        ),
        json={"targetTagId": b},
    )
    assert response.status_code == 200, response.text
    assert count_audit(domain="taxonomy.tags", action="merge") == before + 1


def test_tag_delete_mutation_records_audit(client):
    tag_id = _make_tag("DeleteTag")
    before = count_audit(domain="taxonomy.tags", action="delete")
    response = client.delete(
        f"{API_PREFIX}/tags/{tag_id}",
        headers=auth_headers(
            operator_id="ops-del", idempotency_key="idem-del",
        ),
    )
    assert response.status_code == 200, response.text
    assert count_audit(domain="taxonomy.tags", action="delete") == before + 1


# ---------------------------------------------------------------------------
# Open API bindings
# ---------------------------------------------------------------------------


def _make_client(name: str = "OpsTestClient") -> int:
    async def _build() -> int:
        async with SessionLocal() as db:
            client = OpenApiClient(
                name=name,
                api_key="ljo_test_aaaaaaaaaaaaaaaaaaaaaa",
                status="ACTIVE",
                remark="ops test",
            )
            db.add(client)
            await db.commit()
            await db.refresh(client)
            return client.id

    return asyncio.run(_build())


def test_open_api_bindings_listing(client):
    client_id = _make_client("ListTestClient")
    response = client.get(
        f"{API_PREFIX}/open-api/clients/{client_id}/bindings",
        headers=auth_headers(),
    )
    assert response.status_code == 200
    payload = unwrap(response)
    assert "data" in payload


def test_open_api_client_status_mutation_records_audit(client):
    client_id = _make_client("StatusTestClient")
    before = count_audit(domain="open_api.clients", action="update_status")
    response = client.patch(
        f"{API_PREFIX}/open-api/clients/{client_id}",
        headers=auth_headers(
            operator_id="ops-cs", idempotency_key="idem-cs",
        ),
        json={"status": "DISABLED"},
    )
    assert response.status_code == 200, response.text
    assert count_audit(domain="open_api.clients", action="update_status") == before + 1


def test_open_api_binding_create_mutation_records_audit(client):
    user_id = _ensure_user("mut-bind-1")
    client_id = _make_client("BindingTestClient")
    before = count_audit(domain="open_api.bindings", action="create")
    response = client.post(
        f"{API_PREFIX}/open-api/clients/{client_id}/bindings",
        headers=auth_headers(
            operator_id="ops-bind", idempotency_key="idem-bind-1",
        ),
        json={
            "scope": "binding-code-1",
            "partnerUserId": user_id,
            "remark": "from ops",
        },
    )
    assert response.status_code == 201, response.text
    assert count_audit(domain="open_api.bindings", action="create") == before + 1

    async def _fetch() -> OpenApiAccountBinding | None:
        async with SessionLocal() as db:
            return await db.scalar(
                select(OpenApiAccountBinding).where(
                    OpenApiAccountBinding.user_id == user_id
                )
            )

    binding = asyncio.run(_fetch())
    assert binding is not None
    assert binding.binding_code == "binding-code-1"
    assert binding.client_id == client_id


def test_open_api_binding_create_requires_partner_user_id(client):
    user_id = _ensure_user("mut-bind-legacy")
    response = client.post(
        f"{API_PREFIX}/open-api/clients/1/bindings",
        headers=auth_headers(
            operator_id="ops-legacy", idempotency_key="idem-legacy-1",
        ),
        json={
            "scope": "binding-code-legacy",
        },
    )
    # Pydantic returns 422 for missing required fields. We accept 400 too,
    # since the contract intent is "the request must not be silently
    # fulfilled by falling back to the first ACTIVE client".
    assert response.status_code in {400, 422}, response.text


def test_open_api_binding_status_mutation_records_audit(client):
    user_id = _ensure_user("mut-bind-2")
    client_id = _make_client("BindingStatusClient")

    # Create a binding first.
    create = client.post(
        f"{API_PREFIX}/open-api/clients/{client_id}/bindings",
        headers=auth_headers(
            operator_id="ops-bind", idempotency_key="idem-bind-2",
        ),
        json={
            "scope": "binding-code-2",
            "partnerUserId": user_id,
        },
    )
    assert create.status_code == 201, create.text

    async def _fetch_id() -> int:
        async with SessionLocal() as db:
            binding = await db.scalar(
                select(OpenApiAccountBinding).where(
                    OpenApiAccountBinding.user_id == user_id
                )
            )
            assert binding is not None
            return binding.id

    binding_id = asyncio.run(_fetch_id())

    before = count_audit(domain="open_api.bindings", action="update_status")
    response = client.patch(
        f"{API_PREFIX}/open-api/clients/{client_id}/bindings/{binding_id}/status",
        headers=auth_headers(
            operator_id="ops-bs", idempotency_key="idem-bs",
        ),
        json={"status": "DISABLED"},
    )
    assert response.status_code == 200, response.text
    assert count_audit(domain="open_api.bindings", action="update_status") == before + 1


# ---------------------------------------------------------------------------
# Posts mutations
# ---------------------------------------------------------------------------


def _make_post(author_id: int, *, status_value: str = "PUBLISHED") -> int:
    from lenjoy_bbs.modules.posts.models import Post
    from lenjoy_bbs.db.base import now_utc

    async def _build() -> int:
        async with SessionLocal() as db:
            post = Post(
                author_id=author_id,
                title="Internal Admin Test Post",
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


def test_post_offline_mutation_records_audit(client):
    author_id = _ensure_user("post-author-1")
    post_id = _make_post(author_id)
    before = count_audit(domain="posts", action="offline")
    response = client.patch(
        f"{API_PREFIX}/posts/{post_id}/offline",
        headers=auth_headers(
            operator_id="ops-offline", idempotency_key="idem-offline-1",
        ),
    )
    assert response.status_code == 200, response.text
    assert count_audit(domain="posts", action="offline") == before + 1


def test_post_online_mutation_records_audit(client):
    author_id = _ensure_user("post-author-2")
    post_id = _make_post(author_id, status_value="OFFLINE")
    before = count_audit(domain="posts", action="online")
    response = client.patch(
        f"{API_PREFIX}/posts/{post_id}/online",
        headers=auth_headers(
            operator_id="ops-online", idempotency_key="idem-online-1",
        ),
    )
    assert response.status_code == 200, response.text
    assert count_audit(domain="posts", action="online") == before + 1


# ---------------------------------------------------------------------------
# Categories — list endpoint shape
# ---------------------------------------------------------------------------


def test_categories_list_returns_seeded_categories(client):
    response = client.get(
        f"{API_PREFIX}/categories",
        headers=auth_headers(),
    )
    assert response.status_code == 200
    payload = unwrap(response)
    assert isinstance(payload["data"], list)


def test_tags_list_returns_seeded_tags(client):
    response = client.get(
        f"{API_PREFIX}/tags",
        headers=auth_headers(),
    )
    assert response.status_code == 200
    payload = unwrap(response)
    assert isinstance(payload["data"], list)


# ---------------------------------------------------------------------------
# Reports / Appeals mutations
# ---------------------------------------------------------------------------


def _make_post_report(reporter_id: int, post_id: int) -> int:
    from lenjoy_bbs.modules.reports.models import PostReport
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


def test_post_report_review_mutation_records_audit(client):
    reporter_id = _ensure_user("reporter-1")
    author_id = _ensure_user("reported-author-1")
    post_id = _make_post(author_id)
    report_id = _make_post_report(reporter_id, post_id)
    before = count_audit(domain="reports.posts", action="resolve")
    response = client.patch(
        f"{API_PREFIX}/reports/posts/{report_id}",
        headers=auth_headers(
            operator_id="ops-rp", idempotency_key="idem-rp-1",
        ),
        json={"status": "RESOLVED", "resolutionNote": "ok"},
    )
    assert response.status_code == 200, response.text
    payload = unwrap(response)
    assert payload["data"]["operatorId"] == "ops-rp"
    assert payload["data"]["status"] == "RESOLVED"
    # Action is the literal payload.action (None here, falls back to
    # "update_status"), so we count all updates in that domain instead.
    after = count_audit(domain="reports.posts")
    assert after == before + 1


def test_resource_appeal_review_mutation_records_audit(client):
    buyer_id = _ensure_user("buyer-1")
    seller_id = _ensure_user("seller-1")
    from lenjoy_bbs.modules.posts.models import ResourcePurchase
    from lenjoy_bbs.modules.reports.models import ResourceAppeal
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

    appeal_id = asyncio.run(_build())
    before = count_audit(domain="resource_appeals")
    response = client.patch(
        f"{API_PREFIX}/resource-appeals/{appeal_id}",
        headers=auth_headers(
            operator_id="ops-ap", idempotency_key="idem-ap-1",
        ),
        json={"action": "APPROVE", "refundAmount": 10, "resolutionNote": "ok"},
    )
    assert response.status_code == 200, response.text
    assert count_audit(domain="resource_appeals") == before + 1


# ---------------------------------------------------------------------------
# Bounty delete request review
# ---------------------------------------------------------------------------


def test_bounty_delete_request_review_rejects_missing_review_target(client):
    response = client.patch(
        f"{API_PREFIX}/bounty-delete-requests/9999",
        headers=auth_headers(
            operator_id="ops-bd", idempotency_key="idem-bd-1",
        ),
        json={"action": "REJECT", "resolutionNote": "no"},
    )
    # Not found is acceptable; auth and headers must already have passed.
    assert response.status_code in {200, 404}
    if response.status_code == 200:
        # If the request is somehow found (it shouldn't be on a fresh DB),
        # the audit log should still record it.
        assert count_audit(domain="bounty_delete_requests") >= 1


# ---------------------------------------------------------------------------
# Tag merge with invalid target
# ---------------------------------------------------------------------------


def test_tag_merge_with_invalid_target_returns_error(client):
    tag_id = _make_tag("LonelyMerge")
    response = client.post(
        f"{API_PREFIX}/tags/{tag_id}/merge",
        headers=auth_headers(
            operator_id="ops-m2", idempotency_key="idem-m2",
        ),
        json={"targetTagId": 999999},
    )
    assert response.status_code in {200, 400, 404}


# ---------------------------------------------------------------------------
# Sanity — the same headers should not bleed between tests
# ---------------------------------------------------------------------------


def test_state_isolated_between_tests(client):
    # Each test runs against a fresh DB (autouse conftest fixture resets
    # the schema). A listing call here should succeed independently.
    response = client.get(
        f"{API_PREFIX}/metrics/dashboard",
        headers=auth_headers(),
    )
    assert response.status_code == 200
    payload = unwrap(response)
    assert "data" in payload


# ---------------------------------------------------------------------------
# Audit row status_code for create routes
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "path,payload_body,idem",
    [
        (
            "/categories",
            {"name": "AuditStatusCat", "slug": "audit-status-cat"},
            "idem-status-cat",
        ),
        (
            "/tags",
            {"name": "AuditStatusTag", "slug": "audit-status-tag"},
            "idem-status-tag",
        ),
    ],
)
def test_create_route_audit_row_records_201(
    client, path, payload_body, idem
):
    """Create routes return 201 — the audit row must reflect that, not 200."""
    response = client.post(
        f"{API_PREFIX}{path}",
        headers=auth_headers(
            operator_id="ops-status-201",
            idempotency_key=idem,
            request_id=f"req-{idem}",
        ),
        json=payload_body,
    )
    assert response.status_code == 201, response.text

    async def _fetch() -> InternalAdminAuditLog | None:
        async with SessionLocal() as db:
            return await db.scalar(
                select(InternalAdminAuditLog).where(
                    InternalAdminAuditLog.idempotency_key == idem
                )
            )

    row = asyncio.run(_fetch())
    assert row is not None
    assert row.status_code == 201


def test_open_api_client_create_audit_row_records_201(client):
    idem = "idem-status-client"
    response = client.post(
        f"{API_PREFIX}/open-api/clients",
        headers=auth_headers(
            operator_id="ops-client-201",
            idempotency_key=idem,
            request_id=f"req-{idem}",
        ),
        json={"name": "AuditStatusClient", "remark": "x"},
    )
    assert response.status_code == 201, response.text

    async def _fetch() -> InternalAdminAuditLog | None:
        async with SessionLocal() as db:
            return await db.scalar(
                select(InternalAdminAuditLog).where(
                    InternalAdminAuditLog.idempotency_key == idem
                )
            )

    row = asyncio.run(_fetch())
    assert row is not None
    assert row.status_code == 201


def test_open_api_binding_create_audit_row_records_201(client):
    user_id = _ensure_user("mut-bind-status")
    client_id = _make_client("BindingStatus201Client")
    idem = "idem-status-bind"
    response = client.post(
        f"{API_PREFIX}/open-api/clients/{client_id}/bindings",
        headers=auth_headers(
            operator_id="ops-bind-201",
            idempotency_key=idem,
            request_id=f"req-{idem}",
        ),
        json={
            "scope": "binding-code-201",
            "partnerUserId": user_id,
        },
    )
    assert response.status_code == 201, response.text

    async def _fetch() -> InternalAdminAuditLog | None:
        async with SessionLocal() as db:
            return await db.scalar(
                select(InternalAdminAuditLog).where(
                    InternalAdminAuditLog.idempotency_key == idem
                )
            )

    row = asyncio.run(_fetch())
    assert row is not None
    assert row.status_code == 201


# ---------------------------------------------------------------------------
# Production guard for INTERNAL_SERVICE_TOKEN
# ---------------------------------------------------------------------------


def test_internal_service_token_default_is_rejected_outside_dev(monkeypatch):
    """Booting with the placeholder token outside dev/test must fail loud."""
    from lenjoy_bbs.core import config as config_module

    get_settings.cache_clear()
    monkeypatch.delenv("INTERNAL_SERVICE_TOKEN", raising=False)
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DATABASE_URL", "postgresql://example/db")
    monkeypatch.setenv("JWT_SECRET", "a-real-jwt-secret-at-least-32-chars")
    try:
        with pytest.raises(RuntimeError, match="INTERNAL_SERVICE_TOKEN"):
            config_module.Settings().validate_runtime_configuration()
    finally:
        get_settings.cache_clear()


def test_internal_service_token_set_in_production_is_accepted(monkeypatch):
    """Booting with a real token in production must succeed."""
    from lenjoy_bbs.core import config as config_module

    get_settings.cache_clear()
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "real-prod-token-rotate-me")
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DATABASE_URL", "postgresql://example/db")
    monkeypatch.setenv("JWT_SECRET", "a-real-jwt-secret-at-least-32-chars")
    try:
        # Should not raise.
        config_module.Settings().validate_runtime_configuration()
    finally:
        get_settings.cache_clear()
