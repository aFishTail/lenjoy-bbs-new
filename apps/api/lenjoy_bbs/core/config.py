from functools import lru_cache
from pathlib import Path
from urllib.parse import urlparse

from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_JWT_SECRET = "lenjoy-jwt-secret-change-me-at-least-32-chars"
DEFAULT_INTERNAL_SERVICE_TOKEN = "__INTERNAL_SERVICE_TOKEN_MUST_BE_SET__"


def _find_root_env_file() -> Path:
    for directory in (Path(__file__).resolve().parent, *Path(__file__).resolve().parents):
        candidate = directory / ".env"
        if candidate.exists():
            return candidate
    return Path.cwd() / ".env"


ROOT_ENV_FILE = _find_root_env_file()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT_ENV_FILE, extra="ignore")

    app_env: str = "development"
    log_level: str = "INFO"
    log_format: str = "json"
    slow_request_ms: int = 1000
    sql_log_enabled: bool = False
    database_url: str | None = None
    db_url: str | None = None
    db_user: str = "lenjoy"
    db_password: str = "lenjoy"
    server_port: int = 8080
    jwt_secret: str = DEFAULT_JWT_SECRET
    jwt_access_token_ttl_seconds: int = 72000
    internal_service_token: str = DEFAULT_INTERNAL_SERVICE_TOKEN
    captcha_ttl_seconds: int = 120
    captcha_length: int = 4
    captcha_debug_enabled: bool = False
    initial_register_coins: int = 100
    legacy_admin_mutations_enabled: bool = False
    redis_url: str | None = None
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_password: str | None = None
    minio_endpoint: str = "http://localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "lenjoy-bbs"
    minio_public_base_url: str = "http://localhost:9000/lenjoy-bbs"
    minio_max_file_size_bytes: int = 5_242_880

    @property
    def sqlalchemy_url(self) -> str:
        raw = self.database_url or self.db_url
        if not raw:
            return "sqlite:///lenjoy_bbs.db"
        if raw.startswith("jdbc:postgresql://"):
            host_and_database = raw.removeprefix("jdbc:postgresql://")
            return f"postgresql+psycopg://{self.db_user}:{self.db_password}@{host_and_database}"
        return raw

    @property
    def sqlalchemy_async_url(self) -> str:
        if self.sqlalchemy_url == "sqlite://":
            return "sqlite+aiosqlite://"
        if self.sqlalchemy_url == "sqlite:///lenjoy_bbs.db":
            return "sqlite+aiosqlite:///lenjoy_bbs.db"
        if self.sqlalchemy_url.startswith("sqlite:///"):
            return self.sqlalchemy_url.replace("sqlite://", "sqlite+aiosqlite://", 1)
        return self.sqlalchemy_url

    @property
    def uses_sqlite(self) -> bool:
        return self.sqlalchemy_url.startswith("sqlite")

    @property
    def is_test(self) -> bool:
        return self.app_env.lower() == "test"

    @property
    def is_development(self) -> bool:
        return self.app_env.lower() in {"development", "dev", "local", "test"}

    @property
    def resolved_redis_url(self) -> str:
        if self.redis_url:
            return self.redis_url
        auth = f":{self.redis_password}@" if self.redis_password else ""
        return f"redis://{auth}{self.redis_host}:{self.redis_port}/0"

    @property
    def minio_client_endpoint(self) -> tuple[str, bool]:
        parsed = urlparse(self.minio_endpoint)
        if parsed.scheme:
            return parsed.netloc, parsed.scheme == "https"
        return self.minio_endpoint, False

    def validate_runtime_configuration(self) -> None:
        if self.is_development:
            return
        if not (self.database_url or self.db_url):
            raise RuntimeError("DATABASE_URL or DB_URL is required outside development")
        if self.jwt_secret == DEFAULT_JWT_SECRET:
            raise RuntimeError("JWT_SECRET must be changed outside development")
        if self.internal_service_token == DEFAULT_INTERNAL_SERVICE_TOKEN:
            raise RuntimeError(
                "INTERNAL_SERVICE_TOKEN must be set outside development"
            )


@lru_cache
def get_settings() -> Settings:
    return Settings()
