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
      }
    }
    void run();
  }, []);

  return (
    <main className="post-page">
      <header className="post-hero">
        <p className="post-kicker">C03 · 作者管理</p>
        <h1 className="post-title">我的帖子</h1>
        <p className="post-subtitle">
          在这里查看你发布过的内容并跳转到详情页执行编辑或删除。
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
      {posts.map((post) => (
        <article key={post.id} className="post-item">
          <div className="post-item-meta">
            {post.postType} · {post.status}
          </div>
          <Link href={`/posts/${post.id}`} className="post-item-title">
            {post.title}
          </Link>
        </article>
      ))}
    </main>
  );
}
