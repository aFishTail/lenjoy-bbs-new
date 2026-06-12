# Platform E2E Acceptance Design

## Goal

Provide a repeatable acceptance script for the single-host Compose deployment
covering the real Quark transfer, Automation callback, RESOURCE forum post,
idempotent replay, Automation restart recovery, and forum cleanup flow.

The script runs on the Compose deployment host. It uses one fixed Quark resource
URL, retains the transferred drive file, and soft-deletes the test forum post
after successful acceptance.

## Scope

The acceptance tool has two modes:

- `smoke`: verify Compose configuration, service health, internal authentication,
  PostgreSQL migration state, and Quark authentication without creating tasks.
- `full`: run `smoke`, create one real Automation task, restart Automation while
  work is unfinished, wait for the RESOURCE post, verify idempotent replay, then
  soft-delete the forum post.

The first implementation defaults to `full` and uses one fixed resource URL.
It does not delete transferred drive files and does not test multiple instances.

## Configuration

The script lives at `scripts/platform_e2e.py` and reads configuration from
environment variables:

- `E2E_RESOURCE_URL`: fixed Quark share link.
- `E2E_FORUM_AUTHOR_BINDING_CODE`: Open API author binding used for the post.
- `E2E_FORUM_CATEGORY_ID`: target forum category.
- `E2E_FORUM_TAG_IDS`: optional comma-separated tag IDs.
- `E2E_FORUM_HIDDEN_CONTENT`: hidden RESOURCE post content.
- `E2E_FORUM_PRICE`: positive RESOURCE post price.
- `INTERNAL_SERVICE_TOKEN`: token for Automation and Transfer APIs.
- `FORUM_API_KEY`: Open API key used for cleanup.
- `E2E_TIMEOUT_SECONDS`: overall workflow timeout.

Compose file and project directory may be overridden by command-line options,
but default to `infra/docker/docker-compose.yml` and the repository root.

## Open API Cleanup Endpoint

Add:

```text
DELETE /api/v1/open/posts/{post_id}
X-API-Key: <client key>
```

The endpoint authenticates the Open API client and verifies that an
`open_api_idempotency_record` belonging to that client references the post.
If ownership is valid, it soft-deletes the post using the post lifecycle
rules and returns success.

The endpoint cannot delete posts created by another Open API client or posts
without an idempotency record. Deleting an already deleted owned post is
idempotent and returns success.

## Full Acceptance Flow

1. Validate required configuration without printing secrets.
2. Run `docker compose config --quiet`.
3. Verify API, Automation, Transfer, PostgreSQL, and MinIO health.
4. Verify unauthenticated Automation and Transfer management calls return 401.
5. Verify Quark authentication is `authenticated`.
6. Create one Automation task with:
   - a unique `[E2E][timestamp]` title,
   - a unique `idempotency_scope` reused only for the replay check,
   - `RESOURCE` post type,
   - configured category, tags, hidden content, and price.
7. Poll until the item has left `pending`, then restart `automation-service`.
8. Wait until the task reaches `success`; fail immediately on terminal failure.
9. Verify the resulting forum post exists and is a RESOURCE post.
10. Submit the same Automation request again and verify it is recognized as a
    duplicate and does not produce a second forum post.
11. Delete the created forum post through the Open API cleanup endpoint.
12. Verify public post detail no longer returns the deleted post.
13. Write a JSON report containing timestamps, task IDs, transfer task ID,
    forum post ID, status transitions, cleanup result, and failure details.

## Failure Handling

- The script never deletes a forum post unless it captured the post ID from the
  task it created.
- On failure after forum publication, it attempts cleanup and records whether
  cleanup succeeded.
- The transferred drive file is always retained.
- Secrets, cookies, hidden content, and API keys are never written to reports.
- The script exits non-zero when any required check fails.

## Testing

- BBS API tests cover cleanup authorization, ownership isolation, idempotent
  repeated deletion, and soft-delete behavior.
- Script unit tests cover response parsing, polling state transitions, timeout,
  report redaction, and cleanup-on-failure.
- A real-host acceptance run is required before release using a configured
  fixed resource URL and valid Quark credentials.

## Success Criteria

- One command runs the real acceptance flow on the Compose host.
- Automation restart during unfinished work does not prevent eventual success.
- Replaying the same resource does not create another forum post.
- The test RESOURCE post is soft-deleted after success.
- The transferred drive file remains available.
- The generated JSON report contains enough information to diagnose failures
  without exposing secrets.
