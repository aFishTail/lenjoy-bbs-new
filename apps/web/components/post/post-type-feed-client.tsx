"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { readError } from "@/components/post/client-helpers";
import { PaginationControls } from "@/components/post/pagination-controls";
import { usePostFeedQuery } from "@/components/post/use-post-queries";
import type { PaginatedResponse, PostSummary } from "@/components/post/types";

type PostType = "NORMAL" | "RESOURCE" | "BOUNTY";

type PostTypeFeedClientProps = {
  postType: PostType;
  title: string;
  subtitle: string;
  initialPosts?: PaginatedResponse<PostSummary> | null;
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
      return "普通";
  }
}

export function PostTypeFeedClient({
  postType,
  title,
  subtitle,
  initialPosts,
}: PostTypeFeedClientProps) {
  const [errorText, setErrorText] = useState("");
  const [page, setPage] = useState(1);
  const postsQuery = usePostFeedQuery(
    postType,
    page,
    PAGE_SIZE,
    page === 1 ? initialPosts : undefined,
  );

  useEffect(() => {
    if (postsQuery.error) {
      setErrorText(readError(postsQuery.error));
    }
  }, [postsQuery.error]);

  const postsPage = postsQuery.data;
  const posts = postsPage?.items ?? [];
  const loading = postsQuery.isLoading;

  const navItems = useMemo(
    () => [navByType.NORMAL, navByType.RESOURCE, navByType.BOUNTY],
    [],
  );

  return (
    <main className="page">
      <section className="card-hero mb-6">
        <div className="hero-content">
          <h1 className="hero-title">{title}</h1>
          <p className="hero-subtitle">{subtitle}</p>
          <div className="flex gap-2 mt-6" role="tablist" aria-label="帖子分类">
            {navItems.map((item) => {
              const isActive = item.href === navByType[postType].href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`tab ${isActive ? "active" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
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
          <p className="text-muted">当前分类还没有可展示的帖子</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/posts/${post.id}`}
                className="post-item"
              >
                <div className="post-item-header">
                  <span className={getBadgeClass(post.postType)}>
                    {getTypeText(post.postType)}
                  </span>
                  <span className="badge badge-info">{post.status}</span>
                  <span className="post-item-meta">
                    by {post.authorUsername || post.authorId}
                  </span>
                </div>
                <h3 className="post-item-title">{post.title}</h3>
                <div className="post-item-stats">
                  <span className="post-item-stat">{post.viewCount || 0}</span>
                  <span className="post-item-stat">{post.commentCount || 0}</span>
                  <span className="post-item-stat">{post.likeCount || 0}</span>
                </div>
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
