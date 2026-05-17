# Global Post Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single global post search entry that routes to `/search`, searches published posts by title and public content, and supports type filters and pagination.

**Architecture:** Reuse the existing posts list backend endpoint and frontend post card data shape. Add only the missing global search UI and a dedicated search results page, while tightening backend keyword validation around the existing query.

**Tech Stack:** FastAPI, Pydantic/FastAPI query validation, SQLAlchemy async, Next.js App Router, React Query, TypeScript, Playwright.

---

## File Structure

- Modify `apps/api/lenjoy_bbs/modules/posts/router.py`: validate `keyword` length on the existing `list_posts` endpoint.
- Modify `apps/api/tests/test_api_contract.py`: add backend contract tests for keyword title/content matching, hidden content exclusion, post type filtering, whitespace, deleted/offline exclusion, and overlong keyword validation.
- Modify `apps/web/components/post/client-helpers.ts`: add a search-specific React Query key.
- Modify `apps/web/components/post/use-post-queries.ts`: add `useSearchPostsQuery` and a URL builder that supports optional post type.
- Create `apps/web/components/post/search-page-client.tsx`: client-side search result UI, type filters, empty states, and pagination.
- Create `apps/web/app/search/page.tsx`: server page that reads URL state and fetches initial search results when `q` is non-empty.
- Modify `apps/web/components/layout/navigation.tsx`: add the global search form.
- Modify `apps/web/components/layout/navigation.module.css`: style the navigation search responsively without disrupting existing links/actions.
- Modify `apps/web/test/smoke.e2e.spec.ts`: add smoke coverage for navigation search and search URL state.

---

### Task 1: Backend Search Contract Tests

**Files:**
- Modify: `apps/api/tests/test_api_contract.py`
- Verify: `apps/api/lenjoy_bbs/modules/posts/router.py`

- [ ] **Step 1: Add failing backend tests for search behavior**

Append these tests near the existing post list/filter tests in `apps/api/tests/test_api_contract.py`. The helper functions `register_user`, `bearer`, `unwrap`, `API_PREFIX`, and `SessionLocal` already exist in this file.

