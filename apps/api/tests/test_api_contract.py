import asyncio
import os
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, func, select

os.environ["DATABASE_URL"] = "sqlite://"

from lenjoy_bbs.main import app
from lenjoy_bbs.core.tokens import create_access_token
from lenjoy_bbs.db.session import SessionLocal
from lenjoy_bbs.modules.messages.models import SiteMessage
from lenjoy_bbs.modules.posts.models import Post, PostComment, PostFavorite, PostLike, PostTag
from lenjoy_bbs.modules.reports.models import BountyDeleteRequest, PostReport, ResourceAppeal
from lenjoy_bbs.modules.taxonomy.models import Category, Tag
from lenjoy_bbs.modules.users.models import Role, UserAccount, UserRole
from lenjoy_bbs.modules.wallet.models import Wallet

API_PREFIX = "/api/v1"


def future_utc_timestamp() -> str:
    return (datetime.now(UTC) + timedelta(days=1)).replace(
        microsecond=0).isoformat().replace("+00:00", "Z")


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
            "password": "correct-horse-12345",
            "email": email,
            "captchaId": captcha["captchaId"],
            "captchaCode": captcha["debugCode"],
        },
    )

    payload = unwrap(response)
    assert response.status_code == 201
    assert payload["error"] is None
    assert payload["data"]["user"]["username"] == username
    assert payload["data"]["user"]["nickname"] == username
    return payload["data"]["accessToken"]


def register_admin_user(client: TestClient, username: str, email: str) -> str:
    register_user(client, username, email)

    async def _promote() -> str:
        async with SessionLocal() as db:
            user = await db.scalar(
                select(UserAccount).where(UserAccount.username == username))
            role = await db.scalar(select(Role).where(Role.role_code == "ADMIN"))
            assert user is not None
            assert role is not None
            db.add(UserRole(user_id=user.id, role_id=role.id))
            await db.commit()
            return create_access_token(user, ["ADMIN"])

    return asyncio.run(_promote())


def remove_wallet(username: str) -> None:

    async def _remove() -> None:
        async with SessionLocal() as db:
            user_id = await db.scalar(
                select(UserAccount.id).where(UserAccount.username == username))
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


def test_posts_list_exposes_pagination_in_data(client):
    token = register_user(client, "pagination-author",
                          "pagination-author@example.com")

    create_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(token),
        json={
            "type": "NORMAL",
            "title": "Paginated post",
            "content": "body",
        },
    )
    assert create_response.status_code == 201

    response = client.get(f"{API_PREFIX}/posts?page=1&pageSize=5")
    payload = unwrap(response)

    assert response.status_code == 200
    assert payload["error"] is None
    assert isinstance(payload["data"]["items"], list)
    assert payload["data"]["page"] == 1
    assert payload["data"]["pageSize"] == 5
    assert isinstance(payload["data"]["total"], int)
    assert isinstance(payload["data"]["totalPages"], int)
    assert isinstance(payload["data"]["hasNext"], bool)
    assert isinstance(payload["data"]["hasPrevious"], bool)
    assert payload["meta"]["apiVersion"] == "v1"
    assert "page" not in payload["meta"]
    assert "pageSize" not in payload["meta"]
    assert "total" not in payload["meta"]


def test_posts_create_accepts_post_type_alias(client):
    token = register_user(client, "posttype-alias-author",
                          "posttype-alias-author@example.com")

    create_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(token),
        json={
            "postType": "RESOURCE",
            "title": "Aliased resource post",
            "content": "body",
            "hiddenContent": "secret",
            "price": 8,
        },
    )
    create_payload = unwrap(create_response)
    assert create_response.status_code == 201
    assert create_payload["error"] is None
    assert create_payload["data"]["authorUsername"] == "posttype-alias-author"
    assert create_payload["data"]["postType"] == "RESOURCE"

    list_payload = unwrap(
        client.get(f"{API_PREFIX}/posts?page=1&pageSize=10&postType=RESOURCE"))
    assert {item["authorUsername"]
            for item in list_payload["data"]["items"]
            } == {"posttype-alias-author"}
    assert {item["id"]
            for item in list_payload["data"]["items"]
            } >= {create_payload["data"]["id"]}


def test_posts_list_filters_by_post_type(client):
    token = register_user(client, "typed-feed-author",
                          "typed-feed-author@example.com")

    for post_type in ["NORMAL", "RESOURCE", "BOUNTY"]:
        create_response = client.post(
            f"{API_PREFIX}/posts",
            headers=bearer(token),
            json={
                "type": post_type,
                "title": f"{post_type} post",
                "content": "body",
            },
        )
        assert create_response.status_code == 201

    normal_payload = unwrap(
        client.get(f"{API_PREFIX}/posts?page=1&pageSize=10&postType=NORMAL"))
    resource_payload = unwrap(
        client.get(f"{API_PREFIX}/posts?page=1&pageSize=10&postType=RESOURCE"))
    bounty_payload = unwrap(
        client.get(f"{API_PREFIX}/posts?page=1&pageSize=10&postType=BOUNTY"))

    assert normal_payload["error"] is None
    assert resource_payload["error"] is None
    assert bounty_payload["error"] is None
    assert {item["postType"]
            for item in normal_payload["data"]["items"]} == {"NORMAL"}
    assert {item["postType"]
            for item in resource_payload["data"]["items"]} == {"RESOURCE"}
    assert {item["postType"]
            for item in bounty_payload["data"]["items"]} == {"BOUNTY"}


def test_posts_keyword_search_matches_title_and_public_content(client):
    token = register_user(client, "search-author",
                          "search-author@example.com")

    title_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(token),
        json={
            "postType": "NORMAL",
            "title": "Need help with Redis streams",
            "content": "general body",
        },
    )
    content_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(token),
        json={
            "postType": "RESOURCE",
            "title": "Backend note",
            "content": "This public body mentions searchable-marker.",
            "hiddenContent": "private download",
            "price": 3,
        },
    )
    other_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(token),
        json={
            "postType": "BOUNTY",
            "title": "Unrelated question",
            "content": "different body",
            "bountyAmount": 5,
            "bountyExpireAt": "2026-06-01T12:00:00Z",
        },
    )
    assert title_response.status_code == 201
    assert content_response.status_code == 201
    assert other_response.status_code == 201

    title_id = unwrap(title_response)["data"]["id"]
    content_id = unwrap(content_response)["data"]["id"]
    other_id = unwrap(other_response)["data"]["id"]

    title_payload = unwrap(
        client.get(f"{API_PREFIX}/posts?page=1&pageSize=20&keyword=redis"))
    title_ids = {item["id"] for item in title_payload["data"]["items"]}
    assert title_id in title_ids
    assert content_id not in title_ids
    assert other_id not in title_ids

    content_payload = unwrap(
        client.get(
            f"{API_PREFIX}/posts?page=1&pageSize=20&keyword=searchable-marker"
        ))
    content_ids = {item["id"] for item in content_payload["data"]["items"]}
    assert content_id in content_ids
    assert title_id not in content_ids
    assert other_id not in content_ids


def test_posts_keyword_search_excludes_hidden_content(client):
    token = register_user(client, "hidden-search-author",
                          "hidden-search-author@example.com")

    create_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(token),
        json={
            "postType": "RESOURCE",
            "title": "Public title",
            "content": "public body",
            "hiddenContent": "hidden-only-needle",
            "price": 7,
        },
    )
    assert create_response.status_code == 201
    post_id = unwrap(create_response)["data"]["id"]

    payload = unwrap(
        client.get(
            f"{API_PREFIX}/posts?page=1&pageSize=20&keyword=hidden-only-needle"
        ))

    assert post_id not in {item["id"] for item in payload["data"]["items"]}


def test_posts_keyword_search_combines_with_post_type(client):
    token = register_user(client, "typed-search-author",
                          "typed-search-author@example.com")

    normal_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(token),
        json={
            "postType": "NORMAL",
            "title": "Shared keyword",
            "content": "body",
        },
    )
    resource_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(token),
        json={
            "postType": "RESOURCE",
            "title": "Shared keyword",
            "content": "body",
            "hiddenContent": "download",
            "price": 4,
        },
    )
    assert normal_response.status_code == 201
    assert resource_response.status_code == 201

    normal_id = unwrap(normal_response)["data"]["id"]
    resource_id = unwrap(resource_response)["data"]["id"]

    payload = unwrap(
        client.get(
            f"{API_PREFIX}/posts?page=1&pageSize=20&keyword=shared&postType=RESOURCE"
        ))
    ids = {item["id"] for item in payload["data"]["items"]}

    assert resource_id in ids
    assert normal_id not in ids
    assert {item["postType"] for item in payload["data"]["items"]} == {
        "RESOURCE"
    }


