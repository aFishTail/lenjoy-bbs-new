"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { RichTextContent } from "@/components/editor/rich-text-content";
import { readError } from "@/components/post/client-helpers";
import {
  usePurchaseResourceMutation,
  useReportPostMutation,
  useTogglePostFavoriteMutation,
  useTogglePostLikeMutation,
} from "@/components/post/use-post-mutations";
import { usePostDetailQuery } from "@/components/post/use-post-queries";
import { useAuth } from "@/components/providers/auth-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";

type Props = {
  postId: string;
};

export function PostContentSection({ postId }: Props) {
  const router = useRouter();
  const { authData: auth } = useAuth();
  const [purchasing, setPurchasing] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetail, setReportDetail] = useState("");

  const postQuery = usePostDetailQuery(postId);
  const post = postQuery.data;

  const togglePostLikeMutation = useTogglePostLikeMutation(postId);
  const togglePostFavoriteMutation = useTogglePostFavoriteMutation(postId);
  const reportPostMutation = useReportPostMutation(postId);
  const purchaseResourceMutation = usePurchaseResourceMutation(postId);

  const isLiking = togglePostLikeMutation.isPending;
  const isFavoriting = togglePostFavoriteMutation.isPending;
  const isReporting = reportPostMutation.isPending;

  if (!post) {
    return null;
  }

  const channelHref =
    post.postType === "RESOURCE"
      ? "/resources"
      : post.postType === "BOUNTY"
        ? "/bounties"
        : "/discussions";

  function bountyStatusLabel(value?: string) {
    switch (value) {
      case "ACTIVE":
        return "进行中";
      case "RESOLVED":
        return "已采纳";
      case "EXPIRED":
        return "已过期";
      default:
        return "-";
    }
  }

  function getBadgeClass(type: string) {
    switch (type) {
      case "RESOURCE":
        return "badge badge-resource";
      case "BOUNTY":
        return "badge badge-bounty";
      default:
        return "badge badge-normal";
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

  function openReportDialog() {
    if (!auth) {
      router.push("/auth");
      return;
    }

    setErrorText("");
    setSuccessText("");
    setReportReason("");
    setReportDetail("");
    setReportDialogOpen(true);
  }

  async function reportPost() {
    const trimmedReason = reportReason.trim();
    if (!trimmedReason) {
      return;
    }

    try {
      await reportPostMutation.mutateAsync({
        reason: trimmedReason,
        detail: reportDetail.trim(),
      });
      setReportDialogOpen(false);
      setReportReason("");
      setReportDetail("");
      setSuccessText("举报已提交");
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

  return (
    <>
      {errorText ? <div className="banner banner-error mb-4">{errorText}</div> : null}
      {successText ? <div className="banner banner-success mb-4">{successText}</div> : null}

      <section className="card mb-4">
        <div className="mb-3 flex flex-wrap gap-2">
          <span className={getBadgeClass(post.postType)}>
            {post.postType === "RESOURCE"
              ? "资源"
              : post.postType === "BOUNTY"
                ? "悬赏"
                : "讨论"}
          </span>
          <span className="badge badge-info">{post.status}</span>
          {post.categoryName ? (
            <span className="badge badge-warning">{post.categoryName}</span>
          ) : null}
          {post.price ? <span className="badge badge-warning">{post.price} 金币</span> : null}
          {post.bountyAmount ? (
            <span className="badge badge-warning">{post.bountyAmount} 金币</span>
          ) : null}
          {post.postType === "BOUNTY" && post.bountyStatus ? (
            <span className="badge badge-info">悬赏 {bountyStatusLabel(post.bountyStatus)}</span>
          ) : null}
        </div>

        <h1 className="mb-2 text-2xl font-bold" style={{ fontFamily: "'Newsreader', serif" }}>
          {post.title}
        </h1>

        <div className="mb-4 flex items-center gap-3 text-sm text-muted">
          <div className="avatar avatar-sm">
            {post.authorUsername?.charAt(0).toUpperCase() || "U"}
          </div>
          <span>{post.authorUsername || post.authorId}</span>
          <span>·</span>
          <span>{new Date(post.createdAt).toLocaleString("zh-CN")}</span>
        </div>

        {post.tags?.length ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <Link
                key={tag.id}
                href={`${channelHref}?tagId=${tag.id}`}
                className="badge badge-info"
              >
                #{tag.name}
              </Link>
            ))}
          </div>
        ) : null}

        <div className="post-content">
          {post.content ? (
            <div className="mb-4">
              <RichTextContent html={post.content} className="leading-7" />
            </div>
          ) : null}

          {post.postType === "RESOURCE" ? (
            <div
              className="mb-4 rounded-xl p-4"
              style={{
                background:
                  "linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(251, 191, 36, 0.1))",
                border: "1px solid rgba(245, 158, 11, 0.3)",
              }}
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="font-semibold" style={{ color: "#F59E0B" }}>
                  隐藏内容
                </span>
                <span className="badge badge-warning">
                  {post.resourceUnlocked ? "已解锁" : "购买可见"}
                </span>
              </div>
              {post.hiddenContent ? (
                <RichTextContent html={post.hiddenContent} />
              ) : post.canPurchase ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void purchaseResource()}
                  disabled={purchasing}
                >
                  {purchasing ? "购买中..." : `支付 ${post.price || 0} 金币购买`}
                </button>
              ) : (
                <div className="text-sm text-slate-600">
                  {auth
                    ? "当前资源暂不可购买，或你已经购买过。"
                    : "登录后可购买并查看隐藏内容。"}
                </div>
              )}
            </div>
          ) : null}

          {post.offlineReason ? (
            <div className="banner banner-warning">下架原因：{post.offlineReason}</div>
          ) : null}
        </div>

        <div className="post-action-bar">
          <button
            type="button"
            className={`post-action-btn${post.liked ? " is-active is-like" : ""}`}
            onClick={() => void togglePostLike()}
            disabled={isLiking}
            aria-pressed={post.liked}
          >
            <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 10v10" />
              <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.96 2.39l-1.22 6A2 2 0 0 1 18.61 20H7a2 2 0 0 1-2-2v-8.31a2 2 0 0 1 .59-1.41l5.66-5.66A1 1 0 0 1 13 3.33V5a2 2 0 0 0 2 2Z" />
            </svg>
            <span>{post.likeCount || 0} 点赞</span>
            {post.liked ? <span className="post-action-state">已赞</span> : null}
          </button>
          <button
            type="button"
            className={`post-action-btn${post.collected ? " is-active is-favorite" : ""}`}
            onClick={() => void togglePostFavorite()}
            disabled={isFavoriting}
            aria-pressed={post.collected}
          >
            <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m12 17.27-5.18 3.05 1.4-5.84L3.5 10.24l6.01-.49L12 4.25l2.49 5.5 6.01.49-4.72 4.24 1.4 5.84z" />
            </svg>
            <span>{post.collectCount || 0} 收藏</span>
            {post.collected ? <span className="post-action-state">已收藏</span> : null}
          </button>
          <button
            type="button"
            className="post-action-btn"
            onClick={openReportDialog}
            disabled={isReporting}
          >
            <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4v16" />
              <path d="M4 5h10l-1 4 5 2-2 4H4" />
            </svg>
            <span>举报帖子</span>
          </button>
        </div>
      </section>

      <ConfirmDialog
        open={reportDialogOpen}
        title="举报帖子"
        description="请填写举报原因。内容会提交给后台审核。"
        confirmLabel="提交举报"
        confirmDisabled={!reportReason.trim()}
        confirmBusy={isReporting}
        onConfirm={() => void reportPost()}
        onOpenChange={setReportDialogOpen}
      >
        <div className="confirm-dialog-form">
          <label className="confirm-dialog-field">
            <span>举报原因</span>
            <Input
              value={reportReason}
              onChange={(event) => setReportReason(event.target.value)}
              placeholder="例如：违规内容、广告引流、人身攻击"
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
              placeholder="选填，补充时间、上下文或具体问题"
              rows={4}
              maxLength={300}
            />
          </label>
        </div>
      </ConfirmDialog>
    </>
  );
}
