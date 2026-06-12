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

## Integrated Local Stack

1. Open terminal in repository root.
2. Copy `.env.example` to `.env` and replace the database, MinIO, internal
   service, callback, and forum API credentials.
3. Run:

```bash
docker compose -f infra/docker/docker-compose.yml up --build
```

This compatibility stack also starts `automation-service` and
`transfer-service` from their sibling repositories. It is intended for local
integration testing and the platform E2E acceptance runner, not independent
platform production deployment. Before starting it, configure
`TRANSFER_CALLBACK_TOKEN` and an active Lenjoy Open API `FORUM_API_KEY` in
the root `.env`. Also configure the shared `INTERNAL_SERVICE_TOKEN`, and
ensure `../transfer-service/config/cookies.txt` contains
a valid Quark cookie.

The auxiliary services use isolated PostgreSQL schemas and are only reachable
on the Compose network. For the current workload, run one instance of each
service:

```bash
docker compose -f infra/docker/docker-compose.yml up -d --build
```

`automation-service` reconciles unfinished work at startup, and forum publishing
uses an end-to-end idempotency key. This makes process restarts safe without
adding multi-instance coordination complexity.

Integrated-stack management is centralized at `/admin/operations`. The auxiliary
service images do not include their standalone React admin builds; those
remain available only for local service development.

`transfer-service` runs one durable polling worker by default. Queued work
survives process restarts, running work uses renewable leases, and failed
callbacks are retried with exponential backoff. Tune these through the `TRANSFER_WORKER_*`,
`TRANSFER_TASK_LEASE_SECONDS`, and `TRANSFER_WEBHOOK_*` variables.

Access the integrated stack through its configured Nginx domain:

- Web: <https://www.lxziyuan.site/>
- API health: <https://www.lxziyuan.site/api/v1/health>

Only Nginx publishes host ports in the integrated Compose file. PostgreSQL,
Redis, MinIO, API, web, and auxiliary services remain private to the Compose
network. Use `docker-compose.dev.yml` when local development requires direct
access to dependency ports.

Before starting Nginx, place a valid certificate and private key under
`infra/docker/letsencrypt/live/www.lxziyuan.site/`. Placeholder or malformed
PEM files cause Nginx to restart until valid certificate material is installed.

PostgreSQL applies `POSTGRES_PASSWORD` only when its data volume is initialized.
Changing `DB_PASSWORD` later also requires updating the existing PostgreSQL role
password before restarting dependent services.

## Platform E2E Acceptance

Configure the `E2E_*` variables in `.env` with one stable Quark test resource,
an active Open API author binding, and a valid RESOURCE post category. The
runner reads `.env`, while explicitly exported environment variables take
priority.

Run non-destructive service and authentication checks:

```bash
python scripts/platform_e2e.py smoke
```

Run the real acceptance flow:

```bash
python scripts/platform_e2e.py full
```

Full mode transfers the configured resource, restarts `automation-service`,
publishes a RESOURCE post, verifies replay idempotency, and soft-deletes the
test forum post. Each run uses a unique `resource-transfer/e2e/<run-id>` target
directory, and the transferred drive file is retained. A redacted report is
written to `artifacts/platform-e2e-report.json`.

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

`infra/docker/docker-compose.platform.yml` is the production platform contract.
It runs only the BBS application containers against infrastructure managed by
`lenjoy-platform`. Automation and transfer are deployed independently from
their owning repositories. The integrated Compose remains available for local
acceptance and rollback compatibility, and must not run concurrently against
the same production data.

```bash
docker compose --env-file ../lenjoy-platform/.env -f infra/docker/docker-compose.platform.yml up -d --build
```

## Next Implementation Steps

- Add domain modules under `apps/api/src/main/java/com/lenjoy/bbs/`.
- Add Flyway migrations for user, wallet, post, comment, trade, bounty, notification tables.
- Implement auth and role-based permissions in Spring Security.
- Implement core APIs based on `用户故事.md`.
