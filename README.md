# Lenjoy BBS Monorepo

This repository follows the agreed V1 technical stack:

- Web: Next.js + TypeScript
- API: Java 21 + Spring Boot + MyBatis-Plus + Flyway
- Infra: PostgreSQL + Redis + Nginx + Docker Compose

## Project Structure

```text
apps/
  api/        Spring Boot API service
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

- Web: <http://localhost/>
- API health: <http://localhost/api/v1/health>
- Swagger: <http://localhost/swagger-ui/index.html>

## Local Dependencies Only (PostgreSQL + Redis)

For daily local development, you usually only need database and cache:

1. Copy env template:

```bash
cp .env.example .env
```

`docker-compose.dev.yml` reuses `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT` directly, so you only need one set of database variables.

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
docker compose --env-file .env -f infra/docker/docker-compose.dev.yml up -d
```

Alternative (using full compose file):

```bash
docker compose -f infra/docker/docker-compose.yml up -d postgres redis
```

## Local API Run (without Docker)

Requirements:

- Java 21
- Maven 3.9+
- PostgreSQL 16
- Redis 7

Run:

```bash
cd apps/api
mvn spring-boot:run
```

### Run API in IntelliJ IDEA

`docker compose --env-file .env ...` only affects Docker containers.
When you run Spring Boot directly in IDEA, `.env` is not auto-loaded by default.

Set environment variables in IDEA Run Configuration:

1. Open `Run | Edit Configurations...`.
2. Select your Spring Boot run config (`BbsApiApplication`).
3. In `Environment variables`, add:

```text
DB_URL=jdbc:postgresql://localhost:5432/lenjoy_bbs;DB_USER=lenjoy;DB_PASSWORD=your_password;SERVER_PORT=8080
```

1. Apply and run.

Optional:

- Use IDEA EnvFile plugin to load variables from `.env` automatically.
- Or run API from terminal after exporting env vars in shell.

Environment variables:

- `DB_URL`
- `DB_USER`
- `DB_PASSWORD`
- `SERVER_PORT`

## Local Web Run (without Docker)

Requirements:

- Node.js 22+

Run:

```bash
cd apps/web
npm install
npm run dev
```

## Next Implementation Steps

- Add domain modules under `apps/api/src/main/java/com/lenjoy/bbs/`.
- Add Flyway migrations for user, wallet, post, comment, trade, bounty, notification tables.
- Implement auth and role-based permissions in Spring Security.
- Implement core APIs based on `用户故事.md`.
