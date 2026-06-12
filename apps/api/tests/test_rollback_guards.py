import pytest
from sqlalchemy import select

from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.db.session import SessionLocal
from lenjoy_bbs.modules.auth import service as auth_service
from lenjoy_bbs.modules.auth.captcha import issue_captcha
from lenjoy_bbs.modules.auth.schemas import RegisterRequest
from lenjoy_bbs.modules.posts import lifecycle as posts_lifecycle
from lenjoy_bbs.modules.posts import resource_trade
from lenjoy_bbs.modules.posts.models import Post, PostTag, ResourcePurchase
from lenjoy_bbs.modules.posts.schemas import PostCreateRequest, PostUpdateRequest
from lenjoy_bbs.modules.taxonomy.models import Tag
from lenjoy_bbs.modules.users.models import UserAccount, UserRole
from lenjoy_bbs.modules.wallet import asset_ledger as wallet_asset_ledger
from lenjoy_bbs.modules.wallet.models import Wallet, WalletLedger


async def _register_account(db, username: str, email: str) -> UserAccount:
    captcha = await issue_captcha()
    await auth_service.register_user(
        db,
        RegisterRequest(
            username=username,
            password="correct-horse-12345",
            email=email,
            captchaId=captcha["captchaId"],
            captchaCode=captcha["debugCode"],
        ),
    )
    user = await db.scalar(
        select(UserAccount).where(UserAccount.username == username))
    assert user is not None
    return user


@pytest.mark.asyncio
async def test_register_user_rolls_back_when_wallet_adjustment_fails(
        monkeypatch):
    observed: dict[str, int | bool] = {
        "user_id": 0,
        "role_seen_before_failure": False,
        "wallet_seen_before_failure": False,
    }

    async def fail_adjust(db, user_id, *args, **kwargs):
        observed["user_id"] = user_id
        user = await db.scalar(
            select(UserAccount).where(UserAccount.username == "rollback-user"))
        role = await db.scalar(
            select(UserRole).where(UserRole.user_id == user_id))
        wallet = await db.scalar(
            select(Wallet).where(Wallet.user_id == user_id))

        assert user is not None
        assert role is not None
        assert wallet is not None

        observed["role_seen_before_failure"] = True
        observed["wallet_seen_before_failure"] = True
        raise RuntimeError("boom")

    monkeypatch.setattr(wallet_asset_ledger, "adjust_available", fail_adjust)

    async with SessionLocal() as db:
        captcha = await issue_captcha()

        with pytest.raises(RuntimeError, match="boom"):
            await auth_service.register_user(
                db,
                RegisterRequest(
                    username="rollback-user",
                    password="correct-horse-12345",
                    email="rollback-user@example.com",
                    captchaId=captcha["captchaId"],
                    captchaCode=captcha["debugCode"],
                ),
            )

    async with SessionLocal() as db:
        user = await db.scalar(
            select(UserAccount).where(UserAccount.username == "rollback-user"))
        user_role = await db.scalar(
            select(UserRole).where(UserRole.user_id == observed["user_id"]))
        wallet = await db.scalar(
            select(Wallet).where(Wallet.user_id == observed["user_id"]))
        ledger = await db.scalar(
            select(WalletLedger).where(
                WalletLedger.user_id == observed["user_id"]))

    assert observed["role_seen_before_failure"] is True
    assert observed["wallet_seen_before_failure"] is True
    assert user is None
    assert user_role is None
    assert wallet is None
    assert ledger is None


