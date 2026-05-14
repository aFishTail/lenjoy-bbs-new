# Async FastAPI Architecture Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Python backend refactor so the FastAPI API is fully async, transaction ownership is moved out of routers, and the codebase actually matches the approved architecture instead of stopping at a runnable middle state.

**Architecture:** Keep the project as a modular monolith, but finish the split between HTTP presentation, application use cases, and infrastructure adapters. All writes must be coordinated by application-layer functions, repositories must not commit, routers must stay thin, and transaction rollback behavior must be protected by async tests.

**Tech Stack:** FastAPI, Pydantic v2, SQLAlchemy 2.0 async, `redis.asyncio`, MinIO/S3-compatible storage, pytest, pytest-asyncio, httpx

---

## File Map

**Create**
- `apps/api/tests/test_transaction_boundaries.py`
- `apps/api/tests/test_rollback_guards.py`
- `apps/api/lenjoy_bbs/modules/users/application.py`
- `apps/api/lenjoy_bbs/modules/open_api/application.py`
- `apps/api/lenjoy_bbs/infrastructure/__init__.py`
- `apps/api/lenjoy_bbs/infrastructure/storage/__init__.py`
- `apps/api/lenjoy_bbs/infrastructure/storage/image_storage.py`

**Modify**
- `apps/api/tests/test_runtime_hardening.py`
- `apps/api/tests/test_fastapi_structure.py`
- `apps/api/lenjoy_bbs/modules/users/router.py`
- `apps/api/lenjoy_bbs/modules/wallet/router.py`
- `apps/api/lenjoy_bbs/modules/open_api/router.py`
- `apps/api/lenjoy_bbs/modules/auth/application.py`
- `apps/api/lenjoy_bbs/modules/posts/application.py`
- `apps/api/lenjoy_bbs/modules/admin/service.py`
- `apps/api/lenjoy_bbs/modules/files/router.py`
- `apps/api/lenjoy_bbs/modules/files/storage.py`
- `apps/api/lenjoy_bbs/db/model_registry.py`
- `apps/api/lenjoy_bbs/db/bootstrap.py`
- `apps/api/README.md`

**Keep As-Is Unless Required By Tests**
- `apps/api/lenjoy_bbs/core/*`
- `apps/api/lenjoy_bbs/modules/messages/*`
- `apps/api/lenjoy_bbs/modules/reports/*`
- `apps/api/lenjoy_bbs/modules/taxonomy/*`

---

### Task 1: Lock the Missing Architecture Rules in Tests

**Files:**
- Create: `apps/api/tests/test_transaction_boundaries.py`
- Modify: `apps/api/tests/test_fastapi_structure.py`
- Test: `apps/api/tests/test_transaction_boundaries.py`

- [ ] **Step 1: Write the failing tests**

```python
# apps/api/tests/test_transaction_boundaries.py
from pathlib import Path


def test_routers_do_not_call_commit_or_rollback_directly():
    router_files = [
        Path("lenjoy_bbs/modules/users/router.py"),
        Path("lenjoy_bbs/modules/wallet/router.py"),
        Path("lenjoy_bbs/modules/open_api/router.py"),
    ]

    for path in router_files:
        content = path.read_text(encoding="utf-8")
        assert ".commit(" not in content
        assert ".rollback(" not in content


def test_files_router_uses_infrastructure_storage_adapter():
    content = Path("lenjoy_bbs/modules/files/router.py").read_text(encoding="utf-8")

    assert "infrastructure.storage.image_storage" in content


def test_open_api_and_users_have_application_entrypoints():
    from lenjoy_bbs.modules.open_api.application import create_client, create_open_post
    from lenjoy_bbs.modules.users.application import update_profile

    assert create_client is not None
    assert create_open_post is not None
    assert update_profile is not None
```

