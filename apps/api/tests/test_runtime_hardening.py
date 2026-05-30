import asyncio
import importlib
import os
from datetime import datetime, UTC
from io import BytesIO

import jwt
import pytest
from fastapi import UploadFile
from fastapi.testclient import TestClient
from sqlalchemy import select
from starlette.datastructures import Headers

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("CAPTCHA_DEBUG_ENABLED", "true")

from lenjoy_bbs.core.config import Settings, get_settings
from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.core.security import create_access_token
from lenjoy_bbs.db.session import SessionLocal
from lenjoy_bbs.infrastructure.storage.image_storage import MinioImageStorage, validate_image_upload
from lenjoy_bbs.main import app, create_app
from lenjoy_bbs.modules.open_api import client_management as open_api_client_management
from lenjoy_bbs.modules.open_api.client_management import create_client
from lenjoy_bbs.modules.open_api.publication import create_open_post
from lenjoy_bbs.modules.open_api.constants import OPEN_API_SYSTEM_EMAIL, OPEN_API_SYSTEM_USERNAME
from lenjoy_bbs.modules.open_api.models import OpenApiClient
from lenjoy_bbs.modules.files.router import get_storage_service, upload_image as upload_image_endpoint
from lenjoy_bbs.modules.posts.models import Post, PostComment, PostTag
from lenjoy_bbs.modules.posts.bounty_settlement import accept_bounty_answer_settlement
from lenjoy_bbs.modules.posts.schemas import PostCreateRequest
from lenjoy_bbs.modules.taxonomy.models import Tag
from lenjoy_bbs.modules.users.models import Role, UserAccount, UserRole
from lenjoy_bbs.modules.wallet.models import Wallet, WalletLedger

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
    assert response.status_code == 201
    return unwrap(response)["data"]["accessToken"]


def test_app_startup_does_not_initialize_schema(monkeypatch):
    main_module = importlib.import_module("lenjoy_bbs.main")

    def fail_if_called():
        raise AssertionError("startup must not mutate database schema")

    monkeypatch.setattr(main_module,
                        "init_app_database",
                        fail_if_called,
                        raising=False)

    with TestClient(create_app()) as test_client:
        response = test_client.get(f"{API_PREFIX}/health")

    assert response.status_code == 200


def test_app_startup_seeds_development_data(monkeypatch):
    main_module = importlib.import_module("lenjoy_bbs.main")
    calls: list[str] = []

    async def record_seed() -> None:
        calls.append("seeded")

    monkeypatch.setattr(main_module, "seed_development_data", record_seed)

    with TestClient(main_module.create_app()) as test_client:
        response = test_client.get(f"{API_PREFIX}/health")

    assert response.status_code == 200
    assert calls == ["seeded"]


def test_bootstrap_module_is_sqlite_test_only(monkeypatch):
    bootstrap_module = importlib.import_module("lenjoy_bbs.db.bootstrap")
    runs: list[str] = []

    class FakeSettings:

        def __init__(self, *, uses_sqlite: bool, is_development: bool):
            self.uses_sqlite = uses_sqlite
            self.is_development = is_development

    monkeypatch.setattr(bootstrap_module, "_init_sqlite_database",
                        lambda: "sqlite-bootstrap")
    monkeypatch.setattr(bootstrap_module.asyncio, "run",
                        lambda coroutine: runs.append(coroutine))

    monkeypatch.setattr(
        bootstrap_module,
        "get_settings",
        lambda: FakeSettings(uses_sqlite=True, is_development=True),
    )
    bootstrap_module.init_app_database()

    monkeypatch.setattr(
        bootstrap_module,
        "get_settings",
        lambda: FakeSettings(uses_sqlite=True, is_development=False),
    )
    bootstrap_module.init_app_database()

    monkeypatch.setattr(
        bootstrap_module,
        "get_settings",
        lambda: FakeSettings(uses_sqlite=False, is_development=True),
    )
    bootstrap_module.init_app_database()

    assert len(runs) == 1


def test_production_requires_real_database_url_and_jwt_secret():
    settings = Settings(
        app_env="production",
        database_url=None,
        db_url=None,
        jwt_secret="lenjoy-jwt-secret-change-me-at-least-32-chars",
    )

    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        settings.validate_runtime_configuration()

    settings = Settings(
        app_env="production",
        database_url="postgresql+psycopg://user:pass@localhost/db",
        jwt_secret="lenjoy-jwt-secret-change-me-at-least-32-chars",
    )

    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        settings.validate_runtime_configuration()


