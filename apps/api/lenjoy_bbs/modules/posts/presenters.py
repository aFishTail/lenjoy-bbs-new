from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.modules.posts.models import CommentLike, Post, PostComment, PostFavorite, PostLike, PostTag, ResourcePurchase
from lenjoy_bbs.modules.posts.repository import user_purchased_post
from lenjoy_bbs.modules.reports.models import ResourceAppeal
from lenjoy_bbs.modules.taxonomy.models import Category, Tag
from lenjoy_bbs.modules.users.models import UserAccount


async def load_usernames(db: AsyncSession,
                         user_ids: set[int | None]) -> dict[int, str]:
    filtered_user_ids = {
        user_id
        for user_id in user_ids if user_id is not None
    }
    if not filtered_user_ids:
        return {}

    rows = await db.execute(
        select(UserAccount.id, UserAccount.nickname, UserAccount.username).where(
            UserAccount.id.in_(filtered_user_ids)))
    return {
        user_id: nickname or username
        for user_id, nickname, username in rows.all()
    }


async def load_post_stats(
        db: AsyncSession,
        post_ids: set[int | None]) -> dict[int, dict[str, int]]:
    filtered_post_ids = {
        post_id
        for post_id in post_ids if post_id is not None
    }
    if not filtered_post_ids:
        return {}

    stats = {
        post_id: {
            "likeCount": 0,
            "collectCount": 0,
            "commentCount": 0,
            "answerCount": 0,
        }
        for post_id in filtered_post_ids
    }

    like_rows = await db.execute(
        select(PostLike.post_id, func.count(PostLike.id)).where(
            PostLike.post_id.in_(filtered_post_ids)).group_by(PostLike.post_id)
    )
    for post_id, count in like_rows.all():
        stats[post_id]["likeCount"] = count

    favorite_rows = await db.execute(
        select(PostFavorite.post_id, func.count(PostFavorite.id)).where(
            PostFavorite.post_id.in_(filtered_post_ids)).group_by(
                PostFavorite.post_id))
    for post_id, count in favorite_rows.all():
        stats[post_id]["collectCount"] = count

    comment_rows = await db.execute(
        select(PostComment.post_id, func.count(PostComment.id)).where(
            PostComment.post_id.in_(filtered_post_ids),
            PostComment.is_deleted.is_(False),
        ).group_by(PostComment.post_id))
    for post_id, count in comment_rows.all():
        stats[post_id]["commentCount"] = count

    answer_rows = await db.execute(
        select(PostComment.post_id, func.count(PostComment.id)).where(
            PostComment.post_id.in_(filtered_post_ids),
            PostComment.is_deleted.is_(False),
            PostComment.parent_id.is_(None),
        ).group_by(PostComment.post_id))
    for post_id, count in answer_rows.all():
        stats[post_id]["answerCount"] = count

    return stats


async def load_comment_like_counts(db: AsyncSession,
                                   comment_ids: set[int | None]) -> dict[int,
                                                                          int]:
    filtered_comment_ids = {
        comment_id
        for comment_id in comment_ids if comment_id is not None
    }
    if not filtered_comment_ids:
        return {}

    counts = {comment_id: 0 for comment_id in filtered_comment_ids}
    rows = await db.execute(
        select(CommentLike.comment_id, func.count(CommentLike.id)).where(
            CommentLike.comment_id.in_(filtered_comment_ids)).group_by(
                CommentLike.comment_id))
    for comment_id, count in rows.all():
        counts[comment_id] = count
    return counts


async def load_viewer_liked_comment_ids(
        db: AsyncSession, comment_ids: set[int | None],
        viewer: UserAccount | None) -> set[int]:
    if viewer is None:
        return set()
    filtered_comment_ids = {
        comment_id
        for comment_id in comment_ids if comment_id is not None
    }
    if not filtered_comment_ids:
        return set()

    rows = await db.scalars(
        select(CommentLike.comment_id).where(
            CommentLike.comment_id.in_(filtered_comment_ids),
            CommentLike.user_id == viewer.id,
        ))
    return set(rows.all())


async def load_category_names(db: AsyncSession,
                              category_ids: set[int | None]) -> dict[int, str]:
    filtered_category_ids = {
        category_id
        for category_id in category_ids if category_id is not None
    }
    if not filtered_category_ids:
        return {}

    rows = await db.execute(
        select(Category.id,
               Category.name).where(Category.id.in_(filtered_category_ids)))
    return {category_id: name for category_id, name in rows.all()}


