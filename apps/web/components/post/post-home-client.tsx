"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { getStoredAuth, readError } from "@/components/post/client-helpers";
import { usePostsQuery } from "@/components/post/use-post-queries";
import { useCreatePostMutation } from "@/components/post/use-post-mutations";

type PostType = "NORMAL" | "RESOURCE" | "BOUNTY";

const typeOptions: { value: PostType; label: string; color: string }[] = [
  { value: "NORMAL", label: "普通帖", color: "badge-normal" },
  { value: "RESOURCE", label: "资源帖", color: "badge-resource" },
  { value: "BOUNTY", label: "悬赏帖", color: "badge-bounty" },
];

export function PostHomeClient() {
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");
  const [auth, setAuth] = useState<ReturnType<typeof getStoredAuth>>(null);
  const [authReady, setAuthReady] = useState(false);

  const [postType, setPostType] = useState<PostType>("NORMAL");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [hiddenContent, setHiddenContent] = useState("");
  const [price, setPrice] = useState("");
  const [bountyAmount, setBountyAmount] = useState("");
  const [bountyExpireAt, setBountyExpireAt] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const postsQuery = usePostsQuery();
  const createPostMutation = useCreatePostMutation();

  const posts = postsQuery.data ?? [];
  const loading = postsQuery.isLoading;

  useEffect(() => {
    setAuth(getStoredAuth());
    setAuthReady(true);
  }, []);

  useEffect(() => {
    if (postsQuery.error) {
      setErrorText(readError(postsQuery.error));
    }
  }, [postsQuery.error]);

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorText("");
    setSuccessText("");

    try {
      await createPostMutation.mutateAsync({
        postType,
        title: title.trim(),
        content,
        hiddenContent: hiddenContent.trim() ? hiddenContent : undefined,
        price: price ? Number(price) : undefined,
        bountyAmount: bountyAmount ? Number(bountyAmount) : undefined,
        bountyExpireAt: bountyExpireAt || undefined,
      });
      setSuccessText("发布成功！");
      setTitle("");
      setContent("");
      setHiddenContent("");
      setPrice("");
      setBountyAmount("");
      setBountyExpireAt("");
      setShowCreateForm(false);
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
      {/* Hero Section */}
      <section className="card-hero mb-6">
        <div className="hero-content">
          <h1 className="hero-title">欢迎来到 Lenjoy 社区</h1>
          <p className="hero-subtitle">
            发现精彩内容，分享知识见解。这里有讨论区、资源贴和悬赏问答，满足你的所有需求。
          </p>
          <div className="flex gap-3 mt-6">
            <button
              className="btn btn-cta"
              onClick={() => setShowCreateForm(true)}
              style={{ background: "white", color: "#7C3AED" }}
            >
              <svg
                className="icon-sm"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              发布帖子
            </button>
            <Link
              href="/auth"
              className="btn"
              style={{
                background: "rgba(255,255,255,0.2)",
                color: "white",
                border: "1px solid rgba(255,255,255,0.3)",
              }}
            >
              登录 / 注册
            </Link>
          </div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="section">
        <div className="flex-between">
          <div className="flex gap-2">
            <Link href="/my/posts" className="btn btn-ghost btn-sm">
              <svg
                className="icon-sm"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              我的帖子
            </Link>
            <Link href="/admin" className="btn btn-ghost btn-sm">
              <svg
                className="icon-sm"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              管理后台
            </Link>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => void postsQuery.refetch()}
          >
            <svg
              className="icon-sm"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            刷新
          </button>
        </div>
      </section>

      {/* Create Post Form */}
      {showCreateForm && (
        <section className="card mb-6">
          <div className="flex-between mb-4">
            <h2 className="section-title">发布新帖子</h2>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowCreateForm(false)}
            >
              <svg
                className="icon-sm"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
              收起
            </button>
          </div>

          {authReady && !auth && (
            <div className="banner banner-warning mb-4">
              <svg
                className="icon-sm"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              请先登录后才能发布帖子
            </div>
          )}

          <form onSubmit={submitCreate}>
            <div className="grid gap-4">
              {/* Post Type */}
              <div className="form-group">
                <label className="form-label">帖子类型</label>
                <div className="tabs">
                  {typeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`tab ${postType === option.value ? "active" : ""}`}
                      onClick={() => setPostType(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div className="form-group">
                <label className="form-label">标题</label>
                <input
                  className="form-input"
                  placeholder="请输入标题"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              {/* Content based on type */}
              {(postType === "NORMAL" || postType === "BOUNTY") && (
                <div className="form-group">
                  <label className="form-label">正文内容</label>
                  <textarea
                    className="form-textarea"
                    placeholder="请输入正文内容"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>
              )}

              {postType === "RESOURCE" && (
                <>
                  <div className="form-group">
                    <label className="form-label">公开内容</label>
                    <textarea
                      className="form-textarea"
                      placeholder="请输入资源简介、使用说明等公开内容"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">隐藏内容</label>
                    <textarea
                      className="form-textarea"
                      placeholder="下载链接、提取码等（购买后可见）"
                      value={hiddenContent}
                      onChange={(e) => setHiddenContent(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">售价（金币）</label>
                    <input
                      className="form-input"
                      type="number"
                      placeholder="请输入售价"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                  </div>
                </>
              )}

              {postType === "BOUNTY" && (
                <>
                  <div className="form-group">
                    <label className="form-label">悬赏金额（金币）</label>
                    <input
                      className="form-input"
                      type="number"
                      placeholder="请输入悬赏金额"
                      value={bountyAmount}
                      onChange={(e) => setBountyAmount(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">截止时间</label>
                    <input
                      className="form-input"
                      type="datetime-local"
                      value={bountyExpireAt}
                      onChange={(e) => setBountyExpireAt(e.target.value)}
                    />
                  </div>
                </>
              )}

              {/* Submit Button */}
              <div className="flex gap-3">
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={!auth || createPostMutation.isPending}
                >
                  <svg
                    className="icon-sm"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                  {createPostMutation.isPending ? "提交中..." : "提交发布"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowCreateForm(false)}
                >
                  取消
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

      {/* Messages */}
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
      {successText && (
        <div className="banner banner-success mb-4">
          <svg
            className="icon-sm"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          {successText}
        </div>
      )}

      {/* Posts List */}
      <section className="section">
        <div className="section-header">
          <h2 className="section-title">最新帖子</h2>
          <span className="text-muted text-sm">{posts.length} 条帖子</span>
        </div>

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
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="empty-title">暂无帖子</p>
            <p className="text-muted">成为第一个发布帖子的人吧！</p>
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
      </section>
    </main>
  );
}
