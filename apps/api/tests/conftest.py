import asyncio
import os

import pytest

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("CAPTCHA_DEBUG_ENABLED", "true")

from lenjoy_bbs.core.config import get_settings
from lenjoy_bbs.db.model_registry import Base
from lenjoy_bbs.db.seed import seed_database
from lenjoy_bbs.db.session import SessionLocal, engine


async def reset_database_state() -> None:
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)
    async with SessionLocal() as db:
        await seed_database(db)


@pytest.fixture(autouse=True)
def reset_database():
    get_settings.cache_clear()
    asyncio.run(reset_database_state())
    yield
    get_settings.cache_clear()
