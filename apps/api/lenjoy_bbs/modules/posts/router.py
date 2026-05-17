import hashlib

from fastapi import APIRouter, Query, Request, status
from sqlalchemy import func, select

from lenjoy_bbs.core.api_schemas import ApiEnvelope, PageData
from lenjoy_bbs.core.dependencies import CurrentUser, DbSession, OptionalCurrentUser
from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.core.responses import success
from lenjoy_bbs.modules.posts import repository
from lenjoy_bbs.modules.posts.models import Post
from lenjoy_bbs.modules.posts.presenters import load_category_names, load_post_stats, load_post_tags, load_usernames, load_viewer_post_state, serialize_comment, serialize_post, serialize_post_comments
from lenjoy_bbs.modules.posts.schemas import CommentCreateRequest, CommentResponse, InteractionToggleResponse, PostCreateRequest, PostPurchaseResponse, PostResponse, PostUpdateRequest, PostViewResponse
from lenjoy_bbs.modules.posts.service import accept_bounty_answer, create_comment, create_post, delete_post, purchase_post, record_post_view, toggle_post_favorite, toggle_post_like, update_post

router = APIRouter(prefix="/posts", tags=["posts"])


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
                     keyword: str | None = Query(default=None),
                     pageSize: int = Query(20, ge=1, le=100)):
    normalized_keyword = (keyword or "").strip()
    if len(normalized_keyword) > 100:
        raise ApiError("INVALID_KEYWORD", "Keyword is too long",
                       status.HTTP_422_UNPROCESSABLE_CONTENT)
    keyword_filter = normalized_keyword or None
    offset = max(page - 1, 0) * pageSize
    posts = await repository.list_published_posts(db, pageSize, offset,
                                                  postType, categoryId, tagId,
                                                  keyword_filter)
    usernames = await load_usernames(db, {post.author_id for post in posts})
    post_stats = await load_post_stats(db, {post.id for post in posts})
    category_names = await load_category_names(
        db, {post.category_id
             for post in posts})
    post_tags = await load_post_tags(db, {post.id for post in posts})
    total = await db.scalar(
        select(func.count()).select_from(
            repository.build_published_posts_query(postType, categoryId, tagId,
                                                   keyword_filter).subquery()
        )) or 0
    total_pages = max(1, (total + pageSize - 1) // pageSize)
    return success({
        "items": [
            await serialize_post(db,
                                 post,
                                 usernames=usernames,
                                 post_stats=post_stats,
                                 category_names=category_names,
                                 post_tags=post_tags) for post in posts
        ],
        "page":
        page,
        "pageSize":
        pageSize,
        "total":
        total,
        "totalPages":
        total_pages,
        "hasNext":
        page < total_pages,
        "hasPrevious":
        page > 1,
    })


@router.get("/mine")
@router.get("/mine", response_model=ApiEnvelope[PageData[PostResponse]])
async def my_posts(db: DbSession,
                   user: CurrentUser,
                   page: int = Query(1, ge=1),
                   pageSize: int = Query(20, ge=1, le=100)):
    offset = max(page - 1, 0) * pageSize
    query = select(Post).where(Post.author_id == user.id,
                               Post.is_deleted.is_(False))
    posts = (await db.scalars(
        query.order_by(Post.created_at.desc()).limit(pageSize).offset(offset)
    )).all()
    usernames = await load_usernames(db, {post.author_id for post in posts})
    post_stats = await load_post_stats(db, {post.id for post in posts})
    category_names = await load_category_names(
        db, {post.category_id
             for post in posts})
    post_tags = await load_post_tags(db, {post.id for post in posts})
    viewer_state = await load_viewer_post_state(db,
                                                {post.id
                                                 for post in posts}, user.id)
    total = await db.scalar(
        select(func.count()).select_from(query.subquery())) or 0
    total_pages = max(1, (total + pageSize - 1) // pageSize)
    return success({
        "items": [
            await serialize_post(db,
                                 post,
                                 user,
                                 usernames=usernames,
                                 post_stats=post_stats,
                                 category_names=category_names,
                                 post_tags=post_tags,
                                 viewer_state=viewer_state) for post in posts
        ],
        "page":
        page,
        "pageSize":
        pageSize,
        "total":
        total,
        "totalPages":
        total_pages,
        "hasNext":
        page < total_pages,
        "hasPrevious":
        page > 1,
    })


@router.post("",
             status_code=status.HTTP_201_CREATED,
             response_model=ApiEnvelope[PostResponse])
async def create(payload: PostCreateRequest, db: DbSession, user: CurrentUser):
    return success(await serialize_post(db, await
                                        create_post(db, payload, user), user))


@router.get("/{post_id}", response_model=ApiEnvelope[PostResponse])
async def detail(post_id: int, db: DbSession, user: OptionalCurrentUser):
    post = await repository.find_published_post(db, post_id)
    if post is None:
        raise ApiError("POST_NOT_FOUND", "Post does not exist",
                       status.HTTP_404_NOT_FOUND)
    return success(await serialize_post(db, post, user))


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


@router.get("/{post_id}/comments",
            response_model=ApiEnvelope[list[CommentResponse]])
async def comments(post_id: int, db: DbSession, user: OptionalCurrentUser):
    post = await repository.find_published_post(db, post_id)
    if not post:
        raise ApiError("POST_NOT_FOUND", "Post does not exist",
                       status.HTTP_404_NOT_FOUND)
    items = await repository.list_comments(db, post_id)
    usernames = await load_usernames(
        db,
        {comment.author_id
         for comment in items}
        | {comment.reply_to_user_id
           for comment in items},
    )
    return success(await serialize_post_comments(db,
                                                 post,
                                                 items,
                                                 user,
                                                 usernames=usernames))


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
        db, await accept_bounty_answer(db, post_id, comment_id, user)))


@router.post("/{post_id}/purchase",
             status_code=status.HTTP_201_CREATED,
             response_model=ApiEnvelope[PostPurchaseResponse])
async def purchase(post_id: int, db: DbSession, user: CurrentUser):
    item = await purchase_post(db, post_id, user)
    return success({
        "id": item.id,
        "postId": item.post_id,
        "buyerId": item.buyer_id,
        "sellerId": item.seller_id,
        "price": item.price
    })
