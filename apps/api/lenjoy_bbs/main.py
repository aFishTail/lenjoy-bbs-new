from contextlib import asynccontextmanager

from fastapi import FastAPI

from lenjoy_bbs.api import api_router, internal_api_router
from lenjoy_bbs.core.config import get_settings
from lenjoy_bbs.core.errors import install_error_handlers
from lenjoy_bbs.core.logging import configure_logging, install_request_logging
from lenjoy_bbs.db.seed import seed_database
from lenjoy_bbs.db.session import SessionLocal


async def seed_development_data() -> None:
    settings = get_settings()
    if not settings.is_development:
        return

    async with SessionLocal() as db:
        await seed_database(db)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await seed_development_data()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings)
    settings.validate_runtime_configuration()
    app = FastAPI(title="Lenjoy BBS API", version="1.0.0", lifespan=lifespan)
    install_request_logging(app)
    install_error_handlers(app)
    app.include_router(api_router)
    app.include_router(internal_api_router)
    return app


app = create_app()
