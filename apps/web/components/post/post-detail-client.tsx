"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import {
  authHeaders,
  getStoredAuth,
  readApi,
  readError,
} from "@/components/post/client-helpers";
import { RichTextContent } from "@/components/editor/rich-text-content";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import type { PostDetail } from "@/components/post/types";

type Props = {
  postId: string;
};

export function PostDetailClient({ postId }: Props) {
  const [post, setPost] = useState<PostDetail | null>(null);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [hiddenContent, setHiddenContent] = useState("");
  const [price, setPrice] = useState("");
  const [bountyAmount, setBountyAmount] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const [auth, setAuth] = useState<ReturnType<typeof getStoredAuth>>(null);
  const isAuthor = !!auth && !!post && auth.user.id === post.authorId;

  async function loadDetail() {
    setLoading(true);
    try {
      const response = await fetch(`/api/posts/${postId}`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      const payload = await readApi<PostDetail>(response);
      setPost(payload.data);
      setTitle(payload.data.title || "");
      setContent(payload.data.content || "");
      setHiddenContent(payload.data.hiddenContent || "");
      setPrice(payload.data.price ? String(payload.data.price) : "");
      setBountyAmount(
        payload.data.bountyAmount ? String(payload.data.bountyAmount) : "",
      );
      setErrorText("");
    } catch (error) {
      setErrorText(readError(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setAuth(getStoredAuth());
    void loadDetail();
  }, [postId]);

  async function submitUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorText("");
    setSuccessText("");
    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          title,
          content,
          hiddenContent,
          price: price ? Number(price) : null,
          bountyAmount: bountyAmount ? Number(bountyAmount) : null,
        }),
      });
      await readApi(response);
      setSuccessText("更新成功");
      setIsEditing(false);
      await loadDetail();
    } catch (error) {
      setErrorText(readError(error));
    }
  }

  async function closePost() {
    setErrorText("");
    setSuccessText("");
    try {
      const response = await fetch(`/api/posts/${postId}/close`, {
        method: "POST",
        headers: authHeaders(),
      });
      await readApi(response);
      setSuccessText("帖子已关闭");
      await loadDetail();
    } catch (error) {
      setErrorText(readError(error));
    }
  }

  async function deletePost() {
    setErrorText("");
    setSuccessText("");
    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      await readApi(response);
      setSuccessText("帖子已删除");
      await loadDetail();
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

  if (loading) {
    return (
      <main className="page">
        <div className="loading">
          <div className="spinner"></div>
          <span className="ml-3">加载中...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      {/* Back Link */}
      <div className="mb-4">
        <Link href="/" className="nav-link">
          <svg
            className="icon-sm"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ display: "inline", marginRight: "4px" }}
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          返回帖子列表
        </Link>
      </div>

      {post && (
        <>
          {/* Post Header */}
          <section className="card mb-4">
            <div className="flex gap-2 mb-3">
              <span className={getBadgeClass(post.postType)}>
                {post.postType === "NORMAL" && "普通"}
                {post.postType === "RESOURCE" && "资源"}
                {post.postType === "BOUNTY" && "悬赏"}
              </span>
              <span className="badge badge-info">{post.status}</span>
              {post.price && (
                <span className="badge badge-warning">
                  <svg
                    className="icon-sm"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{ marginRight: "4px" }}
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v12M6 12h12" />
                  </svg>
                  {post.price} 金币
                </span>
              )}
              {post.bountyAmount && (
                <span className="badge badge-warning">
                  <svg
                    className="icon-sm"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{ marginRight: "4px" }}
                  >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  {post.bountyAmount} 金币
                </span>
              )}
            </div>

            <h1
              className="text-2xl font-bold mb-2"
              style={{ fontFamily: "'Newsreader', serif" }}
            >
              {post.title}
            </h1>

            <div className="flex items-center gap-3 text-muted text-sm mb-4">
              <div className="avatar avatar-sm">
                {post.authorUsername?.charAt(0).toUpperCase() || "U"}
              </div>
              <span>{post.authorUsername || post.authorId}</span>
              <span>·</span>
              <span>{new Date(post.createdAt).toLocaleString("zh-CN")}</span>
            </div>

            {/* Post Content */}
            <div className="post-content">
              {post.content && (
                <div className="mb-4">
                  <RichTextContent html={post.content} className="leading-7" />
                </div>
              )}

              {post.hiddenContent && (
                <div
                  className="mb-4 p-4 rounded-xl"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(251, 191, 36, 0.1))",
                    border: "1px solid rgba(245, 158, 11, 0.3)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <svg
                      className="icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span
                      className="font-semibold"
                      style={{ color: "#F59E0B" }}
                    >
                      隐藏内容
                    </span>
                    <span className="badge badge-warning">购买可见</span>
                  </div>
                  <RichTextContent html={post.hiddenContent} />
                </div>
              )}

              {post.offlineReason && (
                <div className="banner banner-warning">
                  <svg
                    className="icon-sm"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  下架原因：{post.offlineReason}
                </div>
              )}
            </div>

            {/* Stats */}
            <div
              className="flex gap-4 pt-4 border-t"
              style={{ borderColor: "var(--border-light)" }}
            >
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
                {post.viewCount || 0} 浏览
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
                {post.likeCount || 0} 点赞
              </span>
              <span className="post-item-stat">
                <svg
                  className="icon-sm"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
                {post.collectCount || 0} 收藏
              </span>
            </div>
          </section>

          {/* Author Actions */}
          {isAuthor && (
            <section className="card">
              <div className="flex-between mb-4">
                <h2 className="section-title">作者操作</h2>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  {isEditing ? "收起编辑" : "编辑帖子"}
                </button>
              </div>

              {isEditing ? (
                <form onSubmit={submitUpdate}>
                  <div className="grid gap-4">
                    <div className="form-group">
                      <label className="form-label">标题</label>
                      <input
                        className="form-input"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                      />
                    </div>

                    {(post.postType === "NORMAL" ||
                      post.postType === "BOUNTY") && (
                      <div className="form-group">
                        <label className="form-label">正文</label>
                        <RichTextEditor value={content} onChange={setContent} />
                      </div>
                    )}

                    {post.postType === "RESOURCE" && (
                      <>
                        <div className="form-group">
                          <label className="form-label">隐藏内容</label>
                          <RichTextEditor
                            value={hiddenContent}
                            onChange={setHiddenContent}
                            minHeightClassName="min-h-[160px]"
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">售价</label>
                          <input
                            className="form-input"
                            type="number"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                          />
                        </div>
                      </>
                    )}

                    {post.postType === "BOUNTY" && (
                      <div className="form-group">
                        <label className="form-label">悬赏金额</label>
                        <input
                          className="form-input"
                          type="number"
                          value={bountyAmount}
                          onChange={(e) => setBountyAmount(e.target.value)}
                        />
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button className="btn btn-primary" type="submit">
                        保存修改
                      </button>
                      <button
                        type="button"
                        className="btn btn-warn"
                        onClick={() => void closePost()}
                      >
                        关闭帖子
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => void deletePost()}
                      >
                        删除帖子
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="btn btn-warn"
                    onClick={() => void closePost()}
                  >
                    关闭帖子
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => void deletePost()}
                  >
                    删除帖子
                  </button>
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* Messages */}
      {errorText && (
        <div className="banner banner-error mt-4">
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
        <div className="banner banner-success mt-4">
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
    </main>
  );
}
