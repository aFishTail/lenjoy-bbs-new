# Web E2E Tests

This directory contains TypeScript Playwright tests for `apps/web`.

## Structure

- `test/e2e/*.spec.ts`: the new domain-oriented Playwright specs
- `test/e2e/fixtures/*`: shared lifecycle-aware fixtures for auth, multi-user, and setup/teardown concerns
- `test/e2e/helpers/*`: stateless test utilities such as unique titles and response parsing
- `test/helpers/*`: legacy helpers still reused during migration; new shared code should move into `test/e2e/*`

The older top-level specs remain temporarily, but new scenarios should be added under `test/e2e`.

## Scope

- anonymous browsing and access control
- authenticated user pages
- fixture post creation through real frontend APIs
- resource purchase and unlock flow
- bounty answer and accept flow
- report, appeal, and messages flow
- admin page and admin API smoke coverage

## Session File

Copy `test/testdata/auth-sessions.example.json` to `test/testdata/auth-sessions.json`.

The JSON must contain `AuthData` payloads for:

- `user_a`
- `user_b`
- `admin`

If the session file is missing, anonymous smoke still runs and authenticated scenarios are skipped.

## Run

From `apps/web`:

```powershell
pnpm test:e2e
```

Run the new core subset:

```powershell
pnpm test:e2e:core
```

Run auth or admin subsets:

```powershell
pnpm test:e2e:auth
pnpm test:e2e:admin
```

Headed:

```powershell
pnpm test:e2e:headed
```

## Reports

- HTML report: `test/artifacts/playwright-report`
- Raw test output: `test/artifacts/test-results`

## Notes

- Authenticated role tests currently use `auth-sessions.json` plus cookie injection, because the frontend auth contract is a `lenjoy.auth` cookie.
- The login page itself should still be tested through the real UI flow rather than the cookie fixture.
- If `apps/web/node_modules` is missing, Playwright commands will fail before discovery. Install frontend dependencies first.
