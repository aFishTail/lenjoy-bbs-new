# Lenjoy BBS Monorepo

This repository follows the agreed V1 technical stack:

- Web: Next.js + TypeScript
- API: FastAPI + SQLAlchemy async + Alembic
- Infra: PostgreSQL + Redis + Nginx + Docker Compose

## Project Structure

```text
apps/
  api/        FastAPI API service
  web/        Next.js web and admin UI
infra/
  docker/     Docker Compose files
  nginx/      Nginx gateway config
packages/
  shared-types/
docs/
```

## Quick Start (Docker)

1. Open terminal in repository root.
2. Run:

```bash
docker compose -f infra/docker/docker-compose.yml up --build
```

1. Access services:

- Web: <http://localhost:8080/>
- API health: <http://localhost:8080/api/v1/health>
- OpenAPI docs: <http://localhost:8080/docs>
- MinIO API: <http://localhost:9000>
- MinIO Console: <http://localhost:9001>

## Local Dependencies Only (PostgreSQL + Redis + MinIO)

For daily local development, you usually only need database, cache, and object storage:

1. Copy env template:

```bash
cp .env.example .env
```

`docker-compose.dev.yml` reuses DB and MinIO related variables directly, so `.env` can be used as the single source of truth for local dependencies.

1. Start dependencies with external env file:

```bash
docker compose --env-file .env -f infra/docker/docker-compose.dev.yml up -d
```

Why this flag is required:

- The compose file is in `infra/docker`, so without `--env-file .env`, Docker Compose looks for `.env` near that folder instead of the repository root.
- If you run without `--env-file`, fallback defaults in compose will be used.

Stop them:

```bash
docker compose --env-file .env -f infra/docker/docker-compose.dev.yml down
```

If you changed `DB_PASSWORD` but authentication still fails:

- Compose is reading `.env` correctly, but PostgreSQL only applies `POSTGRES_PASSWORD` on first initialization.
- If the named volume already exists, init is skipped and old credentials remain.

Reset local DB data (development only):

```bash
docker compose --env-file .env -f infra/docker/docker-compose.dev.yml down -v
docker compose --env-file .env -f infra/docker/docker-compose.dev.yml up -d/u
```

Alternative (using full compose file):

```bash
docker compose -f infra/docker/docker-compose.yml up -d postgres redis minio minio-init
```

## Local API Run (without Docker)

Requirements:

- Python 3.12
- `uv`
- PostgreSQL 16
- Redis 7

Run:

```bash
cd apps/api
uv sync
uv run alembic upgrade head
uv run uvicorn lenjoy_bbs.main:app --host 0.0.0.0 --port 8080 --reload
```

Environment variables:

- `APP_ENV`
- `DATABASE_URL`
- `DB_URL`
- `DB_USER`
- `DB_PASSWORD`
- `SERVER_PORT`
- `LOG_LEVEL`
- `LOG_FORMAT`
- `SLOW_REQUEST_MS`
- `SQL_LOG_ENABLED`
- `MINIO_ENDPOINT`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `MINIO_BUCKET`
- `MINIO_PUBLIC_BASE_URL`
- `UPLOAD_MAX_FILE_SIZE`
- `UPLOAD_MAX_REQUEST_SIZE`
- `MINIO_MAX_FILE_SIZE_BYTES`

### API Logging

`apps/api` uses structured application logs on stdout by default.

- Default format: JSON, one line per event
- Main correlation header: `X-Request-Id`
- Primary fields: `timestamp`, `level`, `logger`, `event`, `request_id`, `method`, `path`, `status_code`, `duration_ms`, `user_id`
- High-value business events are logged for auth, posts, uploads, admin actions, and Open API calls
- External dependency failures from Redis and MinIO are logged as structured errors

Useful env vars:

- `LOG_LEVEL`
- `LOG_FORMAT=json|text`
- `SLOW_REQUEST_MS`
- `SQL_LOG_ENABLED`

Each API request gets an `X-Request-Id` response header. Use that value to correlate request summaries, business events, and exception stacks for the same call.

## Auth API (US-A02)

Implemented backend endpoints:

- `GET /api/v1/auth/captcha`
- `GET /api/v1/auth/captcha/{captchaId}/image`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`

The captcha is split into metadata and image stream:

1. Request metadata endpoint to get `captchaId`, `imageUrl`, `expireAt`.
2. Render image by requesting `imageUrl`.
3. Submit `captchaId` and `captchaCode` in register/login requests.

Example register payload:

```json
{
  "username": "new_user",
  "password": "StrongPass123",
  "email": "new_user@example.com",
  "phone": "",
  "captchaId": "c95db4f401314b03adf1be65a90f3c12",
  "captchaCode": "A7KD"
}
```

Example login payload:

```json
{
  "account": "new_user@example.com",
  "password": "StrongPass123",
  "captchaId": "9a8bb90d5dca4d95bd0ebf40ecf07aca",
  "captchaCode": "3KPM"
}
```

Auth related env vars:

- `JWT_SECRET` (at least 32 chars)
- `JWT_ACCESS_TOKEN_TTL_SECONDS`
- `CAPTCHA_TTL_SECONDS`
- `CAPTCHA_LENGTH`
- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_PASSWORD`

## Local Web Run (without Docker)

Requirements:

- Node.js 22+

Run:

```bash
cd apps/web
pnpm install
pnpm run dev
```

## Platform deployment

`infra/docker/docker-compose.platform.yml` runs only the BBS application containers against infrastructure managed by `lenjoy-platform`. The existing full Compose remains available during migration and must not run concurrently on the same production data.

```bash
docker compose --env-file ../lenjoy-platform/.env -f infra/docker/docker-compose.platform.yml up -d --build
```

## Next Implementation Steps

- Add domain modules under `apps/api/src/main/java/com/lenjoy/bbs/`.
- Add Flyway migrations for user, wallet, post, comment, trade, bounty, notification tables.
- Implement auth and role-based permissions in Spring Security.
- Implement core APIs based on `用户故事.md`.
