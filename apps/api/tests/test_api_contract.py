import asyncio
import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

os.environ["DATABASE_URL"] = "sqlite://"

from lenjoy_bbs.main import app
from lenjoy_bbs.db.session import SessionLocal
from lenjoy_bbs.modules.messages.models import SiteMessage
from lenjoy_bbs.modules.posts.models import PostFavorite, PostLike, PostTag
from lenjoy_bbs.modules.reports.models import ResourceAppeal
from lenjoy_bbs.modules.taxonomy.models import Category, Tag
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
            "bountyExpireAt": "2026-06-01T12:00:00Z",
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
    assert answerer_wallet["data"]["availableCoins"] == 105


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
            "bountyExpireAt": "2026-06-01T12:00:00Z",
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


def test_my_profile_endpoint_returns_counts_and_updates_username(client):
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
    assert profile_payload["data"]["postCount"] == 1
    assert profile_payload["data"]["followingCount"] == 0
    assert profile_payload["data"]["followerCount"] == 0

    update_response = client.patch(
        f"{API_PREFIX}/users/me",
        headers=bearer(token),
        json={
            "username": "profile-renamed",
            "avatarUrl": "https://example.com/avatar.png",
            "bio": "updated bio",
        },
    )
    update_payload = unwrap(update_response)

    assert update_response.status_code == 200
    assert update_payload["data"]["username"] == "profile-renamed"
    assert update_payload["data"][
        "avatarUrl"] == "https://example.com/avatar.png"
    assert update_payload["data"]["bio"] == "updated bio"


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
