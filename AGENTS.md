# Repository Guidelines

## Project Structure & Module Organization
This repository is a small monorepo split by runtime:

- `apps/web`: Next.js 15 + TypeScript frontend. Main routes live in `app/`, reusable UI in `components/`, server/client helpers in `lib/`, and Playwright tests in `test/`.
- `apps/api`: Spring Boot 3.4 backend. Java code lives in `src/main/java/com/lenjoy/bbs`, config and Flyway SQL migrations in `src/main/resources`, and JUnit tests in `src/test`.
- `infra/docker` and `infra/nginx`: local infrastructure and gateway config.
- `docs/` and root `*.md`: product and delivery notes.

## Build, Test, and Development Commands
- `docker compose --env-file .env -f infra/docker/docker-compose.dev.yml up -d`: start local PostgreSQL, Redis, and MinIO.
- `cd apps/api; mvn spring-boot:run`: run the API locally on the configured port.
- `cd apps/api; mvn test`: run backend unit and integration tests.
- `cd apps/web; pnpm install`: install frontend dependencies. Prefer `pnpm` because the app is checked in with `pnpm-lock.yaml`.
- `cd apps/web; pnpm dev`: start the Next.js dev server on `http://localhost:3000`.
- `cd apps/web; pnpm build`: production build.
- `cd apps/web; pnpm lint`: run Next.js linting.
- `cd apps/web; pnpm test:e2e`: run Playwright end-to-end tests.

## Coding Style & Naming Conventions
Use the existing style in each app instead of introducing a new one.

- TypeScript uses 2-space indentation, ES module imports, and PascalCase for React components, for example `PostHomeClient`.
- Next.js route files follow framework naming such as `app/page.tsx`, `app/layout.tsx`, and server actions under `actions/`.
- Java uses 4-space indentation, package-by-feature under `com.lenjoy.bbs`, and class names like `AuthController`, `CaptchaService`, and `RegisterRequest`.
- Database migrations follow Flyway naming: `V13__short_description.sql`.

## UI Feedback Conventions
- Use toast notifications for user action feedback across the frontend. Prefer the existing `sonner`-based `toast` flow over `alert`, inline success/error banners, or ad hoc status text.
- Apply toast feedback to create, update, delete, purchase, report, auth, and similar mutation flows unless a screen explicitly requires persistent inline messaging.
- Only use another feedback pattern when the requirement is stated explicitly or the message must remain visible as page state.

## Testing Guidelines
- Backend tests use JUnit 5 with Spring Boot test support and Testcontainers where needed. Mirror production packages under `apps/api/src/test/java` and name files `*Test.java`.
- Frontend E2E tests use Playwright and live in `apps/web/test` with names like `smoke.e2e.spec.ts`.
- Keep new tests close to the changed behavior. For web flows requiring login, populate `apps/web/test/testdata/auth-sessions.json` from the example file first.

## Commit & Pull Request Guidelines
Recent history mixes Conventional Commit prefixes and short task-based summaries. Prefer `feat:`, `fix:`, `chore:` followed by a concise description, for example `fix: handle captcha cache headers`.

PRs should describe scope, list affected apps (`web`, `api`, `infra`), note any env or migration changes, and include screenshots for UI changes. Link the relevant issue or story when one exists, and state which checks you ran locally.
