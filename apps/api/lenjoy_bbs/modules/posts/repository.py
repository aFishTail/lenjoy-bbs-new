from sqlalchemy import desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.modules.posts.models import Post, PostComment, PostTag, ResourcePurchase


async def find_post(db: AsyncSession,
                    post_id: int,
                    include_deleted: bool = False) -> Post | None:
    query = select(Post).where(Post.id == post_id)
    if not include_deleted:
        query = query.where(Post.is_deleted.is_(False))
    return await db.scalar(query)


async def find_published_post(db: AsyncSession, post_id: int) -> Post | None:
    return await db.scalar(
        select(Post).where(
            Post.id == post_id,
            Post.is_deleted.is_(False),
            Post.status == "PUBLISHED",
        ))


def build_published_posts_query(
    post_type: str | None = None,
    category_id: int | None = None,
    tag_id: int | None = None,
    keyword: str | None = None,
    author_id: int | None = None,
):
    query = select(Post).where(
        Post.is_deleted.is_(False),
        Post.status == "PUBLISHED",
    )
    if post_type:
        query = query.where(Post.post_type == post_type)
    if category_id is not None:
        query = query.where(Post.category_id == category_id)
    if tag_id is not None:
        query = query.where(
            Post.id.in_(
                select(PostTag.post_id).where(PostTag.tag_id == tag_id)))
    if author_id is not None:
        query = query.where(Post.author_id == author_id)
    normalized_keyword = (keyword or "").strip()
    if normalized_keyword:
        pattern = f"%{normalized_keyword}%"
        query = query.where(
            or_(Post.title.ilike(pattern), Post.content.ilike(pattern)))
    return query


async def list_published_posts(
    db: AsyncSession,
    limit: int = 20,
    offset: int = 0,
    post_type: str | None = None,
    category_id: int | None = None,
    tag_id: int | None = None,
    keyword: str | None = None,
    author_id: int | None = None,
) -> list[Post]:
    result = await db.scalars(
        build_published_posts_query(
            post_type, category_id, tag_id, keyword, author_id).order_by(
                desc(Post.created_at)).limit(limit).offset(offset))
    return result.unique().all()


async def user_purchased_post(db: AsyncSession, post_id: int,
                              user_id: int) -> bool:
    return bool(await db.scalar(
        select(ResourcePurchase).where(
            ResourcePurchase.post_id == post_id,
            ResourcePurchase.buyer_id == user_id,
            ResourcePurchase.status == "PAID",
        )))


async def list_comments(db: AsyncSession, post_id: int) -> list[PostComment]:
    result = await db.scalars(
        select(PostComment).where(PostComment.post_id == post_id,
                                  PostComment.is_deleted.is_(False)).order_by(
                                      PostComment.created_at.asc()))
    return result.unique().all()