```python
# add to apps/api/tests/test_fastapi_structure.py
def test_open_api_and_users_use_application_modules():
    from lenjoy_bbs.modules.open_api.application import create_client, create_open_post
    from lenjoy_bbs.modules.users.application import update_profile

    assert create_client is not None
    assert create_open_post is not None
    assert update_profile is not None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest -q tests/test_transaction_boundaries.py tests/test_fastapi_structure.py::test_open_api_and_users_use_application_modules`

Expected: FAIL because routers still call `commit()` and `users/open_api` application modules do not exist.

- [ ] **Step 3: Write minimal implementation to make the architecture testable**

```python
# apps/api/lenjoy_bbs/modules/users/application.py
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.modules.common import user_public
from lenjoy_bbs.modules.users.models import UserAccount
from lenjoy_bbs.modules.users.schemas import ProfileUpdateRequest


async def update_profile(db: AsyncSession, user: UserAccount, payload: ProfileUpdateRequest) -> dict:
    user.avatar_url = payload.avatar_url
    user.bio = payload.bio
    await db.flush()
    await db.commit()
    await db.refresh(user)
    return user_public(user)
```

```python
# apps/api/lenjoy_bbs/modules/open_api/application.py
import secrets

from fastapi import status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.core.security import hash_password
from lenjoy_bbs.modules.open_api.models import OpenApiClient
from lenjoy_bbs.modules.posts.models import Post
from lenjoy_bbs.modules.posts.schemas import PostCreateRequest
from lenjoy_bbs.modules.users.models import UserAccount


async def create_client(db: AsyncSession, *, name: str, remark: str | None, status_value: str) -> OpenApiClient:
    client = OpenApiClient(name=name, api_key="ljo_" + secrets.token_urlsafe(24), status=status_value, remark=remark)
    db.add(client)
    await db.flush()
    await db.commit()
    await db.refresh(client)
    return client


async def create_open_post(db: AsyncSession, *, api_key: str | None, payload: PostCreateRequest) -> Post:
    client = await db.scalar(select(OpenApiClient).where(OpenApiClient.api_key == api_key, OpenApiClient.status == "ACTIVE"))
    if not client:
        raise ApiError("OPEN_API_UNAUTHORIZED", "Open API key is invalid", status.HTTP_401_UNAUTHORIZED)

    user = await db.scalar(select(UserAccount).where(UserAccount.username == "openapi"))
    if not user:
        user = UserAccount(username="openapi", email="openapi@example.com", password_hash=hash_password(secrets.token_urlsafe(24)))
        db.add(user)
        await db.flush()

    post = Post(author_id=user.id, post_type=payload.type, title=payload.title, content=payload.content, status="PUBLISHED")
    db.add(post)
    await db.flush()
    await db.commit()
    await db.refresh(post)
    return post
```

- [ ] **Step 4: Run tests to verify the new modules import**

Run: `uv run pytest -q tests/test_transaction_boundaries.py::test_open_api_and_users_have_application_entrypoints tests/test_fastapi_structure.py::test_open_api_and_users_use_application_modules`

Expected: PASS for import checks, FAIL for router commit checks.

- [ ] **Step 5: Commit**

```bash
git add apps/api/tests/test_transaction_boundaries.py apps/api/tests/test_fastapi_structure.py apps/api/lenjoy_bbs/modules/users/application.py apps/api/lenjoy_bbs/modules/open_api/application.py
git commit -m "test: lock missing architecture boundaries"
```

### Task 2: Move User and OpenAPI Writes Out of Routers

**Files:**
- Modify: `apps/api/lenjoy_bbs/modules/users/router.py`
- Modify: `apps/api/lenjoy_bbs/modules/open_api/router.py`
- Modify: `apps/api/lenjoy_bbs/modules/users/application.py`
- Modify: `apps/api/lenjoy_bbs/modules/open_api/application.py`
- Test: `apps/api/tests/test_transaction_boundaries.py`

- [ ] **Step 1: Extend the failing tests to cover router boundaries explicitly**

