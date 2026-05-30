# Bounty Delete Review Design

## Context

Bounty posts currently use the same author delete flow as normal posts. If a
bounty already has candidate answers from other users, the author can still
delete it directly. That removes the question and participant work without any
review.

The project already has post reports and an admin report review flow. Admin
report approval can offline a post, and offlining an active bounty already
refunds any active bounty reserve. This design reuses that existing governance
path instead of adding a separate deletion request subsystem.

## Goals

- Let authors directly delete bounty posts only when no other user has submitted
  a candidate answer.
- Block direct author deletion after another user has submitted a top-level
  bounty answer.
- Give authors a clear way to submit a deletion request for admin review.
- Keep normal post, resource post, and unused bounty delete behavior unchanged.
- Preserve backend enforcement even if the frontend sends a direct DELETE.

## Non-Goals

- Do not add a new `post_delete_request` table.
- Do not build a new admin deletion-request page.
- Do not change bounty answer visibility rules.
- Do not implement automatic bounty expiry enforcement in this change.

## Deletion Rule

For this feature, a bounty is considered "participated" when there exists a
comment matching all of the following:

- `PostComment.post_id == post.id`
- `PostComment.parent_id is NULL`
- `PostComment.is_deleted is false`
- `PostComment.author_id != post.author_id`

Only those top-level comments count as candidate answers. The author's own
comments do not count. Replies do not count. Deleted answers do not count.

If a bounty post is participated, `DELETE /posts/{post_id}` must reject the
request with a dedicated API error:

- code: `BOUNTY_DELETE_REQUIRES_REVIEW`
- message: `悬赏已有用户参与，需提交删除申请`

If a bounty post is not participated, the current delete behavior remains:
refund active bounty reserve when possible, mark active bounty as `CANCELLED`,
and soft-delete the post.

## Request Flow

Authors request deletion through the existing post report pipeline:

1. The author opens the author tools on a bounty detail page.
2. If `answerCount > 0`, the UI presents an "申请删除" action instead of a direct
   "删除帖子" action.
3. The author enters a reason.
4. The frontend calls the existing post report endpoint for that post.
5. The report is created with:
   - `reason`: `AUTHOR_DELETE_REQUEST`
   - `detail`: the author-provided reason
6. Admins handle the request in the existing report management page.
7. If approved with `OFFLINE_POST`, the existing admin offline path handles the
   post status change and bounty reserve refund.

The backend DELETE guard is authoritative. The frontend `answerCount` branch is
only for a better user experience.

## Duplicate Requests

The first implementation may allow multiple pending author deletion reports for
the same post. This keeps the change small and avoids new database constraints.
If duplicate admin noise becomes a problem, a later change can reject duplicate
pending `AUTHOR_DELETE_REQUEST` reports from the post author.

## Components

- `posts.lifecycle`: add a participated-bounty guard before direct delete.
- `core.messages`: add the dedicated post deletion review error.
- `reports.service`: reuse `create_post_report`; no new model required.
- `post-author-actions`: switch the author action from direct delete to deletion
  request when the bounty has answers.
- `use-post-mutations`: reuse or add a mutation for creating the post report
  from author tools.
- Admin reports UI: no structural change required; it already lists post
  reports.

## Data Flow

Direct delete for unused bounty:

1. Author sends `DELETE /posts/{post_id}`.
2. Backend finds no other-user top-level answers.
3. Backend refunds active bounty reserve when available.
4. Backend marks bounty cancelled and post deleted.

Direct delete for participated bounty:

1. Author sends `DELETE /posts/{post_id}`.
2. Backend finds at least one other-user top-level answer.
3. Backend returns `BOUNTY_DELETE_REQUIRES_REVIEW`.
4. Post and wallet state remain unchanged.

Deletion request:

1. Author submits reason from the frontend.
2. Frontend creates a `PostReport` with `AUTHOR_DELETE_REQUEST`.
3. Admin reviews the report.
4. Admin approval can offline the post through the existing report action.

## Testing

- API: unused active bounty can still be deleted and refunds frozen coins.
- API: bounty with another user's top-level answer rejects direct delete.
- API: rejected direct delete leaves post and wallet state unchanged.
- API: author's own top-level comment does not block direct delete.
- API: another user's reply does not block direct delete.
- API: author can create an `AUTHOR_DELETE_REQUEST` post report.
- Frontend/build: author tools compile after adding the request action.