```python
def test_posts_keyword_search_matches_title_and_public_content(client):
    token = register_user(client, "search-author",
                          "search-author@example.com")

    title_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(token),
        json={
            "postType": "NORMAL",
            "title": "Need help with Redis streams",
            "content": "general body",
        },
    )
    content_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(token),
        json={
            "postType": "RESOURCE",
            "title": "Backend note",
            "content": "This public body mentions searchable-marker.",
            "hiddenContent": "private download",
            "price": 3,
        },
    )
    other_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(token),
        json={
            "postType": "BOUNTY",
            "title": "Unrelated question",
            "content": "different body",
            "bountyAmount": 5,
            "bountyExpireAt": "2026-06-01T12:00:00Z",
        },
    )
    assert title_response.status_code == 201
    assert content_response.status_code == 201
    assert other_response.status_code == 201

    title_id = unwrap(title_response)["data"]["id"]
    content_id = unwrap(content_response)["data"]["id"]
    other_id = unwrap(other_response)["data"]["id"]

    title_payload = unwrap(
        client.get(f"{API_PREFIX}/posts?page=1&pageSize=20&keyword=redis"))
    title_ids = {item["id"] for item in title_payload["data"]["items"]}
    assert title_id in title_ids
    assert content_id not in title_ids
    assert other_id not in title_ids

    content_payload = unwrap(
        client.get(
            f"{API_PREFIX}/posts?page=1&pageSize=20&keyword=searchable-marker"
        ))
    content_ids = {item["id"] for item in content_payload["data"]["items"]}
    assert content_id in content_ids
    assert title_id not in content_ids
    assert other_id not in content_ids


def test_posts_keyword_search_excludes_hidden_content(client):
    token = register_user(client, "hidden-search-author",
                          "hidden-search-author@example.com")

    create_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(token),
        json={
            "postType": "RESOURCE",
            "title": "Public title",
            "content": "public body",
            "hiddenContent": "hidden-only-needle",
            "price": 7,
        },
    )
    assert create_response.status_code == 201
    post_id = unwrap(create_response)["data"]["id"]

    payload = unwrap(
        client.get(
            f"{API_PREFIX}/posts?page=1&pageSize=20&keyword=hidden-only-needle"
        ))

    assert post_id not in {item["id"] for item in payload["data"]["items"]}


def test_posts_keyword_search_combines_with_post_type(client):
    token = register_user(client, "typed-search-author",
                          "typed-search-author@example.com")

    normal_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(token),
        json={
            "postType": "NORMAL",
            "title": "Shared keyword",
            "content": "body",
        },
    )
    resource_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(token),
        json={
            "postType": "RESOURCE",
            "title": "Shared keyword",
            "content": "body",
            "hiddenContent": "download",
            "price": 4,
        },
    )
    assert normal_response.status_code == 201
    assert resource_response.status_code == 201

    normal_id = unwrap(normal_response)["data"]["id"]
    resource_id = unwrap(resource_response)["data"]["id"]

    payload = unwrap(
        client.get(
            f"{API_PREFIX}/posts?page=1&pageSize=20&keyword=shared&postType=RESOURCE"
        ))
    ids = {item["id"] for item in payload["data"]["items"]}

    assert resource_id in ids
    assert normal_id not in ids
    assert {item["postType"] for item in payload["data"]["items"]} == {
        "RESOURCE"
    }


def test_posts_keyword_search_excludes_deleted_and_offline_posts(client):
    token = register_user(client, "visibility-search-author",
                          "visibility-search-author@example.com")

    published_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(token),
        json={
            "postType": "NORMAL",
            "title": "visible-search-keyword",
            "content": "body",
        },
    )
    offline_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(token),
        json={
            "postType": "NORMAL",
            "title": "offline-search-keyword",
            "content": "body",
        },
    )
    deleted_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(token),
        json={
            "postType": "NORMAL",
            "title": "deleted-search-keyword",
            "content": "body",
        },
    )
    assert published_response.status_code == 201
    assert offline_response.status_code == 201
    assert deleted_response.status_code == 201

    published_id = unwrap(published_response)["data"]["id"]
    offline_id = unwrap(offline_response)["data"]["id"]
    deleted_id = unwrap(deleted_response)["data"]["id"]

    async def hide_posts() -> None:
        async with SessionLocal() as db:
            from lenjoy_bbs.modules.posts.models import Post

            offline_post = await db.get(Post, offline_id)
            deleted_post = await db.get(Post, deleted_id)
            offline_post.status = "OFFLINE"
            deleted_post.is_deleted = True
            await db.commit()

    asyncio.run(hide_posts())

    payload = unwrap(
        client.get(f"{API_PREFIX}/posts?page=1&pageSize=20&keyword=search-keyword"))
    ids = {item["id"] for item in payload["data"]["items"]}

    assert published_id in ids
    assert offline_id not in ids
    assert deleted_id not in ids


def test_posts_keyword_whitespace_behaves_like_no_keyword(client):
    token = register_user(client, "blank-search-author",
                          "blank-search-author@example.com")

    create_response = client.post(
        f"{API_PREFIX}/posts",
        headers=bearer(token),
        json={
            "postType": "NORMAL",
            "title": "Blank keyword visible",
            "content": "body",
        },
    )
    assert create_response.status_code == 201
    post_id = unwrap(create_response)["data"]["id"]

    payload = unwrap(
        client.get(f"{API_PREFIX}/posts?page=1&pageSize=20&keyword=%20%20%20"))

    assert post_id in {item["id"] for item in payload["data"]["items"]}


def test_posts_keyword_rejects_overlong_value(client):
    keyword = "x" * 101

    response = client.get(
        f"{API_PREFIX}/posts?page=1&pageSize=20&keyword={keyword}")

    assert response.status_code == 422
```

- [ ] **Step 2: Run backend search tests and confirm the validation test fails**

Run:

```bash
cd apps/api
uv run pytest tests/test_api_contract.py::test_posts_keyword_search_matches_title_and_public_content tests/test_api_contract.py::test_posts_keyword_search_excludes_hidden_content tests/test_api_contract.py::test_posts_keyword_search_combines_with_post_type tests/test_api_contract.py::test_posts_keyword_search_excludes_deleted_and_offline_posts tests/test_api_contract.py::test_posts_keyword_whitespace_behaves_like_no_keyword tests/test_api_contract.py::test_posts_keyword_rejects_overlong_value -q
```

Expected: the first five tests should pass with the current implementation, and `test_posts_keyword_rejects_overlong_value` should fail because `keyword` does not yet have a 100-character limit.

- [ ] **Step 3: Commit failing backend tests**

```bash
git add apps/api/tests/test_api_contract.py
git commit -m "test: cover post keyword search contract"
```

---

### Task 2: Backend Keyword Validation