def test_posts_keyword_search_excludes_deleted_and_offline_posts(client):
    token = register_user(client, "visibility-search-author",
                          "visibility-search-author@example.com")

    published_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(token),
        json={
            "postType": "NORMAL",
            "title": "visible-search-keyword",
            "content": "body",
        },
    )
    offline_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(token),
        json={
            "postType": "NORMAL",
            "title": "offline-search-keyword",
            "content": "body",
        },
    )
    deleted_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(token),
        json={
            "postType": "NORMAL",
            "title": "deleted-search-keyword",
            "content": "body",
        },
    )
    assert published_response.status_code == 201
    assert offline_response.status_code == 201
    assert deleted_response.status_code == 201

    published_id = unwrap(published_response)["data"]["id"]
    offline_id = unwrap(offline_response)["data"]["id"]
    deleted_id = unwrap(deleted_response)["data"]["id"]

    async def hide_posts() -> None:
        async with SessionLocal() as db:
            from lenjoy_bbs.modules.posts.models import Post

            offline_post = await db.get(Post, offline_id)
            deleted_post = await db.get(Post, deleted_id)
            offline_post.status = "OFFLINE"
            deleted_post.is_deleted = True
            await db.commit()

    asyncio.run(hide_posts())

    payload = unwrap(
        client.get(f"{API_PREFIX}/posts?page=1&pageSize=20&keyword=search-keyword"))
    ids = {item["id"] for item in payload["data"]["items"]}

    assert published_id in ids
    assert offline_id not in ids
    assert deleted_id not in ids


def test_posts_keyword_whitespace_behaves_like_no_keyword(client):
    token = register_user(client, "blank-search-author",
                          "blank-search-author@example.com")

    create_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(token),
        json={
            "postType": "NORMAL",
            "title": "Blank keyword visible",
            "content": "body",
        },
    )
    assert create_response.status_code == 201
    post_id = unwrap(create_response)["data"]["id"]

    payload = unwrap(
        client.get(f"{API_PREFIX}/posts?page=1&pageSize=20&keyword=%20%20%20"))

    assert post_id in {item["id"] for item in payload["data"]["items"]}

    overlong_blank_payload = unwrap(
        client.get(f"{API_PREFIX}/posts?page=1&pageSize=20",
                   params={"keyword": " " * 101}))
    assert post_id in {
        item["id"]
        for item in overlong_blank_payload["data"]["items"]
    }


def test_posts_keyword_rejects_overlong_value(client):
    keyword = "x" * 101

    response = client.get(
        f"{API_PREFIX}/posts?page=1&pageSize=20&keyword={keyword}")

    assert response.status_code == 422


def test_posts_list_exposes_interaction_counts_for_all_post_types(client):
    author_token = register_user(client, "stats-author",
                                 "stats-author@example.com")
    liker_token = register_user(client, "stats-liker",
                                "stats-liker@example.com")

    created_posts: dict[str, int] = {}
    for post_type in ["NORMAL", "RESOURCE", "BOUNTY"]:
        create_response = client.post(
            f"{API_PREFIX}/posts",
            headers=bearer(author_token),
            json={
                "postType":
                post_type,
                "title":
                f"{post_type} stats post",
                "content":
                "body",
                **({
                    "hiddenContent": "secret",
                    "price": 8
                } if post_type == "RESOURCE" else {}),
            },
        )
        create_payload = unwrap(create_response)
        assert create_response.status_code == 201
        created_posts[post_type] = create_payload["data"]["id"]

    for post_id in created_posts.values():
        comment_response = client.post(
            f"{API_PREFIX}/posts/{post_id}/comments",
            headers=bearer(liker_token),
            json={"content": "Count me in."},
        )
        assert comment_response.status_code == 201

    async def seed_post_interactions() -> None:
        async with SessionLocal() as db:
            liker_id = await db.scalar(
                select(UserAccount.id).where(
                    UserAccount.username == "stats-liker"))
            assert liker_id is not None
            for post_id in created_posts.values():
                db.add(PostLike(post_id=post_id, user_id=liker_id))
                db.add(PostFavorite(post_id=post_id, user_id=liker_id))
            await db.commit()

    asyncio.run(seed_post_interactions())

    all_payload = unwrap(client.get(f"{API_PREFIX}/posts?page=1&pageSize=20"))
    indexed_items = {item["id"]: item for item in all_payload["data"]["items"]}
    for post_id in created_posts.values():
        item = indexed_items[post_id]
        assert item["viewCount"] == 0
        assert item["commentCount"] == 1
        assert item["likeCount"] == 1
        assert item["collectCount"] == 1

    for post_type, post_id in created_posts.items():
        filtered_payload = unwrap(
            client.get(
                f"{API_PREFIX}/posts?page=1&pageSize=20&postType={post_type}"))
        item = next(entry for entry in filtered_payload["data"]["items"]
                    if entry["id"] == post_id)
        assert item["commentCount"] == 1
        assert item["likeCount"] == 1
        assert item["collectCount"] == 1


def test_post_views_are_deduped_within_the_same_visitor_window(client):
    author_token = register_user(client, "view-author",
                                 "view-author@example.com")

    create_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(author_token),
        json={
            "postType": "NORMAL",
            "title": "Viewed post",
            "content": "body",
        },
    )
    create_payload = unwrap(create_response)
    assert create_response.status_code == 201
    post_id = create_payload["data"]["id"]

    first_view = client.post(
        f"{API_PREFIX}/posts/{post_id}/views",
        headers={"X-Visitor-Id": "visitor-a"},
    )
    first_payload = unwrap(first_view)
    assert first_view.status_code == 200
    assert first_payload["data"]["postId"] == post_id
    assert first_payload["data"]["viewCount"] == 1

    second_view = client.post(
        f"{API_PREFIX}/posts/{post_id}/views",
        headers={"X-Visitor-Id": "visitor-a"},
    )
    second_payload = unwrap(second_view)
    assert second_view.status_code == 200
    assert second_payload["data"]["viewCount"] == 1

    third_view = client.post(
        f"{API_PREFIX}/posts/{post_id}/views",
        headers={"X-Visitor-Id": "visitor-b"},
    )
    third_payload = unwrap(third_view)
    assert third_view.status_code == 200
    assert third_payload["data"]["viewCount"] == 2

    detail_payload = unwrap(client.get(f"{API_PREFIX}/posts/{post_id}"))
    assert detail_payload["data"]["viewCount"] == 2

    list_payload = unwrap(client.get(f"{API_PREFIX}/posts?page=1&pageSize=20"))
    item = next(entry for entry in list_payload["data"]["items"]
                if entry["id"] == post_id)
    assert item["viewCount"] == 2


def test_post_like_toggle_endpoint_updates_count(client):
    author_token = register_user(client, "like-author",
                                 "like-author@example.com")
    liker_token = register_user(client, "like-user", "like-user@example.com")

    create_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(author_token),
        json={
            "postType": "NORMAL",
            "title": "Likable post",
            "content": "body",
        },
    )
    create_payload = unwrap(create_response)
    assert create_response.status_code == 201
    post_id = create_payload["data"]["id"]

    first_toggle = client.post(f"{API_PREFIX}/posts/{post_id}/likes/toggle",
                               headers=bearer(liker_token))
    first_payload = unwrap(first_toggle)
    assert first_toggle.status_code == 200
    assert first_payload["data"] == {"active": True, "count": 1}

    second_toggle = client.post(f"{API_PREFIX}/posts/{post_id}/likes/toggle",
                                headers=bearer(liker_token))
    second_payload = unwrap(second_toggle)
    assert second_toggle.status_code == 200
    assert second_payload["data"] == {"active": False, "count": 0}