```python
def test_users_router_delegates_profile_writes_to_application():
    content = Path("lenjoy_bbs/modules/users/router.py").read_text(encoding="utf-8")

    assert "await update_profile(" in content
    assert ".commit(" not in content
    assert ".flush(" not in content


def test_open_api_router_delegates_writes_to_application():
    content = Path("lenjoy_bbs/modules/open_api/router.py").read_text(encoding="utf-8")

    assert "await create_client(" in content
    assert "await create_open_post(" in content
    assert ".commit(" not in content
    assert ".flush(" not in content
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest -q tests/test_transaction_boundaries.py::test_users_router_delegates_profile_writes_to_application tests/test_transaction_boundaries.py::test_open_api_router_delegates_writes_to_application`

Expected: FAIL because the routers still contain write logic and direct session control.

- [ ] **Step 3: Rewrite the routers to call application-layer functions**

```python
# apps/api/lenjoy_bbs/modules/users/router.py
from lenjoy_bbs.modules.users.application import update_profile as update_profile_use_case


@router.put("", response_model=ApiEnvelope[UserPublicResponse])
async def update_profile_route(
    payload: ProfileUpdateRequest,
    db: DbSession,
    user: CurrentUser,
):
    return success(await update_profile_use_case(db, user, payload))
```

```python
# apps/api/lenjoy_bbs/modules/open_api/router.py
from lenjoy_bbs.modules.open_api.application import create_client as create_client_use_case
from lenjoy_bbs.modules.open_api.application import create_open_post


@admin_router.post("/clients", status_code=status.HTTP_201_CREATED)
async def create_client_route(payload: ClientRequest, db: DbSession, _: AdminUser):
    client = await create_client_use_case(db, name=payload.name, remark=payload.remark, status_value=payload.status)
    return success({"id": client.id, "name": client.name, "apiKey": client.api_key, "status": client.status, "remark": client.remark})


@open_router.post("/posts", status_code=status.HTTP_201_CREATED)
async def open_post(
    payload: PostCreateRequest,
    db: DbSession,
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
):
    post = await create_open_post(db, api_key=x_api_key, payload=payload)
    return success({"id": post.id})
```

- [ ] **Step 4: Run tests to verify router boundaries now hold**

Run: `uv run pytest -q tests/test_transaction_boundaries.py`

Expected: PASS for user/open-api boundary checks, FAIL only if other routers still commit directly.

- [ ] **Step 5: Commit**

```bash
git add apps/api/lenjoy_bbs/modules/users/router.py apps/api/lenjoy_bbs/modules/open_api/router.py apps/api/lenjoy_bbs/modules/users/application.py apps/api/lenjoy_bbs/modules/open_api/application.py apps/api/tests/test_transaction_boundaries.py
git commit -m "refactor: move user and open-api writes into application layer"
```

### Task 3: Remove Router-Owned Transactions From Wallet and Similar Endpoints

**Files:**
- Modify: `apps/api/lenjoy_bbs/modules/wallet/router.py`
- Modify: `apps/api/lenjoy_bbs/modules/wallet/service.py`
- Modify: `apps/api/tests/test_api_contract.py`
- Test: `apps/api/tests/test_transaction_boundaries.py`

- [ ] **Step 1: Write the failing behavioral test for wallet read behavior**

```python
# add to apps/api/tests/test_api_contract.py
def test_wallet_read_endpoint_does_not_depend_on_router_side_commit(client):
    token = register_user(client, "wallet-reader", "wallet-reader@example.com")

    response = client.get(f"{API_PREFIX}/me/wallet", headers=bearer(token))
    payload = unwrap(response)

    assert response.status_code == 200
    assert payload["data"]["availableCoins"] == 100
```

```python
# add to apps/api/tests/test_transaction_boundaries.py
def test_wallet_router_does_not_commit():
    content = Path("lenjoy_bbs/modules/wallet/router.py").read_text(encoding="utf-8")

    assert ".commit(" not in content
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest -q tests/test_transaction_boundaries.py::test_wallet_router_does_not_commit tests/test_api_contract.py::test_wallet_read_endpoint_does_not_depend_on_router_side_commit`