async def load_post_tags(db: AsyncSession,
                         post_ids: set[int | None]) -> dict[int, list[dict]]:
    filtered_post_ids = {
        post_id
        for post_id in post_ids if post_id is not None
    }
    if not filtered_post_ids:
        return {}

    rows = await db.execute(
        select(
            PostTag.post_id,
            Tag.id,
            Tag.name,
            Tag.slug,
            Tag.status,
            Tag.source,
        ).join(Tag, Tag.id == PostTag.tag_id).where(
            PostTag.post_id.in_(filtered_post_ids)).order_by(
                PostTag.post_id, Tag.id))
    tags_by_post_id = {post_id: [] for post_id in filtered_post_ids}
    for post_id, tag_id, name, slug, status, source in rows.all():
        tags_by_post_id[post_id].append({
            "id": tag_id,
            "name": name,
            "slug": slug,
            "status": status,
            "source": source,
        })
    return tags_by_post_id


async def load_viewer_post_state(
    db: AsyncSession,
    post_ids: set[int | None],
    viewer_id: int | None,
) -> dict[int, dict[str, int | bool | str | None]]:
    filtered_post_ids = {
        post_id
        for post_id in post_ids if post_id is not None
    }
    if not filtered_post_ids or viewer_id is None:
        return {}

    state = {
        post_id: {
            "liked": False,
            "collected": False,
            "purchased": False,
            "purchaseId": None,
            "purchaseStatus": None,
            "refundedAmount": 0,
            "appealStatus": None,
        }
        for post_id in filtered_post_ids
    }

    liked_post_ids = (await db.scalars(
        select(PostLike.post_id).where(PostLike.user_id == viewer_id,
                                       PostLike.post_id.in_(filtered_post_ids))
    )).all()
    for post_id in liked_post_ids:
        state[post_id]["liked"] = True

    collected_post_ids = (await db.scalars(
        select(PostFavorite.post_id).where(
            PostFavorite.user_id == viewer_id,
            PostFavorite.post_id.in_(filtered_post_ids)))).all()
    for post_id in collected_post_ids:
        state[post_id]["collected"] = True

    purchase_rows = await db.execute(
        select(
            ResourcePurchase.post_id,
            ResourcePurchase.id,
            ResourcePurchase.status,
            ResourcePurchase.refunded_amount,
            ResourceAppeal.status,
        ).outerjoin(ResourceAppeal,
                    ResourceAppeal.purchase_id == ResourcePurchase.id).where(
                        ResourcePurchase.buyer_id == viewer_id,
                        ResourcePurchase.post_id.in_(filtered_post_ids)))
    for post_id, purchase_id, purchase_status, refunded_amount, appeal_status in purchase_rows.all(
    ):
        state[post_id].update({
            "purchased": True,
            "purchaseId": purchase_id,
            "purchaseStatus": purchase_status,
            "refundedAmount": refunded_amount,
            "appealStatus": appeal_status,
        })

    return state


def _default_post_stats() -> dict[str, int]:
    return {
        "likeCount": 0,
        "collectCount": 0,
        "commentCount": 0,
        "answerCount": 0,
    }


def _default_viewer_post_state() -> dict[str, int | bool | str | None]:
    return {
        "liked": False,
        "collected": False,
        "purchased": False,
        "purchaseId": None,
        "purchaseStatus": None,
        "refundedAmount": 0,
        "appealStatus": None,
    }


def _resolve_post_visibility(
        post: Post, viewer_id: int | None,
        state: dict[str, int | bool | str | None]) -> dict[str, bool]:
    purchased = bool(state["purchased"])
    is_resource = post.post_type == "RESOURCE" and bool(post.hidden_content)
    can_view_hidden = bool(post.hidden_content and viewer_id
                           and (viewer_id == post.author_id or purchased))
    can_purchase = bool(is_resource and viewer_id
                        and viewer_id != post.author_id and not purchased)
    return {
        "purchased": purchased,
        "canViewHidden": can_view_hidden,
        "canPurchase": can_purchase,
    }


