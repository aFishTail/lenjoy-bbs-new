from contextlib import asynccontextmanager

from fastapi import FastAPI

from lenjoy_bbs.api import api_router, internal_api_router
from lenjoy_bbs.core.config import get_settings
from lenjoy_bbs.core.errors import install_error_handlers
from lenjoy_bbs.core.logging import configure_logging, install_request_logging
from lenjoy_bbs.core.rate_limiting import limiter, rate_limit_exceeded_handler
from lenjoy_bbs.db.seed import seed_database
from lenjoy_bbs.db.session import SessionLocal
from lenjoy_bbs.modules.internal_admin.idempotency import InternalAdminIdempotencyMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware


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
    # Disable Swagger/OpenAPI docs in non-development environments to
    # avoid exposing the API structure to potential attackers. In dev
    # mode, docs are available at /docs, /redoc, /openapi.json.
    docs_enabled = settings.is_development
    app = FastAPI(
        title="Lenjoy BBS API",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs" if docs_enabled else None,
        redoc_url="/redoc" if docs_enabled else None,
        openapi_url="/openapi.json" if docs_enabled else None,
    )
    app.add_middleware(InternalAdminIdempotencyMiddleware)
    app.add_middleware(SlowAPIMiddleware)
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
    install_request_logging(app)
    install_error_handlers(app)
    app.include_router(api_router)
    app.include_router(internal_api_router)
    return app


app = create_app()