def test_invalid_jwt_subjects_return_unauthorized(monkeypatch):
    get_settings.cache_clear()
    settings = get_settings()
    missing_subject = jwt.encode({"roles": ["USER"]},
                                 settings.jwt_secret,
                                 algorithm="HS256")
    bad_subject = jwt.encode({
        "sub": "not-a-number",
        "roles": ["USER"]
    },
                             settings.jwt_secret,
                             algorithm="HS256")

    with TestClient(app, raise_server_exceptions=False) as test_client:
        for token in [missing_subject, bad_subject]:
            response = test_client.get(f"{API_PREFIX}/users/me",
                                       headers=bearer(token))
            payload = unwrap(response)
            assert response.status_code == 401
            assert payload["error"]["code"] == "UNAUTHORIZED"


def test_optional_auth_does_not_expose_hidden_content_for_banned_user(client):
    token = register_user(client, "banned-resource-author",
                          "banned-resource-author@example.com")
    post_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(token),
        json={
            "type": "RESOURCE",
            "title": "Hidden post",
            "content": "public",
            "hiddenContent": "secret",
            "price": 10,
        },
    )
    post_id = unwrap(post_response)["data"]["id"]

    async def ban_user() -> None:
        async with SessionLocal() as db:
            user = await db.scalar(
                select(UserAccount).where(
                    UserAccount.username == "banned-resource-author"))
            assert user is not None
            user.status = "BANNED"
            await db.commit()

    asyncio.run(ban_user())

    response = client.get(f"{API_PREFIX}/posts/{post_id}",
                          headers=bearer(token))
    payload = unwrap(response)

    assert response.status_code == 200
    assert payload["data"]["hiddenContent"] is None


@pytest.mark.asyncio
async def test_open_api_post_creation_preserves_resource_fields():
    async with SessionLocal() as db:
        tag_ids = list(
            (await
             db.scalars(select(Tag.id).order_by(Tag.id.asc()).limit(2))).all())
        assert len(tag_ids) == 2
        client = OpenApiClient(name="integration",
                               api_key="open-key",
                               status="ACTIVE",
                               remark=None)
        db.add(client)
        await db.flush()

        post = await create_open_post(
            db,
            api_key="open-key",
            payload=PostCreateRequest(
                type="RESOURCE",
                title="Open resource",
                content="public body",
                hiddenContent="secret body",
                price=42,
                categoryId=7,
                tagIds=tag_ids,
            ),
        )

    async with SessionLocal() as db:
        stored = await db.get(Post, post.id)
        stored_tag_ids = list((await db.scalars(
            select(PostTag.tag_id).where(PostTag.post_id == post.id).order_by(
                PostTag.tag_id.asc()))).all())

    assert stored is not None
    assert stored.post_type == "RESOURCE"
    assert stored.title == "Open resource"
    assert stored.content == "public body"
    assert stored.hidden_content == "secret body"
    assert stored.price == 42
    assert stored.category_id == 7
    assert stored.status == "PUBLISHED"
    assert stored_tag_ids == sorted(tag_ids)


@pytest.mark.asyncio
async def test_open_api_create_client_rolls_back_failed_insert_and_session_recovers(
        monkeypatch):
    async with SessionLocal() as db:
        values = iter(["dup-key", "dup-key", "fresh-key"])
        monkeypatch.setattr(open_api_client_management.secrets,
                            "token_urlsafe", lambda length: next(values))

        first = await create_client(db,
                                    name="client-one",
                                    remark=None,
                                    status_value="ACTIVE")
        assert first.api_key == "ljo_dup-key"

        with pytest.raises(Exception):
            await create_client(db,
                                name="client-two",
                                remark=None,
                                status_value="ACTIVE")

        recovered = await create_client(db,
                                        name="client-three",
                                        remark=None,
                                        status_value="ACTIVE")
        assert recovered.api_key == "ljo_fresh-key"


