"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { getStoredAuth, readError } from "@/components/post/client-helpers";
import { RichTextContent } from "@/components/editor/rich-text-content";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import {
  usePostCommentsQuery,
  usePostDetailQuery,
} from "@/components/post/use-post-queries";
import {
  useAcceptAnswerMutation,
  useClosePostMutation,
  useDeleteOwnCommentMutation,
  useDeletePostMutation,
  usePurchaseResourceMutation,
  useReportCommentMutation,
  useReportPostMutation,
  useSubmitPostCommentMutation,
  useToggleCommentLikeMutation,
  useTogglePostFavoriteMutation,
  useTogglePostLikeMutation,
  useUpdatePostMutation,
} from "@/components/post/use-post-mutations";
import type { PostComment } from "@/components/post/types";

type Props = {
  postId: string;
};

export function PostDetailClient({ postId }: Props) {
  const router = useRouter();
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");
  const [purchasing, setPurchasing] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [hiddenContent, setHiddenContent] = useState("");
  const [price, setPrice] = useState("");
  const [bountyAmount, setBountyAmount] = useState("");
  const [bountyExpireAt, setBountyExpireAt] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [submittingComment, setSubmittingComment] = useState(false);
  const [acceptingCommentId, setAcceptingCommentId] = useState<number | null>(
    null,
  );

  const [auth, setAuth] = useState<ReturnType<typeof getStoredAuth>>(null);

  const postQuery = usePostDetailQuery(postId);
  const commentsQuery = usePostCommentsQuery(postId);
  const updatePostMutation = useUpdatePostMutation(postId);
  const closePostMutation = useClosePostMutation(postId);
  const deletePostMutation = useDeletePostMutation(postId);
  const purchaseResourceMutation = usePurchaseResourceMutation(postId);
  const submitCommentMutation = useSubmitPostCommentMutation(postId);
  const acceptAnswerMutation = useAcceptAnswerMutation(postId);
  const togglePostLikeMutation = useTogglePostLikeMutation(postId);
  const togglePostFavoriteMutation = useTogglePostFavoriteMutation(postId);
  const toggleCommentLikeMutation = useToggleCommentLikeMutation(postId);
  const deleteOwnCommentMutation = useDeleteOwnCommentMutation(postId);
  const reportPostMutation = useReportPostMutation(postId);
  const reportCommentMutation = useReportCommentMutation();

  const post = postQuery.data ?? null;
  const comments = commentsQuery.data ?? [];
  const loading = postQuery.isLoading;
  const isAuthor = !!auth && !!post && auth.user.id === post.authorId;
  const canSubmitBountyAnswer =
    !!post &&
    post.postType === "BOUNTY" &&
    post.bountyStatus === "ACTIVE" &&
    !!auth &&
    auth.user.id !== post.authorId;

  function formatDateTimeInput(value?: string | null) {
    return value ? value.slice(0, 16) : "";
  }

  function bountyStatusLabel(value?: string) {
    switch (value) {
      case "ACTIVE":
        return "进行中";
      case "RESOLVED":
        return "已采纳";
      case "EXPIRED":
        return "已结束未采纳";
      default:
        return "-";
    }
  }

  useEffect(() => {
    setAuth(getStoredAuth());
  }, [postId]);

  useEffect(() => {
    if (!postQuery.data) {
      return;
    }
    setTitle(postQuery.data.title || "");
    setContent(postQuery.data.content || "");
    setHiddenContent(postQuery.data.hiddenContent || "");
    setPrice(postQuery.data.price ? String(postQuery.data.price) : "");
    setBountyAmount(
      postQuery.data.bountyAmount ? String(postQuery.data.bountyAmount) : "",
    );
    setBountyExpireAt(formatDateTimeInput(postQuery.data.bountyExpireAt));
  }, [postQuery.data]);

  useEffect(() => {
    const error = postQuery.error ?? commentsQuery.error;
    if (error) {
      setErrorText(readError(error));
    }
  }, [commentsQuery.error, postQuery.error]);

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

  async function purchaseResource() {
    if (!auth) {
      router.push("/auth");
      return;
    }

    setPurchasing(true);
    setErrorText("");
    setSuccessText("");
    try {
      await purchaseResourceMutation.mutateAsync();
      setSuccessText("购买成功，隐藏内容已解锁");
    } catch (error) {
      setErrorText(readError(error));
    } finally {
      setPurchasing(false);
    }
  }

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
      setCommentText("");
      if (parentId) {
        setReplyDrafts((prev) => ({ ...prev, [parentId]: "" }));
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

  async function togglePostLike() {
    if (!auth) {
      router.push("/auth");
      return;
    }
    try {
      await togglePostLikeMutation.mutateAsync();
    } catch (error) {
      setErrorText(readError(error));
    }
  }

  async function togglePostFavorite() {
    if (!auth) {
      router.push("/auth");
      return;
    }
    try {
      await togglePostFavoriteMutation.mutateAsync();
    } catch (error) {
      setErrorText(readError(error));
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
    try {
      await deleteOwnCommentMutation.mutateAsync(commentId);
      setSuccessText("评论已删除");
    } catch (error) {
      setErrorText(readError(error));
    }
  }

  async function reportPost() {
    if (!auth) {
      router.push("/auth");
      return;
    }
    const reason = window.prompt("请输入举报原因（必填）", "违规内容");
    if (!reason || !reason.trim()) {
      return;
    }
    const detail = window.prompt("补充说明（选填）", "") || "";
    try {
      await reportPostMutation.mutateAsync({
        reason: reason.trim(),
        detail: detail.trim(),
      });
      setSuccessText("举报已提交，等待管理员处理");
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
              {post.postType === "BOUNTY" && post.bountyStatus && (
                <span className="badge badge-info">
                  悬赏 {bountyStatusLabel(post.bountyStatus)}
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

              {post.postType === "RESOURCE" && (
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
                    <span className="badge badge-warning">
                      {post.resourceUnlocked ? "已解锁" : "购买可见"}
                    </span>
                  </div>
                  {post.hiddenContent ? (
                    <RichTextContent html={post.hiddenContent} />
                  ) : (
                    <div className="space-y-3 text-sm text-slate-600">
                      <p>
                        {post.purchaseStatus === "REFUNDED"
                          ? "该资源交易已全额退款，隐藏内容已重新锁定。"
                          : "购买后即可立即查看隐藏内容，适用于下载链接、提取码和完整交付内容。"}
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {post.canPurchase ? (
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => void purchaseResource()}
                            disabled={purchasing}
                          >
                            {purchasing
                              ? "购买中..."
                              : `支付 ${post.price || 0} 金币购买`}
                          </button>
                        ) : !auth ? (
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => router.push("/auth")}
                          >
                            登录后购买
                          </button>
                        ) : post.purchased ? (
                          <>
                            <span className="badge badge-info">
                              {post.purchaseStatus === "REFUNDED"
                                ? "已退款"
                                : "已购买"}
                            </span>
                            {post.purchaseId ? (
                              <Link
                                href="/my/purchases"
                                className="btn btn-ghost btn-sm"
                              >
                                查看交易记录
                              </Link>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-sm text-slate-500">
                            当前资源暂不可购买
                          </span>
                        )}
                      </div>
                    </div>
                  )}
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

              {post.postType === "BOUNTY" && (
                <div
                  className="mb-4 p-4 rounded-xl"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(14, 116, 144, 0.08), rgba(249, 115, 22, 0.12))",
                    border: "1px solid rgba(14, 116, 144, 0.18)",
                  }}
                >
                  <div className="flex flex-wrap gap-3 items-center mb-2">
                    <span className="badge badge-bounty">
                      {bountyStatusLabel(post.bountyStatus)}
                    </span>
                    <span className="text-sm text-slate-600">
                      截止{" "}
                      {post.bountyExpireAt
                        ? new Date(post.bountyExpireAt).toLocaleString("zh-CN")
                        : "-"}
                    </span>
                    {post.bountySettledAt ? (
                      <span className="text-sm text-slate-600">
                        结算{" "}
                        {new Date(post.bountySettledAt).toLocaleString("zh-CN")}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-slate-700">
                    悬赏帖使用一级评论作为候选答案，二级回复用于追问讨论。发帖人不可提交候选答案。
                  </p>
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
              <button
                type="button"
                className="post-item-stat"
                onClick={() => void togglePostLike()}
              >
                <svg
                  className="icon-sm"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                </svg>
                {post.likeCount || 0} 点赞{post.liked ? " (已赞)" : ""}
              </button>
              <button
                type="button"
                className="post-item-stat"
                onClick={() => void togglePostFavorite()}
              >
                <svg
                  className="icon-sm"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
                {post.collectCount || 0} 收藏{post.collected ? " (已收藏)" : ""}
              </button>
              <button
                type="button"
                className="post-item-stat"
                onClick={() => void reportPost()}
              >
                举报帖子
              </button>
            </div>
          </section>

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
