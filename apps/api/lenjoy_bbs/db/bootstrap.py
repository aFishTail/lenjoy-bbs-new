"""SQLite-only local/test bootstrap helpers.

This module exists for local development and tests that use SQLite. It is not
part of FastAPI startup and must not be used as a production schema bootstrap.
Production schema changes belong in Alembic migrations.
"""

import asyncio

from lenjoy_bbs.core.config import get_settings
from lenjoy_bbs.db.model_registry import Base
from lenjoy_bbs.db.seed import seed_database
from lenjoy_bbs.db.session import SessionLocal, engine


async def _init_sqlite_database() -> None:
    """Create and seed the local/test SQLite schema."""
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    async with SessionLocal() as db:
        await seed_database(db)


def init_app_database() -> None:
    """Initialize SQLite fixtures for local/test workflows only, never production startup."""
    settings = get_settings()
    if settings.uses_sqlite and settings.is_development:
        asyncio.run(_init_sqlite_database())