@pytest.mark.asyncio
async def test_open_api_post_creation_rejects_unknown_tag_ids():
    async with SessionLocal() as db:
        client = OpenApiClient(name="integration-invalid-tag",
                               api_key="open-invalid-tag",
                               status="ACTIVE",
                               remark=None)
        db.add(client)
        await db.flush()

        with pytest.raises(ApiError, match="一个或多个标签不存在"):
            await create_open_post(
                db,
                api_key="open-invalid-tag",
                payload=PostCreateRequest(
                    type="NORMAL",
                    title="Open invalid tags",
                    content="public body",
                    tagIds=[999999],
                ),
            )

    async with SessionLocal() as db:
        leaked_post = await db.scalar(
            select(Post).where(Post.title == "Open invalid tags"))

    assert leaked_post is None


@pytest.mark.asyncio
async def test_open_api_post_creation_rejects_conflicting_system_user():
    async with SessionLocal() as db:
        client = OpenApiClient(name="integration-conflict",
                               api_key="open-conflict",
                               status="ACTIVE",
                               remark=None)
        db.add(client)
        db.add(
            UserAccount(
                username=OPEN_API_SYSTEM_USERNAME,
                nickname=OPEN_API_SYSTEM_USERNAME,
                email="different@example.com",
                password_hash="hashed",
            ))
        await db.flush()

        with pytest.raises(ApiError, match="Open API 系统用户配置冲突"):
            await create_open_post(
                db,
                api_key="open-conflict",
                payload=PostCreateRequest(
                    type="NORMAL",
                    title="Open conflict",
                    content="public body",
                ),
            )


@pytest.mark.asyncio
async def test_open_api_post_creation_rejects_conflicting_system_email():
    async with SessionLocal() as db:
        client = OpenApiClient(name="integration-conflict-email",
                               api_key="open-conflict-email",
                               status="ACTIVE",
                               remark=None)
        db.add(client)
        db.add(
            UserAccount(
                username="not-openapi",
                nickname="not-openapi",
                email=OPEN_API_SYSTEM_EMAIL,
                password_hash="hashed",
            ))
        await db.flush()

        with pytest.raises(ApiError, match="Open API 系统用户配置冲突"):
            await create_open_post(
                db,
                api_key="open-conflict-email",
                payload=PostCreateRequest(
                    type="NORMAL",
                    title="Open conflict email",
                    content="public body",
                ),
            )


def test_captcha_debug_code_is_configurable(monkeypatch):
    get_settings.cache_clear()
    monkeypatch.setenv("CAPTCHA_DEBUG_ENABLED", "false")
    response = client_without_lifespan().get(f"{API_PREFIX}/auth/captcha")
    payload = unwrap(response)
    assert "debugCode" not in payload["data"]

    image_response = client_without_lifespan().get(
        f"{API_PREFIX}/auth/captcha/{payload['data']['captchaId']}/image")
    assert image_response.status_code == 200
    assert image_response.headers["content-type"] == "image/png"
    assert image_response.content.startswith(b"\x89PNG")


def client_without_lifespan() -> TestClient:
    return TestClient(app)


def test_post_input_validation_rejects_invalid_page_size_and_price(client):
    token = register_user(client, "alice", "alice@example.com")

    page_response = client.get(f"{API_PREFIX}/posts?page=1&pageSize=500")
    assert page_response.status_code == 422

    price_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(token),
        json={
            "type": "RESOURCE",
            "title": "Invalid price",
            "content": "body",
            "price": -1
        },
    )
    assert price_response.status_code == 422


class FakeStorageService:

    def __init__(self):
        self.uploaded = None
        self.entry_position = None
        self.read_calls_before_upload = None
        self.seek_calls_before_upload = None

    async def upload_image(self, file):
        raw_file = file.file
        self.entry_position = raw_file.tell()
        self.read_calls_before_upload = list(
            getattr(raw_file, "read_calls", []))
        self.seek_calls_before_upload = list(
            getattr(raw_file, "seek_calls", []))
        content = await file.read()
        content_type = validate_image_upload(file, len(content))
        self.uploaded = (file.filename, file.content_type, content)
        return {
            "url": "http://assets.example/posts/20260512/example.png",
            "filename": file.filename,
            "objectKey": "posts/20260512/example.png",
            "contentType": content_type,
            "size": len(content),
        }


class SpyBytesIO(BytesIO):

    def __init__(self, content: bytes):
        super().__init__(content)
        self.read_calls: list[int] = []
        self.seek_calls: list[tuple[int, int]] = []

    def read(self, size: int = -1) -> bytes:
        self.read_calls.append(size)
        return super().read(size)

    def seek(self, offset: int, whence: int = 0) -> int:
        self.seek_calls.append((offset, whence))
        return super().seek(offset, whence)