async def serialize_post(
    db: AsyncSession,
    post: Post,
    viewer: UserAccount | None = None,
    usernames: dict[int, str] | None = None,
    post_stats: dict[int, dict[str, int]] | None = None,
    category_names: dict[int, str] | None = None,
    post_tags: dict[int, list[dict]] | None = None,
    viewer_state: dict[int, dict[str, int | bool | str | None]] | None = None,
) -> dict:
    viewer_id = viewer.id if viewer else None
    usernames = usernames or await load_usernames(db, {post.author_id})
    post_stats = post_stats or await load_post_stats(db, {post.id})
    category_names = category_names or await load_category_names(
        db, {post.category_id})
    post_tags = post_tags or await load_post_tags(db, {post.id})
    viewer_state = viewer_state or await load_viewer_post_state(
        db, {post.id}, viewer_id)
    stats = post_stats.get(post.id, _default_post_stats())
    state = viewer_state.get(post.id, _default_viewer_post_state())
    visibility = _resolve_post_visibility(post, viewer_id, state)
    category_name = (category_names.get(post.category_id)
                     if post.category_id is not None else None)
    bounty_expire_at = (post.bounty_expire_at.isoformat()
                        if post.bounty_expire_at else None)
    bounty_settled_at = (post.bounty_settled_at.isoformat()
                         if post.bounty_settled_at else None)
    offlined_at = post.offlined_at.isoformat() if post.offlined_at else None
    answer_count = stats["answerCount"] if post.post_type == "BOUNTY" else 0

    return {
        "id": post.id,
        "authorId": post.author_id,
        "authorUsername": usernames.get(post.author_id),
        "postType": post.post_type,
        "categoryId": post.category_id,
        "categoryName": category_name,
        "tags": post_tags.get(post.id, []),
        "title": post.title,
        "content": post.content,
        "hiddenContent":
        post.hidden_content if visibility["canViewHidden"] else None,
        "price": post.price or 0,
        "bountyAmount": post.bounty_amount,
        "bountyStatus": post.bounty_status,
        "bountyExpireAt": bounty_expire_at,
        "bountySettledAt": bounty_settled_at,
        "acceptedCommentId": post.accepted_comment_id,
        "status": post.status,
        "viewCount": post.view_count,
        "likeCount": stats["likeCount"],
        "collectCount": stats["collectCount"],
        "commentCount": stats["commentCount"],
        "answerCount": answer_count,
        "liked": bool(state["liked"]),
        "collected": bool(state["collected"]),
        "resourceUnlocked": visibility["canViewHidden"],
        "purchased": visibility["purchased"],
        "canPurchase": visibility["canPurchase"],
        "purchaseId": state["purchaseId"],
        "purchaseStatus": state["purchaseStatus"],
        "refundedAmount": state["refundedAmount"],
        "appealStatus": state["appealStatus"],
        "offlineReason": post.offline_reason,
        "offlinedAt": offlined_at,
        "createdAt": post.created_at.isoformat(),
        "updatedAt": post.updated_at.isoformat(),
    }


async def serialize_comment(db: AsyncSession,
                            comment: PostComment,
                            usernames: dict[int, str] | None = None,
                            *,
                            content: str | None = None,
                            can_view_content: bool = True,
                            masked_summary: str | None = None,
                            like_count: int = 0,
                            liked: bool = False,
                            replies: list[dict] | None = None) -> dict:
    usernames = usernames or await load_usernames(
        db, {comment.author_id, comment.reply_to_user_id})
    resolved_content = content
    if can_view_content and resolved_content is None:
        resolved_content = comment.content
    return {
        "id":
        comment.id,
        "postId":
        comment.post_id,
        "authorId":
        comment.author_id,
        "authorUsername":
        usernames.get(comment.author_id),
        "parentId":
        comment.parent_id,
        "replyToUserId":
        comment.reply_to_user_id,
        "replyToUsername":
        usernames.get(comment.reply_to_user_id)
        if comment.reply_to_user_id is not None else None,
        "content":
        resolved_content,
        "isAccepted":
        comment.is_accepted,
        "canViewContent":
        can_view_content,
        "maskedSummary":
        masked_summary,
        "deleted":
        comment.is_deleted,
        "likeCount":
        like_count,
        "liked":
        liked,
        "updatedAt":
        comment.updated_at.isoformat(),
        "replies":
        replies or [],
        "createdAt":
        comment.created_at.isoformat(),
    }


def _group_comments_by_parent(
        comments: list[PostComment]) -> dict[int | None, list[PostComment]]:
    comments_by_parent_id: dict[int | None, list[PostComment]] = {}
    for comment in comments:
        comments_by_parent_id.setdefault(comment.parent_id, []).append(comment)
    return comments_by_parent_id


def _accepted_summary(comment: PostComment, usernames: dict[int, str]) -> str:
    author_name = usernames.get(comment.author_id) or f"用户{comment.author_id}"
    return f"用户 {author_name} 发布的回答被采纳"