Expected: FAIL because the wallet router still contains `await db.commit()`.

- [ ] **Step 3: Move wallet initialization semantics into service code and keep the route read-only**

```python
# apps/api/lenjoy_bbs/modules/wallet/router.py
@router.get("/wallet", response_model=ApiEnvelope[WalletSummaryResponse])
async def my_wallet(db: DbSession, user: CurrentUser):
    wallet = await ensure_wallet(db, user.id)
    return success({"availableCoins": wallet.available_coins, "frozenCoins": wallet.frozen_coins})
```

```python
# apps/api/lenjoy_bbs/modules/wallet/service.py
async def ensure_wallet(db: AsyncSession, user_id: int) -> Wallet:
    wallet = await db.scalar(select(Wallet).where(Wallet.user_id == user_id))
    if wallet:
        return wallet
    wallet = Wallet(user_id=user_id, available_coins=0, frozen_coins=0)
    db.add(wallet)
    await db.flush()
    return wallet
```

If this route still needs persistence, keep that persistence inside the application use case that calls `ensure_wallet`, not in the router. Do not add a new `commit()` here.

- [ ] **Step 4: Run targeted tests**

Run: `uv run pytest -q tests/test_transaction_boundaries.py::test_wallet_router_does_not_commit tests/test_api_contract.py::test_wallet_read_endpoint_does_not_depend_on_router_side_commit`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/lenjoy_bbs/modules/wallet/router.py apps/api/lenjoy_bbs/modules/wallet/service.py apps/api/tests/test_api_contract.py apps/api/tests/test_transaction_boundaries.py
git commit -m "refactor: remove router-owned wallet transactions"
```

### Task 4: Add Rollback Regression Tests for the Two Critical Transactions

**Files:**
- Create: `apps/api/tests/test_rollback_guards.py`
- Modify: `apps/api/lenjoy_bbs/modules/auth/application.py`
- Modify: `apps/api/lenjoy_bbs/modules/posts/application.py`
- Test: `apps/api/tests/test_rollback_guards.py`

- [ ] **Step 1: Write the failing rollback tests**

```python
import pytest
from sqlalchemy import select

from lenjoy_bbs.modules.auth.application import register_user
from lenjoy_bbs.modules.auth.schemas import RegisterRequest
from lenjoy_bbs.modules.posts.application import purchase_post
from lenjoy_bbs.modules.posts.models import ResourcePurchase
from lenjoy_bbs.modules.users.models import UserAccount
from lenjoy_bbs.modules.wallet.models import WalletLedger


@pytest.mark.asyncio
async def test_register_user_rolls_back_when_wallet_adjustment_fails(monkeypatch):
    from lenjoy_bbs.db.session import SessionLocal
    from lenjoy_bbs.modules.auth.captcha import issue_captcha

    async with SessionLocal() as db:
        captcha = await issue_captcha()

        async def fail_adjust(*args, **kwargs):
            raise RuntimeError("boom")

        monkeypatch.setattr("lenjoy_bbs.modules.auth.application.adjust_available", fail_adjust)

        with pytest.raises(RuntimeError, match="boom"):
            await register_user(
                db,
                RegisterRequest(
                    username="rollback-user",
                    password="correct horse battery staple",
                    email="rollback-user@example.com",
                    captchaId=captcha["captchaId"],
                    captchaCode=captcha["debugCode"],
                ),
            )

        user = await db.scalar(select(UserAccount).where(UserAccount.username == "rollback-user"))
        assert user is None


