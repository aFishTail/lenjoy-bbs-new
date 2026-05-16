from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from sqlalchemy.orm import aliased

from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.modules.auth.repository import find_user_by_any_identifier
from lenjoy_bbs.modules.messages.service import create_site_message
from lenjoy_bbs.modules.open_api.constants import OPEN_API_SYSTEM_EMAIL, OPEN_API_SYSTEM_USERNAME
from lenjoy_bbs.modules.posts.models import Post, ResourcePurchase
from lenjoy_bbs.modules.reports.models import ResourceAppeal
from lenjoy_bbs.modules.common import user_public
from lenjoy_bbs.modules.users.models import UserAccount, UserFollow
from lenjoy_bbs.modules.users.schemas import ProfileUpdateRequest


async def _profile_counts(db: AsyncSession,
                          user_id: int) -> tuple[int, int, int]:
    post_count = await db.scalar(
        select(func.count()).select_from(Post).where(
            Post.author_id == user_id,
            Post.is_deleted.is_(False),
        )) or 0
    following_count = await db.scalar(
        select(func.count()).select_from(UserFollow).where(
            UserFollow.follower_id == user_id, )) or 0
    follower_count = await db.scalar(
        select(func.count()).select_from(UserFollow).where(
            UserFollow.following_id == user_id, )) or 0
    return post_count, following_count, follower_count


async def build_my_profile(db: AsyncSession, user: UserAccount) -> dict:
    post_count, following_count, follower_count = await _profile_counts(
        db, user.id)
    return {
        **user_public(user),
        "postCount": post_count,
        "followingCount": following_count,
        "followerCount": follower_count,
    }


def _serialize_purchase_summary(row) -> dict:
    purchase, post_title, buyer_username, seller_username, appeal_status = row
    return {
        "purchaseId": purchase.id,
        "postId": purchase.post_id,
        "postTitle": post_title,
        "buyerId": purchase.buyer_id,
        "buyerUsername": buyer_username,
        "sellerId": purchase.seller_id,
        "sellerUsername": seller_username,
        "price": purchase.price,
        "refundedAmount": purchase.refunded_amount,
        "status": purchase.status,
        "appealStatus": appeal_status,
        "purchasedAt": purchase.created_at.isoformat(),
        "updatedAt": purchase.updated_at.isoformat(),
    }


async def list_my_followers(db: AsyncSession, user_id: int) -> list[dict]:
    rows = (await db.execute(
        select(UserAccount.id, UserAccount.username, UserAccount.avatar_url,
               UserFollow.created_at).join(
                   UserFollow, UserFollow.follower_id == UserAccount.id).where(
                       UserFollow.following_id == user_id).order_by(
                           UserFollow.created_at.desc()))).all()
    return [{
        "id": row.id,
        "username": row.username,
        "avatarUrl": row.avatar_url,
        "followedAt": row.created_at.isoformat(),
    } for row in rows]


async def list_my_following(db: AsyncSession, user_id: int) -> list[dict]:
    rows = (await db.execute(
        select(UserAccount.id, UserAccount.username, UserAccount.avatar_url,
               UserFollow.created_at).join(
                   UserFollow,
                   UserFollow.following_id == UserAccount.id).where(
                       UserFollow.follower_id == user_id).order_by(
                           UserFollow.created_at.desc()))).all()
    return [{
        "id": row.id,
        "username": row.username,
        "avatarUrl": row.avatar_url,
        "followedAt": row.created_at.isoformat(),
    } for row in rows]


async def toggle_follow(db: AsyncSession, current_user: UserAccount,
                        target_user_id: int) -> dict:
    if current_user.id == target_user_id:
        raise ApiError("INVALID_OPERATION", "User cannot follow themselves")

    target_user = await db.scalar(
        select(UserAccount).where(UserAccount.id == target_user_id))
    if target_user is None:
        raise ApiError("USER_NOT_FOUND", "User does not exist", 404)

    relation = await db.scalar(
        select(UserFollow).where(UserFollow.follower_id == current_user.id,
                                 UserFollow.following_id == target_user_id))
    following = relation is None

    if relation is None:
        db.add(
            UserFollow(follower_id=current_user.id,
                       following_id=target_user_id))
        await create_site_message(
            db,
            user_id=target_user_id,
            title="你有新的关注者",
            content=f"{current_user.username}关注了你。",
            message_type="USER_FOLLOWED",
        )
    else:
        await db.delete(relation)
    await db.commit()

    follower_count = await db.scalar(
        select(func.count()).select_from(UserFollow).where(
            UserFollow.following_id == target_user_id, )) or 0
    following_count = await db.scalar(
        select(func.count()).select_from(UserFollow).where(
            UserFollow.follower_id == current_user.id, )) or 0
    return {
        "following": following,
        "followerCount": follower_count,
        "followingCount": following_count,
    }


async def list_my_resource_purchases(db: AsyncSession,
                                     user_id: int) -> list[dict]:
    buyer = aliased(UserAccount)
    seller = aliased(UserAccount)
    rows = (await db.execute(
        select(
            ResourcePurchase,
            Post.title,
            buyer.username,
            seller.username,
            ResourceAppeal.status,
        ).join(Post, Post.id == ResourcePurchase.post_id).join(
            buyer, buyer.id == ResourcePurchase.buyer_id).join(
                seller, seller.id == ResourcePurchase.seller_id).outerjoin(
                    ResourceAppeal,
                    ResourceAppeal.purchase_id == ResourcePurchase.id).where(
                        ResourcePurchase.buyer_id == user_id).order_by(
                            ResourcePurchase.created_at.desc()))).all()
    return [_serialize_purchase_summary(row) for row in rows]


async def list_my_resource_sales(db: AsyncSession, user_id: int) -> list[dict]:
    buyer = aliased(UserAccount)
    seller = aliased(UserAccount)
    rows = (await db.execute(
        select(
            ResourcePurchase,
            Post.title,
            buyer.username,
            seller.username,
            ResourceAppeal.status,
        ).join(Post, Post.id == ResourcePurchase.post_id).join(
            buyer, buyer.id == ResourcePurchase.buyer_id).join(
                seller, seller.id == ResourcePurchase.seller_id).outerjoin(
                    ResourceAppeal,
                    ResourceAppeal.purchase_id == ResourcePurchase.id).where(
                        ResourcePurchase.seller_id == user_id).order_by(
                            ResourcePurchase.created_at.desc()))).all()
    return [_serialize_purchase_summary(row) for row in rows]


async def update_profile(db: AsyncSession, user: UserAccount,
                         payload: ProfileUpdateRequest) -> dict:
    next_username = (payload.username or user.username).strip()
    if next_username.lower() == OPEN_API_SYSTEM_USERNAME or (
        (user.email or "").lower() == OPEN_API_SYSTEM_EMAIL
            and next_username != user.username):
        raise ApiError("ACCOUNT_RESERVED", "Account identifier is reserved")
    if next_username != user.username:
        conflict = await find_user_by_any_identifier(db, [next_username])
        if conflict and conflict.id != user.id:
            raise ApiError("ACCOUNT_IDENTIFIER_CONFLICT",
                           "Account identifiers must be globally unique")
        user.username = next_username
    user.avatar_url = payload.avatar_url
    user.bio = payload.bio
    await db.flush()
    await db.commit()
    await db.refresh(user)
    return await build_my_profile(db, user)


__all__ = [
    "build_my_profile",
    "list_my_followers",
    "list_my_following",
    "list_my_resource_purchases",
    "list_my_resource_sales",
    "toggle_follow",
    "update_profile",
]
