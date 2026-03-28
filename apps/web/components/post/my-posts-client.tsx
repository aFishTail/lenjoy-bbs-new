"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  authHeaders,
  readApi,
  readError,
} from "@/components/post/client-helpers";
import type { PostSummary } from "@/components/post/types";

export function MyPostsClient() {
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [errorText, setErrorText] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function run() {
      try {
        const response = await fetch("/api/posts/mine", {
          headers: authHeaders(),
          cache: "no-store",
        });
        const payload = await readApi<PostSummary[]>(response);
        setPosts(payload.data);
      } catch (error) {
        setErrorText(readError(error));
      } finally {
        setLoading(false);
      }
    }
    void run();
  }, []);

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

  return (
    <main className="page">
      {/* Back Link */}
      <div className="mb-4">
        <Link href="/" className="nav-link">
          <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: "inline", marginRight: "4px" }}>
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          返回首页
        </Link>
      </div>

      {/* Hero */}
      <section className="card-hero mb-6">
        <div className="hero-content">
          <h1 className="hero-title">我的帖子</h1>
          <p className="hero-subtitle">
            查看和管理你发布的所有内容
          </p>
        </div>
      </section>

      {/* Error */}
      {errorText && (
        <div className="banner banner-error mb-4">
          <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          {errorText}
        </div>
      )}

      {/* Posts List */}
      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <span className="ml-3">加载中...</span>
        </div>
      ) : posts.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <p className="empty-title">暂无帖子</p>
          <p className="text-muted">你还没有发布任何帖子</p>
          <Link href="/" className="btn btn-primary mt-4">
            去发帖
          </Link>
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
                  {post.postType === "NORMAL" && "普通"}
                  {post.postType === "RESOURCE" && "资源"}
                  {post.postType === "BOUNTY" && "悬赏"}
                </span>
                <span className="badge badge-info">{post.status}</span>
              </div>
              <h3 className="post-item-title">{post.title}</h3>
              <div className="post-item-stats">
                <span className="post-item-stat">
                  <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  {post.viewCount || 0}
                </span>
                <span className="post-item-stat">
                  <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  {post.commentCount || 0}
                </span>
                <span className="post-item-stat">
                  <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
