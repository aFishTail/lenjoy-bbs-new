# Web E2E Tests

This directory contains TypeScript Playwright tests for `apps/web`.

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

Headed:

```powershell
pnpm test:e2e:headed
```

## Reports

- HTML report: `test/artifacts/playwright-report`
- Raw test output: `test/artifacts/test-results`