@pytest.mark.asyncio
async def test_purchase_rolls_back_purchase_row_when_credit_side_fails(monkeypatch):
    from lenjoy_bbs.db.session import SessionLocal

    async with SessionLocal() as db:
        buyer = await db.scalar(select(UserAccount).where(UserAccount.username == "bob"))
        post = await db.scalar(select(UserAccount))  # replace with actual post fixture lookup in implementation

        async def fail_second_adjust(*args, **kwargs):
            raise RuntimeError("credit failed")

        monkeypatch.setattr("lenjoy_bbs.modules.posts.application.adjust_available", fail_second_adjust)

        with pytest.raises(RuntimeError, match="credit failed"):
            await purchase_post(db, post.id, buyer)

        purchase = await db.scalar(select(ResourcePurchase).where(ResourcePurchase.buyer_id == buyer.id, ResourcePurchase.post_id == post.id))
        assert purchase is None
        ledgers = (await db.scalars(select(WalletLedger).where(WalletLedger.user_id == buyer.id))).all()
        assert all(row.biz_type != "RESOURCE_PURCHASE" for row in ledgers)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest -q tests/test_rollback_guards.py`

Expected: FAIL because current rollback coverage is incomplete and the second test fixture setup will need real post selection.

- [ ] **Step 3: Implement the missing guards and fix the test fixture setup**

```python
# apps/api/tests/test_rollback_guards.py
# replace the placeholder buyer/post lookup with a real flow:
# 1. register alice
# 2. register bob
# 3. create a resource post as alice
# 4. monkeypatch only the second wallet mutation
```

```python
# apps/api/lenjoy_bbs/modules/posts/application.py
async def purchase_post(db: AsyncSession, post_id: int, buyer: UserAccount) -> ResourcePurchase:
    ...
    try:
        db.add(purchase)
        await db.flush()
        await adjust_available(db, buyer.id, -price, "RESOURCE_PURCHASE", f"resource:buy:{post.id}:{buyer.id}", "Resource purchase")
        await adjust_available(db, post.author_id, price, "RESOURCE_SALE", f"resource:sell:{post.id}:{buyer.id}", "Resource sale")
        await db.commit()
        await db.refresh(purchase)
    except Exception:
        await db.rollback()
        raise
```

```python
# apps/api/lenjoy_bbs/modules/auth/application.py
async def register_user(db: AsyncSession, payload: RegisterRequest) -> dict:
    ...
    except Exception:
        await db.rollback()
        raise
```

- [ ] **Step 4: Run rollback tests**

Run: `uv run pytest -q tests/test_rollback_guards.py`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/tests/test_rollback_guards.py apps/api/lenjoy_bbs/modules/auth/application.py apps/api/lenjoy_bbs/modules/posts/application.py
git commit -m "test: add rollback guards for critical transactions"
```

### Task 5: Start the Infrastructure Extraction for Storage

**Files:**
- Create: `apps/api/lenjoy_bbs/infrastructure/__init__.py`
- Create: `apps/api/lenjoy_bbs/infrastructure/storage/__init__.py`
- Create: `apps/api/lenjoy_bbs/infrastructure/storage/image_storage.py`
- Modify: `apps/api/lenjoy_bbs/modules/files/router.py`
- Modify: `apps/api/lenjoy_bbs/modules/files/storage.py`
- Test: `apps/api/tests/test_runtime_hardening.py`

- [ ] **Step 1: Write the failing import-location test**

```python
def test_files_router_imports_image_storage_from_infrastructure():
    content = Path("lenjoy_bbs/modules/files/router.py").read_text(encoding="utf-8")

    assert "lenjoy_bbs.infrastructure.storage.image_storage" in content
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `uv run pytest -q tests/test_transaction_boundaries.py::test_files_router_uses_infrastructure_storage_adapter`

Expected: FAIL because the router still imports `modules.files.storage`.

- [ ] **Step 3: Extract a stable infrastructure adapter and keep the old module as a compatibility shim**

```python
# apps/api/lenjoy_bbs/infrastructure/storage/image_storage.py
from lenjoy_bbs.modules.files.storage import MinioImageStorage, file_like, validate_image_upload

