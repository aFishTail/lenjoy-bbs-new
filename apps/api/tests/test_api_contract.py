import asyncio
import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

os.environ["DATABASE_URL"] = "sqlite://"

from lenjoy_bbs.main import app
from lenjoy_bbs.db.session import SessionLocal
from lenjoy_bbs.modules.posts.models import PostTag
from lenjoy_bbs.modules.taxonomy.models import Tag
from lenjoy_bbs.modules.users.models import UserAccount
from lenjoy_bbs.modules.wallet.models import Wallet

API_PREFIX = "/api/v1"


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def unwrap(response):
    payload = response.json()
    assert set(payload) == {"data", "error", "meta"}
    return payload


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def register_user(client: TestClient, username: str, email: str) -> str:
    captcha = unwrap(client.get(f"{API_PREFIX}/auth/captcha"))["data"]
    response = client.post(
        f"{API_PREFIX}/auth/register",
        json={
            "username": username,
            "password": "correct horse battery staple",
            "email": email,
            "captchaId": captcha["captchaId"],
            "captchaCode": captcha["debugCode"],
        },
    )

    payload = unwrap(response)
    assert response.status_code == 201
    assert payload["error"] is None
    assert payload["data"]["user"]["username"] == username
    return payload["data"]["accessToken"]


def remove_wallet(username: str) -> None:
    async def _remove() -> None:
        async with SessionLocal() as db:
            user_id = await db.scalar(select(UserAccount.id).where(UserAccount.username == username))
            await db.execute(delete(Wallet).where(Wallet.user_id == user_id))
            await db.commit()

    asyncio.run(_remove())


def test_health_uses_v1_response_contract(client):
    response = client.get(f"{API_PREFIX}/health")

    payload = unwrap(response)
    assert response.status_code == 200
    assert payload["error"] is None
    assert payload["data"] == {"status": "UP"}
    assert payload["meta"]["apiVersion"] == "v1"


def test_register_login_wallet_post_comment_and_purchase_flow(client):
    alice_token = register_user(client, "alice", "alice@example.com")
    bob_token = register_user(client, "bob", "bob@example.com")

    login_captcha = unwrap(client.get(f"{API_PREFIX}/auth/captcha"))["data"]
    login_response = client.post(
        f"{API_PREFIX}/auth/login",
        json={
            "account": "alice",
            "password": "correct horse battery staple",
            "captchaId": login_captcha["captchaId"],
            "captchaCode": login_captcha["debugCode"],
        },
    )
    login_payload = unwrap(login_response)
    assert login_response.status_code == 200
    assert login_payload["data"]["tokenType"] == "Bearer"

    wallet = unwrap(client.get(f"{API_PREFIX}/me/wallet", headers=bearer(alice_token)))
    assert wallet["data"]["availableCoins"] == 100

    post_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(alice_token),
        json={
            "type": "RESOURCE",
            "title": "Readable Python backend",
            "content": "This resource is public.",
            "hiddenContent": "download-secret",
            "price": 10,
        },
    )
    post_payload = unwrap(post_response)
    assert post_response.status_code == 201
    post_id = post_payload["data"]["id"]

    comment_response = client.post(
        f"{API_PREFIX}/posts/{post_id}/comments",
        headers=bearer(bob_token),
        json={"content": "Looks useful."},
    )
    comment_payload = unwrap(comment_response)
    assert comment_response.status_code == 201
    assert comment_payload["data"]["content"] == "Looks useful."

    purchase_response = client.post(
        f"{API_PREFIX}/posts/{post_id}/purchase",
        headers=bearer(bob_token),
    )
    purchase_payload = unwrap(purchase_response)
    assert purchase_response.status_code == 201
    assert purchase_payload["data"]["postId"] == post_id
    assert purchase_payload["data"]["price"] == 10

    purchased_detail = unwrap(client.get(f"{API_PREFIX}/posts/{post_id}", headers=bearer(bob_token)))
    assert purchased_detail["data"]["hiddenContent"] == "download-secret"


def test_post_create_persists_tag_relations(client):
    token = register_user(client, "tag-author", "tag-author@example.com")

    async def load_tag_ids() -> list[int]:
        async with SessionLocal() as db:
            return list((await db.scalars(select(Tag.id).order_by(Tag.id.asc()).limit(2))).all())

    tag_ids = asyncio.run(load_tag_ids())
    assert len(tag_ids) == 2

    create_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(token),
        json={
            "type": "NORMAL",
            "title": "Tagged post",
            "content": "body",
            "tagIds": tag_ids,
        },
    )
    create_payload = unwrap(create_response)
    assert create_response.status_code == 201
    post_id = create_payload["data"]["id"]

    async def fetch_post_tag_ids() -> list[int]:
        async with SessionLocal() as db:
            return list((await db.scalars(select(PostTag.tag_id).where(PostTag.post_id == post_id).order_by(PostTag.tag_id.asc()))).all())

    assert asyncio.run(fetch_post_tag_ids()) == sorted(tag_ids)


