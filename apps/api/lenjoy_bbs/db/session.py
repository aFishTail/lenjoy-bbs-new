from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from lenjoy_bbs.core.config import get_settings


def create_engine_for_settings() -> AsyncEngine:
    settings = get_settings()
    if settings.sqlalchemy_async_url == "sqlite+aiosqlite://":
        return create_async_engine(
            settings.sqlalchemy_async_url,
            echo=settings.sql_log_enabled,
            poolclass=StaticPool,
            future=True,
        )
    return create_async_engine(
        settings.sqlalchemy_async_url,
        echo=settings.sql_log_enabled,
        pool_pre_ping=True,
        future=True,
    )


engine = create_engine_for_settings()
SessionLocal = async_sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, class_=AsyncSession)


async def get_db() -> AsyncGenerator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
