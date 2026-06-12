# Platform E2E Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repeatable compatibility-stack E2E acceptance script that verifies real transfer, Automation restart recovery, RESOURCE publishing, idempotency, and safe forum cleanup without replacing the independently deployed platform contracts.

**Architecture:** Extend the BBS Open API with a client-scoped soft-delete operation backed by the existing idempotency ownership record. Implement the host-side E2E runner as a standard-library Python script with isolated configuration, HTTP/Compose adapters, polling, cleanup, and redacted JSON reporting.

**Tech Stack:** FastAPI, SQLAlchemy async, pytest, Python 3.12 standard library, Docker Compose.

---

### Task 1: Client-Scoped Open API Post Cleanup

**Files:**
- Modify: `apps/api/lenjoy_bbs/modules/open_api/publication.py`
- Modify: `apps/api/lenjoy_bbs/modules/open_api/router.py`
- Modify: `apps/api/tests/test_runtime_hardening.py`
- Modify: `apps/api/tests/test_fastapi_structure.py`

- [ ] Add failing runtime tests proving the owning Open API client can soft-delete its idempotently-created post, repeated deletion succeeds, and another client is rejected.
- [ ] Run the targeted tests and confirm failure because no Open API delete service/route exists.
- [ ] Add `delete_open_post(db, api_key, post_id)` that authenticates the client, resolves ownership through `OpenApiIdempotencyRecord`, sets `Post.is_deleted = True`, and commits.
- [ ] Add `DELETE /open/posts/{post_id}` using `X-API-Key`.
- [ ] Run Open API structure/runtime tests and confirm they pass.

### Task 2: E2E Runner Core

**Files:**
- Create: `scripts/platform_e2e.py`
- Create: `scripts/tests/test_platform_e2e.py`
- Modify: `../automation-service/api/schemas.py`
- Modify: `../automation-service/services/orchestrator.py`
- Modify: `../automation-service/tests/test_orchestrator.py`

- [ ] Add failing tests for configuration parsing, terminal-state polling, timeout, secret redaction, and cleanup after a published-flow failure.
- [ ] Run script unit tests and confirm failure because the runner does not exist.
- [ ] Implement focused units:
  - `E2EConfig.from_env()`
  - `HttpClient`
  - `ComposeClient`
  - `poll_until()`
  - `AcceptanceReport`
  - `PlatformAcceptance.run_smoke()` and `run_full()`
- [ ] Add optional Automation `idempotency_scope` support so fixed resource
  links can be accepted in separate runs while replay remains idempotent inside
  one run.
- [ ] In full mode, create one RESOURCE Automation task, restart Automation after it leaves `pending`, wait for success, replay the same request, verify duplicate behavior, and delete the forum post.
- [ ] Ensure failure paths attempt cleanup only when the created task yielded a forum post ID, and reports never include secrets or hidden content.
- [ ] Run script unit tests and confirm they pass.

### Task 3: Operator Configuration and Documentation

**Files:**
- Modify: `.env.example`
- Modify: `README.md`

- [ ] Add documented `E2E_*` variables with non-secret examples.
- [ ] Document smoke/full commands, retained transfer files, soft-deleted posts, report location, and required real credentials.
- [ ] Run `python scripts/platform_e2e.py --help` and verify the operator interface.

### Task 4: Verification

**Files:**
- Verify all modified files.

- [ ] Run BBS Open API targeted tests.
- [ ] Run E2E runner unit tests.
- [ ] Run `python -m compileall` for the script and API modules.
- [ ] Run `docker compose config --quiet`.
- [ ] Run smoke mode against the local Compose stack.
- [ ] Run full mode only when `E2E_RESOURCE_URL`, valid Quark credentials, valid forum binding/category, and real service tokens are configured.
- [ ] Stop any stack started with temporary test credentials while preserving volumes.
