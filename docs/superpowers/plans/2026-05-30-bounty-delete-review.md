# Bounty Delete Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent authors from directly deleting bounty posts after another user has submitted a top-level answer, and route those cases through the existing post report review flow.

**Architecture:** The backend owns the rule with a delete guard in `posts.lifecycle`, backed by API tests that prove participated bounties cannot be directly deleted. The frontend only improves the author experience by switching the delete action to a deletion request action when visible comments include another user's top-level bounty answer; it reuses the existing post report endpoint with `AUTHOR_DELETE_REQUEST`.

**Tech Stack:** FastAPI, SQLAlchemy async, Pydantic, pytest, Next.js App Router, React, TypeScript, React Query.

---

## File Structure

- Modify: `apps/api/lenjoy_bbs/core/messages.py`
  - Add `Posts.BOUNTY_DELETE_REQUIRES_REVIEW`.
- Modify: `apps/api/lenjoy_bbs/modules/posts/lifecycle.py`
  - Add participated-bounty detection and call it before refund/delete.
- Modify: `apps/api/tests/test_api_contract.py`
  - Add API regression tests for blocked and allowed delete cases.
- Modify: `apps/web/components/post/detail/post-author-actions.tsx`
  - Use visible comments to show direct delete or author deletion request.
  - Add request reason dialog that submits `AUTHOR_DELETE_REQUEST`.
- Modify: `apps/web/components/post/use-post-mutations.ts`
  - Reuse `useReportPostMutation` if sufficient; otherwise keep the same hook and ensure author tools imports it.

## Task 1: Backend Delete Guard

**Files:**
- Modify: `apps/api/tests/test_api_contract.py`
- Modify: `apps/api/lenjoy_bbs/core/messages.py`
- Modify: `apps/api/lenjoy_bbs/modules/posts/lifecycle.py`

- [ ] **Step 1: Write failing test for participated bounty direct delete**

Add this test near `test_deleting_active_bounty_refunds_frozen_balance` in `apps/api/tests/test_api_contract.py`:

```python
def test_bounty_with_other_user_answer_requires_delete_review(client):
    author_token = register_user(client, "bounty-delete-review-author",
                                 "bounty-delete-review-author@example.com")
    answerer_token = register_user(client, "bounty-delete-review-answerer",
                                   "bounty-delete-review-answerer@example.com")

    create_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(author_token),
        json={
            "postType": "BOUNTY",
            "title": "Delete review bounty",
            "content": "question body",
            "bountyAmount": 25,
            "bountyExpireAt": "2026-06-01T12:00:00Z",
        },
    )
    post_id = unwrap(create_response)["data"]["id"]

    answer_response = client.post(
        f"{API_PREFIX}/posts/{post_id}/comments",
        headers=bearer(answerer_token),
        json={"content": "candidate answer"},
    )
    assert answer_response.status_code == 201

    delete_response = client.delete(f"{API_PREFIX}/posts/{post_id}",
                                    headers=bearer(author_token))
    delete_payload = unwrap(delete_response)
    wallet_payload = unwrap(
        client.get(f"{API_PREFIX}/users/me/wallet",
                   headers=bearer(author_token)))
    detail_payload = unwrap(
        client.get(f"{API_PREFIX}/posts/{post_id}",
                   headers=bearer(author_token)))

    assert delete_response.status_code == 400
    assert delete_payload["error"]["code"] == "BOUNTY_DELETE_REQUIRES_REVIEW"
    assert detail_payload["data"]["id"] == post_id
    assert wallet_payload["data"]["availableCoins"] == 75
    assert wallet_payload["data"]["frozenCoins"] == 25
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
uv run pytest apps/api/tests/test_api_contract.py::test_bounty_with_other_user_answer_requires_delete_review -q
```

Expected: FAIL because DELETE currently returns `200`.

- [ ] **Step 3: Add the dedicated API message**

In `apps/api/lenjoy_bbs/core/messages.py`, add this constant to `class Posts` near the existing delete message:

```python
BOUNTY_DELETE_REQUIRES_REVIEW = ApiMessage(
    "BOUNTY_DELETE_REQUIRES_REVIEW",
    "悬赏已有用户参与，需提交删除申请",
)
```

- [ ] **Step 4: Implement participated-bounty check**

In `apps/api/lenjoy_bbs/modules/posts/lifecycle.py`, update imports:

```python
from sqlalchemy import delete, exists, select
```

and:

```python
from lenjoy_bbs.modules.posts.models import Post, PostComment, PostTag
```

Add this helper before `delete_post`:

```python
async def _bounty_has_external_answer(db: AsyncSession, post: Post) -> bool:
    if post.post_type != "BOUNTY":
        return False
    return bool(await db.scalar(
        select(
            exists().where(
                PostComment.post_id == post.id,
                PostComment.parent_id.is_(None),
                PostComment.is_deleted.is_(False),
                PostComment.author_id != post.author_id,
            )
        )
    ))
```

Then in `delete_post`, after the author check and before `try:`:

```python
    if await _bounty_has_external_answer(db, post):
        raise ApiError(Posts.BOUNTY_DELETE_REQUIRES_REVIEW)
```

- [ ] **Step 5: Run the participated-bounty test**

Run:

```bash
uv run pytest apps/api/tests/test_api_contract.py::test_bounty_with_other_user_answer_requires_delete_review -q
```

Expected: PASS.

- [ ] **Step 6: Run existing unused-bounty delete test**

Run:

```bash
uv run pytest apps/api/tests/test_api_contract.py::test_deleting_active_bounty_refunds_frozen_balance -q
```

Expected: PASS.

## Task 2: Backend Edge Cases And Request Report

**Files:**
- Modify: `apps/api/tests/test_api_contract.py`

- [ ] **Step 1: Add test for author own answer not blocking delete**

Add this test near the other bounty delete tests:

```python
def test_bounty_author_own_top_level_comment_does_not_block_delete(client):
    author_token = register_user(client, "bounty-delete-own-comment",
                                 "bounty-delete-own-comment@example.com")

    create_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(author_token),
        json={
            "postType": "BOUNTY",
            "title": "Own comment bounty",
            "content": "question body",
            "bountyAmount": 25,
            "bountyExpireAt": "2026-06-01T12:00:00Z",
        },
    )
    post_id = unwrap(create_response)["data"]["id"]

    comment_response = client.post(
        f"{API_PREFIX}/posts/{post_id}/comments",
        headers=bearer(author_token),
        json={"content": "author clarification"},
    )
    assert comment_response.status_code == 201

    delete_response = client.delete(f"{API_PREFIX}/posts/{post_id}",
                                    headers=bearer(author_token))

    assert delete_response.status_code == 200
```

- [ ] **Step 2: Add test for other-user reply not blocking delete**

Add this test:

```python
def test_bounty_other_user_reply_does_not_block_delete(client):
    author_token = register_user(client, "bounty-delete-reply-author",
                                 "bounty-delete-reply-author@example.com")
    replier_token = register_user(client, "bounty-delete-reply-user",
                                  "bounty-delete-reply-user@example.com")

    create_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(author_token),
        json={
            "postType": "BOUNTY",
            "title": "Reply only bounty",
            "content": "question body",
            "bountyAmount": 25,
            "bountyExpireAt": "2026-06-01T12:00:00Z",
        },
    )
    post_id = unwrap(create_response)["data"]["id"]

    parent_response = client.post(
        f"{API_PREFIX}/posts/{post_id}/comments",
        headers=bearer(author_token),
        json={"content": "author clarification"},
    )
    parent_id = unwrap(parent_response)["data"]["id"]

    reply_response = client.post(
        f"{API_PREFIX}/posts/{post_id}/comments",
        headers=bearer(replier_token),
        json={"parentId": parent_id, "content": "reply only"},
    )
    assert reply_response.status_code == 201

    delete_response = client.delete(f"{API_PREFIX}/posts/{post_id}",
                                    headers=bearer(author_token))

    assert delete_response.status_code == 200
```