def test_image_upload_validates_type_and_uses_storage(client):
    token = register_user(client, "alice", "alice@example.com")
    fake_storage = FakeStorageService()
    app.dependency_overrides[get_storage_service] = lambda: fake_storage
    try:
        invalid_response = client.post(
            f"{API_PREFIX}/files/images",
            headers=bearer(token),
            files={"file": ("note.txt", BytesIO(b"hello"), "text/plain")},
        )
        assert invalid_response.status_code == 400
        assert unwrap(invalid_response)["error"]["code"] == "FILE_TYPE_INVALID"

        valid_response = client.post(
            f"{API_PREFIX}/files/images",
            headers=bearer(token),
            files={
                "file":
                ("image.png", BytesIO(b"\x89PNG\r\n\x1a\nimage"), "image/png")
            },
        )
        payload = unwrap(valid_response)
        assert valid_response.status_code == 200
        assert payload["data"]["objectKey"] == "posts/20260512/example.png"
        assert fake_storage.uploaded[0] == "image.png"
    finally:
        app.dependency_overrides.pop(get_storage_service, None)

    upload = UploadFile(
        file=SpyBytesIO(b"\x89PNG\r\n\x1a\nimage"),
        filename="image.png",
        headers=Headers({"content-type": "image/png"}),
    )

    delegated = asyncio.run(
        upload_image_endpoint(object(), fake_storage, upload))

    assert delegated["data"]["objectKey"] == "posts/20260512/example.png"
    assert fake_storage.entry_position == 0
    assert fake_storage.read_calls_before_upload == []
    assert fake_storage.seek_calls_before_upload == []
    assert fake_storage.uploaded[2] == b"\x89PNG\r\n\x1a\nimage"


def test_image_storage_prepares_bucket_policy_once_per_process(monkeypatch):
    storage_module = importlib.import_module(MinioImageStorage.__module__)

    class FakeMinioClient:
        bucket_exists_calls = 0
        make_bucket_calls = 0
        set_bucket_policy_calls = 0
        put_object_calls = 0

        def __init__(self, *args, **kwargs):
            pass

        def bucket_exists(self, bucket_name):
            type(self).bucket_exists_calls += 1
            return True

        def make_bucket(self, bucket_name):
            type(self).make_bucket_calls += 1

        def set_bucket_policy(self, bucket_name, policy):
            type(self).set_bucket_policy_calls += 1

        def put_object(self, bucket_name, object_name, data, length,
                       content_type):
            type(self).put_object_calls += 1

    monkeypatch.setattr(storage_module, "Minio", FakeMinioClient)
    monkeypatch.setattr(MinioImageStorage,
                        "_bucket_ready",
                        False,
                        raising=False)

    upload_one = UploadFile(
        file=BytesIO(b"\x89PNG\r\n\x1a\none"),
        filename="one.png",
        headers=Headers({"content-type": "image/png"}),
    )
    upload_two = UploadFile(
        file=BytesIO(b"\x89PNG\r\n\x1a\ntwo"),
        filename="two.png",
        headers=Headers({"content-type": "image/png"}),
    )

    asyncio.run(MinioImageStorage().upload_image(upload_one))
    asyncio.run(MinioImageStorage().upload_image(upload_two))

    assert FakeMinioClient.put_object_calls == 2
    assert FakeMinioClient.set_bucket_policy_calls == 1


def test_image_storage_rejects_oversized_upload_before_put_object(monkeypatch):
    storage_module = importlib.import_module(MinioImageStorage.__module__)

    class FakeMinioClient:
        put_object_calls = 0

        def __init__(self, *args, **kwargs):
            pass

        def bucket_exists(self, bucket_name):
            raise AssertionError(
                "bucket_exists should not be called for oversized uploads")

        def make_bucket(self, bucket_name):
            raise AssertionError(
                "make_bucket should not be called for oversized uploads")

        def set_bucket_policy(self, bucket_name, policy):
            raise AssertionError(
                "set_bucket_policy should not be called for oversized uploads")

        def put_object(self, bucket_name, object_name, data, length,
                       content_type):
            type(self).put_object_calls += 1

    monkeypatch.setattr(storage_module, "Minio", FakeMinioClient)
    monkeypatch.setattr(MinioImageStorage,
                        "_bucket_ready",
                        False,
                        raising=False)
    monkeypatch.setattr(get_settings(),
                        "minio_max_file_size_bytes",
                        4,
                        raising=False)

    upload = UploadFile(
        file=BytesIO(b"12345"),
        filename="oversized.png",
        headers=Headers({"content-type": "image/png"}),
    )

    with pytest.raises(ApiError, match="图片大小超过上传限制"):
        asyncio.run(MinioImageStorage().upload_image(upload))

    assert FakeMinioClient.put_object_calls == 0


