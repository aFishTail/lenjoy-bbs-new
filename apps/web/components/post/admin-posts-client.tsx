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

  return (
    <main className="post-page">
      <header className="post-hero">
        <p className="post-kicker">C04 · 管理员下架</p>
        <h1 className="post-title">管理员帖子管理</h1>
        <p className="post-subtitle">
          可按帖子执行下架，前台将不可见。请填写可追溯的处理原因。
        </p>
      </header>
      <div className="post-links">
        <Link className="post-link" href="/">
          返回帖子列表
        </Link>
      </div>
      {errorText ? (
        <p className="post-banner post-banner-error">{errorText}</p>
      ) : null}
      {successText ? (
        <p className="post-banner post-banner-success">{successText}</p>
      ) : null}
      {posts.map((post) => (
        <article key={post.id} className="post-item">
          <div className="post-item-meta">
            {post.postType} · {post.status} · 作者{" "}
            {post.authorUsername || post.authorId}
          </div>
          <Link href={`/posts/${post.id}`} className="post-item-title">
            {post.title}
          </Link>
          <div className="post-btn-row" style={{ marginTop: "10px" }}>
            <input
              className="post-field"
              style={{ minWidth: "220px", flex: "1 1 240px" }}
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
              className="post-btn-danger"
              onClick={() => void offlinePost(post.id)}
              type="button"
            >
              下架帖子
            </button>
          </div>
        </article>
      ))}
    </main>
  );
}
