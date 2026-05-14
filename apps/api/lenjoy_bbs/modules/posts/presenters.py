from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.modules.posts.models import Post, PostComment
from lenjoy_bbs.modules.posts.repository import user_purchased_post
from lenjoy_bbs.modules.users.models import UserAccount


async def serialize_post(db: AsyncSession, post: Post, viewer: UserAccount | None = None) -> dict:
    viewer_id = viewer.id if viewer else None
    can_view_hidden = bool(
        post.hidden_content
        and viewer_id
        and (viewer_id == post.author_id or await user_purchased_post(db, post.id, viewer_id))
    )
    return {
        "id": post.id,
        "authorId": post.author_id,
        "type": post.post_type,
        "title": post.title,
        "content": post.content,
        "hiddenContent": post.hidden_content if can_view_hidden else None,
        "price": post.price or 0,
        "status": post.status,
        "createdAt": post.created_at.isoformat(),
        "updatedAt": post.updated_at.isoformat(),
    }


def serialize_comment(comment: PostComment) -> dict:
    return {
        "id": comment.id,
        "postId": comment.post_id,
        "authorId": comment.author_id,
        "parentId": comment.parent_id,
        "replyToUserId": comment.reply_to_user_id,
        "content": comment.content,
        "isAccepted": comment.is_accepted,
        "createdAt": comment.created_at.isoformat(),
    }
