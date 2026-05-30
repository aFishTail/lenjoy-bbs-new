"use client";

import { FileText } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useAdminCategoriesQuery, useAdminPostsQuery, useAdminTagsQuery } from "@/components/admin/use-admin-queries";
import { useUpdateAdminPostStatusMutation } from "@/components/admin/use-admin-mutations";
import { readError } from "@/components/post/client-helpers";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function AdminPostsClient() {
  const [status, setStatus] = useState("");
  const [postType, setPostType] = useState("");
  const [author, setAuthor] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tagId, setTagId] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    status: "",
    postType: "",
    author: "",
    categoryId: "",
    tagId: "",
  });

  const [actionDialog, setActionDialog] = useState<{
    postId: number;
    action: "online" | "offline";
    title: string;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const postsQuery = useAdminPostsQuery(appliedFilters);
  const categoriesQuery = useAdminCategoriesQuery(postType);
  const tagsQuery = useAdminTagsQuery("");
  const updatePostStatusMutation = useUpdateAdminPostStatusMutation(appliedFilters);

  useEffect(() => {
    if (postsQuery.error) toast.error(readError(postsQuery.error));
  }, [postsQuery.error]);

  const posts = postsQuery.data ?? [];
  const loading = postsQuery.isLoading || postsQuery.isFetching;

  function openOnlineDialog(postId: number, title: string) {
    setActionDialog({ postId, action: "online", title });
    setReason("");
    setSubmitting(false);
  }

  function openOfflineDialog(postId: number, title: string) {
    setActionDialog({ postId, action: "offline", title });
    setReason("");
    setSubmitting(false);
  }

  function closeDialog() {
    setActionDialog(null);
    setReason("");
    setSubmitting(false);
  }

  async function submitAction() {
    if (!actionDialog) return;
    if (!reason.trim()) { toast.error("请填写操作原因"); return; }
    setSubmitting(true);
    try {
      await updatePostStatusMutation.mutateAsync({
        postId: actionDialog.postId,
        online: actionDialog.action === "online",
      });
      toast.success(actionDialog.action === "online" ? "帖子已上架" : "帖子已下架");
      closeDialog();
    } catch (e) { toast.error(readError(e)); setSubmitting(false); }
  }

  const typeBadgeMap: Record<string, string> = {
    RESOURCE: "is-resource",
    BOUNTY: "is-bounty",
    NORMAL: "is-normal",
  };

  const statusBadgeMap: Record<string, string> = {
    PUBLISHED: "is-active",
    OFFLINE: "is-banned",
    CLOSED: "is-muted",
    DELETED: "is-banned",
  };

  const statusLabels: Record<string, string> = {
    PUBLISHED: "已发布",
    OFFLINE: "已下架",
    CLOSED: "已关闭",
    DELETED: "已删除",
  };

  return (
    <main className="admin-main">
      <section className="admin-toolbar">
        <div className="admin-filter-grid">
          <Select
            className="admin-input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">全部状态</option>
            <option value="PUBLISHED">已发布</option>
            <option value="CLOSED">已关闭</option>
            <option value="OFFLINE">已下架</option>
            <option value="DELETED">已删除</option>
          </Select>
          <Select
            className="admin-input"
            value={postType}
            onChange={(e) => {
              setPostType(e.target.value);
              setCategoryId("");
            }}
          >
            <option value="">全部类型</option>
            <option value="NORMAL">NORMAL</option>
            <option value="RESOURCE">RESOURCE</option>
            <option value="BOUNTY">BOUNTY</option>
          </Select>
          <Select
            className="admin-input"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">全部分类</option>
            {(categoriesQuery.data ?? []).map((category) => (
              <option key={category.id} value={String(category.id)}>{category.name}</option>
            ))}
          </Select>
          <Select
            className="admin-input"
            value={tagId}
            onChange={(e) => setTagId(e.target.value)}
          >
            <option value="">全部标签</option>
            {(tagsQuery.data ?? []).map((tag) => (
              <option key={tag.id} value={String(tag.id)}>{tag.name}</option>
            ))}
          </Select>
          <Input
            className="admin-input"
            placeholder="按作者搜索"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />
          <Button
            className="admin-btn"
            type="button"
            onClick={() =>
              setAppliedFilters({
                status,
                postType,
                author: author.trim(),
                categoryId,
                tagId,
              })
            }
          >
            查询帖子
          </Button>
        </div>
      </section>

      <section className="admin-table-card">
        <div className="admin-table-head">
          <h2>
            <FileText size={17} strokeWidth={2} />
            帖子管理
          </h2>
          <p>查看帖子所属分类与标签，并执行上下架操作。</p>
        </div>

        {loading ? (
          <div className="admin-loading">加载中...</div>
        ) : posts.length === 0 ? (
          <div className="admin-empty">暂无帖子</div>
        ) : (
          <div className="admin-table-wrap">
            <Table className="admin-table">
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>标题</TableHead>
                  <TableHead>作者</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>分类/标签</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell>{post.id}</TableCell>
                    <TableCell>
                      <Link href={`/posts/${post.id}`} className="admin-inline-link">{post.title}</Link>
                    </TableCell>
                    <TableCell>{post.authorUsername || post.authorId}</TableCell>
                    <TableCell>
                      <span className={`admin-badge ${typeBadgeMap[post.postType] || ""}`}>
                        {post.postType}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{post.categoryName || "-"}</div>
                        <div className="text-slate-500">
                          {post.tags?.map((tag) => `#${tag.name}`).join(" ") || "-"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`admin-badge ${statusBadgeMap[post.status] || ""}`}>
                        {statusLabels[post.status] || post.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="cat-actions">
                        {post.status === "OFFLINE" && (
                          <button
                            type="button"
                            className="cat-btn cat-btn-enable"
                            onClick={() => openOnlineDialog(post.id, post.title)}
                          >
                            上架
                          </button>
                        )}
                        {post.status !== "OFFLINE" && post.status !== "DELETED" && (
                          <button
                            type="button"
                            className="cat-btn cat-btn-disable"
                            onClick={() => openOfflineDialog(post.id, post.title)}
                          >
                            下架
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* 上下架模态框 */}
      <ConfirmDialog
        open={actionDialog !== null}
        title={actionDialog?.action === "online" ? "上架帖子" : "下架帖子"}
        description="请填写操作原因后提交，操作不可撤销。"
        confirmLabel={actionDialog?.action === "online" ? "确认上架" : "确认下架"}
        confirmBusy={submitting}
        confirmDisabled={!reason.trim()}
        onConfirm={() => void submitAction()}
        onOpenChange={(v) => !v && closeDialog()}
      >
        {actionDialog && (
          <div style={{ display: "grid", gap: 10 }}>
            <div className="coin-modal-user">
              <strong>{actionDialog.title}</strong>
              <span>帖子 ID {actionDialog.postId}</span>
            </div>
            <div className="coin-modal-field">
              <label className="coin-modal-label">操作原因</label>
              <Input
                className="admin-input"
                placeholder="请输入操作原因（必填）"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
        )}
      </ConfirmDialog>
    </main>
  );
}