"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { readError } from "@/components/post/client-helpers";
import { useCreatePostMutation } from "@/components/post/use-post-mutations";
import type { CreatePostInput } from "@/components/post/use-post-mutations";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { useAuth } from "@/components/providers/auth-provider";

const postTypeOptions = [
  {
    value: "NORMAL",
    label: "普通帖子",
    icon: "M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1m2 13a2 2 0 0 1-2-2V7m2 13a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2",
    desc: "分享想法、讨论问题",
  },
  {
    value: "RESOURCE",
    label: "资源出售",
    icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
    desc: "出售文档、源码、素材",
  },
  {
    value: "BOUNTY",
    label: "悬赏求助",
    icon: "M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
    desc: "付费寻求帮助解答",
  },
] as const;

function isRichTextEmpty(value: string) {
  const plain = value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return !plain;
}

export function CreatePostClient() {
  const router = useRouter();
  const { authData: auth, hasAuth } = useAuth();
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");

  const [postType, setPostType] = useState<"NORMAL" | "RESOURCE" | "BOUNTY">(
    "NORMAL",
  );
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [hiddenContent, setHiddenContent] = useState("");
  const [price, setPrice] = useState("");
  const [bountyAmount, setBountyAmount] = useState("");
  const [bountyExpireAt, setBountyExpireAt] = useState("");

  const createPostMutation = useCreatePostMutation();

  const submitting = createPostMutation.isPending;

  useEffect(() => {
    // If auth is null upon mount, auth might not be loaded yet, OR it's truly unauthenticated.
    // getStoredAuth() can be checked synchronously for immediate redirection.
    // However, since we rely on Context, auth starts as null, then populates.
    // But if auth is explicitly verified as missing (e.g. from local storage), redirect.
    if (typeof window !== "undefined") {
      const storedAuth = localStorage.getItem("lenjoy.auth");
      if (!storedAuth) {
        router.push("/auth");
      }
    }
  }, [router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      setErrorText("请输入标题");
      return;
    }

    if (isRichTextEmpty(content)) {
      setErrorText("请输入内容");
      return;
    }

    if (postType === "RESOURCE" && isRichTextEmpty(hiddenContent)) {
      setErrorText("请填写付费内容");
      return;
    }

    if (postType === "RESOURCE" && !price) {
      setErrorText("请设置资源价格");
      return;
    }

    if (postType === "BOUNTY" && !bountyAmount) {
      setErrorText("请设置悬赏金额");
      return;
    }

    if (postType === "BOUNTY" && !bountyExpireAt) {
      setErrorText("请设置悬赏截止时间");
      return;
    }

    setErrorText("");
    setSuccessText("");

    try {
      const request: CreatePostInput = {
        postType,
        title: title.trim(),
        content,
        hiddenContent: isRichTextEmpty(hiddenContent)
          ? undefined
          : hiddenContent,
        price: price ? parseFloat(price) : undefined,
        bountyAmount: bountyAmount ? parseInt(bountyAmount, 10) : undefined,
        bountyExpireAt: bountyExpireAt || undefined,
      };
      if (postType === "RESOURCE") {
        request.price = price ? parseInt(price, 10) : undefined;
      }

      const payload = await createPostMutation.mutateAsync(request);
      setSuccessText("发布成功！");
      setTimeout(() => {
        router.push(`/posts/${payload.id}`);
      }, 1000);
    } catch (error) {
      setErrorText(readError(error));
    }
  }

  if (!auth) {
    return (
      <main className="page">
        <div className="text-center py-12 text-[var(--text-sub)]">
          正在跳转到登录页...
        </div>
      </main>
    );
  }

  return (
    <main className="page min-h-[calc(100vh-80px)] py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1
            className="text-3xl font-bold text-[var(--text-main)] mb-2"
            style={{ fontFamily: "'Newsreader', serif" }}
          >
            发布新帖子
          </h1>
          <p className="text-[var(--text-muted)]">分享你的想法、资源或问题</p>
        </div>

        <form onSubmit={(event) => void onSubmit(event)} className="space-y-6">
          {/* 帖子类型选择 - 标签式设计 */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[var(--border-light)] shadow-[var(--shadow-md)]">
            <label className="block text-sm font-medium text-[var(--text-sub)] mb-4">
              选择帖子类型
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {postTypeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPostType(option.value)}
                  className={`
                    relative p-4 rounded-xl border-2 transition-all duration-200 text-left
                    ${
                      postType === option.value
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5 shadow-[var(--shadow-primary)]"
                        : "border-[var(--border-light)] hover:border-[var(--color-primary-light)] hover:bg-[var(--color-primary)]/5"
                    }
                  `}
                >
                  {postType === option.value && (
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[var(--color-primary)]" />
                  )}
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${postType === option.value ? "bg-[var(--color-primary)] text-white" : "bg-[var(--border-light)] text-[var(--text-sub)]"}`}
                  >
                    <svg
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d={option.icon} />
                    </svg>
                  </div>
                  <div className="font-medium text-[var(--text-main)]">
                    {option.label}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">
                    {option.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 标题 */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[var(--border-light)] shadow-[var(--shadow-md)]">
            <label
              className="block text-sm font-medium text-[var(--text-sub)] mb-3"
              htmlFor="title"
            >
              标题 <span className="text-[var(--color-danger)]">*</span>
            </label>
            <input
              id="title"
              className="w-full px-4 py-3 rounded-xl border border-[var(--border-medium)] bg-white/50 text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
              required
              placeholder="请输入有吸引力的标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* 内容 */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[var(--border-light)] shadow-[var(--shadow-md)]">
            <label
              className="block text-sm font-medium text-[var(--text-sub)] mb-3"
              htmlFor="content"
            >
              内容 <span className="text-[var(--color-danger)]">*</span>
            </label>
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="详细描述你的内容..."
            />
          </div>

          {/* 资源帖专属字段 */}
          {postType === "RESOURCE" && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[var(--border-light)] shadow-[var(--shadow-md)] space-y-4">
              <div className="flex items-center gap-2 text-[var(--color-primary)] font-medium">
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
                资源设置
              </div>

              <div>
                <label
                  className="block text-sm font-medium text-[var(--text-sub)] mb-2"
                  htmlFor="hiddenContent"
                >
                  付费内容（购买后可见）
                </label>
                <RichTextEditor
                  value={hiddenContent}
                  onChange={setHiddenContent}
                  placeholder="设置付费可见的内容，如下载链接、验证码等..."
                  minHeightClassName="min-h-[160px]"
                />
              </div>

              <div>
                <label
                  className="block text-sm font-medium text-[var(--text-sub)] mb-2"
                  htmlFor="price"
                >
                  售价 (金币){" "}
                  <span className="text-[var(--color-danger)]">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                    币
                  </span>
                  <input
                    id="price"
                    className="w-full pl-8 pr-4 py-3 rounded-xl border border-[var(--border-medium)] bg-white/50 text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                    type="number"
                    step="1"
                    min="1"
                    placeholder="1"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 悬赏帖专属字段 */}
          {postType === "BOUNTY" && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[var(--border-light)] shadow-[var(--shadow-md)]">
              <div className="flex items-center gap-2 text-[var(--color-primary)] font-medium mb-4">
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                </svg>
                悬赏设置
              </div>
              <div>
                <label
                  className="block text-sm font-medium text-[var(--text-sub)] mb-2"
                  htmlFor="bountyAmount"
                >
                  悬赏金额 (金币){" "}
                  <span className="text-[var(--color-danger)]">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                    币
                  </span>
                  <input
                    id="bountyAmount"
                    className="w-full pl-8 pr-4 py-3 rounded-xl border border-[var(--border-medium)] bg-white/50 text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                    type="number"
                    step="1"
                    min="1"
                    placeholder="100"
                    value={bountyAmount}
                    onChange={(e) => setBountyAmount(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-4">
                <label
                  className="block text-sm font-medium text-[var(--text-sub)] mb-2"
                  htmlFor="bountyExpireAt"
                >
                  截止时间 <span className="text-[var(--color-danger)]">*</span>
                </label>
                <input
                  id="bountyExpireAt"
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border-medium)] bg-white/50 text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                  type="datetime-local"
                  value={bountyExpireAt}
                  onChange={(e) => setBountyExpireAt(e.target.value)}
                />
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  发布成功后系统会立即冻结对应金币，到期未采纳会自动退回。
                </p>
              </div>
            </div>
          )}

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 px-6 rounded-xl font-medium text-white bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] hover:shadow-[var(--shadow-primary)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                发布中...
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
                发布帖子
              </>
            )}
          </button>

          {/* 错误/成功提示 */}
          {errorText && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700">
              <svg
                className="w-5 h-5 flex-shrink-0"
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
            <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200 text-green-700">
              <svg
                className="w-5 h-5 flex-shrink-0"
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
        </form>

        {/* 返回链接 */}
        <div className="text-center mt-8">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-[var(--text-sub)] hover:text-[var(--color-primary)] transition-colors"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            返回首页
          </a>
        </div>
      </div>
    </main>
  );
}
