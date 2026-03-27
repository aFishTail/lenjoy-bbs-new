"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import {
  authHeaders,
  getStoredAuth,
  readApi,
  readError,
} from "@/components/post/client-helpers";
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
  const [publicContent, setPublicContent] = useState("");
  const [hiddenContent, setHiddenContent] = useState("");
  const [price, setPrice] = useState("");
  const [bountyAmount, setBountyAmount] = useState("");

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
      setPublicContent(payload.data.publicContent || "");
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
          publicContent,
          hiddenContent,
          price: price ? Number(price) : null,
          bountyAmount: bountyAmount ? Number(bountyAmount) : null,
        }),
      });
      await readApi(response);
      setSuccessText("更新成功");
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

  if (loading) {
    return <main className="post-page">加载中...</main>;
  }

  return (
    <main className="post-page">
      <div className="post-links">
        <Link className="post-link" href="/">
          返回帖子列表
        </Link>
      </div>

      {post ? (
        <section className="post-panel">
          <div className="post-item-meta">
            {post.postType} · {post.status} · 作者{" "}
            {post.authorUsername || post.authorId}
          </div>
          <h1 className="mb-3 text-[2rem] font-semibold">{post.title}</h1>
          {post.content ? (
            <p className="mb-3 whitespace-pre-wrap leading-7">{post.content}</p>
          ) : null}
          {post.publicContent ? (
            <p className="mb-2 whitespace-pre-wrap rounded-[10px] border border-[#d6cdc2] bg-[#fffdf7] p-3">
              公开内容：{post.publicContent}
            </p>
          ) : null}
          {post.hiddenContent ? (
            <p className="mb-2 whitespace-pre-wrap rounded-[10px] border border-[#e8c39f] bg-[#fff2e5] p-3">
              隐藏内容：{post.hiddenContent}
            </p>
          ) : null}
          {post.offlineReason ? (
            <p className="post-banner post-banner-error">
              下架原因：{post.offlineReason}
            </p>
          ) : null}
        </section>
      ) : null}

      {isAuthor && post ? (
        <section className="post-panel">
          <h2 className="mb-3 text-[1.2rem] font-semibold">作者操作（C03）</h2>
          <form className="post-grid" onSubmit={submitUpdate}>
            <input
              className="post-field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            {(post.postType === "NORMAL" || post.postType === "BOUNTY") && (
              <textarea
                className="post-textarea"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            )}
            {post.postType === "RESOURCE" && (
              <>
                <textarea
                  className="post-textarea post-textarea-sm"
                  value={publicContent}
                  onChange={(e) => setPublicContent(e.target.value)}
                />
                <textarea
                  className="post-textarea post-textarea-sm"
                  value={hiddenContent}
                  onChange={(e) => setHiddenContent(e.target.value)}
                />
                <input
                  className="post-field"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </>
            )}
            {post.postType === "BOUNTY" && (
              <input
                className="post-field"
                value={bountyAmount}
                onChange={(e) => setBountyAmount(e.target.value)}
              />
            )}
            <div className="post-btn-row">
              <button className="post-btn" type="submit">
                保存编辑
              </button>
              <button
                className="post-btn-warn"
                type="button"
                onClick={() => void closePost()}
              >
                关闭帖子
              </button>
              <button
                className="post-btn-danger"
                type="button"
                onClick={() => void deletePost()}
              >
                逻辑删除
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {errorText ? (
        <p className="post-banner post-banner-error">{errorText}</p>
      ) : null}
      {successText ? (
        <p className="post-banner post-banner-success">{successText}</p>
      ) : null}
    </main>
  );
}
