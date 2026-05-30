from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.core.messages import Posts
from lenjoy_bbs.modules.posts import repository
from lenjoy_bbs.modules.posts.models import Post
from lenjoy_bbs.modules.posts.presenters import load_category_names, load_post_stats, load_post_tags, load_usernames, load_viewer_post_state, serialize_post, serialize_post_comments
from lenjoy_bbs.modules.users.models import UserAccount


async def list_posts_feed(db: AsyncSession,
                          page: int,
                          page_size: int,
                          post_type: str | None = None,
                          category_id: int | None = None,
                          tag_id: int | None = None,
                          keyword: str | None = None,
                          author_id: int | None = None) -> dict:
    offset = max(page - 1, 0) * page_size
    posts = await repository.list_published_posts(db, page_size, offset,
                                                  post_type, category_id,
                                                  tag_id, keyword, author_id)
    usernames = await load_usernames(db, {post.author_id for post in posts})
    post_stats = await load_post_stats(db, {post.id for post in posts})
    category_names = await load_category_names(
        db, {post.category_id
             for post in posts})
    post_tags = await load_post_tags(db, {post.id for post in posts})
    total = await db.scalar(
        select(func.count()).select_from(
            repository.build_published_posts_query(
                post_type, category_id, tag_id, keyword,
                author_id).subquery())) or 0
    total_pages = max(1, (total + page_size - 1) // page_size)
    return {
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
        page_size,
        "total":
        total,
        "totalPages":
        total_pages,
        "hasNext":
        page < total_pages,
        "hasPrevious":
        page > 1,
    }


async def list_my_posts_feed(db: AsyncSession, user: UserAccount, page: int,
                             page_size: int) -> dict:
    offset = max(page - 1, 0) * page_size
    query = select(Post).where(Post.author_id == user.id,
                               Post.is_deleted.is_(False))
    posts = (await db.scalars(
        query.order_by(Post.created_at.desc()).limit(page_size).offset(offset)
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
    total_pages = max(1, (total + page_size - 1) // page_size)
    return {
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
        page_size,
        "total":
        total,
        "totalPages":
        total_pages,
        "hasNext":
        page < total_pages,
        "hasPrevious":
        page > 1,
    }


async def read_post_detail(db: AsyncSession, post_id: int,
                           viewer: UserAccount | None) -> dict:
    post = await repository.find_published_post(db, post_id)
    if post is None:
        raise ApiError(Posts.POST_NOT_FOUND)
    return await serialize_post(db, post, viewer)


async def read_post_comments(db: AsyncSession, post_id: int,
                             viewer: UserAccount | None) -> list[dict]:
    post = await repository.find_published_post(db, post_id)
    if not post:
        raise ApiError(Posts.POST_NOT_FOUND)
    items = await repository.list_comments(db, post_id)
    usernames = await load_usernames(
        db,
        {comment.author_id
         for comment in items}
        | {comment.reply_to_user_id
           for comment in items},
    )
    return await serialize_post_comments(db,
                                         post,
                                         items,
                                         viewer,
                                         usernames=usernames)


__all__ = [
    "list_my_posts_feed", "list_posts_feed", "read_post_comments",
    "read_post_detail"
]