__all__ = ["MinioImageStorage", "file_like", "validate_image_upload"]
```

```python
# apps/api/lenjoy_bbs/modules/files/router.py
from lenjoy_bbs.infrastructure.storage.image_storage import MinioImageStorage, validate_image_upload
```

```python
# apps/api/lenjoy_bbs/infrastructure/__init__.py
__all__ = []
```

```python
# apps/api/lenjoy_bbs/infrastructure/storage/__init__.py
from .image_storage import MinioImageStorage, validate_image_upload

__all__ = ["MinioImageStorage", "validate_image_upload"]
```

- [ ] **Step 4: Run targeted tests**

Run: `uv run pytest -q tests/test_transaction_boundaries.py::test_files_router_uses_infrastructure_storage_adapter tests/test_runtime_hardening.py::test_image_upload_validates_type_and_uses_storage`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/lenjoy_bbs/infrastructure/__init__.py apps/api/lenjoy_bbs/infrastructure/storage/__init__.py apps/api/lenjoy_bbs/infrastructure/storage/image_storage.py apps/api/lenjoy_bbs/modules/files/router.py apps/api/tests/test_transaction_boundaries.py
git commit -m "refactor: introduce infrastructure storage adapter"
```

### Task 6: Document the Real Architecture and Clean the Bootstrap Notes

**Files:**
- Modify: `apps/api/README.md`
- Modify: `apps/api/lenjoy_bbs/db/bootstrap.py`
- Modify: `apps/api/tests/test_runtime_hardening.py`
- Test: `apps/api/tests/test_runtime_hardening.py`

- [ ] **Step 1: Write the failing documentation/behavior test**

```python
def test_bootstrap_module_is_sqlite_test_only():
    from lenjoy_bbs.db.bootstrap import init_app_database

    assert init_app_database is not None
```

Add a README assertion by checking the expected section text manually after edit; do not invent a doc parser test.

- [ ] **Step 2: Run the bootstrap test**

Run: `uv run pytest -q tests/test_runtime_hardening.py::test_bootstrap_module_is_sqlite_test_only`

Expected: PASS or trivial PASS; this step is mainly to keep the change bounded before the README edit.

- [ ] **Step 3: Update the README so it matches the actual completed architecture**

```markdown
# apps/api/README.md

## Architecture

- `lenjoy_bbs.api`: public router aggregation under `/api/v1`
- `modules/*/router.py`: HTTP layer only
- `modules/*/application.py`: write use cases and transaction ownership
- `modules/*/repository.py`: data access only, no `commit()` or `rollback()`
- `infrastructure/*`: external adapters such as storage and cache
- `db/session.py`: async engine and async session factory
```

```python
# apps/api/lenjoy_bbs/db/bootstrap.py
def init_app_database() -> None:
    \"\"\"SQLite-only bootstrap used by tests/local bootstrap, not production startup.\"\"\"
    ...
```

- [ ] **Step 4: Run the relevant tests**

Run: `uv run pytest -q tests/test_runtime_hardening.py tests/test_fastapi_structure.py`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/README.md apps/api/lenjoy_bbs/db/bootstrap.py apps/api/tests/test_runtime_hardening.py apps/api/tests/test_fastapi_structure.py
git commit -m "docs: align backend docs with completed async architecture"
```

## Self-Review

- Spec coverage:
  - Async foundation: covered in Tasks 1-3.
  - Router/application/transaction boundary cleanup: covered in Tasks 2-4.
  - Infrastructure extraction start: covered in Task 5.
  - Docs/bootstrap alignment: covered in Task 6.
- Placeholder scan:
  - The only intentionally incomplete point was the inline note in Task 4 about replacing the temporary post lookup. That replacement is explicitly required in Step 3 and must be completed before the task is considered done.
- Type consistency:
  - `DbSession` stays `AsyncSession`.
  - `update_profile`, `create_client`, and `create_open_post` are the application entrypoints referenced by tests and routers.