def test_admin_missing_resources_return_404_and_wallet_ledger_balances_are_after_values(
        client):
    token = register_user(client, "admin-user", "admin@example.com")

    async def prepare_admin() -> tuple[str, int]:
        async with SessionLocal() as db:
            user = await db.scalar(
                select(UserAccount).where(UserAccount.username == "admin-user")
            )
            role = await db.scalar(
                select(Role).where(Role.role_code == "ADMIN"))
            db.add(UserRole(user_id=user.id, role_id=role.id))
            await db.commit()
            return create_access_token(user, ["ADMIN"]), user.id

    admin_token, user_id = asyncio.run(prepare_admin())

    missing_response = client.patch(
        f"{API_PREFIX}/admin/users/999999/status",
        headers=bearer(admin_token),
        json={"status": "BANNED"},
    )
    assert missing_response.status_code == 404

    adjust_response = client.patch(
        f"{API_PREFIX}/admin/coins/users/{user_id}",
        headers=bearer(admin_token),
        json={
            "amount": 25,
            "reason": "bonus"
        },
    )
    assert adjust_response.status_code == 200
    assert unwrap(adjust_response)["data"]["availableCoins"] == 125

    async def fetch_ledger_balances() -> list[int]:
        async with SessionLocal() as db:
            ledgers = (await db.scalars(
                select(WalletLedger).where(
                    WalletLedger.user_id == user_id).order_by(
                        WalletLedger.id.asc()))).all()
            return [row.balance_after for row in ledgers]

    assert asyncio.run(fetch_ledger_balances()) == [100, 125]


def test_admin_role_revocation_invalidates_old_token_authorization(client):
    token = register_user(client, "revoked-admin", "revoked-admin@example.com")

    async def prepare_admin() -> tuple[str, int, int]:
        async with SessionLocal() as db:
            user = await db.scalar(
                select(UserAccount).where(
                    UserAccount.username == "revoked-admin"))
            role = await db.scalar(
                select(Role).where(Role.role_code == "ADMIN"))
            assert user is not None
            assert role is not None
            membership = UserRole(user_id=user.id, role_id=role.id)
            db.add(membership)
            await db.commit()
            return create_access_token(user, ["ADMIN"]), user.id, membership.id

    admin_token, user_id, membership_id = asyncio.run(prepare_admin())

    async def revoke_admin() -> None:
        async with SessionLocal() as db:
            membership = await db.get(UserRole, membership_id)
            assert membership is not None
            await db.delete(membership)
            await db.commit()

    asyncio.run(revoke_admin())

    response = client.patch(
        f"{API_PREFIX}/admin/coins/users/{user_id}",
        headers=bearer(admin_token),
        json={
            "amount": 25,
            "reason": "bonus"
        },
    )
    payload = unwrap(response)

    assert response.status_code == 403
    assert payload["error"]["code"] == "FORBIDDEN"


