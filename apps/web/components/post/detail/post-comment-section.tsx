"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { RichTextContent } from "@/components/editor/rich-text-content";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { readError } from "@/components/post/client-helpers";
import {
  usePostCommentsQuery,
  usePostDetailQuery,
} from "@/components/post/use-post-queries";
import {
  useAcceptAnswerMutation,
  useDeleteOwnCommentMutation,
  useReportCommentMutation,
  useSubmitPostCommentMutation,
  useToggleCommentLikeMutation,
} from "@/components/post/use-post-mutations";
import { useAuth } from "@/components/providers/auth-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";

type Props = {
  postId: string;
};

export function PostCommentSection({ postId }: Props) {
  const router = useRouter();
  const { authData: auth } = useAuth();

  const [commentText, setCommentText] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [submittingComment, setSubmittingComment] = useState(false);
  const [acceptingCommentId, setAcceptingCommentId] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetCommentId, setDeleteTargetCommentId] = useState<number | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetail, setReportDetail] = useState("");
  const [reportTargetCommentId, setReportTargetCommentId] = useState<number | null>(null);

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
      toast.error(parentId ? "请输入回复内容" : "请输入评论内容");
      return;
    }

    if (!auth) {
      router.push("/auth");
      return;
    }

    setSubmittingComment(true);

    try {
      await submitCommentMutation.mutateAsync({
        parentId,
        content: contentValue,
      });
      toast.success(parentId ? "回复已发送" : "评论已提交");

      if (parentId) {
        setReplyDrafts((prev) => ({ ...prev, [parentId]: "" }));
      } else {
        setCommentText("");
      }
    } catch (error) {
      toast.error(readError(error));
    } finally {
      setSubmittingComment(false);
    }
  }

  async function acceptAnswer(commentId: number) {
    setAcceptingCommentId(commentId);

    try {
      await acceptAnswerMutation.mutateAsync(commentId);
      toast.success("已采纳该答案，悬赏已完成结算");
    } catch (error) {
      toast.error(readError(error));
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
      toast.error(readError(error));
    }
  }

  async function deleteOwnComment(commentId: number) {
    if (!auth) {
      router.push("/auth");
      return;
    }

    try {
      await deleteOwnCommentMutation.mutateAsync(commentId);
      setDeleteDialogOpen(false);
      setDeleteTargetCommentId(null);
      toast.success("评论已删除");
    } catch (error) {
      toast.error(readError(error));
    }
  }

  function openDeleteDialog(commentId: number) {
    if (!auth) {
      router.push("/auth");
      return;
    }

    setDeleteTargetCommentId(commentId);
    setDeleteDialogOpen(true);
  }

  function openReportDialog(commentId: number) {
    if (!auth) {
      router.push("/auth");
      return;
    }

    setReportTargetCommentId(commentId);
    setReportReason("");
    setReportDetail("");
    setReportDialogOpen(true);
  }

  async function submitCommentReport() {
    const trimmedReason = reportReason.trim();
    if (!reportTargetCommentId || !trimmedReason) {
      return;
    }

    try {
      await reportCommentMutation.mutateAsync({
        commentId: reportTargetCommentId,
        reason: trimmedReason,
        detail: reportDetail.trim(),
      });
      setReportDialogOpen(false);
      setReportTargetCommentId(null);
      setReportReason("");
      setReportDetail("");
      toast.success("评论举报已提交");
    } catch (error) {
      toast.error(readError(error));
    }
  }

  return (
    <>
      <section className="card mb-4">
        <div className="flex-between mb-4">
          <h2 className="section-title">
            {post.postType === "BOUNTY" ? "候选答案" : "评论区"}
          </h2>
          <span className="text-sm text-slate-500">
            {comments.length} 条一级{post.postType === "BOUNTY" ? "答案" : "评论"}
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
                placeholder="直接给出可采纳的完整方案，补充讨论可使用二级回复。"
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
            <div className="banner banner-info mb-6">登录后可参与回答悬赏问题。</div>
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
                  <span>{new Date(comment.createdAt).toLocaleString("zh-CN")}</span>
                  {comment.accepted ? (
                    <span className="badge badge-success">已采纳</span>
                  ) : null}
                </div>

                <RichTextContent
                  html={comment.deleted ? "<p>该评论已删除</p>" : comment.content}
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
                      {acceptingCommentId === comment.id ? "采纳中..." : "采纳答案"}
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
                      onClick={() => openDeleteDialog(comment.id)}
                    >
                      删除评论
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => openReportDialog(comment.id)}
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
                      placeholder="继续追问，或补充更多细节。"
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
                      <div key={reply.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-slate-500">
                          <span className="font-medium text-slate-700">
                            {reply.authorUsername || reply.authorId}
                          </span>
                          {reply.replyToUsername ? (
                            <span>回复 {reply.replyToUsername}</span>
                          ) : null}
                          <span>{new Date(reply.createdAt).toLocaleString("zh-CN")}</span>
                        </div>

                        <RichTextContent
                          html={reply.deleted ? "<p>该评论已删除</p>" : reply.content}
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
                              onClick={() => openDeleteDialog(reply.id)}
                            >
                              删除
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => openReportDialog(reply.id)}
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

      <ConfirmDialog
        open={deleteDialogOpen}
        title="确认删除评论"
        description="删除后该评论内容将不可恢复，原位置只保留已删除状态。请确认继续。"
        confirmLabel="确认删除"
        confirmBusy={deleteOwnCommentMutation.isPending}
        onConfirm={() => {
          if (deleteTargetCommentId) {
            void deleteOwnComment(deleteTargetCommentId);
          }
        }}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setDeleteTargetCommentId(null);
          }
        }}
      />

      <ConfirmDialog
        open={reportDialogOpen}
        title="举报评论"
        description="请填写举报原因。内容会提交给后台审核。"
        confirmLabel="提交举报"
        confirmDisabled={!reportReason.trim() || !reportTargetCommentId}
        confirmBusy={reportCommentMutation.isPending}
        onConfirm={() => void submitCommentReport()}
        onOpenChange={(open) => {
          setReportDialogOpen(open);
          if (!open) {
            setReportTargetCommentId(null);
            setReportReason("");
            setReportDetail("");
          }
        }}
      >
        <div className="confirm-dialog-form">
          <label className="confirm-dialog-field">
            <span>举报原因</span>
            <Input
              value={reportReason}
              onChange={(event) => setReportReason(event.target.value)}
              placeholder="例如：辱骂、人身攻击、广告、刷屏"
              maxLength={80}
              autoFocus
            />
          </label>
          <label className="confirm-dialog-field">
            <span>补充说明</span>
            <textarea
              className="confirm-dialog-textarea"
              value={reportDetail}
              onChange={(event) => setReportDetail(event.target.value)}
              placeholder="选填，补充违规位置或上下文"
              rows={4}
              maxLength={300}
            />
          </label>
        </div>
      </ConfirmDialog>
    </>
  );
}