def test_comment_like_toggle_endpoint_updates_counts_and_viewer_state(client):
    author_token = register_user(client, "comment-like-author",
                                 "comment-like-author@example.com")
    commenter_token = register_user(client, "comment-like-commenter",
                                    "comment-like-commenter@example.com")
    liker_token = register_user(client, "comment-like-user",
                                "comment-like-user@example.com")

    create_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(author_token),
        json={
            "postType": "NORMAL",
            "title": "Comment likable post",
            "content": "body",
        },
    )
    post_id = unwrap(create_response)["data"]["id"]
    comment_response = client.post(
        f"{API_PREFIX}/posts/{post_id}/comments",
        headers=bearer(commenter_token),
        json={"content": "A useful comment."},
    )
    comment_id = unwrap(comment_response)["data"]["id"]
    reply_response = client.post(
        f"{API_PREFIX}/posts/{post_id}/comments",
        headers=bearer(liker_token),
        json={
            "parentId": comment_id,
            "content": "A nested reply.",
        },
    )
    reply_id = unwrap(reply_response)["data"]["id"]

    first_toggle = client.post(
        f"{API_PREFIX}/comments/{comment_id}/likes/toggle",
        headers=bearer(liker_token),
    )
    second_toggle = client.post(
        f"{API_PREFIX}/comments/{comment_id}/likes/toggle",
        headers=bearer(liker_token),
    )
    third_toggle = client.post(
        f"{API_PREFIX}/comments/{comment_id}/likes/toggle",
        headers=bearer(liker_token),
    )
    reply_toggle = client.post(
        f"{API_PREFIX}/comments/{reply_id}/likes/toggle",
        headers=bearer(commenter_token),
    )

    assert first_toggle.status_code == 200
    assert unwrap(first_toggle)["data"] == {"active": True, "count": 1}
    assert second_toggle.status_code == 200
    assert unwrap(second_toggle)["data"] == {"active": False, "count": 0}
    assert third_toggle.status_code == 200
    assert unwrap(third_toggle)["data"] == {"active": True, "count": 1}
    assert reply_toggle.status_code == 200
    assert unwrap(reply_toggle)["data"] == {"active": True, "count": 1}

    liker_view = unwrap(
        client.get(f"{API_PREFIX}/posts/{post_id}/comments",
                   headers=bearer(liker_token)))["data"]
    commenter_view = unwrap(
        client.get(f"{API_PREFIX}/posts/{post_id}/comments",
                   headers=bearer(commenter_token)))["data"]

    assert liker_view[0]["id"] == comment_id
    assert liker_view[0]["likeCount"] == 1
    assert liker_view[0]["liked"] is True
    assert liker_view[0]["replies"][0]["id"] == reply_id
    assert liker_view[0]["replies"][0]["likeCount"] == 1
    assert liker_view[0]["replies"][0]["liked"] is False
    assert commenter_view[0]["likeCount"] == 1
    assert commenter_view[0]["liked"] is False
    assert commenter_view[0]["replies"][0]["likeCount"] == 1
    assert commenter_view[0]["replies"][0]["liked"] is True


def test_comment_like_rejects_missing_or_deleted_comment(client):
    author_token = register_user(client, "comment-like-delete-author",
                                 "comment-like-delete-author@example.com")
    liker_token = register_user(client, "comment-like-delete-user",
                                "comment-like-delete-user@example.com")

    create_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(author_token),
        json={
            "postType": "NORMAL",
            "title": "Deleted comment like post",
            "content": "body",
        },
    )
    post_id = unwrap(create_response)["data"]["id"]
    comment_response = client.post(
        f"{API_PREFIX}/posts/{post_id}/comments",
        headers=bearer(author_token),
        json={"content": "Comment to delete."},
    )
    comment_id = unwrap(comment_response)["data"]["id"]

    async def mark_deleted() -> None:
        async with SessionLocal() as db:
            comment = await db.get(PostComment, comment_id)
            assert comment is not None
            comment.is_deleted = True
            await db.commit()

    asyncio.run(mark_deleted())

    missing_response = client.post(
        f"{API_PREFIX}/comments/999999/likes/toggle",
        headers=bearer(liker_token),
    )
    deleted_response = client.post(
        f"{API_PREFIX}/comments/{comment_id}/likes/toggle",
        headers=bearer(liker_token),
    )

    assert missing_response.status_code == 404
    assert unwrap(missing_response)["error"]["code"] == "COMMENT_NOT_FOUND"
    assert deleted_response.status_code == 404
    assert unwrap(deleted_response)["error"]["code"] == "COMMENT_NOT_FOUND"


def test_bounty_post_detail_exposes_bounty_fields(client):
    author_token = register_user(client, "bounty-detail-author",
                                 "bounty-detail-author@example.com")

    create_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(author_token),
        json={
            "postType": "BOUNTY",
            "title": "Need a debugging answer",
            "content": "body",
            "bountyAmount": 25,
            "bountyExpireAt": "2026-06-01T12:00:00Z",
        },
    )
    create_payload = unwrap(create_response)
    assert create_response.status_code == 201
    post_id = create_payload["data"]["id"]

    detail_response = client.get(f"{API_PREFIX}/posts/{post_id}")
    detail_payload = unwrap(detail_response)

    assert detail_response.status_code == 200
    assert detail_payload["data"]["postType"] == "BOUNTY"
    assert detail_payload["data"]["bountyAmount"] == 25
    assert detail_payload["data"]["bountyStatus"] == "ACTIVE"
    assert detail_payload["data"]["bountyExpireAt"] is not None
    assert detail_payload["data"]["acceptedCommentId"] is None


def test_bounty_post_creation_freezes_wallet_balance(client):
    author_token = register_user(client, "bounty-freeze-author",
                                 "bounty-freeze-author@example.com")

    create_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(author_token),
        json={
            "postType": "BOUNTY",
            "title": "Need a frozen bounty",
            "content": "question body",
            "bountyAmount": 25,
            "bountyExpireAt": "2026-06-01T12:00:00Z",
        },
    )
    create_payload = unwrap(create_response)
    wallet_payload = unwrap(
        client.get(f"{API_PREFIX}/users/me/wallet",
                   headers=bearer(author_token)))

    assert create_response.status_code == 201
    assert create_payload["data"]["bountyStatus"] == "ACTIVE"
    assert wallet_payload["data"]["availableCoins"] == 75
    assert wallet_payload["data"]["frozenCoins"] == 25
    assert wallet_payload["data"]["totalCoins"] == 100


def test_deleting_active_bounty_refunds_frozen_balance(client):
    author_token = register_user(client, "bounty-delete-author",
                                 "bounty-delete-author@example.com")

    create_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(author_token),
        json={
            "postType": "BOUNTY",
            "title": "Delete unused bounty",
            "content": "question body",
            "bountyAmount": 25,
            "bountyExpireAt": "2026-06-01T12:00:00Z",
        },
    )
    post_id = unwrap(create_response)["data"]["id"]

    delete_response = client.delete(f"{API_PREFIX}/posts/{post_id}",
                                    headers=bearer(author_token))
    wallet_payload = unwrap(
        client.get(f"{API_PREFIX}/users/me/wallet",
                   headers=bearer(author_token)))

    assert delete_response.status_code == 200
    assert wallet_payload["data"]["availableCoins"] == 100
    assert wallet_payload["data"]["frozenCoins"] == 0
    assert wallet_payload["data"]["totalCoins"] == 100


def test_deleting_active_bounty_with_missing_reserve_does_not_block_delete(client):
    author_token = register_user(client, "bounty-delete-missing-reserve",
                                 "bounty-delete-missing-reserve@example.com")

    create_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(author_token),
        json={
            "postType": "BOUNTY",
            "title": "Delete bounty with missing reserve",
            "content": "question body",
            "bountyAmount": 25,
            "bountyExpireAt": "2026-06-01T12:00:00Z",
        },
    )
    post_id = unwrap(create_response)["data"]["id"]

    async def remove_frozen_reserve():
        async with SessionLocal() as db:
            user = await db.scalar(
                select(UserAccount).where(
                    UserAccount.username == "bounty-delete-missing-reserve"))
            wallet = await db.scalar(
                select(Wallet).where(Wallet.user_id == user.id))
            wallet.frozen_coins = 0
            await db.commit()

    asyncio.run(remove_frozen_reserve())

    delete_response = client.delete(f"{API_PREFIX}/posts/{post_id}",
                                    headers=bearer(author_token))
    wallet_payload = unwrap(
        client.get(f"{API_PREFIX}/users/me/wallet",
                   headers=bearer(author_token)))

    assert delete_response.status_code == 200
    assert wallet_payload["data"]["availableCoins"] == 75
    assert wallet_payload["data"]["frozenCoins"] == 0


def test_bounty_with_other_user_answer_requires_delete_review(client):
    author_token = register_user(client, "bounty-delete-review-author",
                                 "bounty-delete-review-author@example.com")
    answerer_token = register_user(client, "bounty-delete-review-answerer",
                                   "bounty-delete-review-answerer@example.com")

    create_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(author_token),
        json={
            "postType": "BOUNTY",
            "title": "Delete review bounty",
            "content": "question body",
            "bountyAmount": 25,
            "bountyExpireAt": "2026-06-01T12:00:00Z",
        },
    )
    post_id = unwrap(create_response)["data"]["id"]

    answer_response = client.post(
        f"{API_PREFIX}/posts/{post_id}/comments",
        headers=bearer(answerer_token),
        json={"content": "candidate answer"},
    )
    assert answer_response.status_code == 201

    delete_response = client.delete(f"{API_PREFIX}/posts/{post_id}",
                                    headers=bearer(author_token))
    delete_payload = unwrap(delete_response)
    wallet_payload = unwrap(
        client.get(f"{API_PREFIX}/users/me/wallet",
                   headers=bearer(author_token)))
    detail_payload = unwrap(
        client.get(f"{API_PREFIX}/posts/{post_id}",
                   headers=bearer(author_token)))

    assert delete_response.status_code == 400
    assert delete_payload["error"]["code"] == "BOUNTY_DELETE_REQUIRES_REVIEW"
    assert detail_payload["data"]["id"] == post_id
    assert wallet_payload["data"]["availableCoins"] == 75
    assert wallet_payload["data"]["frozenCoins"] == 25


