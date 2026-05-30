"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { readError } from "@/components/post/client-helpers";
import { TagPicker } from "@/components/post/tag-picker";
import {
  useDeletePostMutation,
  useReportPostMutation,
  useUpdatePostMutation,
} from "@/components/post/use-post-mutations";
import {
  usePostCommentsQuery,
  usePostDetailQuery,
} from "@/components/post/use-post-queries";
import {
  useCategoriesQuery,
  useTagsQuery,
} from "@/components/post/use-taxonomy-queries";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import styles from "./post-author-actions.module.css";

type Props = {
  postId: string;
};

const editPostSchema = z
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
    }
  });

type EditPostValues = z.infer<typeof editPostSchema>;

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

export function PostAuthorActions({ postId }: Props) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteRequestDialogOpen, setDeleteRequestDialogOpen] = useState(false);
  const [deleteRequestReason, setDeleteRequestReason] = useState("");

  const postQuery = usePostDetailQuery(postId);
  const commentsQuery = usePostCommentsQuery(postId);
  const post = postQuery.data;
  const comments = commentsQuery.data ?? [];

  const categoriesQuery = useCategoriesQuery(post?.postType || "NORMAL");
  const tagsQuery = useTagsQuery("");
  const updatePostMutation = useUpdatePostMutation(postId);
  const deletePostMutation = useDeletePostMutation(postId);
  const reportPostMutation = useReportPostMutation(postId);
  const form = useForm<EditPostValues>({
    resolver: zodResolver(editPostSchema),
    defaultValues: {
      postType: "NORMAL",
      title: "",
      categoryId: "",
      tagIds: [],
      content: "",
      hiddenContent: "",
      price: "",
      bountyAmount: "",
    },
    reValidateMode: "onChange",
    shouldFocusError: true,
  });
  const {
    control,
    handleSubmit,
    register,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = form;

  function getPostTypeLabel(type: string) {
    switch (type) {
      case "RESOURCE":
        return "资源帖";
      case "BOUNTY":
        return "悬赏帖";
      default:
        return "讨论帖";
    }
  }

  useEffect(() => {
    if (!post) return;
    reset({
      postType: post.postType,
      title: post.title || "",
      categoryId: post.categoryId ? String(post.categoryId) : "",
      tagIds: post.tags?.map((tag) => tag.id) || [],
      content: post.content || "",
      hiddenContent: post.hiddenContent || "",
      price: post.price ? String(post.price) : "",
      bountyAmount: post.bountyAmount ? String(post.bountyAmount) : "",
    });
  }, [post, reset]);

  useEffect(() => {
    if (isEditing && post) {
      setValue("postType", post.postType, { shouldValidate: true });
    }
  }, [isEditing, post, setValue]);

  if (!post) return null;

  const bountyRequiresDeleteReview =
    post.postType === "BOUNTY" &&
    comments.some(
      (comment) =>
        comment.parentId == null &&
        !comment.deleted &&
        comment.authorId !== post.authorId,
    );

  async function submitUpdate(data: EditPostValues) {
    try {
      await updatePostMutation.mutateAsync({
        title: data.title,
        categoryId: Number(data.categoryId),
        tagIds: data.tagIds,
        content: data.content,
        hiddenContent: data.hiddenContent,
        price: data.postType === "RESOURCE" ? Number(data.price) : null,
        bountyAmount:
          data.postType === "BOUNTY" ? Number(data.bountyAmount) : null,
      });
      toast.success("更新成功");
      setIsEditing(false);
    } catch (error) {
      toast.error(readError(error));
    }
  }

  async function deletePost() {
    try {
      await deletePostMutation.mutateAsync();
      setDeleteDialogOpen(false);
      toast.success("帖子已删除");
      router.replace("/");
      router.refresh();
    } catch (error) {
      toast.error(readError(error));
    }
  }

  async function submitDeleteRequest() {
    const detail = deleteRequestReason.trim();
    if (!detail) {
      return;
    }

    try {
      await reportPostMutation.mutateAsync({
        reason: "AUTHOR_DELETE_REQUEST",
        detail,
      });
      setDeleteRequestDialogOpen(false);
      setDeleteRequestReason("");
      toast.success("删除申请已提交，请等待管理员处理");
    } catch (error) {
      toast.error(readError(error));
    }
  }

  return (
    <>
      <section className={`card ${styles.card}`}>
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>AUTHOR TOOLS</p>
            <h2 className="section-title">作者操作</h2>
          </div>
          <div className={styles.toolbar}>
            <button
              type="button"
              className={`btn btn-ghost ${isEditing ? styles.toolActive : ""}`}
              onClick={() => setIsEditing((value) => !value)}
            >
              {isEditing ? "收起编辑" : "编辑帖子"}
            </button>
            {bountyRequiresDeleteReview ? (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => setDeleteRequestDialogOpen(true)}
              >
                申请删除
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => setDeleteDialogOpen(true)}
              >
                删除帖子
              </button>
            )}
          </div>
        </div>

        {isEditing ? (
          <form
            noValidate
            onSubmit={(event) => void handleSubmit(submitUpdate)(event)}
            className={styles.editor}
          >
            <input
              type="hidden"
              {...register("postType")}
              value={post.postType}
              readOnly
            />

            <div className={styles.editorHead}>
              <div>
                <h3 className={styles.editorTitle}>编辑内容</h3>
                <p className={styles.editorCopy}>
                  在同一块区域完成内容维护，保存后直接回到作者操作概览。
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              <Field data-invalid={!!errors.title || undefined}>
                <FieldLabel htmlFor="edit-title">标题</FieldLabel>
                <Input
                  id="edit-title"
                  aria-invalid={!!errors.title}
                  {...register("title")}
                />
                {errors.title?.message ? (
                  <FieldError>{errors.title.message}</FieldError>
                ) : null}
              </Field>

              <Field data-invalid={!!errors.categoryId || undefined}>
                <FieldLabel htmlFor="edit-categoryId">分类</FieldLabel>
                <Select
                  id="edit-categoryId"
                  aria-invalid={!!errors.categoryId}
                  {...register("categoryId")}
                >
                  <option value="">请选择分类</option>
                  {(categoriesQuery.data ?? []).map((category) => (
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
                      tags={tagsQuery.data ?? []}
                      selectedTagIds={field.value}
                      onChange={field.onChange}
                    />
                    {errors.tagIds?.message ? (
                      <FieldError>{errors.tagIds.message}</FieldError>
                    ) : null}
                  </Field>
                )}
              />

              <Controller
                name="content"
                control={control}
                render={({ field }) => (
                  <Field data-invalid={!!errors.content || undefined}>
                    <FieldLabel>正文</FieldLabel>
                    <RichTextEditor
                      value={field.value}
                      onChange={field.onChange}
                      invalid={!!errors.content}
                    />
                    {errors.content?.message ? (
                      <FieldError>{errors.content.message}</FieldError>
                    ) : null}
                  </Field>
                )}
              />

              {post.postType === "RESOURCE" ? (
                <>
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
                          minHeightClassName="min-h-[160px]"
                          invalid={!!errors.hiddenContent}
                        />
                        {errors.hiddenContent?.message ? (
                          <FieldError>{errors.hiddenContent.message}</FieldError>
                        ) : null}
                      </Field>
                    )}
                  />
                  <Field data-invalid={!!errors.price || undefined}>
                    <FieldLabel htmlFor="edit-price">售价</FieldLabel>
                    <Input
                      id="edit-price"
                      type="number"
                      min="1"
                      max="1000000"
                      step="1"
                      aria-invalid={!!errors.price}
                      {...register("price")}
                    />
                    {errors.price?.message ? (
                      <FieldError>{errors.price.message}</FieldError>
                    ) : null}
                  </Field>
                </>
              ) : null}

              {post.postType === "BOUNTY" ? (
                <>
                  <Field data-invalid={!!errors.bountyAmount || undefined}>
                    <FieldLabel htmlFor="edit-bountyAmount">悬赏金额</FieldLabel>
                    <Input
                      id="edit-bountyAmount"
                      type="number"
                      min="1"
                      max="1000000"
                      step="1"
                      aria-invalid={!!errors.bountyAmount}
                      {...register("bountyAmount")}
                    />
                    {errors.bountyAmount?.message ? (
                      <FieldError>{errors.bountyAmount.message}</FieldError>
                    ) : null}
                  </Field>
                </>
              ) : null}

              <div className={styles.submitRow}>
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={updatePostMutation.isPending || isSubmitting}
                >
                  {updatePostMutation.isPending || isSubmitting
                    ? "保存中..."
                    : "保存修改"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setIsEditing(false)}
                >
                  取消
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className={styles.summary}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>内容类型</span>
              <strong>{getPostTypeLabel(post.postType)}</strong>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>最近更新</span>
              <strong>{new Date(post.updatedAt).toLocaleString("zh-CN")}</strong>
            </div>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={deleteDialogOpen}
        title="确认删除帖子"
        description="删除后帖子内容、评论入口和详情页访问都会失效，且无法恢复。请确认继续。"
        confirmLabel="确认删除"
        confirmBusy={deletePostMutation.isPending}
        onConfirm={() => void deletePost()}
        onOpenChange={setDeleteDialogOpen}
      />

      <ConfirmDialog
        open={deleteRequestDialogOpen}
        title="申请删除悬赏帖"
        description="已有用户参与回答的悬赏帖不能直接删除。请填写原因，提交后由管理员处理。"
        confirmLabel="提交申请"
        confirmDisabled={!deleteRequestReason.trim()}
        confirmBusy={reportPostMutation.isPending}
        onConfirm={() => void submitDeleteRequest()}
        onOpenChange={(open) => {
          setDeleteRequestDialogOpen(open);
          if (!open) {
            setDeleteRequestReason("");
          }
        }}
      >
        <div className="confirm-dialog-form">
          <label className="confirm-dialog-field">
            <span>申请原因</span>
            <textarea
              className="confirm-dialog-textarea"
              value={deleteRequestReason}
              onChange={(event) => setDeleteRequestReason(event.target.value)}
              placeholder="请说明为什么需要删除该悬赏帖"
              rows={4}
              maxLength={300}
              autoFocus
            />
          </label>
        </div>
      </ConfirmDialog>
    </>
  );
}
