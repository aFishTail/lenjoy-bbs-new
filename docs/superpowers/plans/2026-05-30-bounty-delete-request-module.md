# Bounty Delete Request Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move author bounty delete requests out of the report flow and into a dedicated bounty management workflow.

**Architecture:** Add a dedicated `bounty_delete_request` persistence model, author API, admin API, and admin page. Approval soft-deletes the bounty post by reusing the existing bounty refund/cancel behavior; rejection only updates request status and sends a bounty-specific site message.

**Tech Stack:** FastAPI, async SQLAlchemy, Alembic, pytest, Next.js App Router, React Query, TypeScript.

---

### Task 1: Backend Model, Migration, and Contract Tests

**Files:**
- Create: `apps/api/migrations/versions/20260530_0005_add_bounty_delete_request.py`
- Modify: `apps/api/lenjoy_bbs/modules/reports/models.py`
- Modify: `apps/api/tests/test_fastapi_structure.py`
- Modify: `apps/api/tests/test_api_contract.py`

- [ ] **Step 1: Add failing model/import tests**

In `apps/api/tests/test_fastapi_structure.py`, extend the existing model import test so it imports `BountyDeleteRequest` from `lenjoy_bbs.modules.reports.models` and asserts it is not `None`.

In `apps/api/tests/test_api_contract.py`, import `BountyDeleteRequest` beside the existing reports models and add tests named:

```python
def test_bounty_author_delete_request_does_not_create_report(client):
    ...
    response = client.post(
        f"{API_PREFIX}/posts/{post_id}/bounty-delete-requests",
        headers=bearer(author_token),
        json={"reason": "question duplicated"},
    )
    assert response.status_code == 201
    payload = unwrap(response)
    assert payload["data"]["postId"] == post_id
    assert payload["data"]["status"] == "PENDING"

    async def inspect_rows() -> tuple[int, int]:
        async with TestingSessionLocal() as session:
            request_count = await session.scalar(select(func.count()).select_from(BountyDeleteRequest))
            report_count = await session.scalar(select(func.count()).select_from(PostReport))
            return request_count or 0, report_count or 0

    request_count, report_count = asyncio.run(inspect_rows())
    assert request_count == 1
    assert report_count == 0
```

Also add focused negative tests for non-author, non-bounty post, no external top-level answer, and duplicate pending request. Expected duplicate error code should be `BOUNTY_DELETE_REQUEST_PENDING`.

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
uv run pytest apps/api/tests/test_fastapi_structure.py::test_messages_reports_and_admin_users_use_service_entrypoints apps/api/tests/test_api_contract.py::test_bounty_author_delete_request_does_not_create_report -q
```

Expected: fails because `BountyDeleteRequest` and the new route do not exist.

- [ ] **Step 3: Add the model and migration**

In `apps/api/lenjoy_bbs/modules/reports/models.py`, add:

```python
class BountyDeleteRequest(Base):
    __tablename__ = "bounty_delete_request"

    id: Mapped[int] = mapped_column(IdType, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("bbs_post.id"), nullable=False)
    author_id: Mapped[int] = mapped_column(ForeignKey("user_account.id"), nullable=False)
    reason: Mapped[str] = mapped_column(String(1000), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="PENDING", nullable=False)
    resolution_note: Mapped[str | None] = mapped_column(String(255))
    handled_by: Mapped[int | None] = mapped_column(BigInteger)
    handled_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc, onupdate=now_utc, nullable=False)
```

Create migration `20260530_0005_add_bounty_delete_request.py` with `down_revision = "20260528_0004"` and a matching `op.create_table("bounty_delete_request", ...)`. Add a non-unique index on `post_id` and `status`; enforce the one-pending-request rule in service code for SQLite compatibility.

- [ ] **Step 4: Run structure test**

Run:

```powershell
uv run pytest apps/api/tests/test_fastapi_structure.py::test_messages_reports_and_admin_users_use_service_entrypoints -q
```

Expected: pass.

### Task 2: Author Request API

**Files:**
- Create: `apps/api/lenjoy_bbs/modules/posts/bounty_delete_requests.py`
- Modify: `apps/api/lenjoy_bbs/modules/posts/router.py`
- Modify: `apps/api/lenjoy_bbs/modules/posts/schemas.py`
- Modify: `apps/api/lenjoy_bbs/core/messages.py`
- Modify: `apps/api/tests/test_api_contract.py`

- [ ] **Step 1: Add request/response schemas and messages**

Add Pydantic models:

```python
class BountyDeleteRequestCreate(BaseModel):
    reason: str = Field(min_length=1, max_length=1000)

class BountyDeleteRequestResponse(BaseModel):
    id: int
    post_id: int = Field(alias="postId")
    author_id: int = Field(alias="authorId")
    reason: str
    status: str
    created_at: str = Field(alias="createdAt")