**Files:**
- Modify: `apps/api/lenjoy_bbs/modules/posts/router.py`
- Test: `apps/api/tests/test_api_contract.py`

- [ ] **Step 1: Add the minimal keyword validation**

In `apps/api/lenjoy_bbs/modules/posts/router.py`, change the existing `keyword` query parameter in `list_posts` from:

```python
keyword: str | None = Query(default=None),
```

to:

```python
keyword: str | None = Query(default=None, max_length=100),
```

Keep repository-level trimming unchanged. It already treats whitespace-only values as no keyword.

- [ ] **Step 2: Run the backend search tests**

Run:

```bash
cd apps/api
uv run pytest tests/test_api_contract.py::test_posts_keyword_search_matches_title_and_public_content tests/test_api_contract.py::test_posts_keyword_search_excludes_hidden_content tests/test_api_contract.py::test_posts_keyword_search_combines_with_post_type tests/test_api_contract.py::test_posts_keyword_search_excludes_deleted_and_offline_posts tests/test_api_contract.py::test_posts_keyword_whitespace_behaves_like_no_keyword tests/test_api_contract.py::test_posts_keyword_rejects_overlong_value -q
```

Expected: all six tests pass.

- [ ] **Step 3: Run the existing API contract tests**

Run:

```bash
cd apps/api
uv run pytest tests/test_api_contract.py -q
```

Expected: all tests in `test_api_contract.py` pass.

- [ ] **Step 4: Commit backend validation**

```bash
git add apps/api/lenjoy_bbs/modules/posts/router.py apps/api/tests/test_api_contract.py
git commit -m "feat: validate post search keyword length"
```

---

### Task 3: Search Query Hook

**Files:**
- Modify: `apps/web/components/post/client-helpers.ts`
- Modify: `apps/web/components/post/use-post-queries.ts`

- [ ] **Step 1: Add a search query key**

In `apps/web/components/post/client-helpers.ts`, add this entry inside `queryKeys` near the other post query keys:

```ts
  postSearch: (
    filters: { q: string; postType: string },
    page: number,
    pageSize: number,
  ) => ["posts", "search", filters, page, pageSize] as const,
```

- [ ] **Step 2: Add a search hook and URL builder**

In `apps/web/components/post/use-post-queries.ts`, extend `PostFeedFilters` or add a dedicated type:

```ts
export type PostSearchFilters = {
  q: string;
  postType?: "" | "NORMAL" | "RESOURCE" | "BOUNTY";
};
```

Add this builder after `buildFeedQuery`:

```ts
function buildSearchQuery(
  page: number,
  pageSize: number,
  filters: PostSearchFilters,
) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    keyword: filters.q,
  });
  if (filters.postType) {
    params.set("postType", filters.postType);
  }
  return `/api/posts?${params.toString()}`;
}
```

Add this hook after `usePostFeedQuery`:

```ts
export function useSearchPostsQuery(
  page: number,
  pageSize: number,
  filters: PostSearchFilters,
  initialData?: PaginatedResponse<PostSummary> | null,
) {
  const normalizedKeyword = filters.q.trim();

  return useQuery({
    queryKey: queryKeys.postSearch(
      {
        q: normalizedKeyword,
        postType: filters.postType || "",
      },
      page,
      pageSize,
    ),
    queryFn: () =>
      requestApiData<PaginatedResponse<PostSummary>>(
        buildSearchQuery(page, pageSize, {
          ...filters,
          q: normalizedKeyword,
        }),
        { cache: "no-store" },
      ),
    enabled: normalizedKeyword.length > 0,
    initialData: initialData || undefined,
  });
}
```

- [ ] **Step 3: Type-check the web app**

Run:

```bash
cd apps/web
npm run build
```

Expected: build fails only if later search page imports are not yet present. If it fails due to the hook itself, fix the hook before continuing.

- [ ] **Step 4: Commit the query hook**

```bash
git add apps/web/components/post/client-helpers.ts apps/web/components/post/use-post-queries.ts
git commit -m "feat: add post search query hook"
```

---

### Task 4: Search Results Page

**Files:**
- Create: `apps/web/components/post/search-page-client.tsx`
- Create: `apps/web/app/search/page.tsx`
- Reuse: `apps/web/components/post/post-list.module.css`

- [ ] **Step 1: Create the client component**

Create `apps/web/components/post/search-page-client.tsx` with this component. It reuses existing post list styles and pagination controls.