def test_post_create_rejects_unknown_tag_ids(client):
    token = register_user(client, "invalid-tag-author", "invalid-tag-author@example.com")

    response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(token),
        json={
            "type": "NORMAL",
            "title": "Broken tags",
            "content": "body",
            "tagIds": [999999],
        },
    )
    payload = unwrap(response)

    assert response.status_code == 400
    assert payload["error"]["code"] == "TAG_NOT_FOUND"


def test_post_update_can_clear_nullable_fields(client):
    token = register_user(client, "clear-fields-author", "clear-fields-author@example.com")

    create_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(token),
        json={
            "type": "RESOURCE",
            "title": "Clearable post",
            "content": "body",
            "hiddenContent": "secret",
            "price": 10,
            "categoryId": 1,
        },
    )
    create_payload = unwrap(create_response)
    assert create_response.status_code == 201
    post_id = create_payload["data"]["id"]

    update_response = client.put(
        f"{API_PREFIX}/posts/{post_id}",
        headers=bearer(token),
        json={
            "content": None,
            "hiddenContent": None,
            "price": None,
            "categoryId": None,
        },
    )
    update_payload = unwrap(update_response)

    assert update_response.status_code == 200
    assert update_payload["data"]["content"] is None
    assert update_payload["data"]["hiddenContent"] is None
    assert update_payload["data"]["price"] == 0


def test_wallet_read_endpoint_returns_wallet_summary(client):
    token = register_user(client, "wallet-reader", "wallet-reader@example.com")

    response = client.get(f"{API_PREFIX}/me/wallet", headers=bearer(token))
    payload = unwrap(response)

    assert response.status_code == 200
    assert payload["data"]["availableCoins"] == 100
    assert payload["data"]["frozenCoins"] == 0


def test_wallet_read_endpoint_returns_zero_summary_when_wallet_row_is_missing(client):
    token = register_user(client, "wallet-missing", "wallet-missing@example.com")
    remove_wallet("wallet-missing")

    response = client.get(f"{API_PREFIX}/me/wallet", headers=bearer(token))
    payload = unwrap(response)

    assert response.status_code == 200
    assert payload["data"]["availableCoins"] == 0
    assert payload["data"]["frozenCoins"] == 0


def test_protected_endpoint_returns_v1_error_contract(client):
    response = client.post(
        f"{API_PREFIX}/posts",
        json={"type": "NORMAL", "title": "Denied", "content": "No token"},
    )

    payload = unwrap(response)
    assert response.status_code == 401
    assert payload["data"] is None
    assert payload["error"]["code"] == "UNAUTHORIZED"


def test_register_rejects_reserved_open_api_identifiers(client):
    captcha = unwrap(client.get(f"{API_PREFIX}/auth/captcha"))["data"]
    response = client.post(
        f"{API_PREFIX}/auth/register",
        json={
            "username": "openapi",
            "password": "correct horse battery staple",
            "email": "reserved@example.com",
            "captchaId": captcha["captchaId"],
            "captchaCode": captcha["debugCode"],
        },
    )
    payload = unwrap(response)

    assert response.status_code == 400
    assert payload["error"]["code"] == "ACCOUNT_RESERVED"


def test_register_rejects_identifier_namespace_collisions(client):
    captcha = unwrap(client.get(f"{API_PREFIX}/auth/captcha"))["data"]
    first = client.post(
        f"{API_PREFIX}/auth/register",
        json={
            "username": "namespace-owner",
            "password": "correct horse battery staple",
            "email": "namespace-owner@example.com",
            "phone": "12345",
            "captchaId": captcha["captchaId"],
            "captchaCode": captcha["debugCode"],
        },
    )
    assert first.status_code == 201

    second_captcha = unwrap(client.get(f"{API_PREFIX}/auth/captcha"))["data"]
    response = client.post(
        f"{API_PREFIX}/auth/register",
        json={
            "username": "12345",
            "password": "correct horse battery staple",
            "email": "namespace-collision@example.com",
            "captchaId": second_captcha["captchaId"],
            "captchaCode": second_captcha["debugCode"],
        },
    )
    payload = unwrap(response)

    assert response.status_code == 400
    assert payload["error"]["code"] == "ACCOUNT_IDENTIFIER_CONFLICT"


def test_unknown_route_returns_v1_error_contract(client):
    response = client.get(f"{API_PREFIX}/not-a-route")

    payload = unwrap(response)
    assert response.status_code == 404
    assert payload["data"] is None
    assert payload["error"]["code"] == "NOT_FOUND"
