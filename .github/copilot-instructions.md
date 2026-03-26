# Lenjoy BBS Project Guidelines

## Scope

- Applies to the full workspace.
- This repository uses .github/copilot-instructions.md as the only workspace-instructions file type.

## Architecture

- Monorepo layout:
  - apps/api: Java 21 Spring Boot backend
  - apps/web: Next.js frontend
  - infra/docker: Docker Compose files
  - infra/nginx: gateway config
  - docs (currently empty): future deep-dive docs
- Backend is modular monolith style. Keep new features aligned to domain folders (controller, service, domain, mapper, security, exception).
- Do not introduce microservice assumptions or distributed patterns unless explicitly requested.

## Build and Run

- Backend local run: cd apps/api && mvn spring-boot:run
- Backend tests: cd apps/api && mvn test
- Frontend local run: cd apps/web && npm run dev
- Frontend build: cd apps/web && npm run build
- Full stack with Docker: docker compose -f infra/docker/docker-compose.yml up --build
- Local dependencies only: docker compose --env-file .env -f infra/docker/docker-compose.dev.yml up -d

## Environment and Tooling

- Backend requires Java 21. If build fails with unsupported release 21, fix JDK first.
- Compose commands for infra/docker/docker-compose.dev.yml should use --env-file .env from repository root.
- PostgreSQL password changes require volume reset in dev: docker compose --env-file .env -f infra/docker/docker-compose.dev.yml down -v
- Redis is required for captcha/session-style short-lived data.

## Backend Conventions

- Use Lombok to reduce boilerplate in DTO/entity/service/controller classes where appropriate.
- Keep API responses wrapped with ApiResponse<T> unless task explicitly requires another format.
- Keep auth endpoints under /api/v1/auth.
- Auth stack conventions:
  - JWT bearer auth
  - Stateless security session
  - Captcha flow is split endpoints:
    - metadata endpoint returns captchaId + imageUrl + expireAt
    - image endpoint returns image stream
- Validate request DTOs with Jakarta Validation annotations.
- Keep business errors centralized via ApiException and GlobalExceptionHandler.

## Database and Migrations

- Use Flyway SQL migrations under apps/api/src/main/resources/db/migration.
- Naming rule: V{number}\_\_{description}.sql (double underscore).
- Prefer additive, backward-safe migrations for ongoing development.

## Frontend Conventions

- Keep frontend and admin UI in the same Next.js app (route grouping, e.g. /admin).
- Align auth integration with backend contract (captchaId, imageUrl, captchaCode, token fields).

## Link, Do Not Duplicate

- For startup and environment details, refer to README.md.
- For product scope and acceptance criteria, refer to 用户故事.md and 需求文档.md.
- For architecture rationale and stack decisions, refer to 技术栈方案.md.

## Guardrails

- Prefer minimal changes that match existing project style.
- Avoid broad refactors outside requested scope.
- Preserve existing API behavior unless the task asks for a breaking change.