def test_offline_post_is_hidden_from_public_detail_comment_and_purchase(
        client):
    author_token = register_user(client, "offline-author",
                                 "offline-author@example.com")
    buyer_token = register_user(client, "offline-buyer",
                                "offline-buyer@example.com")
    admin_user_token = register_user(client, "offline-admin",
                                     "offline-admin@example.com")

    post_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(author_token),
        json={
            "type": "RESOURCE",
            "title": "Offline resource",
            "content": "public",
            "hiddenContent": "secret",
            "price": 10,
        },
    )
    post_id = unwrap(post_response)["data"]["id"]

    async def promote_admin() -> str:
        async with SessionLocal() as db:
            user = await db.scalar(
                select(UserAccount).where(
                    UserAccount.username == "offline-admin"))
            role = await db.scalar(
                select(Role).where(Role.role_code == "ADMIN"))
            assert user is not None
            assert role is not None
            db.add(UserRole(user_id=user.id, role_id=role.id))
            await db.commit()
            return create_access_token(user, ["ADMIN"])

    admin_token = asyncio.run(promote_admin())

    offline_response = client.patch(
        f"{API_PREFIX}/admin/posts/{post_id}/offline",
        headers=bearer(admin_token))
    assert offline_response.status_code == 200

    detail_response = client.get(f"{API_PREFIX}/posts/{post_id}",
                                 headers=bearer(author_token))
    comments_response = client.get(f"{API_PREFIX}/posts/{post_id}/comments")
    purchase_response = client.post(f"{API_PREFIX}/posts/{post_id}/purchase",
                                    headers=bearer(buyer_token))

    assert detail_response.status_code == 404
    assert unwrap(detail_response)["error"]["code"] == "POST_NOT_FOUND"
    assert comments_response.status_code == 404
    assert unwrap(comments_response)["error"]["code"] == "POST_NOT_FOUND"
    assert purchase_response.status_code == 404
    assert unwrap(purchase_response)["error"]["code"] == "POST_NOT_FOUND"


def test_admin_offline_active_bounty_refunds_frozen_balance(client):
    author_token = register_user(client, "offline-bounty-author",
                                 "offline-bounty-author@example.com")
    register_user(client, "offline-bounty-admin",
                  "offline-bounty-admin@example.com")

    post_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(author_token),
        json={
            "postType": "BOUNTY",
            "title": "Offline bounty",
            "content": "question",
            "bountyAmount": 25,
            "bountyExpireAt": "2026-06-01T12:00:00Z",
        },
    )
    post_id = unwrap(post_response)["data"]["id"]

    async def promote_admin() -> str:
        async with SessionLocal() as db:
            user = await db.scalar(
                select(UserAccount).where(
                    UserAccount.username == "offline-bounty-admin"))
            role = await db.scalar(
                select(Role).where(Role.role_code == "ADMIN"))
            assert user is not None
            assert role is not None
            db.add(UserRole(user_id=user.id, role_id=role.id))
            await db.commit()
            return create_access_token(user, ["ADMIN"])

    admin_token = asyncio.run(promote_admin())

    offline_response = client.patch(
        f"{API_PREFIX}/admin/posts/{post_id}/offline",
        headers=bearer(admin_token))
    wallet_payload = unwrap(
        client.get(f"{API_PREFIX}/users/me/wallet",
                   headers=bearer(author_token)))

    assert offline_response.status_code == 200
    assert wallet_payload["data"]["availableCoins"] == 100
    assert wallet_payload["data"]["frozenCoins"] == 0


def test_admin_report_offline_post_notifies_author_only(client):
    author_token = register_user(client, "report-offline-author",
                                 "report-offline-author@example.com")
    reporter_token = register_user(client, "report-offline-reporter",
                                   "report-offline-reporter@example.com")
    register_user(client, "report-offline-admin",
                  "report-offline-admin@example.com")

    post_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(author_token),
        json={
            "postType": "NORMAL",
            "title": "Reported offline post",
            "content": "body",
        },
    )
    post_id = unwrap(post_response)["data"]["id"]

    report_response = client.post(
        f"{API_PREFIX}/posts/{post_id}/reports",
        headers=bearer(reporter_token),
        json={
            "reason": "spam",
            "detail": "bad content"
        },
    )
    report_id = unwrap(report_response)["data"]["id"]

    async def promote_admin() -> str:
        async with SessionLocal() as db:
            user = await db.scalar(
                select(UserAccount).where(
                    UserAccount.username == "report-offline-admin"))
            role = await db.scalar(
                select(Role).where(Role.role_code == "ADMIN"))
            assert user is not None
            assert role is not None
            db.add(UserRole(user_id=user.id, role_id=role.id))
            await db.commit()
            return create_access_token(user, ["ADMIN"])

    admin_token = asyncio.run(promote_admin())

    review_response = client.patch(
        f"{API_PREFIX}/admin/reports/posts/{report_id}",
        headers=bearer(admin_token),
        json={
            "status": "VALID",
            "resolutionNote": "违规内容",
            "action": "OFFLINE_POST",
        },
    )
    author_messages = unwrap(
        client.get(f"{API_PREFIX}/users/me/messages",
                   headers=bearer(author_token)))["data"]
    reporter_messages = unwrap(
        client.get(f"{API_PREFIX}/users/me/messages",
                   headers=bearer(reporter_token)))["data"]
    detail_response = client.get(f"{API_PREFIX}/posts/{post_id}",
                                 headers=bearer(author_token))

    assert review_response.status_code == 200
    assert detail_response.status_code == 404
    assert any(message["messageType"] == "POST_OFFLINED"
               for message in author_messages)
    assert all(message["messageType"] != "POST_OFFLINED"
               for message in reporter_messages)


