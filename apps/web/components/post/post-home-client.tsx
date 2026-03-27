"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import {
  authHeaders,
  getStoredAuth,
  readApi,
  readError,
} from "@/components/post/client-helpers";
import type { PostSummary } from "@/components/post/types";

type PostType = "NORMAL" | "RESOURCE" | "BOUNTY";

const typeOptions: PostType[] = ["NORMAL", "RESOURCE", "BOUNTY"];

export function PostHomeClient() {
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");
  const [auth, setAuth] = useState<ReturnType<typeof getStoredAuth>>(null);
  const [authReady, setAuthReady] = useState(false);

  const [postType, setPostType] = useState<PostType>("NORMAL");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [publicContent, setPublicContent] = useState("");
  const [hiddenContent, setHiddenContent] = useState("");
  const [price, setPrice] = useState("");
  const [bountyAmount, setBountyAmount] = useState("");

  async function loadPosts() {
    setLoading(true);
    try {
      const response = await fetch("/api/posts", { cache: "no-store" });
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
    setAuth(getStoredAuth());
    setAuthReady(true);
    void loadPosts();
  }, []);

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorText("");
    setSuccessText("");

    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          postType,
          title,
          content,
          publicContent,
          hiddenContent,
          price: price ? Number(price) : null,
          bountyAmount: bountyAmount ? Number(bountyAmount) : null,
        }),
      });
      await readApi(response);
      setSuccessText("发帖成功");
      setTitle("");
      setContent("");
      setPublicContent("");
      setHiddenContent("");
      setPrice("");
      setBountyAmount("");
      await loadPosts();
    } catch (error) {
      setErrorText(readError(error));
    }
  }

  return (
    <main className="post-page">
      <header className="post-hero">
        <p className="post-kicker">Epic C · 帖子基础能力</p>
        <h1 className="post-title">帖子广场</h1>
        <p className="post-subtitle">
          已覆盖 C01/C02。若需登录注册，请前往
          <Link href="/auth" className="post-link">
            /auth
          </Link>
          。
        </p>
      </header>

      <section className="post-panel post-grid">
        <div className="post-links">
          <Link className="post-link" href="/my/posts">
            我的帖子管理
          </Link>
          <Link className="post-link" href="/admin/posts">
            管理员帖子管理
          </Link>
        </div>
        {authReady && !auth ? (
          <p className="post-banner post-banner-error">
            未检测到本地登录态，发帖功能将不可用。
          </p>
        ) : null}
      </section>

      <section className="post-panel">
        <h2 className="mb-3 text-[1.25rem] font-semibold">发布帖子</h2>
        <form className="post-grid" onSubmit={submitCreate}>
          <select
            className="post-select"
            value={postType}
            onChange={(e) => setPostType(e.target.value as PostType)}
          >
            {typeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <input
            className="post-field"
            placeholder="标题"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          {(postType === "NORMAL" || postType === "BOUNTY") && (
            <textarea
              className="post-textarea"
              placeholder="正文"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          )}

          {postType === "RESOURCE" && (
            <>
              <textarea
                className="post-textarea post-textarea-sm"
                placeholder="公开内容"
                value={publicContent}
                onChange={(e) => setPublicContent(e.target.value)}
              />
              <textarea
                className="post-textarea post-textarea-sm"
                placeholder="隐藏内容"
                value={hiddenContent}
                onChange={(e) => setHiddenContent(e.target.value)}
              />
              <input
                className="post-field"
                placeholder="售价（整数）"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </>
          )}

          {postType === "BOUNTY" && (
            <input
              className="post-field"
              placeholder="悬赏金额（整数）"
              value={bountyAmount}
              onChange={(e) => setBountyAmount(e.target.value)}
            />
          )}

          <button className="post-btn" type="submit">
            提交发帖
          </button>
        </form>
      </section>

      {errorText ? (
        <p className="post-banner post-banner-error">{errorText}</p>
      ) : null}
      {successText ? (
        <p className="post-banner post-banner-success">{successText}</p>
      ) : null}

      <section className="post-panel post-list">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[1.32rem] font-semibold">最新帖子</h2>
          <button
            className="post-btn-ghost"
            onClick={() => void loadPosts()}
            type="button"
          >
            刷新
          </button>
        </div>
        {loading ? <p className="post-item-meta">加载中...</p> : null}
        {posts.map((post) => (
          <article className="post-item" key={post.id}>
            <div className="post-item-meta">
              {post.postType} · {post.status} · 作者{" "}
              {post.authorUsername || post.authorId}
            </div>
            <h3>
              <Link href={`/posts/${post.id}`} className="post-item-title">
                {post.title}
              </Link>
            </h3>
          </article>
        ))}
      </section>
    </main>
  );
}