```tsx
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { readError } from "@/components/post/client-helpers";
import { PaginationControls } from "@/components/post/pagination-controls";
import { PostCardStats } from "@/components/post/post-card-stats";
import {
  useSearchPostsQuery,
  type PostSearchFilters,
} from "@/components/post/use-post-queries";
import type { PaginatedResponse, PostSummary } from "@/components/post/types";
import styles from "./post-list.module.css";

type SearchPageClientProps = {
  initialPosts?: PaginatedResponse<PostSummary> | null;
  initialKeyword: string;
  initialType: PostSearchFilters["postType"];
  initialPage: number;
};

const PAGE_SIZE = 20;

const typeTabs: Array<{
  value: PostSearchFilters["postType"];
  label: string;
}> = [
  { value: "", label: "全部" },
  { value: "NORMAL", label: "讨论" },
  { value: "RESOURCE", label: "资源" },
  { value: "BOUNTY", label: "悬赏" },
];

function getBadgeClass(type: string) {
  switch (type) {
    case "RESOURCE":
      return "badge badge-resource";
    case "BOUNTY":
      return "badge badge-bounty";
    default:
      return "badge badge-normal";
  }
}

function getTypeText(type: string) {
  switch (type) {
    case "RESOURCE":
      return "资源";
    case "BOUNTY":
      return "悬赏";
    default:
      return "讨论";
  }
}

export function SearchPageClient({
  initialPosts,
  initialKeyword,
  initialType,
  initialPage,
}: SearchPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorText, setErrorText] = useState("");

  const keyword = (searchParams.get("q") || initialKeyword).trim();
  const typeParam = searchParams.get("type") || initialType || "";
  const postType: PostSearchFilters["postType"] =
    typeParam === "NORMAL" || typeParam === "RESOURCE" || typeParam === "BOUNTY"
      ? typeParam
      : "";
  const pageParam = Number(searchParams.get("page") || initialPage || 1);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const postsQuery = useSearchPostsQuery(
    page,
    PAGE_SIZE,
    {
      q: keyword,
      postType,
    },
    page === initialPage && keyword === initialKeyword && postType === initialType
      ? initialPosts
      : undefined,
  );

  useEffect(() => {
    if (postsQuery.error) {
      setErrorText(readError(postsQuery.error));
    }
  }, [postsQuery.error]);

  const postsPage = postsQuery.data;
  const posts = postsPage?.items ?? [];
  const loading = postsQuery.isLoading || postsQuery.isFetching;

  const resultText = useMemo(() => {
    if (!keyword) {
      return "输入关键词后搜索帖子标题和公开正文";
    }
    return `搜索 "${keyword}"`;
  }, [keyword]);

  function replaceSearch(next: {
    q?: string;
    postType?: PostSearchFilters["postType"];
    page?: number;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    const nextKeyword = next.q !== undefined ? next.q.trim() : keyword;
    const nextType = next.postType !== undefined ? next.postType : postType;
    const nextPage = next.page ?? 1;

    if (nextKeyword) {
      params.set("q", nextKeyword);
    } else {
      params.delete("q");
    }

    if (nextType) {
      params.set("type", nextType);
    } else {
      params.delete("type");
    }

    if (nextPage > 1) {
      params.set("page", String(nextPage));
    } else {
      params.delete("page");
    }

    const query = params.toString();
    router.replace(query ? `/search?${query}` : "/search");
  }

  return (
    <main className="page">
      <section className={`${styles.filterPanel} mb-6`}>
        <h1 className={styles.title}>{resultText}</h1>
        <div className="flex flex-wrap gap-2 mt-4">
          {typeTabs.map((tab) => (
            <button
              key={tab.value || "all"}
              type="button"
              className={`tab ${postType === tab.value ? "active" : ""}`}
              onClick={() => replaceSearch({ postType: tab.value, page: 1 })}
              disabled={!keyword}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {keyword && postsPage ? (
          <p className="text-muted mt-3">共 {postsPage.total} 条结果</p>
        ) : null}
      </section>

      {errorText && <div className="banner banner-error mb-4">{errorText}</div>}

      {!keyword ? (
        <div className="empty">
          <div className="empty-icon">?</div>
          <p className="empty-title">输入关键词开始搜索</p>
          <p className="text-muted">搜索范围包括帖子标题和公开正文。</p>
        </div>
      ) : loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <span className="ml-3">加载中...</span>
        </div>
      ) : posts.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">-</div>
          <p className="empty-title">没有找到相关帖子</p>
          <p className="text-muted">可以换个关键词，或切换到全部类型再试。</p>
          {postType ? (
            <button
              type="button"
              className="tab mt-3"
              onClick={() => replaceSearch({ postType: "", page: 1 })}
            >
              查看全部类型
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="grid gap-3">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/posts/${post.id}`}
                className={styles.item}
              >
                <div className={styles.header}>
                  <span className={getBadgeClass(post.postType)}>
                    {getTypeText(post.postType)}
                  </span>
                  <span className="badge badge-info">{post.status}</span>
                  {post.categoryName ? (
                    <span className="badge badge-warning">{post.categoryName}</span>
                  ) : null}
                  <span className={styles.meta}>
                    by {post.authorUsername || post.authorId}
                  </span>
                </div>
                <h3 className={styles.title}>{post.title}</h3>
                {post.tags?.length ? (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {post.tags.slice(0, 4).map((tag) => (
                      <span key={tag.id} className="badge badge-info">
                        #{tag.name}
                      </span>
                    ))}
                  </div>
                ) : null}
                <PostCardStats
                  viewCount={post.viewCount}
                  commentCount={post.commentCount}
                  likeCount={post.likeCount}
                  createdAt={post.createdAt}
                />
              </Link>
            ))}
          </div>
          {postsPage && (
            <PaginationControls
              page={postsPage.page}
              totalPages={postsPage.totalPages}
              total={postsPage.total}
              pageSize={postsPage.pageSize}
              hasNext={postsPage.hasNext}
              hasPrevious={postsPage.hasPrevious}
              disabled={postsQuery.isFetching}
              onPageChange={(nextPage) => replaceSearch({ page: nextPage })}
            />
          )}
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Create the server page**