def test_bounty_author_own_top_level_comment_does_not_block_delete(client):
    author_token = register_user(client, "bounty-delete-own-comment",
                                 "bounty-delete-own-comment@example.com")

    create_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(author_token),
        json={
            "postType": "BOUNTY",
            "title": "Own comment bounty",
            "content": "question body",
            "bountyAmount": 25,
            "bountyExpireAt": "2026-06-01T12:00:00Z",
        },
    )
    post_id = unwrap(create_response)["data"]["id"]

    comment_response = client.post(
        f"{API_PREFIX}/posts/{post_id}/comments",
        headers=bearer(author_token),
        json={"content": "author clarification"},
    )
    assert comment_response.status_code == 201

    delete_response = client.delete(f"{API_PREFIX}/posts/{post_id}",
                                    headers=bearer(author_token))

    assert delete_response.status_code == 200


def test_bounty_other_user_reply_does_not_block_delete(client):
    author_token = register_user(client, "bounty-delete-reply-author",
                                 "bounty-delete-reply-author@example.com")
    replier_token = register_user(client, "bounty-delete-reply-user",
                                  "bounty-delete-reply-user@example.com")

    create_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(author_token),
        json={
            "postType": "BOUNTY",
            "title": "Reply only bounty",
            "content": "question body",
            "bountyAmount": 25,
            "bountyExpireAt": "2026-06-01T12:00:00Z",
        },
    )
    post_id = unwrap(create_response)["data"]["id"]

    parent_response = client.post(
        f"{API_PREFIX}/posts/{post_id}/comments",
        headers=bearer(author_token),
        json={"content": "author clarification"},
    )
    parent_id = unwrap(parent_response)["data"]["id"]

    reply_response = client.post(
        f"{API_PREFIX}/posts/{post_id}/comments",
        headers=bearer(replier_token),
        json={"parentId": parent_id, "content": "reply only"},
    )
    assert reply_response.status_code == 201

    delete_response = client.delete(f"{API_PREFIX}/posts/{post_id}",
                                    headers=bearer(author_token))

    assert delete_response.status_code == 200


def create_bounty_post_with_external_answer(client, author_token: str,
                                            answerer_token: str,
                                            title: str) -> int:
    create_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(author_token),
        json={
            "postType": "BOUNTY",
            "title": title,
            "content": "question body",
            "bountyAmount": 25,
            "bountyExpireAt": future_utc_timestamp(),
        },
    )
    post_id = unwrap(create_response)["data"]["id"]

    answer_response = client.post(
        f"{API_PREFIX}/posts/{post_id}/comments",
        headers=bearer(answerer_token),
        json={"content": "candidate answer"},
    )
    assert answer_response.status_code == 201
    return post_id


def test_bounty_author_delete_request_does_not_create_report(client):
    author_token = register_user(client, "bounty-request-author",
                                 "bounty-request-author@example.com")
    answerer_token = register_user(client, "bounty-request-answerer",
                                   "bounty-request-answerer@example.com")
    post_id = create_bounty_post_with_external_answer(
        client, author_token, answerer_token, "Delete request bounty")

    response = client.post(
        f"{API_PREFIX}/posts/{post_id}/bounty-delete-requests",
        headers=bearer(author_token),
        json={"reason": "question duplicated"},
    )
    assert response.status_code == 201
    payload = unwrap(response)
    assert payload["data"]["postId"] == post_id
    assert payload["data"]["status"] == "PENDING"

    async def inspect_rows() -> tuple[int, int]:
        async with SessionLocal() as session:
            request_count = await session.scalar(
                select(func.count()).select_from(BountyDeleteRequest))
            report_count = await session.scalar(
                select(func.count()).select_from(PostReport))
            return request_count or 0, report_count or 0

    request_count, report_count = asyncio.run(inspect_rows())
    assert request_count == 1
    assert report_count == 0


def test_bounty_delete_request_rejects_non_author(client):
    author_token = register_user(client, "bounty-request-non-author-owner",
                                 "bounty-request-non-author-owner@example.com")
    answerer_token = register_user(
        client, "bounty-non-author-answerer",
        "bounty-request-non-author-answerer@example.com")
    other_token = register_user(client, "bounty-request-non-author",
                                "bounty-request-non-author@example.com")
    post_id = create_bounty_post_with_external_answer(
        client, author_token, answerer_token, "Non-author request bounty")

    response = client.post(
        f"{API_PREFIX}/posts/{post_id}/bounty-delete-requests",
        headers=bearer(other_token),
        json={"reason": "not my post"},
    )
    payload = unwrap(response)

    assert response.status_code == 403
    assert payload["error"]["code"] == "FORBIDDEN"


def test_bounty_delete_request_rejects_non_bounty_post(client):
    author_token = register_user(client, "bounty-request-normal-author",
                                 "bounty-request-normal-author@example.com")

    create_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(author_token),
        json={
            "postType": "NORMAL",
            "title": "Normal delete request",
            "content": "body",
        },
    )
    post_id = unwrap(create_response)["data"]["id"]

    response = client.post(
        f"{API_PREFIX}/posts/{post_id}/bounty-delete-requests",
        headers=bearer(author_token),
        json={"reason": "not a bounty"},
    )
    payload = unwrap(response)

    assert response.status_code == 400
    assert payload["error"]["code"] == "POST_NOT_BOUNTY"


def test_bounty_delete_request_rejects_without_external_top_level_answer(
        client):
    author_token = register_user(client, "bounty-request-no-answer-author",
                                 "bounty-request-no-answer-author@example.com")
    replier_token = register_user(client, "bounty-request-no-answer-replier",
                                  "bounty-request-no-answer-replier@example.com")

    create_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(author_token),
        json={
            "postType": "BOUNTY",
            "title": "No external answer bounty",
            "content": "question body",
            "bountyAmount": 25,
            "bountyExpireAt": future_utc_timestamp(),
        },
    )
    post_id = unwrap(create_response)["data"]["id"]
    parent_response = client.post(
        f"{API_PREFIX}/posts/{post_id}/comments",
        headers=bearer(author_token),
        json={"content": "author clarification"},
    )
    parent_id = unwrap(parent_response)["data"]["id"]
    reply_response = client.post(
        f"{API_PREFIX}/posts/{post_id}/comments",
        headers=bearer(replier_token),
        json={"parentId": parent_id, "content": "reply only"},
    )
    assert reply_response.status_code == 201

    response = client.post(
        f"{API_PREFIX}/posts/{post_id}/bounty-delete-requests",
        headers=bearer(author_token),
        json={"reason": "no answer"},
    )
    payload = unwrap(response)

    assert response.status_code == 400
    assert payload["error"]["code"] == "BOUNTY_DELETE_REQUEST_NOT_ALLOWED"


def test_bounty_delete_request_duplicate_pending_rejected(client):
    author_token = register_user(client, "bounty-request-duplicate-author",
                                 "bounty-request-duplicate-author@example.com")
    answerer_token = register_user(
        client, "bounty-duplicate-answerer",
        "bounty-request-duplicate-answerer@example.com")
    post_id = create_bounty_post_with_external_answer(
        client, author_token, answerer_token, "Duplicate request bounty")

    first_response = client.post(
        f"{API_PREFIX}/posts/{post_id}/bounty-delete-requests",
        headers=bearer(author_token),
        json={"reason": "first request"},
    )
    assert first_response.status_code == 201

    response = client.post(
        f"{API_PREFIX}/posts/{post_id}/bounty-delete-requests",
        headers=bearer(author_token),
        json={"reason": "second request"},
    )
    payload = unwrap(response)

    assert response.status_code == 400
    assert payload["error"]["code"] == "BOUNTY_DELETE_REQUEST_PENDING"


