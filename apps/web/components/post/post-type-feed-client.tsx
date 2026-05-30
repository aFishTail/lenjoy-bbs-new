"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { readError } from "@/components/post/client-helpers";
import { PaginationControls } from "@/components/post/pagination-controls";
import { PostCardStats } from "@/components/post/post-card-stats";
import { usePostFeedQuery } from "@/components/post/use-post-queries";
import type {
  CategorySummary,
  PaginatedResponse,
  PostSummary,
  TagSummary,
} from "@/components/post/types";
import styles from "./post-list.module.css";
import {
  useCategoriesQuery,
  useHotTagsQuery,
} from "@/components/post/use-taxonomy-queries";

type PostType = "NORMAL" | "RESOURCE" | "BOUNTY";

type PostTypeFeedClientProps = {
  postType: PostType;
  title: string;
  initialPosts?: PaginatedResponse<PostSummary> | null;
  initialCategories?: CategorySummary[] | null;
  initialHotTags?: TagSummary[] | null;
};

const PAGE_SIZE = 20;

const navByType: Record<PostType, { href: string; label: string }> = {
  NORMAL: { href: "/discussions", label: "讨论" },
  RESOURCE: { href: "/resources", label: "资源" },
  BOUNTY: { href: "/bounties", label: "悬赏" },
};

function getBadgeClass(type: PostType) {
  switch (type) {
    case "RESOURCE":
      return "badge badge-resource";
    case "BOUNTY":
      return "badge badge-bounty";
    default:
      return "badge badge-normal";
  }
}

function getTypeText(type: PostType) {
  switch (type) {
    case "RESOURCE":
      return "资源";
    case "BOUNTY":
      return "悬赏";
    default:
      return "讨论";
  }
}

export function PostTypeFeedClient({
  postType,
  title,
  initialPosts,
  initialCategories,
  initialHotTags,
}: PostTypeFeedClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorText, setErrorText] = useState("");
  const [page, setPage] = useState(1);

  const categoryId = searchParams.get("categoryId") || "";
  const tagId = searchParams.get("tagId") || "";
  const keyword = searchParams.get("keyword") || "";

  const categoriesQuery = useCategoriesQuery(postType, initialCategories);
  const hotTagsQuery = useHotTagsQuery(postType, initialHotTags);
  const postsQuery = usePostFeedQuery(
    postType,
    page,
    PAGE_SIZE,
    {
      categoryId,
      tagId,
      keyword,
    },
    page === 1 ? initialPosts : undefined,
  );

  useEffect(() => {
    if (postsQuery.error) {
      setErrorText(readError(postsQuery.error));
    }
  }, [postsQuery.error]);

  useEffect(() => {
    setPage(1);
  }, [categoryId, tagId, keyword]);

  const postsPage = postsQuery.data;
  const posts = postsPage?.items ?? [];
  const loading = postsQuery.isLoading;

  function updateFilters(next: {
    categoryId?: string;
    tagId?: string;
    keyword?: string;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.categoryId !== undefined) {
      if (next.categoryId) {
        params.set("categoryId", next.categoryId);
      } else {
        params.delete("categoryId");
      }
    }
    if (next.tagId !== undefined) {
      if (next.tagId) {
        params.set("tagId", next.tagId);
      } else {
        params.delete("tagId");
      }
    }
    if (next.keyword !== undefined) {
      if (next.keyword) {
        params.set("keyword", next.keyword);
      } else {
        params.delete("keyword");
      }
    }
    const query = params.toString();
    router.replace(
      query ? `${navByType[postType].href}?${query}` : navByType[postType].href,
    );
  }

  return (
    <main className="page">
      <section className={`${styles.filterPanel} mb-6`}>
        <div className="flex flex-col gap-4 w-full overflow-hidden">
          <div>
            <label className="block text-sm mb-2">分类</label>
            <div className={styles.scrollContainer}>
              <div className={styles.scrollRow}>
                <button
                  type="button"
                  className={`${styles.filterChip} ${!categoryId ? styles.filterChipActive : ""}`}
                  onClick={() => updateFilters({ categoryId: "" })}
                >
                  全部
                </button>
                {(categoriesQuery.data ?? []).map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    className={`${styles.filterChip} ${categoryId === String(category.id) ? styles.filterChipActive : ""}`}
                    onClick={() => updateFilters({ categoryId: String(category.id) })}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm mb-2">热门标签</label>
            <div className={styles.scrollContainer}>
              <div className={styles.scrollRow}>
                <button
                  type="button"
                  className={`${styles.filterChip} ${!tagId ? styles.filterChipActive : ""}`}
                  onClick={() => updateFilters({ tagId: "" })}
                >
                  全部
                </button>
                {(hotTagsQuery.data ?? []).map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className={`${styles.filterChip} ${tagId === String(tag.id) ? styles.filterChipActive : ""}`}
                    onClick={() => updateFilters({ tagId: String(tag.id) })}
                  >
                    #{tag.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {errorText && <div className="banner banner-error mb-4">{errorText}</div>}

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <span className="ml-3">加载中...</span>
        </div>
      ) : posts.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">-</div>
          <p className="empty-title">暂无{title}</p>
          <p className="text-muted">当前筛选条件下还没有可展示的帖子</p>
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
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </main>
  );
}
