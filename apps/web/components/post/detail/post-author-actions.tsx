"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { readError } from "@/components/post/client-helpers";
import { TagPicker } from "@/components/post/tag-picker";
import {
  useDeletePostMutation,
  useUpdatePostMutation,
} from "@/components/post/use-post-mutations";
import { usePostDetailQuery } from "@/components/post/use-post-queries";
import {
  useCategoriesQuery,
  useTagsQuery,
} from "@/components/post/use-taxonomy-queries";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/select";

type Props = {
  postId: string;
};

export function PostAuthorActions({ postId }: Props) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [content, setContent] = useState("");
  const [hiddenContent, setHiddenContent] = useState("");
  const [price, setPrice] = useState("");
  const [bountyAmount, setBountyAmount] = useState("");
  const [bountyExpireAt, setBountyExpireAt] = useState("");

  const postQuery = usePostDetailQuery(postId);
  const post = postQuery.data;

  const categoriesQuery = useCategoriesQuery(post?.postType || "NORMAL");
  const tagsQuery = useTagsQuery("");
  const updatePostMutation = useUpdatePostMutation(postId);
  const deletePostMutation = useDeletePostMutation(postId);

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

  function getPostStatusLabel(status: string) {
    switch (status) {
      case "PUBLISHED":
        return "已发布";
      case "CLOSED":
        return "已关闭";
      case "OFFLINE":
        return "已下架";
      case "DELETED":
        return "已删除";
      default:
        return status;
    }
  }

  function formatDateTimeInput(value?: string | null) {
    return value ? value.slice(0, 16) : "";
  }

  useEffect(() => {
    if (!post) return;
    setTitle(post.title || "");
    setCategoryId(post.categoryId ? String(post.categoryId) : "");
    setSelectedTagIds(post.tags?.map((tag) => tag.id) || []);
    setContent(post.content || "");
    setHiddenContent(post.hiddenContent || "");
    setPrice(post.price ? String(post.price) : "");
    setBountyAmount(post.bountyAmount ? String(post.bountyAmount) : "");
    setBountyExpireAt(formatDateTimeInput(post.bountyExpireAt));
  }, [post]);

  if (!post) return null;

  async function submitUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await updatePostMutation.mutateAsync({
        title,
        categoryId: Number(categoryId),
        tagIds: selectedTagIds,
        content,
        hiddenContent,
        price: price ? Number(price) : null,
        bountyAmount: bountyAmount ? Number(bountyAmount) : null,
        bountyExpireAt: bountyExpireAt || null,
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

  return (
    <>
      <section className="card author-actions-card">
        <div className="author-actions-header">
          <div>
            <p className="author-actions-eyebrow">AUTHOR TOOLS</p>
            <h2 className="section-title">作者操作</h2>
          </div>
          <div className="author-actions-toolbar">
            <button
              type="button"
              className={`btn btn-ghost ${isEditing ? "author-tool-active" : ""}`}
              onClick={() => setIsEditing((value) => !value)}
            >
              {isEditing ? "收起编辑" : "编辑帖子"}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => setDeleteDialogOpen(true)}
            >
              删除帖子
            </button>
          </div>
        </div>

        {isEditing ? (
          <form onSubmit={submitUpdate} className="author-actions-editor">
            <div className="author-actions-editor-head">
              <div>
                <h3 className="author-actions-editor-title">编辑内容</h3>
                <p className="author-actions-editor-copy">
                  在同一块区域完成内容维护，保存后直接回到作者操作概览。
                </p>
              </div>
            </div>

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

              <div className="form-group">
                <label className="form-label">分类</label>
                <Select
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  {(categoriesQuery.data ?? []).map((category) => (
                    <option key={category.id} value={String(category.id)}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="form-group">
                <label className="form-label">标签</label>
                <TagPicker
                  tags={tagsQuery.data ?? []}
                  selectedTagIds={selectedTagIds}
                  onChange={setSelectedTagIds}
                />
              </div>

              <div className="form-group">
                <label className="form-label">正文</label>
                <RichTextEditor value={content} onChange={setContent} />
              </div>

              {post.postType === "RESOURCE" ? (
                <>
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
              ) : null}

              {post.postType === "BOUNTY" ? (
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
              ) : null}

              <div className="author-actions-submit-row">
                <button className="btn btn-primary" type="submit">
                  保存修改
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
          <div className="author-actions-summary">
            <div className="author-actions-summary-item">
              <span className="author-actions-summary-label">当前状态</span>
              <strong>{getPostStatusLabel(post.status)}</strong>
            </div>
            <div className="author-actions-summary-item">
              <span className="author-actions-summary-label">内容类型</span>
              <strong>{getPostTypeLabel(post.postType)}</strong>
            </div>
            <div className="author-actions-summary-item">
              <span className="author-actions-summary-label">最近更新</span>
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
    </>
  );
}
