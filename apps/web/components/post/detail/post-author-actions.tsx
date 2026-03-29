"use client";

import { useState, useEffect, FormEvent } from "react";
import { readError } from "@/components/post/client-helpers";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import {
  useClosePostMutation,
  useDeletePostMutation,
  useUpdatePostMutation,
} from "@/components/post/use-post-mutations";
import { usePostDetailQuery } from "@/components/post/use-post-queries";

type Props = {
  postId: string;
};

export function PostAuthorActions({ postId }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");
  
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [hiddenContent, setHiddenContent] = useState("");
  const [price, setPrice] = useState("");
  const [bountyAmount, setBountyAmount] = useState("");
  const [bountyExpireAt, setBountyExpireAt] = useState("");

  const postQuery = usePostDetailQuery(postId);
  const post = postQuery.data;

  const updatePostMutation = useUpdatePostMutation(postId);
  const closePostMutation = useClosePostMutation(postId);
  const deletePostMutation = useDeletePostMutation(postId);

  function formatDateTimeInput(value?: string | null) {
    return value ? value.slice(0, 16) : "";
  }

  useEffect(() => {
    if (!post) return;
    setTitle(post.title || "");
    setContent(post.content || "");
    setHiddenContent(post.hiddenContent || "");
    setPrice(post.price ? String(post.price) : "");
    setBountyAmount(post.bountyAmount ? String(post.bountyAmount) : "");
    setBountyExpireAt(formatDateTimeInput(post.bountyExpireAt));
  }, [post]);

  if (!post) return null;

  async function submitUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorText("");
    setSuccessText("");
    try {
      await updatePostMutation.mutateAsync({
        title,
        content,
        hiddenContent,
        price: price ? Number(price) : null,
        bountyAmount: bountyAmount ? Number(bountyAmount) : null,
        bountyExpireAt: bountyExpireAt || null,
      });
      setSuccessText("更新成功");
      setIsEditing(false);
    } catch (error) {
      setErrorText(readError(error));
    }
  }

  async function closePost() {
    setErrorText("");
    setSuccessText("");
    try {
      await closePostMutation.mutateAsync();
      setSuccessText("帖子已关闭");
    } catch (error) {
      setErrorText(readError(error));
    }
  }

  async function deletePost() {
    setErrorText("");
    setSuccessText("");
    try {
      await deletePostMutation.mutateAsync();
      setSuccessText("帖子已删除");
    } catch (error) {
      setErrorText(readError(error));
    }
  }

  return (
    <>
      {errorText && (
        <div className="banner banner-error mb-4">
          <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
          </svg>
          {errorText}
        </div>
      )}
      
      {successText && (
        <div className="banner banner-success mb-4">
          <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          </svg>
          {successText}
        </div>
      )}

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
                    <label className="form-label">公开内容</label>
                    <RichTextEditor
                      value={content}
                      onChange={setContent}
                      minHeightClassName="min-h-[160px]"
                    />
                  </div>
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
                      min="1"
                      step="1"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                  </div>
                </>
              )}

              {post.postType === "BOUNTY" && (
                <>
                  <div className="form-group">
                    <label className="form-label">悬赏金额</label>
                    <input
                      className="form-input"
                      type="number"
                      min="1"
                      step="1"
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
    </>
  );
}