```

Add `Posts` messages:

```python
BOUNTY_DELETE_REQUEST_PENDING = ApiMessage("BOUNTY_DELETE_REQUEST_PENDING", "悬赏删除申请已提交，请等待管理员处理")
BOUNTY_DELETE_REQUEST_NOT_ALLOWED = ApiMessage("BOUNTY_DELETE_REQUEST_NOT_ALLOWED", "当前悬赏帖不能提交删除申请")
```

- [ ] **Step 2: Implement service**

Create `bounty_delete_requests.py` with:

```python
async def create_bounty_delete_request(
    db: AsyncSession,
    post_id: int,
    author: UserAccount,
    reason: str,
) -> BountyDeleteRequest:
    post = await find_post(db, post_id)
    if not post:
        raise ApiError(Posts.POST_NOT_FOUND)
    if post.author_id != author.id:
        raise ApiError(Posts.DELETE_FORBIDDEN)
    if post.post_type != "BOUNTY":
        raise ApiError(Posts.POST_NOT_BOUNTY)
    if not await _bounty_has_external_answer(db, post):
        raise ApiError(Posts.BOUNTY_DELETE_REQUEST_NOT_ALLOWED)
    pending = await db.scalar(
        select(BountyDeleteRequest).where(
            BountyDeleteRequest.post_id == post.id,
            BountyDeleteRequest.status == "PENDING",
        )
    )
    if pending:
        raise ApiError(Posts.BOUNTY_DELETE_REQUEST_PENDING)
    item = BountyDeleteRequest(
        post_id=post.id,
        author_id=author.id,
        reason=reason.strip(),
        status="PENDING",
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item
```

Move `_bounty_has_external_answer` out of `lifecycle.py` into this service or make it exported from `lifecycle.py`; keep a single implementation used by both direct-delete blocking and request creation.

- [ ] **Step 3: Add route**

In `apps/api/lenjoy_bbs/modules/posts/router.py`, add:

```python
@router.post(
    "/{post_id}/bounty-delete-requests",
    status_code=status.HTTP_201_CREATED,
)
async def create_bounty_delete_request_endpoint(
    post_id: int,
    payload: BountyDeleteRequestCreate,
    db: DbSession,
    user: CurrentUser,
):
    item = await create_bounty_delete_request(db, post_id, user, payload.reason)
    return success(serialize_bounty_delete_request(item))
```

- [ ] **Step 4: Run author API tests**

Run:

```powershell
uv run pytest apps/api/tests/test_api_contract.py::test_bounty_author_delete_request_does_not_create_report apps/api/tests/test_api_contract.py::test_bounty_delete_request_duplicate_pending_rejected -q
```

Expected: pass.

### Task 3: Admin Review API

**Files:**
- Create: `apps/api/lenjoy_bbs/modules/admin/bounty_delete_requests/router.py`
- Create: `apps/api/lenjoy_bbs/modules/admin/bounty_delete_requests/service.py`
- Create: `apps/api/lenjoy_bbs/modules/admin/bounty_delete_requests/schemas.py`
- Modify: `apps/api/lenjoy_bbs/modules/admin/router.py`
- Modify: `apps/api/lenjoy_bbs/core/messages.py`
- Modify: `apps/api/tests/test_api_contract.py`

- [ ] **Step 1: Add failing admin tests**

Add tests:

```python
def test_admin_approves_bounty_delete_request_soft_deletes_post_and_notifies_author(client):
    ...
    review_response = client.patch(
        f"{API_PREFIX}/admin/bounty-delete-requests/{request_id}",
        headers=bearer(admin_token),
        json={"action": "APPROVE", "resolutionNote": "approved"},
    )
    assert review_response.status_code == 200
    assert unwrap(review_response)["data"]["status"] == "APPROVED"
    assert client.get(f"{API_PREFIX}/posts/{post_id}").status_code == 404
    messages = unwrap(client.get(f"{API_PREFIX}/users/me/messages", headers=bearer(author_token)))["data"]
    assert any(m["messageType"] == "BOUNTY_DELETE_REQUEST_APPROVED" for m in messages)
```

Add a rejection test that asserts the post remains readable and the message type is `BOUNTY_DELETE_REQUEST_REJECTED`.

- [ ] **Step 2: Implement admin service**

Implement list and review functions. Approval should:

```python
await refund_active_bounty_reserve(db, post, "bounty_delete_request", admin_id)
if post.bounty_status == "ACTIVE":
    post.bounty_status = "CANCELLED"
post.is_deleted = True
request.status = "APPROVED"
await create_site_message(..., message_type="BOUNTY_DELETE_REQUEST_APPROVED")
```

Rejection should only mark the request rejected and send `BOUNTY_DELETE_REQUEST_REJECTED`.

- [ ] **Step 3: Add admin router**

Mount the router from `lenjoy_bbs.modules.admin.router` and expose:

```python
@router.get("/bounty-delete-requests")
async def bounty_delete_requests(...):
    return success(await list_bounty_delete_requests(...))

@router.patch("/bounty-delete-requests/{request_id}")
async def review_bounty_delete_request(...):
    return success(await review_bounty_delete_request(...))
```

- [ ] **Step 4: Run admin tests**

Run:

```powershell
uv run pytest apps/api/tests/test_api_contract.py::test_admin_approves_bounty_delete_request_soft_deletes_post_and_notifies_author apps/api/tests/test_api_contract.py::test_admin_rejects_bounty_delete_request_keeps_post_visible -q
```

Expected: pass.

### Task 4: Frontend Author Submission

**Files:**
- Create: `apps/web/app/api/posts/[postId]/bounty-delete-requests/route.ts`
- Modify: `apps/web/components/post/use-post-mutations.ts`
- Modify: `apps/web/components/post/detail/post-author-actions.tsx`

- [ ] **Step 1: Replace report mutation usage**

Add `useCreateBountyDeleteRequestMutation(postId)` that posts to `/api/posts/${postId}/bounty-delete-requests` with `{ reason }`.

In `post-author-actions.tsx`, remove `useReportPostMutation` from the delete-request path and call the new mutation. Keep the same dialog and button visibility logic.

- [ ] **Step 2: Add Next route proxy**

Create the route handler mirroring the existing report proxy:

```ts
export async function POST(request: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  return proxyRequest(request, `${backendBase}/api/v1/posts/${postId}/bounty-delete-requests`);
}
```

- [ ] **Step 3: Build web**

Run:

```powershell
npm run build
```

from `apps/web`.

Expected: Next.js build succeeds. If `apps/web/next-env.d.ts` is modified only by the build, restore it before committing.

### Task 5: Admin UI and Navigation

**Files:**
- Create: `apps/web/app/admin/bounty-delete-requests/page.tsx`
- Create: `apps/web/app/api/admin/bounty-delete-requests/route.ts`
- Create: `apps/web/app/api/admin/bounty-delete-requests/[requestId]/route.ts`
- Create: `apps/web/components/admin/admin-bounty-delete-requests-client.tsx`
- Modify: `apps/web/components/admin/admin-shell.tsx`
- Modify: `apps/web/components/admin/use-admin-queries.ts`
- Modify: `apps/web/components/admin/use-admin-mutations.ts`
- Modify: `apps/web/components/post/client-helpers.ts`
- Modify: `apps/web/components/post/types.ts`

- [ ] **Step 1: Add frontend types and query keys**

Add:

```ts
export type BountyDeleteRequestItem = {
  id: number;
  postId: number;
  postTitle?: string | null;
  authorId: number;
  authorUsername?: string | null;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  resolutionNote?: string | null;
  handledBy?: number | null;
  createdAt: string;
  handledAt?: string | null;
  bountyAmount?: number | null;
  answerCount?: number;
};
```

Add `adminBountyDeleteRequests(filters)` to query keys and React Query hooks for list/review.

- [ ] **Step 2: Add admin page**

Build a table page with status and keyword filters, rows for post title, author, reason, status, and actions. Pending rows show `通过` and `驳回`; processed rows show handling note.

Use the existing `ConfirmDialog`, `Input`, `Select`, `Button`, and `Table` components.

- [ ] **Step 3: Update admin navigation**

Change `admin-shell.tsx` so `悬赏管理` is a parent group with child links:

```ts
{ label: "悬赏管理", children: [
  { href: "/admin/bounties", label: "悬赏治理" },
  { href: "/admin/bounty-delete-requests", label: "删除申请" },
] }
```

Render child links with the same active-state behavior used for flat links. Keep unrelated admin menus unchanged.

- [ ] **Step 4: Build web**

Run:

```powershell
npm run build
```

from `apps/web`.

Expected: build succeeds.

### Task 6: Cleanup and Regression

**Files:**
- Modify only files touched by previous tasks if tests reveal issues.

- [ ] **Step 1: Remove obsolete report-based delete request test**

Remove or replace `test_bounty_author_can_submit_delete_request_report`; the new assertion is that author delete requests do not create reports.

- [ ] **Step 2: Run focused backend suite**

Run:

```powershell
uv run pytest apps/api/tests/test_api_contract.py::test_bounty_with_other_user_answer_requires_delete_review apps/api/tests/test_api_contract.py::test_bounty_author_delete_request_does_not_create_report apps/api/tests/test_api_contract.py::test_admin_approves_bounty_delete_request_soft_deletes_post_and_notifies_author apps/api/tests/test_api_contract.py::test_admin_rejects_bounty_delete_request_keeps_post_visible -q
```

Expected: pass.

- [ ] **Step 3: Run full relevant checks**

Run:

```powershell
uv run pytest apps/api/tests/test_api_contract.py apps/api/tests/test_fastapi_structure.py -q
```

Then:

```powershell
npm run build
```

from `apps/web`.

Expected: all checks pass.

- [ ] **Step 4: Commit implementation**

Review `git status --short`, exclude generated build artifacts, then commit:

```powershell
git add apps/api apps/web
git commit -m "feat: add bounty delete request workflow"
```