@pytest.mark.asyncio
async def test_purchase_post_rolls_back_purchase_and_ledger_when_credit_side_fails(
        monkeypatch):
    async with SessionLocal() as db:
        seller = await _register_account(db, "seller-rollback",
                                         "seller-rollback@example.com")
        buyer = await _register_account(db, "buyer-rollback",
                                        "buyer-rollback@example.com")
        post = await posts_lifecycle.create_post(
            db,
            PostCreateRequest(
                type="RESOURCE",
                title="Rollback resource",
                content="public",
                hiddenContent="secret",
                price=10,
            ),
            seller,
        )

    original_adjust_available = wallet_asset_ledger.adjust_available
    observed = {
        "buyer_debit_seen": False,
        "purchase_seen_before_failure": False,
        "buyer_ledger_staged_before_failure": False,
    }
    purchase_biz_key = f"resource:buy:{post.id}:{buyer.id}"
    sale_biz_key = f"resource:sell:{post.id}:{buyer.id}"

    async def fail_credit_side(db,
                               user_id,
                               delta,
                               biz_type,
                               biz_key,
                               remark,
                               operated_by=None):
        if user_id == buyer.id and biz_type == "RESOURCE_PURCHASE":
            purchase = await db.scalar(
                select(ResourcePurchase).where(
                    ResourcePurchase.buyer_id == buyer.id,
                    ResourcePurchase.post_id == post.id,
                ))
            assert purchase is not None
            observed["buyer_debit_seen"] = True
            return await original_adjust_available(db, user_id, delta,
                                                   biz_type, biz_key, remark,
                                                   operated_by)

        if user_id == seller.id and biz_type == "RESOURCE_SALE":
            purchase = await db.scalar(
                select(ResourcePurchase).where(
                    ResourcePurchase.buyer_id == buyer.id,
                    ResourcePurchase.post_id == post.id,
                ))
            buyer_wallet = await db.scalar(
                select(Wallet).where(Wallet.user_id == buyer.id))
            buyer_ledger_staged = any(
                isinstance(obj, WalletLedger)
                and obj.biz_key == purchase_biz_key
                for obj in db.sync_session.new)

            assert observed["buyer_debit_seen"] is True
            assert purchase is not None
            assert buyer_wallet is not None
            assert buyer_wallet.available_coins == 90
            assert buyer_ledger_staged is True

            observed["purchase_seen_before_failure"] = True
            observed["buyer_ledger_staged_before_failure"] = True
            raise RuntimeError("credit failed")
        return await original_adjust_available(db, user_id, delta, biz_type,
                                               biz_key, remark, operated_by)

    monkeypatch.setattr(wallet_asset_ledger, "adjust_available",
                        fail_credit_side)

    async with SessionLocal() as db:
        buyer = await db.scalar(
            select(UserAccount).where(UserAccount.username == "buyer-rollback")
        )
        assert buyer is not None

        with pytest.raises(RuntimeError, match="credit failed"):
            await resource_trade.purchase_resource_post(db, post.id, buyer)

    async with SessionLocal() as db:
        buyer = await db.scalar(
            select(UserAccount).where(UserAccount.username == "buyer-rollback")
        )
        seller = await db.scalar(
            select(UserAccount).where(
                UserAccount.username == "seller-rollback"))
        assert buyer is not None
        assert seller is not None

        purchase = await db.scalar(
            select(ResourcePurchase).where(
                ResourcePurchase.buyer_id == buyer.id,
                ResourcePurchase.post_id == post.id,
            ))
        purchase_ledger = await db.scalar(
            select(WalletLedger).where(
                WalletLedger.biz_key == purchase_biz_key))
        sale_ledger = await db.scalar(
            select(WalletLedger).where(WalletLedger.biz_key == sale_biz_key))
        buyer_wallet = await db.scalar(
            select(Wallet).where(Wallet.user_id == buyer.id))
        seller_wallet = await db.scalar(
            select(Wallet).where(Wallet.user_id == seller.id))

    assert observed["buyer_debit_seen"] is True
    assert observed["purchase_seen_before_failure"] is True
    assert observed["buyer_ledger_staged_before_failure"] is True
    assert purchase is None
    assert purchase_ledger is None
    assert sale_ledger is None
    assert buyer_wallet is not None
    assert seller_wallet is not None
    assert buyer_wallet.available_coins == 100
    assert seller_wallet.available_coins == 100


@pytest.mark.asyncio
async def test_purchase_post_checks_funds_on_locked_wallet(monkeypatch):
    async with SessionLocal() as db:
        seller = await _register_account(db, "seller-locked-wallet",
                                         "seller-locked-wallet@example.com")
        buyer = await _register_account(db, "buyer-locked-wallet",
                                        "buyer-locked-wallet@example.com")
        post = await posts_lifecycle.create_post(
            db,
            PostCreateRequest(
                type="RESOURCE",
                title="Locked wallet resource",
                content="public",
                hiddenContent="secret",
                price=10,
            ),
            seller,
        )

    class LockedWallet:
        available_coins = 0

    observed = {"lock_wallet_called": False, "adjust_available_called": False}

    async def fake_lock_wallet(db, user_id):
        assert user_id == buyer.id
        observed["lock_wallet_called"] = True
        return LockedWallet()

    async def fail_adjust_available(*args, **kwargs):
        observed["adjust_available_called"] = True
        raise AssertionError(
            "adjust_available should not be called when locked wallet lacks funds"
        )

    monkeypatch.setattr(wallet_asset_ledger, "lock_wallet", fake_lock_wallet)
    monkeypatch.setattr(wallet_asset_ledger, "adjust_available",
                        fail_adjust_available)

    async with SessionLocal() as db:
        buyer = await db.scalar(
            select(UserAccount).where(
                UserAccount.username == "buyer-locked-wallet"))
        assert buyer is not None

        with pytest.raises(ApiError, match="金币余额不足"):
            await resource_trade.purchase_resource_post(db, post.id, buyer)

    assert observed["lock_wallet_called"] is True
    assert observed["adjust_available_called"] is False