Create `apps/web/app/search/page.tsx`:

```tsx
import { SearchPageClient } from "@/components/post/search-page-client";
import { serverFetchApiData } from "@/lib/server-api";
import type { PaginatedResponse, PostSummary } from "@/components/post/types";
import type { PostSearchFilters } from "@/components/post/use-post-queries";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readQueryValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function readPostType(
  value: string | undefined,
): PostSearchFilters["postType"] {
  if (value === "NORMAL" || value === "RESOURCE" || value === "BOUNTY") {
    return value;
  }
  return "";
}

export default async function SearchPage({ searchParams }: Props) {
  const resolved = (await searchParams) || {};
  const keyword = (readQueryValue(resolved.q) || "").trim();
  const postType = readPostType(readQueryValue(resolved.type));
  const rawPage = Number(readQueryValue(resolved.page) || 1);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  let initialPosts: PaginatedResponse<PostSummary> | null = null;

  if (keyword) {
    try {
      const params = new URLSearchParams({
        keyword,
        page: String(page),
        pageSize: "20",
      });
      if (postType) {
        params.set("postType", postType);
      }
      initialPosts = await serverFetchApiData<PaginatedResponse<PostSummary>>(
        `/api/v1/posts?${params.toString()}`,
      );
    } catch (error) {
      console.error("Search SSR error:", error);
    }
  }

  return (
    <SearchPageClient
      initialPosts={initialPosts}
      initialKeyword={keyword}
      initialType={postType}
      initialPage={page}
    />
  );
}
```

- [ ] **Step 3: Build the web app**

Run:

```bash
cd apps/web
npm run build
```

Expected: the build passes. If TypeScript reports an issue with `PostSearchFilters["postType"]`, export the type from `use-post-queries.ts` exactly as shown in Task 3.

- [ ] **Step 4: Commit the search page**

```bash
git add apps/web/components/post/search-page-client.tsx apps/web/app/search/page.tsx apps/web/components/post/client-helpers.ts apps/web/components/post/use-post-queries.ts
git commit -m "feat: add post search results page"
```

---

### Task 5: Global Navigation Search

**Files:**
- Modify: `apps/web/components/layout/navigation.tsx`
- Modify: `apps/web/components/layout/navigation.module.css`

- [ ] **Step 1: Add navigation search state and submit handling**

In `apps/web/components/layout/navigation.tsx`, update imports:

```tsx
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
```

Inside `Navigation`, after `const pathname = usePathname();`, add:

```tsx
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchKeyword, setSearchKeyword] = useState("");
```

After the `isHome`, `isDiscussion`, `isResource`, and `isBounty` constants, and before the admin-page early return, add:

