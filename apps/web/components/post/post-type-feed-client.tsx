"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { readError } from "@/components/post/client-helpers";
import { usePostFeedQuery } from "@/components/post/use-post-queries";
import type { PostSummary } from "@/components/post/types";

type PostType = "NORMAL" | "RESOURCE" | "BOUNTY";

type PostTypeFeedClientProps = {
  postType: PostType;
  title: string;
  subtitle: string;
  initialPosts?: PostSummary[] | null;
};

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
  const postsQuery = usePostFeedQuery(postType, initialPosts);

  useEffect(() => {
    if (postsQuery.error) {
      setErrorText(readError(postsQuery.error));
    }
  }, [postsQuery.error]);

  const posts = postsQuery.data ?? [];
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

      {errorText && (
        <div className="banner banner-error mb-4">
          <svg
            className="icon-sm"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          {errorText}
        </div>
      )}

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <span className="ml-3">加载中...</span>
        </div>
      ) : posts.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <p className="empty-title">暂无{title}</p>
          <p className="text-muted">当前分类还没有可展示的帖子</p>
        </div>
      ) : (
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
                <span className="post-item-stat">
                  <svg
                    className="icon-sm"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  {post.viewCount || 0}
                </span>
                <span className="post-item-stat">
                  <svg
                    className="icon-sm"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  {post.commentCount || 0}
                </span>
                <span className="post-item-stat">
                  <svg
                    className="icon-sm"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                  </svg>
                  {post.likeCount || 0}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
