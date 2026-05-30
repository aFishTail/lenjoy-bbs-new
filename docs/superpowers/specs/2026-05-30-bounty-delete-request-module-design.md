# Bounty Delete Request Module Design

## Summary

Authors cannot directly delete bounty posts after another user has submitted a top-level answer. The current delete request path reuses post reports, which sends the request into report management and produces report/offline notifications. This design separates author-initiated bounty delete requests from third-party reports.

The new flow belongs to the bounty module. The admin sidebar will have a bounty management parent menu with two child pages:

- Bounty governance: the existing bounty governance page.
- Delete requests: a new page for author delete requests.

## User Flow

When a bounty post has at least one visible top-level answer from another user, the author sees "申请删除" instead of direct delete. Submitting the dialog creates a bounty delete request through a new API, not through `/posts/{post_id}/reports`.

If the request is approved by an admin, the post is soft-deleted, the active bounty is cancelled, and any unsettled frozen bounty reserve is refunded with the existing refund helper. The author receives a bounty-specific site message saying the delete request was approved.

If the request is rejected, the post remains published and the author receives a bounty-specific site message saying the delete request was rejected.

## Data Model

Add a dedicated `bounty_delete_request` table with:

- `id`
- `post_id`
- `author_id`
- `reason`
- `status`: `PENDING`, `APPROVED`, or `REJECTED`
- `resolution_note`
- `handled_by`
- `handled_at`
- `created_at`
- `updated_at`

Only one pending delete request is allowed per bounty post. Historical approved or rejected requests may remain for audit.

## API Design

Public author API:

- `POST /api/v1/posts/{post_id}/bounty-delete-requests`
  - Requires login.
  - Requires the caller to be the post author.
  - Requires the post to be a bounty post.
  - Requires at least one non-deleted top-level answer by another user.
  - Rejects duplicate pending requests for the same post.
  - Body: `{ "reason": string }`.

Admin API:

- `GET /api/v1/admin/bounty-delete-requests`
  - Supports `status` and `keyword` filters.
  - Returns request, post, author, bounty amount, answer count, status, reason, and resolution fields.

- `PATCH /api/v1/admin/bounty-delete-requests/{request_id}`
  - Body: `{ "action": "APPROVE" | "REJECT", "resolutionNote": string | null }`.
  - Approve soft-deletes the post and cancels/refunds the active bounty reserve.
  - Reject leaves the post unchanged.

## Admin UI

Change the admin sidebar from a single bounty entry to a parent bounty management group:

- `悬赏管理`
  - `悬赏治理`: existing `/admin/bounties`
  - `删除申请`: new `/admin/bounty-delete-requests`

The new delete request page lists pending and historical requests and lets admins approve or reject with an optional handling note.

## Messaging

Do not emit report-related messages for this flow. Use bounty-specific message types:

- `BOUNTY_DELETE_REQUEST_APPROVED`
- `BOUNTY_DELETE_REQUEST_REJECTED`

Approved content should say the author's bounty delete request was approved and the post has been deleted. Rejected content should say the request was not approved and include the admin note when present.

## Out of Scope

- Deadline enforcement for bounty posts.
- Changing normal report management behavior.
- Hard-deleting posts or comments.
- Dispute handling between the author and answerers beyond approving or rejecting deletion.

## Acceptance Criteria

- Author delete requests no longer create `PostReport` records.
- Requests appear under the new bounty delete request admin page, not report management.
- Approving a request soft-deletes the bounty post, cancels active bounty status, and refunds unsettled frozen bounty reserve.
- Rejecting a request keeps the post visible.
- Author notifications use bounty delete request wording, not report/offline wording.
- Direct deletion remains allowed for bounty posts with no external top-level answers.