```tsx
  useEffect(() => {
    if (pathname === "/search") {
      setSearchKeyword(searchParams.get("q") || "");
    }
  }, [pathname, searchParams]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const keyword = searchKeyword.trim();
    if (!keyword) {
      return;
    }
    const params = new URLSearchParams({ q: keyword });
    router.push(`/search?${params.toString()}`);
  }
```

Add this form between the links block and the actions block:

```tsx
        <form className={styles.search} onSubmit={handleSearchSubmit}>
          <input
            className={styles.searchInput}
            value={searchKeyword}
            onChange={(event) => setSearchKeyword(event.target.value)}
            placeholder="搜索帖子"
            aria-label="搜索帖子"
            maxLength={100}
          />
          <button className={styles.searchButton} type="submit" aria-label="搜索">
            <svg
              className="icon-sm"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </button>
        </form>
```

- [ ] **Step 2: Style the search form**

In `apps/web/components/layout/navigation.module.css`, add:

```css
.search {
  display: flex;
  align-items: center;
  min-width: min(360px, 28vw);
  height: 42px;
  padding: 0 6px 0 14px;
  border: 1px solid rgba(32, 36, 45, 0.1);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.56);
}

.searchInput {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #20242d;
  font-size: 0.9rem;
}

.searchInput::placeholder {
  color: #8a909b;
}

.searchButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  background: #20242d;
  color: #ffffff;
  cursor: pointer;
}
```

Inside the existing `@media (max-width: 820px)` block, add:

```css
  .search {
    order: 4;
    width: 100%;
    min-width: 0;
  }
```

Inside the existing `@media (max-width: 520px)` block, add:

```css
  .search {
    height: 40px;
  }
```

- [ ] **Step 3: Build the web app**

Run:

```bash
cd apps/web
npm run build
```

Expected: build passes.

- [ ] **Step 4: Commit navigation search**

```bash
git add apps/web/components/layout/navigation.tsx apps/web/components/layout/navigation.module.css
git commit -m "feat: add global navigation search"
```

---

### Task 6: Frontend E2E Smoke Coverage

**Files:**
- Modify: `apps/web/test/smoke.e2e.spec.ts`

- [ ] **Step 1: Add a smoke test for search URL behavior**

Append this test inside the existing `test.describe("PRD smoke", ...)` block in `apps/web/test/smoke.e2e.spec.ts`:

```ts
  test("global search routes to search results with keyword state", async ({
    page,
    baseURL,
  }) => {
    test.skip(!baseURL, "baseURL is required");

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByLabel("搜索帖子").fill("redis");
    await page.getByLabel("搜索").click();

    await page.waitForURL(/\/search\?q=redis/);
    await expect(page.getByLabel("搜索帖子")).toHaveValue("redis");
    await expect(page.locator("main")).toBeVisible();
  });
```

- [ ] **Step 2: Run the web build**

Run:

```bash
cd apps/web
npm run build
```

Expected: build passes.

- [ ] **Step 3: Run the smoke E2E test when the app stack is available**

Run:

```bash
cd apps/web
npm run test:e2e -- test/smoke.e2e.spec.ts
```

Expected: the smoke suite passes against a running app. If no local app stack is running, record that the E2E test was not run and run the build instead.

- [ ] **Step 4: Commit E2E coverage**

```bash
git add apps/web/test/smoke.e2e.spec.ts
git commit -m "test: cover global post search smoke flow"
```

---

### Task 7: Final Verification

**Files:**
- Verify: all modified files

- [ ] **Step 1: Run backend verification**

Run:

```bash
cd apps/api
uv run pytest tests/test_api_contract.py -q
```

Expected: all API contract tests pass.

- [ ] **Step 2: Run frontend verification**

Run:

```bash
cd apps/web
npm run build
```

Expected: Next.js build passes.

- [ ] **Step 3: Check git status**

Run:

```bash
git status --short
```

Expected: no unstaged implementation changes remain. Untracked runtime artifacts, if any, should be reviewed and ignored or removed only if they were created by this work.

- [ ] **Step 4: Final commit if any verification-only fixes were needed**

If verification required small fixes, commit them:

```bash
git add apps/api/lenjoy_bbs/modules/posts/router.py apps/api/tests/test_api_contract.py apps/web/components/post/client-helpers.ts apps/web/components/post/use-post-queries.ts apps/web/components/post/search-page-client.tsx apps/web/app/search/page.tsx apps/web/components/layout/navigation.tsx apps/web/components/layout/navigation.module.css apps/web/test/smoke.e2e.spec.ts
git commit -m "fix: stabilize global post search"
```
