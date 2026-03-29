"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readError } from "@/components/post/client-helpers";
import { RichTextContent } from "@/components/editor/rich-text-content";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { usePostCommentsQuery, usePostDetailQuery } from "@/components/post/use-post-queries";
import {
  useAcceptAnswerMutation,
  useDeleteOwnCommentMutation,
  useReportCommentMutation,
  useSubmitPostCommentMutation,
  useToggleCommentLikeMutation,
} from "@/components/post/use-post-mutations";
import { useAuth } from "@/components/providers/auth-provider";

type Props = {
  postId: string;
};

export function PostCommentSection({ postId }: Props) {
  const router = useRouter();
  const { authData: auth } = useAuth();
  
  // Local state for forms and notifications
  const [commentText, setCommentText] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [submittingComment, setSubmittingComment] = useState(false);
  const [acceptingCommentId, setAcceptingCommentId] = useState<number | null>(null);
  
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");

  const postQuery = usePostDetailQuery(postId);
  const commentsQuery = usePostCommentsQuery(postId);
  
  const post = postQuery.data;
  const comments = commentsQuery.data ?? [];

  const submitCommentMutation = useSubmitPostCommentMutation(postId);
  const acceptAnswerMutation = useAcceptAnswerMutation(postId);
  const toggleCommentLikeMutation = useToggleCommentLikeMutation(postId);
  const deleteOwnCommentMutation = useDeleteOwnCommentMutation(postId);
  const reportCommentMutation = useReportCommentMutation();

  if (!post) {
    return null;
  }

  const isAuthor = !!auth && auth.user.id === post.authorId;
  const canSubmitBountyAnswer =
    post.postType === "BOUNTY" &&
    post.bountyStatus === "ACTIVE" &&
    !!auth &&
    auth.user.id !== post.authorId;

  async function submitComment(parentId?: number) {
    const contentValue = parentId
      ? (replyDrafts[parentId] || "").trim()
      : commentText.trim();

    if (!contentValue) {
      setErrorText(parentId ? "请输入回复内容" : "请输入回答内容");
      return;
    }

    if (!auth) {
      router.push("/auth");
      return;
    }

    setSubmittingComment(true);
    setErrorText("");
    setSuccessText("");
    try {
      await submitCommentMutation.mutateAsync({
        parentId,
        content: contentValue,
      });
      setSuccessText(parentId ? "回复已发送" : "回答已提交");
      
      if (parentId) {
        setReplyDrafts((prev) => ({ ...prev, [parentId]: "" }));
      } else {
        setCommentText("");
      }
    } catch (error) {
      setErrorText(readError(error));
    } finally {
      setSubmittingComment(false);
    }
  }

  async function acceptAnswer(commentId: number) {
    setAcceptingCommentId(commentId);
    setErrorText("");
    setSuccessText("");
    try {
      await acceptAnswerMutation.mutateAsync(commentId);
      setSuccessText("已采纳该答案并完成赏金结算");
    } catch (error) {
      setErrorText(readError(error));
    } finally {
      setAcceptingCommentId(null);
    }
  }

  async function toggleCommentLike(commentId: number) {
    if (!auth) {
      router.push("/auth");
      return;
    }
    try {
      await toggleCommentLikeMutation.mutateAsync(commentId);
    } catch (error) {
      setErrorText(readError(error));
    }
  }

  async function deleteOwnComment(commentId: number) {
    if (!auth) {
      router.push("/auth");
      return;
    }
    setErrorText("");
    setSuccessText("");
    try {
      await deleteOwnCommentMutation.mutateAsync(commentId);
      setSuccessText("评论已删除");
    } catch (error) {
      setErrorText(readError(error));
    }
  }

  async function reportComment(commentId: number) {
    if (!auth) {
      router.push("/auth");
      return;
    }
    const reason = window.prompt("请输入举报原因（必填）", "违规评论");
    if (!reason || !reason.trim()) {
      return;
    }
    const detail = window.prompt("补充说明（选填）", "") || "";
    try {
      await reportCommentMutation.mutateAsync({
        commentId,
        reason: reason.trim(),
        detail: detail.trim(),
      });
      setSuccessText("评论举报已提交");
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

      <section className="card mb-4">
        <div className="flex-between mb-4">
          <h2 className="section-title">
            {post.postType === "BOUNTY" ? "候选答案" : "评论区"}
          </h2>
          <span className="text-sm text-slate-500">
            {comments.length} 条一级
            {post.postType === "BOUNTY" ? "答案" : "评论"}
          </span>
        </div>

        {post.postType === "BOUNTY" ? (
          canSubmitBountyAnswer ? (
            <div className="mb-6 rounded-2xl border border-[var(--border-light)] bg-white/70 p-4">
              <label className="form-label">提交你的候选答案</label>
              <RichTextEditor
                value={commentText}
                onChange={setCommentText}
                minHeightClassName="min-h-[180px]"
                placeholder="直接给出可采纳的完整方案，追问讨论请用二级回复。"
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={submittingComment}
                  onClick={() => void submitComment()}
                >
                  {submittingComment ? "提交中..." : "提交答案"}
                </button>
              </div>
            </div>
          ) : !auth ? (
            <div className="banner banner-info mb-6">
              登录后可参与回答悬赏问题。
            </div>
          ) : null
        ) : (
          <div className="mb-6 rounded-2xl border border-[var(--border-light)] bg-white/70 p-4">
            <label className="form-label">发表评论</label>
            <RichTextEditor
              value={commentText}
              onChange={setCommentText}
              minHeightClassName="min-h-[160px]"
              placeholder="补充你的看法或反馈。"
            />
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                className="btn btn-primary"
                disabled={submittingComment}
                onClick={() => void submitComment()}
              >
                {submittingComment ? "提交中..." : "发表评论"}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {comments.length === 0 ? (
            <div className="text-sm text-slate-500">暂无内容</div>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="rounded-2xl border border-[var(--border-light)] bg-white/80 p-4"
              >
                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                  <span className="font-medium text-slate-800">
                    {comment.authorUsername || comment.authorId}
                  </span>
                  <span>
                    {new Date(comment.createdAt).toLocaleString("zh-CN")}
                  </span>
                  {comment.accepted ? (
                    <span className="badge badge-success">已采纳</span>
                  ) : null}
                </div>
                <RichTextContent
                  html={
                    comment.deleted
                      ? "<p>该评论已删除</p>"
                      : comment.content
                  }
                  className="leading-7"
                />

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => void toggleCommentLike(comment.id)}
                  >
                    点赞 {comment.likeCount || 0}
                    {comment.liked ? " (已赞)" : ""}
                  </button>
                  {post.postType === "BOUNTY" &&
                  isAuthor &&
                  post.bountyStatus === "ACTIVE" &&
                  !comment.accepted ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={acceptingCommentId === comment.id}
                      onClick={() => void acceptAnswer(comment.id)}
                    >
                      {acceptingCommentId === comment.id
                        ? "采纳中..."
                        : "采纳答案"}
                    </button>
                  ) : null}
                  {!!auth ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        setReplyDrafts((prev) => ({
                          ...prev,
                          [comment.id]: prev[comment.id] || "",
                        }))
                      }
                    >
                      追问 / 回复
                    </button>
                  ) : null}
                  {!!auth && auth.user.id === comment.authorId ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => void deleteOwnComment(comment.id)}
                    >
                      删除评论
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => void reportComment(comment.id)}
                  >
                    举报评论
                  </button>
                </div>

                {comment.id in replyDrafts ? (
                  <div className="mt-4 rounded-xl border border-[var(--border-light)] bg-slate-50 p-3">
                    <RichTextEditor
                      value={replyDrafts[comment.id] || ""}
                      onChange={(value) =>
                        setReplyDrafts((prev) => ({
                          ...prev,
                          [comment.id]: value,
                        }))
                      }
                      minHeightClassName="min-h-[120px]"
                      placeholder="继续追问或补充细节。"
                    />
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          setReplyDrafts((prev) => {
                            const next = { ...prev };
                            delete next[comment.id];
                            return next;
                          })
                        }
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={submittingComment}
                        onClick={() => void submitComment(comment.id)}
                      >
                        发送回复
                      </button>
                    </div>
                  </div>
                ) : null}

                {comment.replies?.length ? (
                  <div className="mt-4 space-y-3 border-t border-[var(--border-light)] pt-4">
                    {comment.replies.map((reply) => (
                      <div
                        key={reply.id}
                        className="rounded-xl bg-slate-50 p-3 text-sm"
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-slate-500">
                          <span className="font-medium text-slate-700">
                            {reply.authorUsername || reply.authorId}
                          </span>
                          {reply.replyToUsername ? (
                            <span>回复 {reply.replyToUsername}</span>
                          ) : null}
                          <span>
                            {new Date(reply.createdAt).toLocaleString(
                              "zh-CN",
                            )}
                          </span>
                        </div>
                        <RichTextContent
                          html={
                            reply.deleted
                              ? "<p>该评论已删除</p>"
                              : reply.content
                          }
                          className="leading-6"
                        />
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => void toggleCommentLike(reply.id)}
                          >
                            点赞 {reply.likeCount || 0}
                            {reply.liked ? " (已赞)" : ""}
                          </button>
                          {!!auth && auth.user.id === reply.authorId ? (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() =>
                                void deleteOwnComment(reply.id)
                              }
                            >
                              删除
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => void reportComment(reply.id)}
                          >
                            举报
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}