def test_admin_approves_bounty_delete_request_soft_deletes_post_and_notifies_author(
        client):
    author_token = register_user(client, "bounty-admin-approve-author",
                                 "bounty-admin-approve-author@example.com")
    answerer_token = register_user(client, "bounty-admin-approve-answerer",
                                   "bounty-admin-approve-answerer@example.com")
    admin_token = register_admin_user(client, "bounty-admin-approve-admin",
                                      "bounty-admin-approve-admin@example.com")
    post_id = create_bounty_post_with_external_answer(
        client, author_token, answerer_token, "Approve delete request bounty")
    request_response = client.post(
        f"{API_PREFIX}/posts/{post_id}/bounty-delete-requests",
        headers=bearer(author_token),
        json={"reason": "question duplicated"},
    )
    request_id = unwrap(request_response)["data"]["id"]

    review_response = client.patch(
        f"{API_PREFIX}/admin/bounty-delete-requests/{request_id}",
        headers=bearer(admin_token),
        json={
            "action": "APPROVE",
            "resolutionNote": "approved",
        },
    )

    assert review_response.status_code == 200
    payload = unwrap(review_response)
    assert payload["data"]["status"] == "APPROVED"
    assert client.get(f"{API_PREFIX}/posts/{post_id}").status_code == 404
    messages = unwrap(
        client.get(f"{API_PREFIX}/users/me/messages",
                   headers=bearer(author_token)))["data"]
    assert any(item["messageType"] == "BOUNTY_DELETE_REQUEST_APPROVED"
               for item in messages)

    second_review_response = client.patch(
        f"{API_PREFIX}/admin/bounty-delete-requests/{request_id}",
        headers=bearer(admin_token),
        json={"action": "REJECT"},
    )
    second_review_payload = unwrap(second_review_response)
    assert second_review_response.status_code == 400
    assert second_review_payload["error"][
        "code"] == "BOUNTY_DELETE_REQUEST_ALREADY_HANDLED"


def test_admin_rejects_bounty_delete_request_keeps_post_visible(client):
    author_token = register_user(client, "bounty-admin-reject-author",
                                 "bounty-admin-reject-author@example.com")
    answerer_token = register_user(client, "bounty-admin-reject-answerer",
                                   "bounty-admin-reject-answerer@example.com")
    admin_token = register_admin_user(client, "bounty-admin-reject-admin",
                                      "bounty-admin-reject-admin@example.com")
    post_id = create_bounty_post_with_external_answer(
        client, author_token, answerer_token, "Reject delete request bounty")
    request_response = client.post(
        f"{API_PREFIX}/posts/{post_id}/bounty-delete-requests",
        headers=bearer(author_token),
        json={"reason": "still useful"},
    )
    request_id = unwrap(request_response)["data"]["id"]

    review_response = client.patch(
        f"{API_PREFIX}/admin/bounty-delete-requests/{request_id}",
        headers=bearer(admin_token),
        json={
            "action": "REJECT",
            "resolutionNote": "keep visible",
        },
    )

    assert review_response.status_code == 200
    payload = unwrap(review_response)
    assert payload["data"]["status"] == "REJECTED"
    assert client.get(f"{API_PREFIX}/posts/{post_id}").status_code == 200
    messages = unwrap(
        client.get(f"{API_PREFIX}/users/me/messages",
                   headers=bearer(author_token)))["data"]
    assert any(item["messageType"] == "BOUNTY_DELETE_REQUEST_REJECTED"
               for item in messages)


def test_admin_rejects_approval_when_bounty_delete_request_is_resolved(
        client):
    author_token = register_user(client, "bounty-admin-resolved-author",
                                 "bounty-admin-resolved-author@example.com")
    answerer_token = register_user(client, "bounty-admin-resolved-answerer",
                                   "bounty-admin-resolved-answerer@example.com")
    admin_token = register_admin_user(client, "bounty-admin-resolved-admin",
                                      "bounty-admin-resolved-admin@example.com")
    create_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(author_token),
        json={
            "postType": "BOUNTY",
            "title": "Resolved delete request bounty",
            "content": "question body",
            "bountyAmount": 25,
            "bountyExpireAt": future_utc_timestamp(),
        },
    )
    post_id = unwrap(create_response)["data"]["id"]
    answer_response = client.post(
        f"{API_PREFIX}/posts/{post_id}/comments",
        headers=bearer(answerer_token),
        json={"content": "candidate answer"},
    )
    comment_id = unwrap(answer_response)["data"]["id"]
    request_response = client.post(
        f"{API_PREFIX}/posts/{post_id}/bounty-delete-requests",
        headers=bearer(author_token),
        json={"reason": "please remove after review"},
    )
    request_id = unwrap(request_response)["data"]["id"]
    accept_response = client.post(
        f"{API_PREFIX}/posts/{post_id}/comments/{comment_id}/accept",
        headers=bearer(author_token),
    )
    assert accept_response.status_code == 200

    review_response = client.patch(
        f"{API_PREFIX}/admin/bounty-delete-requests/{request_id}",
        headers=bearer(admin_token),
        json={"action": "APPROVE"},
    )
    review_payload = unwrap(review_response)
    detail_payload = unwrap(
        client.get(f"{API_PREFIX}/posts/{post_id}",
                   headers=bearer(author_token)))

    async def request_status() -> str | None:
        async with SessionLocal() as db:
            return await db.scalar(
                select(BountyDeleteRequest.status).where(
                    BountyDeleteRequest.id == request_id))

    assert review_response.status_code == 400
    assert review_payload["error"][
        "code"] == "BOUNTY_DELETE_REQUEST_NOT_APPROVABLE"
    assert detail_payload["data"]["bountyStatus"] == "RESOLVED"
    assert detail_payload["data"]["acceptedCommentId"] == comment_id
    assert asyncio.run(request_status()) == "PENDING"


def test_admin_lists_bounty_delete_requests_with_filters(client):
    author_token = register_user(client, "bounty-admin-list-author",
                                 "bounty-admin-list-author@example.com")
    answerer_token = register_user(client, "bounty-admin-list-answerer",
                                   "bounty-admin-list-answerer@example.com")
    admin_token = register_admin_user(client, "bounty-admin-list-admin",
                                      "bounty-admin-list-admin@example.com")
    post_id = create_bounty_post_with_external_answer(
        client, author_token, answerer_token, "Filterable delete bounty")
    request_response = client.post(
        f"{API_PREFIX}/posts/{post_id}/bounty-delete-requests",
        headers=bearer(author_token),
        json={"reason": "filterable reason"},
    )
    request_id = unwrap(request_response)["data"]["id"]

    list_response = client.get(
        f"{API_PREFIX}/admin/bounty-delete-requests",
        headers=bearer(admin_token),
        params={
            "status": "PENDING",
            "keyword": "Filterable",
        },
    )
    miss_response = client.get(
        f"{API_PREFIX}/admin/bounty-delete-requests",
        headers=bearer(admin_token),
        params={
            "status": "APPROVED",
            "keyword": "Filterable",
        },
    )
    payload = unwrap(list_response)
    miss_payload = unwrap(miss_response)

    assert list_response.status_code == 200
    assert miss_response.status_code == 200
    assert miss_payload["data"] == []
    assert len(payload["data"]) == 1
    item = payload["data"][0]
    assert item["id"] == request_id
    assert item["status"] == "PENDING"
    assert item["postId"] == post_id
    assert item["reason"] == "filterable reason"
    assert item["answerCount"] == 1


def test_register_login_wallet_post_comment_and_purchase_flow(client):
    alice_token = register_user(client, "alice", "alice@example.com")
    bob_token = register_user(client, "bob", "bob@example.com")

    login_captcha = unwrap(client.get(f"{API_PREFIX}/auth/captcha"))["data"]
    login_response = client.post(
        f"{API_PREFIX}/auth/login",
        json={
            "account": "alice",
            "password": "correct-horse-12345",
            "captchaId": login_captcha["captchaId"],
            "captchaCode": login_captcha["debugCode"],
        },
    )
    login_payload = unwrap(login_response)
    assert login_response.status_code == 200
    assert login_payload["data"]["tokenType"] == "Bearer"

    wallet = unwrap(
        client.get(f"{API_PREFIX}/users/me/wallet",
                   headers=bearer(alice_token)))
    assert wallet["data"]["availableCoins"] == 100
    assert wallet["data"]["totalCoins"] == 100

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
    assert comment_payload["data"]["authorUsername"] == "bob"
    assert comment_payload["data"]["content"] == "Looks useful."

    comments_payload = unwrap(
        client.get(f"{API_PREFIX}/posts/{post_id}/comments"))
    assert comments_payload["data"][0]["authorUsername"] == "bob"

    purchase_response = client.post(
        f"{API_PREFIX}/posts/{post_id}/purchase",
        headers=bearer(bob_token),
    )
    purchase_payload = unwrap(purchase_response)
    assert purchase_response.status_code == 201
    assert purchase_payload["data"]["postId"] == post_id
    assert purchase_payload["data"]["price"] == 10

    purchased_detail = unwrap(
        client.get(f"{API_PREFIX}/posts/{post_id}", headers=bearer(bob_token)))
    assert purchased_detail["data"]["hiddenContent"] == "download-secret"


