"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { SendIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { readError } from "@/components/post/client-helpers";
import { TagPicker } from "@/components/post/tag-picker";
import type { CreatePostInput } from "@/components/post/use-post-mutations";
import { useCreatePostMutation } from "@/components/post/use-post-mutations";
import {
  useCategoriesQuery,
  useTagsQuery,
} from "@/components/post/use-taxonomy-queries";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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
        <div className="py-12 text-center text-[var(--text-sub)]">
          正在检查登录状态...
        </div>
      </main>
    );
  }

  if (!auth) {
    return (
      <main className="page">
        <div className="py-12 text-center text-[var(--text-sub)]">
          正在跳转到登录页...
        </div>
      </main>
    );
  }

  return (
    <main className="page min-h-[calc(100vh-80px)] py-8">
      <div className="mx-auto max-w-3xl px-4">
        <div className="mb-8 text-center">
          <h1
            className="mb-2 text-3xl font-bold text-[var(--text-main)]"
            style={{ fontFamily: "'Newsreader', serif" }}
          >
            发布新帖子
          </h1>
          <p className="text-[var(--text-muted)]">
            分类负责归档，标签负责话题表达
          </p>
        </div>

        <form onSubmit={(event) => void onSubmit(event)}>
          <FieldGroup className="gap-6">
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="p-6">
                <Field>
                  <FieldLabel>帖子类型</FieldLabel>
                  <ToggleGroup
                    type="single"
                    value={postType}
                    onValueChange={(value) => {
                      if (value) {
                        setPostType(
                          value as "NORMAL" | "RESOURCE" | "BOUNTY",
                        );
                      }
                    }}
                    className="grid grid-cols-1 gap-3 sm:grid-cols-3"
                  >
                    {postTypeOptions.map((option) => (
                      <ToggleGroupItem
                        key={option.value}
                        value={option.value}
                        className="h-auto flex-col items-start rounded-xl p-4 text-left"
                      >
                        <span className="font-medium">{option.label}</span>
                        <span className="mt-1 text-xs text-slate-500">
                          {option.desc}
                        </span>
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </Field>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="p-6">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="title">标题</FieldLabel>
                    <Input
                      id="title"
                      required
                      placeholder="请输入标题"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="categoryId">分类</FieldLabel>
                    <Select
                      id="categoryId"
                      value={categoryId}
                      onChange={(event) => setCategoryId(event.target.value)}
                    >
                      {categories.map((category) => (
                        <option key={category.id} value={String(category.id)}>
                          {category.name}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel>标签</FieldLabel>
                    <TagPicker
                      tags={tags}
                      selectedTagIds={selectedTagIds}
                      onChange={setSelectedTagIds}
                    />
                    {selectedTags.length > 0 ? (
                      <FieldDescription>
                        已选：{selectedTags.map((tag) => tag.name).join(" / ")}
                      </FieldDescription>
                    ) : null}
                  </Field>
                </FieldGroup>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="p-6">
                <Field>
                  <FieldLabel>正文</FieldLabel>
                  <RichTextEditor
                    value={content}
                    onChange={setContent}
                    placeholder="详细描述帖子内容..."
                  />
                </Field>
              </CardContent>
            </Card>

            {postType === "RESOURCE" && (
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardContent className="p-6">
                  <FieldGroup>
                    <Field>
                      <FieldLabel>隐藏内容</FieldLabel>
                      <RichTextEditor
                        value={hiddenContent}
                        onChange={setHiddenContent}
                        placeholder="下载链接、提取码、使用说明等"
                        minHeightClassName="min-h-[160px]"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="price">售价</FieldLabel>
                      <Input
                        id="price"
                        type="number"
                        step="1"
                        min="1"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                      />
                    </Field>
                  </FieldGroup>
                </CardContent>
              </Card>
            )}

            {postType === "BOUNTY" && (
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardContent className="p-6">
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="bountyAmount">
                        悬赏金额
                      </FieldLabel>
                      <Input
                        id="bountyAmount"
                        type="number"
                        step="1"
                        min="1"
                        value={bountyAmount}
                        onChange={(e) => setBountyAmount(e.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="bountyExpireAt">
                        截止时间
                      </FieldLabel>
                      <Input
                        id="bountyExpireAt"
                        type="datetime-local"
                        value={bountyExpireAt}
                        onChange={(e) => setBountyExpireAt(e.target.value)}
                      />
                    </Field>
                  </FieldGroup>
                </CardContent>
              </Card>
            )}

            <Button type="submit" disabled={submitting} className="w-full">
              <SendIcon data-icon="inline-start" />
              {submitting ? "发布中..." : "发布帖子"}
            </Button>
          </FieldGroup>
        </form>
      </div>
    </main>
  );
}