- [ ] **Step 3: Add test for author deletion request report**

Add this test:

```python
def test_bounty_author_can_submit_delete_request_report(client):
    author_token = register_user(client, "bounty-delete-request-author",
                                 "bounty-delete-request-author@example.com")

    create_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(author_token),
        json={
            "postType": "BOUNTY",
            "title": "Delete request bounty",
            "content": "question body",
            "bountyAmount": 25,
            "bountyExpireAt": "2026-06-01T12:00:00Z",
        },
    )
    post_id = unwrap(create_response)["data"]["id"]

    report_response = client.post(
        f"{API_PREFIX}/posts/{post_id}/reports",
        headers=bearer(author_token),
        json={
            "reason": "AUTHOR_DELETE_REQUEST",
            "detail": "问题已通过其他方式解决",
        },
    )
    report_payload = unwrap(report_response)

    assert report_response.status_code == 201
    assert report_payload["data"]["postId"] == post_id
    assert report_payload["data"]["reason"] == "AUTHOR_DELETE_REQUEST"
```

- [ ] **Step 4: Run the edge-case tests**

Run:

```bash
uv run pytest apps/api/tests/test_api_contract.py::test_bounty_author_own_top_level_comment_does_not_block_delete apps/api/tests/test_api_contract.py::test_bounty_other_user_reply_does_not_block_delete apps/api/tests/test_api_contract.py::test_bounty_author_can_submit_delete_request_report -q
```

Expected: PASS.

- [ ] **Step 5: Run all bounty delete API tests together**

Run:

```bash
uv run pytest apps/api/tests/test_api_contract.py::test_deleting_active_bounty_refunds_frozen_balance apps/api/tests/test_api_contract.py::test_bounty_with_other_user_answer_requires_delete_review apps/api/tests/test_api_contract.py::test_bounty_author_own_top_level_comment_does_not_block_delete apps/api/tests/test_api_contract.py::test_bounty_other_user_reply_does_not_block_delete apps/api/tests/test_api_contract.py::test_bounty_author_can_submit_delete_request_report -q
```

Expected: PASS.

## Task 3: Frontend Author Delete Request Action

**Files:**
- Modify: `apps/web/components/post/detail/post-author-actions.tsx`

- [ ] **Step 1: Import the report mutation and comments query**

Change the mutation import to include `useReportPostMutation`:

```ts
import {
  useDeletePostMutation,
  useReportPostMutation,
  useUpdatePostMutation,
} from "@/components/post/use-post-mutations";
```

Change the query import to include `usePostCommentsQuery`:

```ts
import {
  usePostCommentsQuery,
  usePostDetailQuery,
} from "@/components/post/use-post-queries";
```

- [ ] **Step 2: Add request dialog state and mutation**

Inside `PostAuthorActions`, after the existing `deleteDialogOpen` state, add:

```ts
const [deleteRequestDialogOpen, setDeleteRequestDialogOpen] = useState(false);
const [deleteRequestReason, setDeleteRequestReason] = useState("");
```

After `deletePostMutation`, add:

```ts
const reportPostMutation = useReportPostMutation(postId);
const commentsQuery = usePostCommentsQuery(postId);
```

After `if (!post) return null;`, add:

```ts
const comments = commentsQuery.data ?? [];
const bountyRequiresDeleteReview =
  post.postType === "BOUNTY" &&
  comments.some(
    (comment) =>
      comment.parentId == null &&
      !comment.deleted &&
      comment.authorId !== post.authorId,
  );
```

- [ ] **Step 3: Add submit-delete-request handler**

Add this function after `deletePost`:

```ts
async function submitDeleteRequest() {
  const detail = deleteRequestReason.trim();
  if (!detail) {
    return;
  }

  try {
    await reportPostMutation.mutateAsync({
      reason: "AUTHOR_DELETE_REQUEST",
      detail,
    });
    setDeleteRequestDialogOpen(false);
    setDeleteRequestReason("");
    toast.success("删除申请已提交，请等待管理员处理");
  } catch (error) {
    toast.error(readError(error));
  }
}
```