def test_admin_report_offline_active_bounty_refunds_frozen_balance(client):
    author_token = register_user(client, "report-bounty-author",
                                 "report-bounty-author@example.com")
    reporter_token = register_user(client, "report-bounty-reporter",
                                   "report-bounty-reporter@example.com")
    register_user(client, "report-bounty-admin",
                  "report-bounty-admin@example.com")

    post_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(author_token),
        json={
            "postType": "BOUNTY",
            "title": "Reported bounty",
            "content": "question",
            "bountyAmount": 25,
            "bountyExpireAt": "2026-06-01T12:00:00Z",
        },
    )
    post_id = unwrap(post_response)["data"]["id"]

    report_response = client.post(
        f"{API_PREFIX}/posts/{post_id}/reports",
        headers=bearer(reporter_token),
        json={
            "reason": "spam",
            "detail": "bad bounty"
        },
    )
    report_id = unwrap(report_response)["data"]["id"]

    async def promote_admin() -> str:
        async with SessionLocal() as db:
            user = await db.scalar(
                select(UserAccount).where(
                    UserAccount.username == "report-bounty-admin"))
            role = await db.scalar(
                select(Role).where(Role.role_code == "ADMIN"))
            assert user is not None
            assert role is not None
            db.add(UserRole(user_id=user.id, role_id=role.id))
            await db.commit()
            return create_access_token(user, ["ADMIN"])

    admin_token = asyncio.run(promote_admin())

    review_response = client.patch(
        f"{API_PREFIX}/admin/reports/posts/{report_id}",
        headers=bearer(admin_token),
        json={
            "status": "VALID",
            "resolutionNote": "违规悬赏",
            "action": "OFFLINE_POST",
        },
    )
    wallet_payload = unwrap(
        client.get(f"{API_PREFIX}/users/me/wallet",
                   headers=bearer(author_token)))

    assert review_response.status_code == 200
    assert wallet_payload["data"]["availableCoins"] == 100
    assert wallet_payload["data"]["frozenCoins"] == 0


@pytest.mark.asyncio
async def test_accepting_expired_bounty_refunds_frozen_balance():
    async with SessionLocal() as db:
        author = UserAccount(username="expired-bounty-author",
                             nickname="expired-bounty-author",
                             email="expired-bounty-author@example.com",
                             password_hash="hashed")
        answerer = UserAccount(username="expired-bounty-answerer",
                               nickname="expired-bounty-answerer",
                               email="expired-bounty-answerer@example.com",
                               password_hash="hashed")
        db.add_all([author, answerer])
        await db.flush()
        db.add(Wallet(user_id=author.id, available_coins=75, frozen_coins=25))

        post = Post(
            author_id=author.id,
            post_type="BOUNTY",
            title="Expired bounty",
            content="question",
            bounty_amount=25,
            bounty_status="ACTIVE",
            bounty_expire_at=datetime(2020, 1, 1, tzinfo=UTC),
        )
        db.add(post)
        await db.flush()
        comment = PostComment(post_id=post.id,
                              author_id=answerer.id,
                              content="answer")
        db.add(comment)
        await db.commit()
        post_id = post.id
        comment_id = comment.id

    async with SessionLocal() as db:
        author = await db.scalar(
            select(UserAccount).where(
                UserAccount.username == "expired-bounty-author"))
        assert author is not None
        with pytest.raises(ApiError, match="悬赏已过期"):
            await accept_bounty_answer_settlement(db, post_id, comment_id,
                                                  author)

    async with SessionLocal() as db:
        post = await db.get(Post, post_id)
        wallet = await db.scalar(
            select(Wallet).where(Wallet.user_id == author.id))

    assert post is not None
    assert post.bounty_status == "EXPIRED"
    assert wallet is not None
    assert wallet.available_coins == 100
    assert wallet.frozen_coins == 0
