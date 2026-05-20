from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from lenjoy_bbs.core.auth_dependencies import current_user, optional_current_user, require_admin
from lenjoy_bbs.db.session import get_db
from lenjoy_bbs.modules.users.models import UserAccount

DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[UserAccount, Depends(current_user)]
OptionalCurrentUser = Annotated[UserAccount | None,
                                Depends(optional_current_user)]
AdminUser = Annotated[UserAccount, Depends(require_admin)]
