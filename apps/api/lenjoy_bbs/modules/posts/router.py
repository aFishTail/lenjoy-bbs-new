from fastapi import APIRouter, Query, status
from sqlalchemy import func, select

from lenjoy_bbs.core.api_schemas import ApiEnvelope
from lenjoy_bbs.core.dependencies import CurrentUser, DbSession, OptionalCurrentUser
from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.core.responses import success
from lenjoy_bbs.modules.posts import repository
from lenjoy_bbs.modules.posts.models import Post
from lenjoy_bbs.modules.posts.presenters import serialize_comment, serialize_post
from lenjoy_bbs.modules.posts.schemas import CommentCreateRequest, CommentResponse, PostCreateRequest, PostPurchaseResponse, PostResponse, PostUpdateRequest
from lenjoy_bbs.modules.posts.service import create_comment, create_post, delete_post, purchase_post, update_post

router = APIRouter(prefix="/posts", tags=["posts"])


@router.get("", response_model=ApiEnvelope[list[PostResponse]])
async def list_posts(db: DbSession, page: int = Query(1, ge=1), pageSize: int = Query(20, ge=1, le=100)):
    offset = max(page - 1, 0) * pageSize
    posts = await repository.list_published_posts(db, pageSize, offset)
    total = await db.scalar(select(func.count()).select_from(Post).where(Post.is_deleted.is_(False), Post.status == "PUBLISHED")) or 0
    return success([await serialize_post(db, post) for post in posts], page=page, pageSize=pageSize, total=total)


@router.get("/mine")
async def my_posts(db: DbSession, user: CurrentUser):
    posts = (await db.scalars(select(Post).where(Post.author_id == user.id, Post.is_deleted.is_(False)))).all()
    return success([await serialize_post(db, post, user) for post in posts])


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ApiEnvelope[PostResponse])
async def create(payload: PostCreateRequest, db: DbSession, user: CurrentUser):
    return success(await serialize_post(db, await create_post(db, payload, user), user))


@router.get("/{post_id}", response_model=ApiEnvelope[PostResponse])
async def detail(post_id: int, db: DbSession, user: OptionalCurrentUser):
    post = await repository.find_published_post(db, post_id)
    if post is None:
        raise ApiError("POST_NOT_FOUND", "Post does not exist", status.HTTP_404_NOT_FOUND)
    return success(await serialize_post(db, post, user))


@router.put("/{post_id}", response_model=ApiEnvelope[PostResponse])
async def update(
    post_id: int,
    payload: PostUpdateRequest,
    db: DbSession,
    user: CurrentUser,
):
    return success(await serialize_post(db, await update_post(db, post_id, payload, user), user))


@router.delete("/{post_id}")
async def delete(post_id: int, db: DbSession, user: CurrentUser):
    await delete_post(db, post_id, user)
    return success(None)


@router.get("/{post_id}/comments", response_model=ApiEnvelope[list[CommentResponse]])
async def comments(post_id: int, db: DbSession):
    if not await repository.find_published_post(db, post_id):
        raise ApiError("POST_NOT_FOUND", "Post does not exist", status.HTTP_404_NOT_FOUND)
    return success([serialize_comment(comment) for comment in await repository.list_comments(db, post_id)])


@router.post("/{post_id}/comments", status_code=status.HTTP_201_CREATED, response_model=ApiEnvelope[CommentResponse])
async def add_comment(
    post_id: int,
    payload: CommentCreateRequest,
    db: DbSession,
    user: CurrentUser,
):
    return success(serialize_comment(await create_comment(db, post_id, payload, user)))


@router.post("/{post_id}/purchase", status_code=status.HTTP_201_CREATED, response_model=ApiEnvelope[PostPurchaseResponse])
async def purchase(post_id: int, db: DbSession, user: CurrentUser):
    item = await purchase_post(db, post_id, user)
    return success({"id": item.id, "postId": item.post_id, "buyerId": item.buyer_id, "sellerId": item.seller_id, "price": item.price})
