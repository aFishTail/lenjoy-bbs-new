from fastapi import APIRouter
from lenjoy_bbs.core.dependencies import CurrentUser, DbSession
from lenjoy_bbs.core.responses import success
from lenjoy_bbs.modules.messages.service import list_messages, mark_all_messages_read, mark_message_read, unread_count as get_unread_count

router = APIRouter(prefix="/me/messages", tags=["messages"])


@router.get("")
async def messages(db: DbSession, user: CurrentUser, limit: int = 50):
    return success(await list_messages(db, user.id, limit))


@router.get("/unread-count")
async def unread_count(db: DbSession, user: CurrentUser):
    return success(await get_unread_count(db, user.id))


@router.patch("/{message_id}/read")
async def read_message(message_id: int, db: DbSession, user: CurrentUser):
    await mark_message_read(db, user.id, message_id)
    return success(None)


@router.patch("/read-all")
async def read_all_messages(db: DbSession, user: CurrentUser):
    return success(await mark_all_messages_read(db, user.id))
