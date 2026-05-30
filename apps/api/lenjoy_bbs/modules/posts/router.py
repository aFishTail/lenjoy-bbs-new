import hashlib

from fastapi import APIRouter, Query, Request, status

from lenjoy_bbs.core.api_schemas import ApiEnvelope, PageData
from lenjoy_bbs.core.dependencies import CurrentUser, DbSession, OptionalCurrentUser
from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.core.messages import Posts
from lenjoy_bbs.core.responses import success
from lenjoy_bbs.modules.posts.bounty_settlement import accept_bounty_answer_settlement
from lenjoy_bbs.modules.posts.bounty_delete_requests import (
    create_bounty_delete_request,
    serialize_bounty_delete_request,
)
from lenjoy_bbs.modules.posts.engagement import create_comment, record_post_view, toggle_comment_like, toggle_post_favorite, toggle_post_like
from lenjoy_bbs.modules.posts.lifecycle import create_post, delete_post, update_post
from lenjoy_bbs.modules.posts.presenters import serialize_comment, serialize_post
from lenjoy_bbs.modules.posts.read_service import list_my_posts_feed, list_posts_feed, read_post_comments, read_post_detail
from lenjoy_bbs.modules.posts.resource_trade import purchase_resource_post
from lenjoy_bbs.modules.posts.schemas import (
    BountyDeleteRequestCreate,
    BountyDeleteRequestResponse,
    CommentCreateRequest,
    CommentResponse,
    InteractionToggleResponse,
    PostCreateRequest,
    PostPurchaseResponse,
    PostResponse,
    PostUpdateRequest,
    PostViewResponse,
)

router = APIRouter(prefix="/posts", tags=["posts"])
comments_router = APIRouter(prefix="/comments", tags=["comments"])


def _resolve_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "").strip()
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip", "").strip()
    if real_ip:
        return real_ip
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _resolve_viewer_key(request: Request, user: OptionalCurrentUser) -> str:
    if user is not None:
        return f"user:{user.id}"

    visitor_id = request.headers.get("x-visitor-id", "").strip()
    if visitor_id:
        return f"anon:{visitor_id[:128]}"

    fingerprint = f"{_resolve_client_ip(request)}|{request.headers.get('user-agent', 'unknown')}"
    digest = hashlib.sha256(fingerprint.encode("utf-8")).hexdigest()[:24]
    return f"anon-fallback:{digest}"


@router.get("", response_model=ApiEnvelope[PageData[PostResponse]])
async def list_posts(db: DbSession,
                     page: int = Query(1, ge=1),
                     postType: str | None = Query(default=None),
                     categoryId: int | None = Query(default=None),
                     tagId: int | None = Query(default=None),
                     authorId: int | None = Query(default=None, ge=1),
                     keyword: str | None = Query(default=None),
                     pageSize: int = Query(20, ge=1, le=100)):
    normalized_keyword = (keyword or "").strip()
    if len(normalized_keyword) > 100:
        raise ApiError(Posts.INVALID_KEYWORD)
    keyword_filter = normalized_keyword or None
    return success(await list_posts_feed(db, page, pageSize, postType,
                                         categoryId, tagId, keyword_filter,
                                         authorId))


@router.get("/mine")
@router.get("/mine", response_model=ApiEnvelope[PageData[PostResponse]])
async def my_posts(db: DbSession,
                   user: CurrentUser,
                   page: int = Query(1, ge=1),
                   pageSize: int = Query(20, ge=1, le=100)):
    return success(await list_my_posts_feed(db, user, page, pageSize))


@router.post("",
             status_code=status.HTTP_201_CREATED,
             response_model=ApiEnvelope[PostResponse])
async def create(payload: PostCreateRequest, db: DbSession, user: CurrentUser):
    return success(await serialize_post(db, await
                                        create_post(db, payload, user), user))


@router.get("/{post_id}", response_model=ApiEnvelope[PostResponse])
async def detail(post_id: int, db: DbSession, user: OptionalCurrentUser):
    return success(await read_post_detail(db, post_id, user))


@router.post("/{post_id}/views", response_model=ApiEnvelope[PostViewResponse])
async def add_view(post_id: int, request: Request, db: DbSession,
                   user: OptionalCurrentUser):
    post, _ = await record_post_view(db, post_id,
                                     _resolve_viewer_key(request, user))
    return success({"postId": post.id, "viewCount": post.view_count})


@router.post("/{post_id}/likes/toggle",
             response_model=ApiEnvelope[InteractionToggleResponse])
async def toggle_like(post_id: int, db: DbSession, user: CurrentUser):
    return success(await toggle_post_like(db, post_id, user))


@router.post("/{post_id}/favorites/toggle",
             response_model=ApiEnvelope[InteractionToggleResponse])
async def toggle_favorite(post_id: int, db: DbSession, user: CurrentUser):
    return success(await toggle_post_favorite(db, post_id, user))


@comments_router.post("/{comment_id}/likes/toggle",
                      response_model=ApiEnvelope[InteractionToggleResponse])
async def toggle_comment_like_endpoint(comment_id: int, db: DbSession,
                                       user: CurrentUser):
    return success(await toggle_comment_like(db, comment_id, user))


@router.put("/{post_id}", response_model=ApiEnvelope[PostResponse])
async def update(
    post_id: int,
    payload: PostUpdateRequest,
    db: DbSession,
    user: CurrentUser,
):
    return success(await serialize_post(
        db, await update_post(db, post_id, payload, user), user))


@router.delete("/{post_id}")
async def delete(post_id: int, db: DbSession, user: CurrentUser):
    await delete_post(db, post_id, user)
    return success(None)


@router.post("/{post_id}/bounty-delete-requests",
             status_code=status.HTTP_201_CREATED,
             response_model=ApiEnvelope[BountyDeleteRequestResponse])
async def create_bounty_delete_request_endpoint(
    post_id: int,
    payload: BountyDeleteRequestCreate,
    db: DbSession,
    user: CurrentUser,
):
    item = await create_bounty_delete_request(db, post_id, user,
                                              payload.reason)
    return success(serialize_bounty_delete_request(item))


@router.get("/{post_id}/comments",
            response_model=ApiEnvelope[list[CommentResponse]])
async def comments(post_id: int, db: DbSession, user: OptionalCurrentUser):
    return success(await read_post_comments(db, post_id, user))


@router.post("/{post_id}/comments",
             status_code=status.HTTP_201_CREATED,
             response_model=ApiEnvelope[CommentResponse])
async def add_comment(
    post_id: int,
    payload: CommentCreateRequest,
    db: DbSession,
    user: CurrentUser,
):
    return success(await serialize_comment(
        db, await create_comment(db, post_id, payload, user)))


@router.post("/{post_id}/comments/{comment_id}/accept",
             response_model=ApiEnvelope[CommentResponse])
async def accept_comment(post_id: int, comment_id: int, db: DbSession,
                         user: CurrentUser):
    return success(await serialize_comment(
        db, await accept_bounty_answer_settlement(db, post_id, comment_id,
                                                  user)))


@router.post("/{post_id}/purchase",
             status_code=status.HTTP_201_CREATED,
             response_model=ApiEnvelope[PostPurchaseResponse])
async def purchase(post_id: int, db: DbSession, user: CurrentUser):
    item = await purchase_resource_post(db, post_id, user)
    return success({
        "id": item.id,
        "postId": item.post_id,
        "buyerId": item.buyer_id,
        "sellerId": item.seller_id,
        "price": item.price
    })