def _find_comment_by_id(comments: list[PostComment],
                        comment_id: int | None) -> PostComment | None:
    if comment_id is None:
        return None
    return next((comment for comment in comments if comment.id == comment_id),
                None)


def _order_comments_with_accepted_first(
        comments: list[PostComment],
        accepted_comment_id: int | None) -> list[PostComment]:
    return sorted(comments,
                  key=lambda item: (
                      item.id != accepted_comment_id,
                      item.created_at,
                  ))


async def _serialize_comment_tree(db: AsyncSession, comment: PostComment,
                                  comments_by_parent_id: dict[
                                      int | None, list[PostComment]],
                                  usernames: dict[int, str],
                                  like_counts: dict[int, int],
                                  liked_comment_ids: set[int]) -> dict:
    reply_items = [
        await _serialize_comment_tree(db, reply, comments_by_parent_id,
                                      usernames, like_counts,
                                      liked_comment_ids)
        for reply in comments_by_parent_id.get(comment.id, [])
    ]
    return await serialize_comment(db,
                                   comment,
                                   usernames=usernames,
                                   like_count=like_counts.get(comment.id, 0),
                                   liked=comment.id in liked_comment_ids,
                                   replies=reply_items)


async def _serialize_full_comment_tree_list(
        db: AsyncSession, comments: list[PostComment],
        comments_by_parent_id: dict[int | None, list[PostComment]],
        usernames: dict[int, str], like_counts: dict[int, int],
        liked_comment_ids: set[int]) -> list[dict]:
    return [
        await _serialize_comment_tree(db, comment, comments_by_parent_id,
                                      usernames, like_counts,
                                      liked_comment_ids) for comment in comments
    ]


async def _serialize_bounty_viewer_comments(
        db: AsyncSession, post: Post, top_level_comments: list[PostComment],
        viewer_id: int | None, usernames: dict[int, str],
        like_counts: dict[int, int], liked_comment_ids: set[int]) -> list[dict]:
    accepted_comment = _find_comment_by_id(top_level_comments,
                                           post.accepted_comment_id)
    visible_comments = [
        await serialize_comment(db,
                                comment,
                                usernames=usernames,
                                like_count=like_counts.get(comment.id, 0),
                                liked=comment.id in liked_comment_ids,
                                replies=[])
        for comment in top_level_comments if comment.author_id == viewer_id
    ] if viewer_id is not None else []

    if accepted_comment and accepted_comment.author_id != viewer_id:
        visible_comments.insert(
            0,
            await serialize_comment(
                db,
                accepted_comment,
                usernames=usernames,
                content=None,
                can_view_content=False,
                masked_summary=_accepted_summary(accepted_comment, usernames),
                like_count=like_counts.get(accepted_comment.id, 0),
                liked=accepted_comment.id in liked_comment_ids,
                replies=[],
            ),
        )

    if post.bounty_status == "RESOLVED" and viewer_id is None:
        return visible_comments[:1]
    return visible_comments


async def serialize_post_comments(
        db: AsyncSession,
        post: Post,
        comments: list[PostComment],
        viewer: UserAccount | None,
        usernames: dict[int, str] | None = None) -> list[dict]:
    usernames = usernames or await load_usernames(
        db,
        {comment.author_id
         for comment in comments}
        | {comment.reply_to_user_id
           for comment in comments},
    )
    comments_by_parent_id = _group_comments_by_parent(comments)
    top_level_comments = comments_by_parent_id.get(None, [])
    viewer_id = viewer.id if viewer else None
    is_post_author = viewer_id == post.author_id
    comment_ids = {comment.id for comment in comments}
    like_counts = await load_comment_like_counts(db, comment_ids)
    liked_comment_ids = await load_viewer_liked_comment_ids(
        db, comment_ids, viewer)

    if post.post_type != "BOUNTY":
        return await _serialize_full_comment_tree_list(db, top_level_comments,
                                                       comments_by_parent_id,
                                                       usernames, like_counts,
                                                       liked_comment_ids)

    if is_post_author:
        ordered_comments = _order_comments_with_accepted_first(
            top_level_comments, post.accepted_comment_id)
        return await _serialize_full_comment_tree_list(db, ordered_comments,
                                                       comments_by_parent_id,
                                                       usernames, like_counts,
                                                       liked_comment_ids)

    return await _serialize_bounty_viewer_comments(db, post,
                                                   top_level_comments,
                                                   viewer_id, usernames,
                                                   like_counts,
                                                   liked_comment_ids)