def test_bounty_author_can_accept_top_level_answer(client):
    asker_token = register_user(client, "bounty-asker",
                                "bounty-asker@example.com")
    answerer_token = register_user(client, "bounty-answerer",
                                   "bounty-answerer@example.com")

    create_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(asker_token),
        json={
            "postType": "BOUNTY",
            "title": "Need a working answer",
            "content": "question body",
            "bountyAmount": 5,
            "bountyExpireAt": future_utc_timestamp(),
        },
    )
    create_payload = unwrap(create_response)
    post_id = create_payload["data"]["id"]

    comment_response = client.post(
        f"{API_PREFIX}/posts/{post_id}/comments",
        headers=bearer(answerer_token),
        json={"content": "Here is the accepted answer."},
    )
    comment_payload = unwrap(comment_response)
    comment_id = comment_payload["data"]["id"]

    accept_response = client.post(
        f"{API_PREFIX}/posts/{post_id}/comments/{comment_id}/accept",
        headers=bearer(asker_token),
    )
    accept_payload = unwrap(accept_response)
    detail_payload = unwrap(
        client.get(f"{API_PREFIX}/posts/{post_id}",
                   headers=bearer(asker_token)))
    comments_payload = unwrap(
        client.get(f"{API_PREFIX}/posts/{post_id}/comments",
                   headers=bearer(asker_token)))
    asker_wallet = unwrap(
        client.get(f"{API_PREFIX}/users/me/wallet",
                   headers=bearer(asker_token)))
    answerer_wallet = unwrap(
        client.get(f"{API_PREFIX}/users/me/wallet",
                   headers=bearer(answerer_token)))

    assert accept_response.status_code == 200
    assert accept_payload["data"]["isAccepted"] is True
    assert detail_payload["data"]["bountyStatus"] == "RESOLVED"
    assert detail_payload["data"]["acceptedCommentId"] == comment_id
    assert comments_payload["data"][0]["isAccepted"] is True
    assert asker_wallet["data"]["availableCoins"] == 95
    assert asker_wallet["data"]["frozenCoins"] == 0
    assert asker_wallet["data"]["totalCoins"] == 95
    assert answerer_wallet["data"]["availableCoins"] == 105
    assert answerer_wallet["data"]["frozenCoins"] == 0


def test_bounty_answers_are_masked_by_viewer_role(client):
    asker_token = register_user(client, "bounty-visibility-asker",
                                "bounty-visibility-asker@example.com")
    answerer_token = register_user(client, "bounty-visibility-answerer",
                                   "bounty-visibility-answerer@example.com")
    viewer_token = register_user(client, "bounty-visibility-viewer",
                                 "bounty-visibility-viewer@example.com")

    create_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(asker_token),
        json={
            "postType": "BOUNTY",
            "title": "Need a private answer",
            "content": "question body",
            "bountyAmount": 5,
            "bountyExpireAt": future_utc_timestamp(),
        },
    )
    post_id = unwrap(create_response)["data"]["id"]

    first_answer = unwrap(
        client.post(
            f"{API_PREFIX}/posts/{post_id}/comments",
            headers=bearer(answerer_token),
            json={"content": "My private answer."},
        ))["data"]
    unwrap(
        client.post(
            f"{API_PREFIX}/posts/{post_id}/comments",
            headers=bearer(viewer_token),
            json={"content": "Another hidden answer."},
        ))

    asker_detail = unwrap(
        client.get(f"{API_PREFIX}/posts/{post_id}",
                   headers=bearer(asker_token)))
    asker_comments = unwrap(
        client.get(f"{API_PREFIX}/posts/{post_id}/comments",
                   headers=bearer(asker_token)))
    answerer_comments = unwrap(
        client.get(f"{API_PREFIX}/posts/{post_id}/comments",
                   headers=bearer(answerer_token)))
    public_comments = unwrap(
        client.get(f"{API_PREFIX}/posts/{post_id}/comments"))

    assert asker_detail["data"]["answerCount"] == 2
    assert len(asker_comments["data"]) == 2
    assert {item["content"]
            for item in asker_comments["data"]} == {
                "My private answer.",
                "Another hidden answer.",
            }
    assert len(answerer_comments["data"]) == 1
    assert answerer_comments["data"][0]["id"] == first_answer["id"]
    assert answerer_comments["data"][0]["content"] == "My private answer."
    assert public_comments["data"] == []

    accept_response = client.post(
        f"{API_PREFIX}/posts/{post_id}/comments/{first_answer['id']}/accept",
        headers=bearer(asker_token),
    )
    resolved_public_comments = unwrap(
        client.get(f"{API_PREFIX}/posts/{post_id}/comments"))

    assert accept_response.status_code == 200
    assert len(resolved_public_comments["data"]) == 1
    assert resolved_public_comments["data"][0]["id"] == first_answer["id"]
    assert resolved_public_comments["data"][0]["content"] is None
    assert resolved_public_comments["data"][0]["canViewContent"] is False
    assert "被采纳" in resolved_public_comments["data"][0]["maskedSummary"]


def test_business_events_generate_site_messages(client):
    author_token = register_user(client, "message-author",
                                 "message-author@example.com")
    actor_token = register_user(client, "message-actor",
                                "message-actor@example.com")

    normal_post_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(author_token),
        json={
            "type": "NORMAL",
            "title": "Normal post for messages",
            "content": "body",
        },
    )
    normal_post_id = unwrap(normal_post_response)["data"]["id"]

    resource_post_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(author_token),
        json={
            "type": "RESOURCE",
            "title": "Resource post for messages",
            "content": "body",
            "hiddenContent": "secret",
            "price": 10,
        },
    )
    resource_post_id = unwrap(resource_post_response)["data"]["id"]

    like_response = client.post(
        f"{API_PREFIX}/posts/{normal_post_id}/likes/toggle",
        headers=bearer(actor_token),
    )
    favorite_response = client.post(
        f"{API_PREFIX}/posts/{normal_post_id}/favorites/toggle",
        headers=bearer(actor_token),
    )
    purchase_response = client.post(
        f"{API_PREFIX}/posts/{resource_post_id}/purchase",
        headers=bearer(actor_token),
    )
    author_messages = unwrap(
        client.get(f"{API_PREFIX}/users/me/messages",
                   headers=bearer(author_token)))
    author_unread = unwrap(
        client.get(
            f"{API_PREFIX}/users/me/messages/unread-count",
            headers=bearer(author_token),
        ))
    actor_messages = unwrap(
        client.get(f"{API_PREFIX}/users/me/messages",
                   headers=bearer(actor_token)))

    assert like_response.status_code == 200
    assert favorite_response.status_code == 200
    assert purchase_response.status_code == 201
    assert {item["messageType"]
            for item in author_messages["data"]
            } >= {"POST_LIKED", "POST_FAVORITED", "RESOURCE_SOLD"}
    assert author_unread["data"] >= 3
    assert {item["messageType"]
            for item in actor_messages["data"]} >= {"RESOURCE_PURCHASED"}


def test_post_create_persists_tag_relations(client):
    token = register_user(client, "tag-author", "tag-author@example.com")

    async def load_tag_ids() -> list[int]:
        async with SessionLocal() as db:
            return list(
                (await
                 db.scalars(select(Tag.id).order_by(Tag.id.asc()).limit(2)
                            )).all())

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
            return list((await db.scalars(
                select(PostTag.tag_id).where(
                    PostTag.post_id == post_id).order_by(PostTag.tag_id.asc())
            )).all())

    assert asyncio.run(fetch_post_tag_ids()) == sorted(tag_ids)


