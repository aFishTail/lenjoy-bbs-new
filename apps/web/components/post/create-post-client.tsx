"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { readError } from "@/components/post/client-helpers";
import { TagPicker } from "@/components/post/tag-picker";
import { useCreatePostMutation } from "@/components/post/use-post-mutations";
import type { CreatePostInput } from "@/components/post/use-post-mutations";
import { useCategoriesQuery, useTagsQuery } from "@/components/post/use-taxonomy-queries";
import { useAuth } from "@/components/providers/auth-provider";
import { Select } from "@/components/ui/select";

const postTypeOptions = [
  { value: "NORMAL", label: "普通帖", desc: "讨论、分享、提问" },
  { value: "RESOURCE", label: "资源帖", desc: "售卖资源和隐藏内容" },
  { value: "BOUNTY", label: "悬赏帖", desc: "带赏金的问题求助" },
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
  const { authData: auth, hasAuth, authReady } = useAuth();

  const [postType, setPostType] = useState<"NORMAL" | "RESOURCE" | "BOUNTY">(
    "NORMAL",
  );
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [content, setContent] = useState("");
  const [hiddenContent, setHiddenContent] = useState("");
  const [price, setPrice] = useState("");
  const [bountyAmount, setBountyAmount] = useState("");
  const [bountyExpireAt, setBountyExpireAt] = useState("");

  const createPostMutation = useCreatePostMutation();
  const categoriesQuery = useCategoriesQuery(postType);
  const tagsQuery = useTagsQuery("");
  const categories = categoriesQuery.data ?? [];
  const tags = tagsQuery.data ?? [];

  const submitting = createPostMutation.isPending;

  useEffect(() => {
    if (authReady && !hasAuth) {
      router.replace("/auth");
    }
  }, [authReady, hasAuth, router]);

  useEffect(() => {
    if (!categories.length) {
      setCategoryId("");
      return;
    }
    if (!categories.some((item) => String(item.id) === categoryId)) {
      setCategoryId(String(categories[0].id));
    }
  }, [categories, categoryId]);

  const selectedTags = useMemo(
    () => tags.filter((tag) => selectedTagIds.includes(tag.id)),
    [selectedTagIds, tags],
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      toast.error("请输入标题");
      return;
    }

    if (!categoryId) {
      toast.error("请选择分类");
      return;
    }

    if (isRichTextEmpty(content)) {
      toast.error("请输入正文");
      return;
    }

    if (postType === "RESOURCE" && isRichTextEmpty(hiddenContent)) {
      toast.error("请填写资源隐藏内容");
      return;
    }

    if (postType === "RESOURCE" && !price) {
      toast.error("请设置资源售价");
      return;
    }

    if (postType === "BOUNTY" && !bountyAmount) {
      toast.error("请设置悬赏金额");
      return;
    }

    if (postType === "BOUNTY" && !bountyExpireAt) {
      toast.error("请设置截止时间");
      return;
    }

    try {
      const request: CreatePostInput = {
        postType,
        title: title.trim(),
        categoryId: Number(categoryId),
        tagIds: selectedTagIds,
        content,
        hiddenContent: isRichTextEmpty(hiddenContent)
          ? undefined
          : hiddenContent,
        price: price ? parseInt(price, 10) : undefined,
        bountyAmount: bountyAmount ? parseInt(bountyAmount, 10) : undefined,
        bountyExpireAt: bountyExpireAt || undefined,
      };

      const payload = await createPostMutation.mutateAsync(request);
      toast.success("发布成功");
      setTimeout(() => {
        router.push(`/posts/${payload.id}`);
      }, 800);
    } catch (error) {
      toast.error(readError(error));
    }
  }

  if (!auth && (!authReady || hasAuth)) {
    return (
      <main className="page">
        <div className="text-center py-12 text-[var(--text-sub)]">
          正在检查登录状态...
        </div>
      </main>
    );
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
      <div className="max-w-3xl mx-auto px-4">
        <div className="mb-8 text-center">
          <h1
            className="text-3xl font-bold text-[var(--text-main)] mb-2"
            style={{ fontFamily: "'Newsreader', serif" }}
          >
            发布新帖子
          </h1>
          <p className="text-[var(--text-muted)]">分类负责归档，标签负责话题表达</p>
        </div>

        <form onSubmit={(event) => void onSubmit(event)} className="space-y-6">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[var(--border-light)] shadow-[var(--shadow-md)]">
            <label className="block text-sm font-medium text-[var(--text-sub)] mb-4">
              帖子类型
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {postTypeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPostType(option.value)}
                  className={`relative p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                    postType === option.value
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                      : "border-[var(--border-light)] hover:border-[var(--color-primary-light)]"
                  }`}
                >
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

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[var(--border-light)] shadow-[var(--shadow-md)] space-y-4">
            <div>
              <label
                className="block text-sm font-medium text-[var(--text-sub)] mb-3"
                htmlFor="title"
              >
                标题
              </label>
              <input
                id="title"
                className="w-full px-4 py-3 rounded-xl border border-[var(--border-medium)] bg-white/50 text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                required
                placeholder="请输入标题"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-sub)] mb-3">
                分类
              </label>
              <Select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                {categories.map((category) => (
                  <option key={category.id} value={String(category.id)}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-sub)] mb-3">
                标签
              </label>
              <TagPicker
                tags={tags}
                selectedTagIds={selectedTagIds}
                onChange={setSelectedTagIds}
              />
              {selectedTags.length > 0 ? (
                <div className="mt-3 text-xs text-[var(--text-muted)]">
                  已选：{selectedTags.map((tag) => tag.name).join(" / ")}
                </div>
              ) : null}
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[var(--border-light)] shadow-[var(--shadow-md)]">
            <label className="block text-sm font-medium text-[var(--text-sub)] mb-3">
              正文
            </label>
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="详细描述帖子内容..."
            />
          </div>

          {postType === "RESOURCE" && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[var(--border-light)] shadow-[var(--shadow-md)] space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-sub)] mb-2">
                  隐藏内容
                </label>
                <RichTextEditor
                  value={hiddenContent}
                  onChange={setHiddenContent}
                  placeholder="下载链接、提取码、使用说明等"
                  minHeightClassName="min-h-[160px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-sub)] mb-2">
                  售价
                </label>
                <input
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border-medium)] bg-white/50 text-[var(--text-main)]"
                  type="number"
                  step="1"
                  min="1"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
            </div>
          )}

          {postType === "BOUNTY" && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[var(--border-light)] shadow-[var(--shadow-md)] space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-sub)] mb-2">
                  悬赏金额
                </label>
                <input
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border-medium)] bg-white/50 text-[var(--text-main)]"
                  type="number"
                  step="1"
                  min="1"
                  value={bountyAmount}
                  onChange={(e) => setBountyAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-sub)] mb-2">
                  截止时间
                </label>
                <input
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border-medium)] bg-white/50 text-[var(--text-main)]"
                  type="datetime-local"
                  value={bountyExpireAt}
                  onChange={(e) => setBountyExpireAt(e.target.value)}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 px-6 rounded-xl font-medium text-white bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] hover:shadow-[var(--shadow-primary)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "发布中..." : "发布帖子"}
          </button>

        </form>
      </div>
    </main>
  );
}
