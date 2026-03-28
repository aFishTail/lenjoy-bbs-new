"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  authHeaders,
  readApi,
  readError,
} from "@/components/post/client-helpers";
import type { PostSummary } from "@/components/post/types";

export function AdminPostsClient() {
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [reasonById, setReasonById] = useState<Record<number, string>>({});
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const response = await fetch("/api/admin/posts", {
        headers: authHeaders(),
        cache: "no-store",
      });
      const payload = await readApi<PostSummary[]>(response);
      setPosts(payload.data);
      setErrorText("");
    } catch (error) {
      setErrorText(readError(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function offlinePost(postId: number) {
    setErrorText("");
    setSuccessText("");
    try {
      const response = await fetch(`/api/admin/posts/${postId}/offline`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ reason: reasonById[postId] || "违规内容" }),
      });
      await readApi(response);
      setSuccessText(`帖子 ${postId} 已下架`);
      await load();
    } catch (error) {
      setErrorText(readError(error));
    }
  }

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
          <h1 className="hero-title">帖子管理</h1>
          <p className="hero-subtitle">
            可执行下架操作，请填写可追溯的处理原因
          </p>
        </div>
      </section>

      {/* Messages */}
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
      {successText && (
        <div className="banner banner-success mb-4">
          <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          {successText}
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
            </svg>
          </div>
          <p className="empty-title">暂无帖子</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {posts.map((post) => (
            <div key={post.id} className="card">
              <div className="flex gap-2 mb-2">
                <span className={getBadgeClass(post.postType)}>
                  {post.postType === "NORMAL" && "普通"}
                  {post.postType === "RESOURCE" && "资源"}
                  {post.postType === "BOUNTY" && "悬赏"}
                </span>
                <span className="badge badge-info">{post.status}</span>
                <span className="text-muted text-sm">
                  作者: {post.authorUsername || post.authorId}
                </span>
              </div>
              <Link href={`/posts/${post.id}`} className="post-item-title block mb-3">
                {post.title}
              </Link>
              <div className="flex gap-3 items-center">
                <input
                  className="form-input"
                  style={{ flex: "1 1 200px" }}
                  placeholder="下架原因"
                  value={reasonById[post.id] || ""}
                  onChange={(e) =>
                    setReasonById((prev) => ({
                      ...prev,
                      [post.id]: e.target.value,
                    }))
                  }
                />
                <button
                  className="btn btn-danger"
                  onClick={() => void offlinePost(post.id)}
                  type="button"
                >
                  <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                  </svg>
                  下架
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
