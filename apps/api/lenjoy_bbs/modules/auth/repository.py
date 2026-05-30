from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.modules.users.models import Role, UserAccount, UserRole


async def find_user_by_account(db: AsyncSession, account: str) -> UserAccount | None:
    return await db.scalar(
        select(UserAccount).where(
            or_(
                UserAccount.username == account,
                UserAccount.email == account,
                UserAccount.phone == account,
            )
        )
    )


async def find_user_by_any_identifier(db: AsyncSession, identifiers: list[str]) -> UserAccount | None:
    non_empty_identifiers = [identifier for identifier in identifiers if identifier]
    if not non_empty_identifiers:
        return None
    return await db.scalar(
        select(UserAccount).where(
            or_(
                UserAccount.username.in_(non_empty_identifiers),
                UserAccount.email.in_(non_empty_identifiers),
                UserAccount.phone.in_(non_empty_identifiers),
            )
        )
    )


async def find_user_role(db: AsyncSession) -> Role:
    role = await db.scalar(select(Role).where(Role.role_code == "USER"))
    if role is None:
        role = Role(role_code="USER", role_name="普通用户")
        db.add(role)
        await db.flush()
    return role


async def assign_user_role(db: AsyncSession, user: UserAccount) -> None:
    role = await find_user_role(db)
    db.add(UserRole(user_id=user.id, role_id=role.id))
