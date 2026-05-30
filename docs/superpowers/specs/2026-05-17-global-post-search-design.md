# Global Post Search Design

Date: 2026-05-17

## Goal

Add a first-version global search feature for the forum. The feature should let users search published posts by title and public content from any page, then browse results on a dedicated search page.

## Scope

In scope:

- One global search entry in the top navigation.
- A dedicated `/search` page.
- Search by post title and public `content`.
- Results for published, non-deleted posts only.
- Type filters on the search page: all, discussion, resource, bounty.
- Pagination with URL state preserved.
- Empty keyword, no-result, loading, and error states.

Out of scope for the first version:

- Searching hidden paid content.
- Searching comments, users, tags, or categories as independent result types.
- Search suggestions, autocomplete, hot searches, search history, result highlighting, and sort switching.
- Dedicated search engine infrastructure.
- PostgreSQL trigram or full-text index optimization.

## Recommended Approach

Use the existing posts list API and repository query for the first version.

The current backend already supports a `keyword` parameter on `GET /api/v1/posts`, and the repository matches `Post.title` and `Post.content` for published posts. Reusing this path keeps the change small, avoids duplicate search/list behavior, and matches the existing pagination and post card data shape.

If search performance becomes a real problem after usage grows, add a second phase with PostgreSQL trigram or full-text indexes and consider relevance sorting then.

## User Experience

### Navigation Search

The top navigation includes a global search form.

- Submitting a non-empty keyword routes to `/search?q=<keyword>`.
- Empty or whitespace-only input does not navigate.
- The search input uses the current `q` value when the user is already on `/search`.
- Submitting a new keyword from `/search` resets pagination to page 1.

### Search Results Page

The `/search` page reads these URL parameters:

- `q`: search keyword.
- `type`: optional post type filter. Supported values are `NORMAL`, `RESOURCE`, and `BOUNTY`.
- `page`: optional page number, defaulting to 1.

Page behavior:

- No keyword: show an empty state asking the user to enter a keyword; do not request the post list.
- Keyword with results: show result count, current keyword, type filter tabs, post cards, and pagination.
- Keyword with no results: show a no-result state and provide clear actions to clear the type filter or change the keyword.
- Type filter changes preserve `q` and reset `page` to 1.
- Pagination preserves `q` and `type`.

Post result cards should reuse the existing post list card structure: title, author, post type, category or tags when available, view/comment/like counts, and created time.

## API Design

No new backend search endpoint is required for version 1.

Use:

```text
GET /api/v1/posts?page=1&pageSize=20&keyword=<keyword>
GET /api/v1/posts?page=1&pageSize=20&keyword=<keyword>&postType=RESOURCE
```

The Next.js app should continue calling through the existing `/api/posts` proxy route.

Backend behavior:

- Trim `keyword`.
- Treat an empty trimmed keyword as no keyword.
- Validate `keyword` length with a maximum of 100 characters.
- Return 422 for an overlong keyword.
- Match only `Post.title` and public `Post.content`.
- Do not match `Post.hidden_content`.
- Continue filtering to `status == "PUBLISHED"` and `is_deleted == false`.
- Keep the current default ordering by `created_at desc`.

## Data Flow

1. User submits the top navigation search form.
2. Frontend routes to `/search?q=<keyword>`.
3. `/search` reads URL state and requests `/api/posts` only when `q` is non-empty.
4. The frontend proxy calls `GET /api/v1/posts` with `keyword`, optional `postType`, `page`, and `pageSize`.
5. The backend repository applies publication/deletion filters, optional type filter, keyword matching, ordering, limit, and offset.
6. The search page renders post cards and pagination from the existing paginated response shape.

## Testing

Backend tests:

- `GET /api/v1/posts?keyword=...` matches a post title.
- `GET /api/v1/posts?keyword=...` matches public `content`.
- Search does not match `hidden_content`.
- Search does not return offline or deleted posts.
- `postType` and `keyword` together return only matching posts of that type.
- Whitespace-only keyword behaves like the normal list endpoint.
- Overlong keyword returns 422.

Frontend tests:

- Submitting the navigation search form routes to `/search?q=...`.
- `/search` reads `q` and renders matching results.
- Type filter tabs update the URL and refresh results.
- Empty `q` shows the empty keyword state without an unnecessary list request.
- No-result searches show a no-result state.
- Pagination preserves `q` and `type`.

## Acceptance Criteria

- Users can start a post search from the top navigation on any page.
- Search results only include published, non-deleted posts whose title or public content matches the keyword.
- Users can filter results by all, discussion, resource, or bounty.
- URL state survives refresh and browser navigation.
- Existing discussion, resource, and bounty list pages continue to behave as they do today.