def test_post_filters_and_detail_restore_metadata_and_viewer_state(client):
    author_token = register_user(client, "post-metadata-author",
                                 "post-metadata-author@example.com")
    viewer_token = register_user(client, "post-metadata-viewer",
                                 "post-metadata-viewer@example.com")

    async def load_taxonomy_ids() -> tuple[list[int], list[int]]:
        async with SessionLocal() as db:
            category_ids = list((await db.scalars(
                select(Category.id).order_by(Category.id.asc()).limit(2)
            )).all())
            tag_ids = list(
                (await
                 db.scalars(select(Tag.id).order_by(Tag.id.asc()).limit(2)
                            )).all())
            return category_ids, tag_ids

    category_ids, tag_ids = asyncio.run(load_taxonomy_ids())
    assert len(category_ids) == 2
    assert len(tag_ids) == 2

    target_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(author_token),
        json={
            "postType": "RESOURCE",
            "title": "Unique metadata resource",
            "content": "needle body",
            "hiddenContent": "secret-resource",
            "price": 9,
            "categoryId": category_ids[0],
            "tagIds": [tag_ids[0]],
        },
    )
    target_payload = unwrap(target_response)
    assert target_response.status_code == 201
    post_id = target_payload["data"]["id"]

    other_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(author_token),
        json={
            "postType": "NORMAL",
            "title": "Other visible post",
            "content": "different",
            "categoryId": category_ids[1],
            "tagIds": [tag_ids[1]],
        },
    )
    other_payload = unwrap(other_response)
    assert other_response.status_code == 201
    other_post_id = other_payload["data"]["id"]

    category_filtered = unwrap(
        client.get(
            f"{API_PREFIX}/posts?page=1&pageSize=20&categoryId={category_ids[0]}"
        ))
    assert {item["id"]
            for item in category_filtered["data"]["items"]} >= {post_id}
    assert other_post_id not in {
        item["id"]
        for item in category_filtered["data"]["items"]
    }

    tag_filtered = unwrap(
        client.get(
            f"{API_PREFIX}/posts?page=1&pageSize=20&tagId={tag_ids[0]}"))
    assert {item["id"] for item in tag_filtered["data"]["items"]} >= {post_id}
    assert other_post_id not in {
        item["id"]
        for item in tag_filtered["data"]["items"]
    }

    keyword_filtered = unwrap(
        client.get(f"{API_PREFIX}/posts?page=1&pageSize=20&keyword=metadata"))
    assert {item["id"]
            for item in keyword_filtered["data"]["items"]} == {post_id}

    viewer_detail = unwrap(
        client.get(f"{API_PREFIX}/posts/{post_id}",
                   headers=bearer(viewer_token)))
    assert viewer_detail["data"]["categoryId"] == category_ids[0]
    assert viewer_detail["data"]["categoryName"]
    assert [tag["id"] for tag in viewer_detail["data"]["tags"]] == [tag_ids[0]]
    assert viewer_detail["data"]["liked"] is False
    assert viewer_detail["data"]["collected"] is False
    assert viewer_detail["data"]["resourceUnlocked"] is False
    assert viewer_detail["data"]["canPurchase"] is True
    assert viewer_detail["data"]["hiddenContent"] is None

    like_response = client.post(f"{API_PREFIX}/posts/{post_id}/likes/toggle",
                                headers=bearer(viewer_token))
    favorite_response = client.post(
        f"{API_PREFIX}/posts/{post_id}/favorites/toggle",
        headers=bearer(viewer_token))
    assert like_response.status_code == 200
    assert favorite_response.status_code == 200

    purchased_response = client.post(f"{API_PREFIX}/posts/{post_id}/purchase",
                                     headers=bearer(viewer_token))
    assert purchased_response.status_code == 201

    purchased_detail = unwrap(
        client.get(f"{API_PREFIX}/posts/{post_id}",
                   headers=bearer(viewer_token)))
    assert purchased_detail["data"]["liked"] is True
    assert purchased_detail["data"]["collected"] is True
    assert purchased_detail["data"]["resourceUnlocked"] is True
    assert purchased_detail["data"]["purchased"] is True
    assert purchased_detail["data"]["canPurchase"] is False
    assert purchased_detail["data"]["hiddenContent"] == "secret-resource"
    assert purchased_detail["data"]["purchaseStatus"] == "PAID"


def test_post_create_rejects_unknown_tag_ids(client):
    token = register_user(client, "invalid-tag-author",
                          "invalid-tag-author@example.com")

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
    token = register_user(client, "clear-fields-author",
                          "clear-fields-author@example.com")

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

    response = client.get(f"{API_PREFIX}/users/me/wallet",
                          headers=bearer(token))
    payload = unwrap(response)

    assert response.status_code == 200
    assert payload["data"]["availableCoins"] == 100
    assert payload["data"]["frozenCoins"] == 0
    assert payload["data"]["totalCoins"] == 100
    assert payload["data"]["updatedAt"]


def test_wallet_read_endpoint_returns_zero_summary_when_wallet_row_is_missing(
        client):
    token = register_user(client, "wallet-missing",
                          "wallet-missing@example.com")
    remove_wallet("wallet-missing")

    response = client.get(f"{API_PREFIX}/users/me/wallet",
                          headers=bearer(token))
    payload = unwrap(response)

    assert response.status_code == 200
    assert payload["data"]["availableCoins"] == 0
    assert payload["data"]["frozenCoins"] == 0
    assert payload["data"]["totalCoins"] == 0
    assert payload["data"]["updatedAt"]


def test_my_profile_endpoint_returns_counts_and_updates_nickname(client):
    token = register_user(client, "profile-owner", "profile-owner@example.com")

    create_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(token),
        json={
            "type": "NORMAL",
            "title": "My own post",
            "content": "body",
        },
    )
    assert create_response.status_code == 201

    profile_response = client.get(f"{API_PREFIX}/users/me",
                                  headers=bearer(token))
    profile_payload = unwrap(profile_response)

    assert profile_response.status_code == 200
    assert profile_payload["data"]["username"] == "profile-owner"
    assert profile_payload["data"]["nickname"] == "profile-owner"
    assert profile_payload["data"]["postCount"] == 1
    assert profile_payload["data"]["followingCount"] == 0
    assert profile_payload["data"]["followerCount"] == 0

    update_response = client.patch(
        f"{API_PREFIX}/users/me",
        headers=bearer(token),
        json={
            "nickname": "profile-renamed",
            "avatarUrl": "https://example.com/avatar.png",
            "bio": "updated bio",
        },
    )
    update_payload = unwrap(update_response)

    assert update_response.status_code == 200
    assert update_payload["data"]["username"] == "profile-owner"
    assert update_payload["data"]["nickname"] == "profile-renamed"
    assert update_payload["data"][
        "avatarUrl"] == "https://example.com/avatar.png"
    assert update_payload["data"]["bio"] == "updated bio"

    login_captcha = unwrap(client.get(f"{API_PREFIX}/auth/captcha"))["data"]
    login_response = client.post(
        f"{API_PREFIX}/auth/login",
        json={
            "account": "profile-owner",
            "password": "correct-horse-12345",
            "captchaId": login_captcha["captchaId"],
            "captchaCode": login_captcha["debugCode"],
        },
    )
    login_payload = unwrap(login_response)
    assert login_response.status_code == 200
    assert login_payload["data"]["user"]["username"] == "profile-owner"
    assert login_payload["data"]["user"]["nickname"] == "profile-renamed"


def test_public_profile_endpoint_returns_public_fields_and_follow_state(client):
    leader_token = register_user(client, "public-profile-leader",
                                 "public-profile-leader@example.com")
    follower_token = register_user(client, "public-profile-follower",
                                   "public-profile-follower@example.com")

    leader_profile = unwrap(
        client.get(f"{API_PREFIX}/users/me",
                   headers=bearer(leader_token)))["data"]
    follower_profile = unwrap(
        client.get(f"{API_PREFIX}/users/me",
                   headers=bearer(follower_token)))["data"]
    leader_id = leader_profile["id"]

    create_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(leader_token),
        json={
            "type": "NORMAL",
            "title": "Public profile post",
            "content": "body",
        },
    )
    assert create_response.status_code == 201

    client.post(f"{API_PREFIX}/users/{leader_id}/follow/toggle",
                headers=bearer(follower_token))

    guest_response = client.get(f"{API_PREFIX}/users/{leader_id}")
    guest_payload = unwrap(guest_response)
    follower_response = client.get(f"{API_PREFIX}/users/{leader_id}",
                                   headers=bearer(follower_token))
    follower_payload = unwrap(follower_response)
    self_response = client.get(f"{API_PREFIX}/users/{follower_profile['id']}",
                               headers=bearer(follower_token))
    self_payload = unwrap(self_response)

    assert guest_response.status_code == 200
    assert guest_payload["data"]["username"] == "public-profile-leader"
    assert guest_payload["data"]["postCount"] == 1
    assert guest_payload["data"]["followerCount"] == 1
    assert guest_payload["data"]["followedByMe"] is False
    assert guest_payload["data"]["isSelf"] is False
    assert "email" not in guest_payload["data"]
    assert "phone" not in guest_payload["data"]
    assert "roles" not in guest_payload["data"]

    assert follower_payload["data"]["followedByMe"] is True
    assert follower_payload["data"]["isSelf"] is False
    assert self_payload["data"]["isSelf"] is True
    assert self_payload["data"]["followedByMe"] is False


