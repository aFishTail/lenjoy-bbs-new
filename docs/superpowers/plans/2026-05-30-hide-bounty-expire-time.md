# Hide Bounty Expire Time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the bounty deadline field from create/edit/detail UI while leaving backend fields and lifecycle behavior unchanged.

**Architecture:** This is a frontend-only change. The create and edit form schemas stop requiring `bountyExpireAt`, the rendered datetime inputs are removed, and submit payloads no longer include a deadline value. The post detail component is verified to show amount/status only, not the deadline.

**Tech Stack:** Next.js App Router, React, TypeScript, React Hook Form, Zod.

---

## File Structure

- Modify: `apps/web/components/post/create-post-client.tsx`
  - Remove `bountyExpireAt` from form schema/defaults/submit payload.
  - Remove the rendered bounty deadline `<Field>`.
- Modify: `apps/web/components/post/detail/post-author-actions.tsx`
  - Remove `bountyExpireAt` from edit schema/defaults/reset/submit payload.
  - Remove the rendered edit bounty deadline `<Field>`.
- Modify: `apps/web/components/post/use-post-mutations.ts`
  - Allow update payloads to omit `bountyExpireAt` after the edit form stops
    submitting it.
- Verify: `apps/web/components/post/detail/post-content-section.tsx`
  - Confirm it does not render `post.bountyExpireAt`.

## Task 1: Hide Deadline From Create Post Form

**Files:**
- Modify: `apps/web/components/post/create-post-client.tsx`

- [ ] **Step 1: Remove create-form deadline schema field**

Change:

```ts
bountyExpireAt: z.string(),
```

to no field at all. Keep `bountyAmount`.

- [ ] **Step 2: Remove create-form deadline validation**

Delete this block from the `values.postType === "BOUNTY"` branch:

```ts
if (!values.bountyExpireAt) {
  ctx.addIssue({
    code: "custom",
    path: ["bountyExpireAt"],
    message: "请设置截止时间",
  });
}
```

- [ ] **Step 3: Remove deadline default value**

Delete:

```ts
bountyExpireAt: "",
```

from the `useForm` `defaultValues`.

- [ ] **Step 4: Remove deadline from create submit payload**

Change:

```ts
bountyExpireAt:
  data.postType === "BOUNTY" ? data.bountyExpireAt : undefined,
```

to no property at all. Keep the existing `bountyAmount` payload behavior.

- [ ] **Step 5: Remove rendered create deadline field**

Delete this field from the bounty-only form section:

```tsx
<Field data-invalid={!!errors.bountyExpireAt || undefined}>
  <FieldLabel htmlFor="bountyExpireAt">截止时间</FieldLabel>
  <Input
    id="bountyExpireAt"
    type="datetime-local"
    aria-invalid={!!errors.bountyExpireAt}
    {...register("bountyExpireAt")}
  />
  {errors.bountyExpireAt?.message ? (
    <FieldError>{errors.bountyExpireAt.message}</FieldError>
  ) : null}
</Field>
```

- [ ] **Step 6: Type-check for stale references**

Run:

```bash
rg -n "bountyExpireAt" apps/web/components/post/create-post-client.tsx
```

Expected: no output.

## Task 2: Hide Deadline From Author Edit Form

**Files:**
- Modify: `apps/web/components/post/detail/post-author-actions.tsx`
- Modify: `apps/web/components/post/use-post-mutations.ts`

- [ ] **Step 1: Remove edit-form deadline schema field**

Change:

```ts
bountyExpireAt: z.string(),
```

to no field at all. Keep `bountyAmount`.

- [ ] **Step 2: Remove edit-form deadline validation**

Delete this block from the `values.postType === "BOUNTY"` branch:

```ts
if (!values.bountyExpireAt) {
  ctx.addIssue({
    code: "custom",
    path: ["bountyExpireAt"],
    message: "请设置截止时间",
  });
}
```

- [ ] **Step 3: Remove edit deadline helper and defaults**

Delete the helper:

```ts
function formatDateTimeInput(value?: string | null) {
  return value ? value.slice(0, 16) : "";
}
```

Delete this default value:

```ts
bountyExpireAt: "",
```

- [ ] **Step 4: Remove edit reset deadline value**

Delete:

```ts
bountyExpireAt: formatDateTimeInput(post.bountyExpireAt),
```

from the `reset(...)` call.

- [ ] **Step 5: Remove deadline from update submit payload**

Change:

```ts
bountyExpireAt:
  data.postType === "BOUNTY" ? data.bountyExpireAt : null,
```

to no property at all. Keep the existing `bountyAmount` payload behavior.

- [ ] **Step 6: Remove rendered edit deadline field**

Delete this field from the bounty-only edit section:

```tsx
<Field data-invalid={!!errors.bountyExpireAt || undefined}>
  <FieldLabel htmlFor="edit-bountyExpireAt">截止时间</FieldLabel>
  <Input
    id="edit-bountyExpireAt"
    type="datetime-local"
    aria-invalid={!!errors.bountyExpireAt}
    {...register("bountyExpireAt")}
  />
  {errors.bountyExpireAt?.message ? (
    <FieldError>{errors.bountyExpireAt.message}</FieldError>
  ) : null}
</Field>
```

- [ ] **Step 7: Type-check for stale references**

Run:

```bash
rg -n "bountyExpireAt|formatDateTimeInput" apps/web/components/post/detail/post-author-actions.tsx
```

Expected: no output.

- [ ] **Step 8: Make update mutation deadline optional**

In `apps/web/components/post/use-post-mutations.ts`, change:

```ts
bountyExpireAt: string | null;
```

to:

```ts
bountyExpireAt?: string | null;
```

Expected: author edit payloads can omit the deadline while existing callers
that still provide it remain type-compatible.

## Task 3: Verify Detail Page And Build

**Files:**
- Verify: `apps/web/components/post/detail/post-content-section.tsx`
- Verify: `apps/web/components/post/create-post-client.tsx`
- Verify: `apps/web/components/post/detail/post-author-actions.tsx`

- [ ] **Step 1: Confirm detail page does not render deadline**

Run:

```bash
rg -n "bountyExpireAt|截止时间" apps/web/components/post/detail/post-content-section.tsx
```

Expected: no output.

- [ ] **Step 2: Confirm only non-form references remain**

Run:

```bash
rg -n "bountyExpireAt|截止时间" apps/web/components/post apps/web/app
```

Expected: references may remain in shared types, admin bounty management, API types, or tests. No create form, author edit form, or detail content deadline input/display references should remain.

- [ ] **Step 3: Run frontend build**

Run:

```bash
npm run build
```

Expected: build completes successfully.

- [ ] **Step 4: Review diff**

Run:

```bash
git diff -- apps/web/components/post/create-post-client.tsx apps/web/components/post/detail/post-author-actions.tsx
```

Expected: diff only removes deadline field validation, defaults, payload values, and rendered inputs.
