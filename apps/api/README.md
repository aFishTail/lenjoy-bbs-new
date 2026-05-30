# Lenjoy BBS API

Lenjoy BBS backend implemented with FastAPI, SQLAlchemy async sessions, and Alembic migrations.

## Current Architecture

The codebase is organized around `lenjoy_bbs/`:

- `main.py`: application entrypoint. Creates the FastAPI app, validates runtime configuration, installs error handlers, and mounts the shared API router.
- `api.py`: the single `/api/v1` aggregation point. It includes health, auth, users, wallet, posts, taxonomy, files, messages, reports, admin, and OpenAPI routers.
- `core/`: shared runtime concerns such as settings, error handling, response envelopes, auth dependencies, token helpers, password helpers, and common dependency aliases.
- `db/`: async engine/session setup, model registry, and local SQLite bootstrap helpers. Production schema changes are handled by Alembic, not FastAPI startup.
- `infrastructure/storage/`: external storage adapter code. Image upload currently uses MinIO.
- `modules/`: domain modules. Most domains follow `router.py + service.py + schemas.py`, with `models.py`, `repository.py`, `seed.py`, or `presenters.py` added only where needed.

Current module layout highlights:

- `modules/posts/`: public post APIs. This module is split into router, service, repository, presenters, models, and schemas.
- `modules/admin/`: admin aggregate router under `/admin`, further split into `users`, `posts`, `wallet`, `taxonomy`, and `metrics`.
- `modules/open_api/`: external publishing and client management endpoints, with dedicated models, service, schemas, and constants.
- `modules/users/`, `wallet/`, `auth/`, `messages/`, `reports/`, `taxonomy/`, `files/`, `health/`: domain-local HTTP and business logic.

Conventions used in the current code:

- Routers stay thin and delegate business logic to `service.py`.
- Reusable request dependencies are exposed from `core/dependencies.py` as aliases like `DbSession`, `CurrentUser`, `OptionalCurrentUser`, and `AdminUser`.
- Domain models are colocated with their modules instead of being grouped under `db/`.
- Seed data is owned by domains and orchestrated by `db/seed.py`.

## Runtime And Configuration

Settings are loaded by `core/config.py` from the repository root `.env` file and environment variables.

Important variables:

- `APP_ENV`: defaults to `development`. Non-development environments enable stricter runtime validation.
- `LOG_LEVEL`: defaults to `INFO`.
- `LOG_FORMAT`: defaults to `json`; set to `text` for local readability.
- `SLOW_REQUEST_MS`: defaults to `1000`; requests above this threshold are elevated to warning level.
- `SQL_LOG_ENABLED`: defaults to `false`; enables SQLAlchemy SQL echo when needed.
- `DATABASE_URL`: preferred database connection string.
- `DB_URL`, `DB_USER`, `DB_PASSWORD`: compatibility path for the old Spring Boot style JDBC configuration.
- `JWT_SECRET`: must be changed outside development.
- `SERVER_PORT`: defaults to `8080`.
- `REDIS_URL` or `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD`
- `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`, `MINIO_PUBLIC_BASE_URL`, `MINIO_MAX_FILE_SIZE_BYTES`
- `CAPTCHA_DEBUG_ENABLED`, `CAPTCHA_TTL_SECONDS`, `CAPTCHA_LENGTH`

Database behavior:

- If no database URL is configured, the app falls back to SQLite for local/test use.
- `db/bootstrap.py` can create and seed the SQLite schema for local workflows, but it is not part of app startup.
- Production schema management must go through `migrations/`.

## Logging

The API now uses a centralized logging setup in `core/logging.py`.

- Logs go to stdout by default so Docker and process managers can collect them directly.
- The default format is single-line JSON with request and actor context attached automatically.
- Every request gets an `X-Request-Id` response header. If a caller provides one, the API preserves it.
- Expected application failures (`ApiError`, validation errors, 404s) are logged without Python stacks.
- Unhandled 5xx failures are logged with full stack traces.

Current high-value log coverage includes:

- Request summaries with method, path, status, duration, and authenticated user ID where available.
- Auth events such as register success, login success, login failure, and invalid token decode.
- Post lifecycle events such as create, update, delete, comment, and purchase.
- Admin actions for user status, wallet adjustment, category creation, and tag creation.
- File upload success/failure and Redis/MinIO dependency failures.

## Development

Install dependencies:

```powershell
uv sync
```

Run migrations:

```powershell
uv run alembic upgrade head
```

Start the API:

```powershell
uv run uvicorn lenjoy_bbs.main:app --host 0.0.0.0 --port 8080 --reload
```

The Docker image follows the same pattern and runs `alembic upgrade head` before starting Uvicorn.

## Verification

```powershell
uv run pytest -q
uv run python -m py_compile (Get-ChildItem lenjoy_bbs -Recurse -Filter *.py).FullName
```
