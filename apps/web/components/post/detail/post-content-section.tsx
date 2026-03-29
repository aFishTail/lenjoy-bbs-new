"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { readError } from "@/components/post/client-helpers";
import { RichTextContent } from "@/components/editor/rich-text-content";
import { usePostDetailQuery } from "@/components/post/use-post-queries";
import {
  usePurchaseResourceMutation,
  useReportPostMutation,
  useTogglePostFavoriteMutation,
  useTogglePostLikeMutation,
} from "@/components/post/use-post-mutations";
import { useAuth } from "@/components/providers/auth-provider";

type Props = {
  postId: string;
};

export function PostContentSection({ postId }: Props) {
  const router = useRouter();
  const { authData: auth } = useAuth();
  const [purchasing, setPurchasing] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");

  const postQuery = usePostDetailQuery(postId);
  const post = postQuery.data;

  const togglePostLikeMutation = useTogglePostLikeMutation(postId);
  const togglePostFavoriteMutation = useTogglePostFavoriteMutation(postId);
  const reportPostMutation = useReportPostMutation(postId);
  const purchaseResourceMutation = usePurchaseResourceMutation(postId);

  if (!post) {
    return null;
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
        <div className="flex gap-2 mb-3">
          <span className={getBadgeClass(post.postType)}>
            {post.postType === "NORMAL" && "普通"}
            {post.postType === "RESOURCE" && "资源"}
            {post.postType === "BOUNTY" && "悬赏"}
          </span>
          <span className="badge badge-info">{post.status}</span>
          {post.price && (
            <span className="badge badge-warning">
              <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: "4px" }}>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v12M6 12h12" />
              </svg>
              {post.price} 金币
            </span>
          )}
          {post.bountyAmount && (
            <span className="badge badge-warning">
              <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: "4px" }}>
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

        <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "'Newsreader', serif" }}>
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
                background: "linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(251, 191, 36, 0.1))",
                border: "1px solid rgba(245, 158, 11, 0.3)",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span className="font-semibold" style={{ color: "#F59E0B" }}>
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
                        {purchasing ? "购买中..." : `支付 ${post.price || 0} 金币购买`}
                      </button>
                    ) : !auth ? (
                      <button type="button" className="btn btn-primary" onClick={() => router.push("/auth")}>
                        登录后购买
                      </button>
                    ) : post.purchased ? (
                      <>
                        <span className="badge badge-info">
                          {post.purchaseStatus === "REFUNDED" ? "已退款" : "已购买"}
                        </span>
                        {post.purchaseId ? (
                          <Link href="/my/purchases" className="btn btn-ghost btn-sm">
                            查看交易记录
                          </Link>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-sm text-slate-500">当前资源暂不可购买</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {post.offlineReason && (
            <div className="banner banner-warning">
              <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                background: "linear-gradient(135deg, rgba(14, 116, 144, 0.08), rgba(249, 115, 22, 0.12))",
                border: "1px solid rgba(14, 116, 144, 0.18)",
              }}
            >
              <div className="flex flex-wrap gap-3 items-center mb-2">
                <span className="badge badge-bounty">{bountyStatusLabel(post.bountyStatus)}</span>
                <span className="text-sm text-slate-600">
                  截止 {post.bountyExpireAt ? new Date(post.bountyExpireAt).toLocaleString("zh-CN") : "-"}
                </span>
                {post.bountySettledAt ? (
                  <span className="text-sm text-slate-600">
                    结算 {new Date(post.bountySettledAt).toLocaleString("zh-CN")}
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
        <div className="flex gap-4 pt-4 border-t" style={{ borderColor: "var(--border-light)" }}>
          <span className="post-item-stat">
            <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {post.viewCount || 0} 浏览
          </span>
          <button type="button" className="post-item-stat" onClick={() => void togglePostLike()}>
            <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
            </svg>
            {post.likeCount || 0} 点赞{post.liked ? " (已赞)" : ""}
          </button>
          <button type="button" className="post-item-stat" onClick={() => void togglePostFavorite()}>
            <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            {post.collectCount || 0} 收藏{post.collected ? " (已收藏)" : ""}
          </button>
          <button type="button" className="post-item-stat" onClick={() => void reportPost()}>
            举报帖子
          </button>
        </div>
      </section>
    </>
  );
}
