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
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

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
    setErrorText("");
  }, [keyword, postType, page]);

  useEffect(() => {
    if (postsQuery.error) {
      setErrorText(readError(postsQuery.error));
    } else if (postsQuery.isSuccess) {
      setErrorText("");
    }
  }, [postsQuery.error, postsQuery.isSuccess]);

  const postsPage = postsQuery.data;
  const posts = postsPage?.items ?? [];
  const loading = postsQuery.isLoading;

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
              aria-pressed={postType === tab.value}
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
        <div className="loading" role="status">
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
