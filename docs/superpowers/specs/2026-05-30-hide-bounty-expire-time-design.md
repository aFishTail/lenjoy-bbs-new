# Hide Bounty Expire Time Design

## Context

The bounty post flow currently exposes a bounty deadline field in create/edit UI
and the API supports `bountyExpireAt`. The broader bounty expiry and deletion
review behavior needs more product discussion, so this change intentionally
reduces scope to hiding the deadline field for now.

## Goals

- Hide the bounty deadline input when creating a bounty post.
- Hide the bounty deadline input when editing a bounty post.
- Do not show a bounty deadline on the post detail page.
- Keep existing backend model, API fields, and stored data unchanged.

## Non-Goals

- Do not implement expiry enforcement for bounty answers.
- Do not change bounty refund, settlement, or deletion behavior.
- Do not add a deletion request workflow.
- Do not remove database columns or API response fields.

## Design

The web app will stop asking users for `bountyExpireAt`. Bounty creation and
editing forms will no longer render a deadline control and will no longer apply
client-side validation that requires a deadline for bounty posts.

When submitting a bounty post from the web UI, the client will send
`bountyExpireAt: null` or omit the field, matching the existing backend schema
where the field is optional. Editing a bounty post will not submit a new bounty
deadline.

The post detail page already does not need to surface this field. If any
deadline display exists or is added by local code paths, it should be removed or
kept hidden as part of this change.

## Components

- Create post form: remove the bounty deadline field and validation.
- Author edit tools: remove the bounty deadline field and validation.
- Post detail content: ensure no deadline display is rendered.
- API/backend: no schema, migration, or lifecycle changes.

## Data Flow

1. User chooses bounty post type.
2. UI asks for title, content, category/tags, and bounty amount.
3. UI submits the post without requiring a deadline.
4. Backend stores `bounty_expire_at` as `NULL` when no value is provided.
5. Detail views continue to receive `bountyExpireAt` from the API but do not
   display it.

## Error Handling

No new backend errors are introduced. Existing validation for bounty amount,
title, content, category, and tags remains unchanged.

If the backend rejects omitted or null `bountyExpireAt` in practice, the
implementation should adjust the frontend request shape to match the current
accepted optional-field behavior instead of changing the bounty lifecycle.

## Testing

- Verify bounty creation succeeds without a visible deadline field.
- Verify bounty editing succeeds without a visible deadline field.
- Verify post detail does not display a bounty deadline.
- Run the relevant frontend build or test command available in the project.
