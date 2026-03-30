"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { readError } from "@/components/post/client-helpers";
import { PaginationControls } from "@/components/post/pagination-controls";
import { usePostsQuery } from "@/components/post/use-post-queries";
import { useAuth } from "@/components/providers/auth-provider";
import type { PaginatedResponse, PostSummary } from "@/components/post/types";

const PAGE_SIZE = 20;

type PostHomeClientProps = {
  initialPosts?: PaginatedResponse<PostSummary> | null;
};

export function PostHomeClient({ initialPosts }: PostHomeClientProps = {}) {
  const [errorText, setErrorText] = useState("");
  const [page, setPage] = useState(1);
  const { authData: auth, hasAuth } = useAuth();
  const isAdmin = auth?.user.roles?.some(
    (role) => role === "ADMIN" || role === "ROLE_ADMIN",
  );

  const postsQuery = usePostsQuery(
    page,
    PAGE_SIZE,
    page === 1 ? initialPosts : undefined,
  );

  const postsPage = postsQuery.data;
  const posts = postsPage?.items ?? [];
  const loading = postsQuery.isLoading;

  useEffect(() => {
    if (postsQuery.error) {
      setErrorText(readError(postsQuery.error));
    }
  }, [postsQuery.error]);

  const getBadgeClass = (type: string) => {
    switch (type) {
      case "RESOURCE":
        return "badge badge-resource";
      case "BOUNTY":
        return "badge badge-bounty";
      default:
        return "badge badge-normal";
    }
  };

  const getTypeText = (type: string) => {
    switch (type) {
      case "RESOURCE":
        return "资源";
      case "BOUNTY":
        return "悬赏";
      default:
        return "普通";
    }
  };

  return (
    <main className="page">
      <section className="card-hero mb-6">
        <div className="hero-content">
          <h1 className="hero-title">欢迎来到 Lenjoy 社区</h1>
          <p className="hero-subtitle">
            发现精彩内容，分享知识见解。这里有讨论区、资源帖和悬赏问答。
          </p>
          <div className="flex gap-3 mt-6">
            <Link
              href={hasAuth ? "/posts/new" : "/auth"}
              className="btn btn-cta"
              style={{ background: "white", color: "#7C3AED" }}
            >
              发布帖子
            </Link>
            <Link
              href={hasAuth ? "/my" : "/auth"}
              className="btn"
              style={{
                background: "rgba(255,255,255,0.2)",
                color: "white",
                border: "1px solid rgba(255,255,255,0.3)",
              }}
            >
              {hasAuth ? "个人中心" : "登录 / 注册"}
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="flex-between">
          <div className="flex gap-2">
            {isAdmin && (
              <Link href="/admin" className="btn btn-ghost btn-sm">
                管理后台
              </Link>
            )}
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => void postsQuery.refetch()}
          >
            刷新
          </button>
        </div>
      </section>

      {errorText && <div className="banner banner-error mb-4">{errorText}</div>}

      <section className="section">
        <div className="section-header">
          <h2 className="section-title">最新帖子</h2>
          <span className="text-muted text-sm">
            {postsPage?.total ?? posts.length} 条帖子
          </span>
        </div>

        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
            <span className="ml-3">加载中...</span>
          </div>
        ) : posts.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">-</div>
            <p className="empty-title">暂无帖子</p>
            <p className="text-muted">成为第一个发布帖子的人吧</p>
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
      </section>
    </main>
  );
}
