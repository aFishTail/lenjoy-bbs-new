"use client";

import { useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { SendIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
  FieldError,
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

const postFormSchema = z
  .object({
    postType: z.enum(["NORMAL", "RESOURCE", "BOUNTY"]),
    title: z
      .string()
      .trim()
      .min(1, "请输入标题")
      .max(255, "标题不能超过 255 个字符"),
    categoryId: z.string().min(1, "请选择分类"),
    tagIds: z.array(z.number()).max(5, "最多选择 5 个标签"),
    content: z.string().max(20_000, "正文不能超过 20000 个字符"),
    hiddenContent: z.string().max(20_000, "隐藏内容不能超过 20000 个字符"),
    price: z.string(),
    bountyAmount: z.string(),
    bountyExpireAt: z.string(),
  })
  .superRefine((values, ctx) => {
    if (isRichTextEmpty(values.content)) {
      ctx.addIssue({
        code: "custom",
        path: ["content"],
        message: "请输入正文",
      });
    }

    if (values.postType === "RESOURCE") {
      if (isRichTextEmpty(values.hiddenContent)) {
        ctx.addIssue({
          code: "custom",
          path: ["hiddenContent"],
          message: "请填写资源隐藏内容",
        });
      }
      validatePositiveInteger(values.price, ["price"], "请设置资源售价", ctx);
    }

    if (values.postType === "BOUNTY") {
      validatePositiveInteger(
        values.bountyAmount,
        ["bountyAmount"],
        "请设置悬赏金额",
        ctx,
      );
      if (!values.bountyExpireAt) {
        ctx.addIssue({
          code: "custom",
          path: ["bountyExpireAt"],
          message: "请设置截止时间",
        });
      }
    }
  });

type PostFormValues = z.infer<typeof postFormSchema>;

function isRichTextEmpty(value: string) {
  const plain = value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return !plain;
}

function validatePositiveInteger(
  value: string,
  path: (string | number)[],
  requiredMessage: string,
  ctx: z.RefinementCtx,
) {
  const normalized = value.trim();
  if (!normalized) {
    ctx.addIssue({ code: "custom", path, message: requiredMessage });
    return;
  }
  if (!/^\d+$/.test(normalized)) {
    ctx.addIssue({ code: "custom", path, message: "请输入整数" });
    return;
  }
  const parsed = Number(normalized);
  if (parsed < 1 || parsed > 1_000_000) {
    ctx.addIssue({
      code: "custom",
      path,
      message: "请输入 1 到 1000000 之间的整数",
    });
  }
}

export function CreatePostClient() {
  const router = useRouter();
  const { authData: auth, hasAuth, authReady } = useAuth();

  const createPostMutation = useCreatePostMutation();
  const form = useForm<PostFormValues>({
    resolver: zodResolver(postFormSchema),
    defaultValues: {
      postType: "NORMAL",
      title: "",
      categoryId: "",
      tagIds: [],
      content: "",
      hiddenContent: "",
      price: "",
      bountyAmount: "",
      bountyExpireAt: "",
    },
    reValidateMode: "onChange",
    shouldFocusError: true,
  });

  const {
    control,
    handleSubmit,
    register,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = form;

  const postType = watch("postType");
  const categoryId = watch("categoryId");
  const selectedTagIds = watch("tagIds");
  const categoriesQuery = useCategoriesQuery(postType);
  const tagsQuery = useTagsQuery("");
  const categories = categoriesQuery.data ?? [];
  const tags = tagsQuery.data ?? [];

  const submitting = createPostMutation.isPending || isSubmitting;

  useEffect(() => {
    if (authReady && !hasAuth) {
      router.replace("/auth");
    }
  }, [authReady, hasAuth, router]);

  useEffect(() => {
    if (!categories.length) {
      setValue("categoryId", "");
      return;
    }
    if (!categories.some((item) => String(item.id) === categoryId)) {
      setValue("categoryId", String(categories[0].id));
    }
  }, [categories, categoryId, setValue]);

  const selectedTags = useMemo(
    () => tags.filter((tag) => selectedTagIds.includes(tag.id)),
    [selectedTagIds, tags],
  );

  async function onSubmit(data: PostFormValues) {
    try {
      const request: CreatePostInput = {
        postType: data.postType,
        title: data.title,
        categoryId: Number(data.categoryId),
        tagIds: data.tagIds,
        content: data.content,
        hiddenContent:
          data.postType === "RESOURCE" ? data.hiddenContent : undefined,
        price: data.postType === "RESOURCE" ? parseInt(data.price, 10) : undefined,
        bountyAmount:
          data.postType === "BOUNTY" ? parseInt(data.bountyAmount, 10) : undefined,
        bountyExpireAt:
          data.postType === "BOUNTY" ? data.bountyExpireAt : undefined,
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

        <form noValidate onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
          <FieldGroup className="gap-6">
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="p-6">
                <Controller
                  name="postType"
                  control={control}
                  render={({ field }) => (
                    <Field data-invalid={!!errors.postType || undefined}>
                      <FieldLabel>帖子类型</FieldLabel>
                      <ToggleGroup
                        type="single"
                        value={field.value}
                        onValueChange={(value) => {
                          if (value) {
                            field.onChange(value);
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
                      {errors.postType?.message ? (
                        <FieldError>{errors.postType.message}</FieldError>
                      ) : null}
                    </Field>
                  )}
                />
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="p-6">
                <FieldGroup>
                  <Field data-invalid={!!errors.title || undefined}>
                    <FieldLabel htmlFor="title">标题</FieldLabel>
                    <Input
                      id="title"
                      placeholder="请输入标题"
                      aria-invalid={!!errors.title}
                      {...register("title")}
                    />
                    {errors.title?.message ? (
                      <FieldError>{errors.title.message}</FieldError>
                    ) : null}
                  </Field>

                  <Field data-invalid={!!errors.categoryId || undefined}>
                    <FieldLabel htmlFor="categoryId">分类</FieldLabel>
                    <Select
                      id="categoryId"
                      aria-invalid={!!errors.categoryId}
                      {...register("categoryId")}
                    >
                      <option value="">请选择分类</option>
                      {categories.map((category) => (
                        <option key={category.id} value={String(category.id)}>
                          {category.name}
                        </option>
                      ))}
                    </Select>
                    {errors.categoryId?.message ? (
                      <FieldError>{errors.categoryId.message}</FieldError>
                    ) : null}
                  </Field>

                  <Controller
                    name="tagIds"
                    control={control}
                    render={({ field }) => (
                      <Field data-invalid={!!errors.tagIds || undefined}>
                        <FieldLabel>标签</FieldLabel>
                        <TagPicker
                          tags={tags}
                          selectedTagIds={field.value}
                          onChange={field.onChange}
                        />
                        {selectedTags.length > 0 ? (
                          <FieldDescription>
                            已选：{selectedTags.map((tag) => tag.name).join(" / ")}
                          </FieldDescription>
                        ) : null}
                        {errors.tagIds?.message ? (
                          <FieldError>{errors.tagIds.message}</FieldError>
                        ) : null}
                      </Field>
                    )}
                  />
                </FieldGroup>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="p-6">
                <Controller
                  name="content"
                  control={control}
                  render={({ field }) => (
                    <Field data-invalid={!!errors.content || undefined}>
                      <FieldLabel>正文</FieldLabel>
                      <RichTextEditor
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="详细描述帖子内容..."
                        invalid={!!errors.content}
                      />
                      {errors.content?.message ? (
                        <FieldError>{errors.content.message}</FieldError>
                      ) : null}
                    </Field>
                  )}
                />
              </CardContent>
            </Card>

            {postType === "RESOURCE" && (
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardContent className="p-6">
                  <FieldGroup>
                    <Controller
                      name="hiddenContent"
                      control={control}
                      render={({ field }) => (
                        <Field
                          data-invalid={!!errors.hiddenContent || undefined}
                        >
                          <FieldLabel>隐藏内容</FieldLabel>
                          <RichTextEditor
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="下载链接、提取码、使用说明等"
                            minHeightClassName="min-h-[160px]"
                            invalid={!!errors.hiddenContent}
                          />
                          {errors.hiddenContent?.message ? (
                            <FieldError>
                              {errors.hiddenContent.message}
                            </FieldError>
                          ) : null}
                        </Field>
                      )}
                    />
                    <Field data-invalid={!!errors.price || undefined}>
                      <FieldLabel htmlFor="price">售价</FieldLabel>
                      <Input
                        id="price"
                        type="number"
                        step="1"
                        min="1"
                        max="1000000"
                        aria-invalid={!!errors.price}
                        {...register("price")}
                      />
                      {errors.price?.message ? (
                        <FieldError>{errors.price.message}</FieldError>
                      ) : null}
                    </Field>
                  </FieldGroup>
                </CardContent>
              </Card>
            )}

            {postType === "BOUNTY" && (
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardContent className="p-6">
                  <FieldGroup>
                    <Field data-invalid={!!errors.bountyAmount || undefined}>
                      <FieldLabel htmlFor="bountyAmount">悬赏金额</FieldLabel>
                      <Input
                        id="bountyAmount"
                        type="number"
                        step="1"
                        min="1"
                        max="1000000"
                        aria-invalid={!!errors.bountyAmount}
                        {...register("bountyAmount")}
                      />
                      {errors.bountyAmount?.message ? (
                        <FieldError>{errors.bountyAmount.message}</FieldError>
                      ) : null}
                    </Field>
                    <Field data-invalid={!!errors.bountyExpireAt || undefined}>
                      <FieldLabel htmlFor="bountyExpireAt">截止时间</FieldLabel>
                      <Input
                        id="bountyExpireAt"
                        type="datetime-local"
                        aria-invalid={!!errors.bountyExpireAt}
                        {...register("bountyExpireAt")}
                      />
                      {errors.bountyExpireAt?.message ? (
                        <FieldError>{errors.bountyExpireAt.message}</FieldError>
                      ) : null}
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