- [ ] **Step 4: Switch toolbar button behavior**

Replace the delete button in the toolbar with this conditional:

```tsx
{bountyRequiresDeleteReview ? (
  <button
    type="button"
    className="btn btn-danger"
    onClick={() => setDeleteRequestDialogOpen(true)}
  >
    申请删除
  </button>
) : (
  <button
    type="button"
    className="btn btn-danger"
    onClick={() => setDeleteDialogOpen(true)}
  >
    删除帖子
  </button>
)}
```

- [ ] **Step 5: Add deletion request dialog**

Add this `ConfirmDialog` after the existing delete confirmation dialog:

```tsx
<ConfirmDialog
  open={deleteRequestDialogOpen}
  title="申请删除悬赏帖"
  description="已有用户参与回答的悬赏帖不能直接删除。请填写原因，提交后由管理员处理。"
  confirmLabel="提交申请"
  confirmDisabled={!deleteRequestReason.trim()}
  confirmBusy={reportPostMutation.isPending}
  onConfirm={() => void submitDeleteRequest()}
  onOpenChange={(open) => {
    setDeleteRequestDialogOpen(open);
    if (!open) {
      setDeleteRequestReason("");
    }
  }}
>
  <div className="confirm-dialog-form">
    <label className="confirm-dialog-field">
      <span>申请原因</span>
      <textarea
        className="confirm-dialog-textarea"
        value={deleteRequestReason}
        onChange={(event) => setDeleteRequestReason(event.target.value)}
        placeholder="请说明为什么需要删除该悬赏帖"
        rows={4}
        maxLength={300}
        autoFocus
      />
    </label>
  </div>
</ConfirmDialog>
```

- [ ] **Step 6: Run frontend build**

Run:

```bash
npm run build
```

from `apps/web`.

Expected: PASS.

If the build changes `apps/web/next-env.d.ts` only by switching `.next-dev` to `.next-build`, restore that generated side effect before committing:

```bash
git restore -- apps/web/next-env.d.ts
```

## Task 4: Final Verification

**Files:**
- Verify: `apps/api/lenjoy_bbs/modules/posts/lifecycle.py`
- Verify: `apps/api/tests/test_api_contract.py`
- Verify: `apps/web/components/post/detail/post-author-actions.tsx`
- Verify: `apps/web/components/post/use-post-mutations.ts`

- [ ] **Step 1: Run backend bounty delete tests**

Run:

```bash
uv run pytest apps/api/tests/test_api_contract.py::test_deleting_active_bounty_refunds_frozen_balance apps/api/tests/test_api_contract.py::test_bounty_with_other_user_answer_requires_delete_review apps/api/tests/test_api_contract.py::test_bounty_author_own_top_level_comment_does_not_block_delete apps/api/tests/test_api_contract.py::test_bounty_other_user_reply_does_not_block_delete apps/api/tests/test_api_contract.py::test_bounty_author_can_submit_delete_request_report -q
```

Expected: PASS.

- [ ] **Step 2: Run frontend build**

Run:

```bash
npm run build
```

from `apps/web`.

Expected: PASS.

- [ ] **Step 3: Review API diff**

Run:

```bash
git diff -- apps/api/lenjoy_bbs/core/messages.py apps/api/lenjoy_bbs/modules/posts/lifecycle.py apps/api/tests/test_api_contract.py
```

Expected: diff includes only the new error message, participated-bounty guard, and focused tests.

- [ ] **Step 4: Review frontend diff**

Run:

```bash
git diff -- apps/web/components/post/detail/post-author-actions.tsx apps/web/components/post/use-post-mutations.ts
```

Expected: diff adds the author delete request UI and uses the existing report mutation; no unrelated UI refactor.

- [ ] **Step 5: Check generated file cleanup**

Run:

```bash
git status --short
```

Expected: no `apps/web/next-env.d.ts` change unless it had a pre-existing user change before this task.