def test_posts_list_filters_by_author_id_and_excludes_hidden_posts(client):
    target_token = register_user(client, "author-filter-target",
                                 "author-filter-target@example.com")
    other_token = register_user(client, "author-filter-other",
                                "author-filter-other@example.com")

    target_id = unwrap(
        client.get(f"{API_PREFIX}/users/me",
                   headers=bearer(target_token)))["data"]["id"]

    visible_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(target_token),
        json={
            "type": "NORMAL",
            "title": "Visible author post",
            "content": "body",
        },
    )
    offline_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(target_token),
        json={
            "type": "NORMAL",
            "title": "Offline author post",
            "content": "body",
        },
    )
    other_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(other_token),
        json={
            "type": "NORMAL",
            "title": "Other author post",
            "content": "body",
        },
    )
    assert visible_response.status_code == 201
    assert offline_response.status_code == 201
    assert other_response.status_code == 201

    visible_id = unwrap(visible_response)["data"]["id"]
    offline_id = unwrap(offline_response)["data"]["id"]
    other_id = unwrap(other_response)["data"]["id"]

    async def hide_post() -> None:
        async with SessionLocal() as db:
            offline_post = await db.get(Post, offline_id)
            offline_post.status = "OFFLINE"
            await db.commit()

    asyncio.run(hide_post())

    response = client.get(
        f"{API_PREFIX}/posts?page=1&pageSize=20&authorId={target_id}")
    payload = unwrap(response)
    ids = {item["id"] for item in payload["data"]["items"]}

    assert response.status_code == 200
    assert visible_id in ids
    assert offline_id not in ids
    assert other_id not in ids


def test_my_posts_endpoint_returns_paginated_response(client):
    token = register_user(client, "my-posts-owner",
                          "my-posts-owner@example.com")

    for index in range(2):
        response = client.post(
            f"{API_PREFIX}/posts",
            headers=bearer(token),
            json={
                "type": "NORMAL",
                "title": f"Owned post {index}",
                "content": "body",
            },
        )
        assert response.status_code == 201

    response = client.get(f"{API_PREFIX}/posts/mine?page=1&pageSize=1",
                          headers=bearer(token))
    payload = unwrap(response)

    assert response.status_code == 200
    assert len(payload["data"]["items"]) == 1
    assert payload["data"]["page"] == 1
    assert payload["data"]["pageSize"] == 1
    assert payload["data"]["total"] >= 2
    assert payload["data"]["totalPages"] >= 2
    assert payload["data"]["hasNext"] is True
    assert payload["data"]["hasPrevious"] is False


def test_resource_purchase_and_sales_endpoints_return_trade_summaries(client):
    seller_token = register_user(client, "resource-seller",
                                 "resource-seller@example.com")
    buyer_token = register_user(client, "resource-buyer",
                                "resource-buyer@example.com")

    post_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(seller_token),
        json={
            "postType": "RESOURCE",
            "title": "Paid file",
            "content": "body",
            "hiddenContent": "secret",
            "price": 15,
        },
    )
    post_payload = unwrap(post_response)
    post_id = post_payload["data"]["id"]

    purchase_response = client.post(
        f"{API_PREFIX}/posts/{post_id}/purchase",
        headers=bearer(buyer_token),
    )
    purchase_payload = unwrap(purchase_response)
    purchase_id = purchase_payload["data"]["id"]

    async def seed_appeal() -> None:
        async with SessionLocal() as db:
            db.add(
                ResourceAppeal(
                    purchase_id=purchase_id,
                    post_id=post_id,
                    buyer_id=2,
                    seller_id=1,
                    reason="broken file",
                    status="PENDING",
                    requested_refund_amount=15,
                ))
            await db.commit()

    asyncio.run(seed_appeal())

    purchases_response = client.get(
        f"{API_PREFIX}/users/me/resource-purchases",
        headers=bearer(buyer_token))
    purchases_payload = unwrap(purchases_response)
    sales_response = client.get(f"{API_PREFIX}/users/me/resource-sales",
                                headers=bearer(seller_token))
    sales_payload = unwrap(sales_response)

    assert purchases_response.status_code == 200
    assert sales_response.status_code == 200
    assert purchases_payload["data"][0]["purchaseId"] == purchase_id
    assert purchases_payload["data"][0]["postTitle"] == "Paid file"
    assert purchases_payload["data"][0]["buyerUsername"] == "resource-buyer"
    assert purchases_payload["data"][0]["sellerUsername"] == "resource-seller"
    assert purchases_payload["data"][0]["appealStatus"] == "PENDING"
    assert sales_payload["data"][0]["purchaseId"] == purchase_id


def test_messages_endpoints_use_users_me_prefix_and_return_message_payloads(
        client):
    token = register_user(client, "message-owner", "message-owner@example.com")

    async def seed_message() -> int:
        async with SessionLocal() as db:
            user_id = await db.scalar(
                select(UserAccount.id).where(
                    UserAccount.username == "message-owner"))
            message = SiteMessage(
                user_id=user_id,
                title="Purchase notice",
                content="A resource was purchased.",
                message_type="RESOURCE_PURCHASE",
            )
            db.add(message)
            await db.commit()
            await db.refresh(message)
            return message.id

    message_id = asyncio.run(seed_message())

    list_response = client.get(f"{API_PREFIX}/users/me/messages",
                               headers=bearer(token))
    list_payload = unwrap(list_response)
    unread_response = client.get(
        f"{API_PREFIX}/users/me/messages/unread-count", headers=bearer(token))
    unread_payload = unwrap(unread_response)
    read_response = client.patch(
        f"{API_PREFIX}/users/me/messages/{message_id}/read",
        headers=bearer(token),
    )
    read_payload = unwrap(read_response)
    read_all_response = client.patch(
        f"{API_PREFIX}/users/me/messages/read-all", headers=bearer(token))
    read_all_payload = unwrap(read_all_response)

    assert list_response.status_code == 200
    assert list_payload["data"][0]["read"] is False
    assert list_payload["data"][0]["messageType"] == "RESOURCE_PURCHASE"
    assert unread_payload["data"] == 1
    assert read_response.status_code == 200
    assert read_payload["data"]["id"] == message_id
    assert read_payload["data"]["read"] is True
    assert read_all_response.status_code == 200
    assert read_all_payload["data"] == 0


def test_follow_endpoints_toggle_and_list_relations(client):
    leader_token = register_user(client, "follow-leader",
                                 "follow-leader@example.com")
    follower_token = register_user(client, "follow-follower",
                                   "follow-follower@example.com")

    toggle_response = client.post(f"{API_PREFIX}/users/1/follow/toggle",
                                  headers=bearer(follower_token))
    toggle_payload = unwrap(toggle_response)

    assert toggle_response.status_code == 200
    assert toggle_payload["data"]["following"] is True
    assert toggle_payload["data"]["followerCount"] == 1
    assert toggle_payload["data"]["followingCount"] == 1

    followers_response = client.get(f"{API_PREFIX}/users/me/followers",
                                    headers=bearer(leader_token))
    following_response = client.get(f"{API_PREFIX}/users/me/following",
                                    headers=bearer(follower_token))
    followers_payload = unwrap(followers_response)
    following_payload = unwrap(following_response)

    assert followers_response.status_code == 200
    assert following_response.status_code == 200
    assert followers_payload["data"][0]["username"] == "follow-follower"
    assert following_payload["data"][0]["username"] == "follow-leader"
    assert followers_payload["data"][0]["followedAt"]
    assert following_payload["data"][0]["followedAt"]

    untoggle_response = client.post(f"{API_PREFIX}/users/1/follow/toggle",
                                    headers=bearer(follower_token))
    untoggle_payload = unwrap(untoggle_response)
    assert untoggle_payload["data"]["following"] is False
    assert untoggle_payload["data"]["followerCount"] == 0
    assert untoggle_payload["data"]["followingCount"] == 0


def test_follow_toggle_rejects_self_follow(client):
    token = register_user(client, "self-follow-user",
                          "self-follow-user@example.com")

    response = client.post(f"{API_PREFIX}/users/1/follow/toggle",
                           headers=bearer(token))
    payload = unwrap(response)

    assert response.status_code == 400
    assert payload["error"]["code"] == "INVALID_OPERATION"


def test_protected_endpoint_returns_v1_error_contract(client):
    response = client.post(
        f"{API_PREFIX}/posts",
        json={
            "type": "NORMAL",
            "title": "Denied",
            "content": "No token"
        },
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
            "password": "correct-horse-12345",
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
            "password": "correct-horse-12345",
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
            "password": "correct-horse-12345",
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