@pytest.mark.asyncio
async def test_create_post_rolls_back_when_tag_validation_fails():
    async with SessionLocal() as db:
        author = await _register_account(db, "tag-rollback-author",
                                         "tag-rollback-author@example.com")

        with pytest.raises(ApiError, match="一个或多个标签不存在"):
            await posts_lifecycle.create_post(
                db,
                PostCreateRequest(
                    type="NORMAL",
                    title="Invalid tags create",
                    content="body",
                    tagIds=[999999],
                ),
                author,
            )

    async with SessionLocal() as db:
        post = await db.scalar(
            select(Post).where(Post.title == "Invalid tags create"))

    assert post is None


@pytest.mark.asyncio
async def test_bounty_create_post_rolls_back_when_wallet_freeze_fails(
        monkeypatch):
    async with SessionLocal() as db:
        author = await _register_account(
            db, "bounty-freeze-rollback-author",
            "bounty-freeze-rollback-author@example.com")

    observed = {
        "post_staged_before_failure": False,
    }

    async def fail_freeze(db, author_id, post_id, bounty_amount):
        staged_post = await db.scalar(
            select(Post).where(Post.title == "Rollback bounty create"))
        assert staged_post is not None
        assert staged_post.post_type == "BOUNTY"
        assert staged_post.author_id == author_id
        assert staged_post.id == post_id
        assert bounty_amount == 5
        observed["post_staged_before_failure"] = True
        raise RuntimeError("freeze failed")

    monkeypatch.setattr(posts_lifecycle, "reserve_bounty_funds", fail_freeze)

    async with SessionLocal() as db:
        author = await db.scalar(
            select(UserAccount).where(
                UserAccount.username == "bounty-freeze-rollback-author"))
        assert author is not None

        with pytest.raises(RuntimeError, match="freeze failed"):
            await posts_lifecycle.create_post(
                db,
                PostCreateRequest(
                    type="BOUNTY",
                    title="Rollback bounty create",
                    content="body",
                    bountyAmount=5,
                    bountyExpireAt="2026-06-01T12:00:00Z",
                ),
                author,
            )

    async with SessionLocal() as db:
        author = await db.scalar(
            select(UserAccount).where(
                UserAccount.username == "bounty-freeze-rollback-author"))
        assert author is not None

        post = await db.scalar(
            select(Post).where(Post.title == "Rollback bounty create"))
        reserve_ledger = await db.scalar(
            select(WalletLedger).where(
                WalletLedger.user_id == author.id,
                WalletLedger.biz_type == "BOUNTY_RESERVE"))
        wallet = await db.scalar(
            select(Wallet).where(Wallet.user_id == author.id))

    assert observed["post_staged_before_failure"] is True
    assert post is None
    assert reserve_ledger is None
    assert wallet is not None
    assert wallet.available_coins == 100
    assert wallet.frozen_coins == 0


@pytest.mark.asyncio
async def test_update_post_rolls_back_when_tag_validation_fails():
    async with SessionLocal() as db:
        author = await _register_account(db, "tag-update-author",
                                         "tag-update-author@example.com")
        valid_tag_ids = list(
            (await
             db.scalars(select(Tag.id).order_by(Tag.id.asc()).limit(1))).all())
        assert len(valid_tag_ids) == 1
        post = await posts_lifecycle.create_post(
            db,
            PostCreateRequest(
                type="NORMAL",
                title="Before invalid update",
                content="body",
                tagIds=valid_tag_ids,
            ),
            author,
        )
        post_id = post.id

        with pytest.raises(ApiError, match="一个或多个标签不存在"):
            await posts_lifecycle.update_post(
                db,
                post_id,
                PostUpdateRequest(
                    title="After invalid update",
                    tagIds=[999999],
                ),
                author,
            )

    async with SessionLocal() as db:
        stored_post = await db.get(Post, post_id)
        stored_tag_ids = list((await db.scalars(
            select(PostTag.tag_id).where(PostTag.post_id == post_id))).all())

    assert stored_post is not None
    assert stored_post.title == "Before invalid update"
    assert stored_tag_ids == valid_tag_ids
