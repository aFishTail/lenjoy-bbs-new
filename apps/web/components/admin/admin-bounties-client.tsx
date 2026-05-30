"use client";

import { Award } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { readError } from "@/components/post/client-helpers";
import type { AdminBountySummary, PostComment } from "@/components/post/types";
import {
  useAdminBountiesQuery,
  useAdminBountyCommentsQuery,
} from "@/components/admin/use-admin-queries";
import { useDeleteAdminCommentMutation } from "@/components/admin/use-admin-mutations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const bountyStatuses: { label: string; value: string }[] = [
  { label: "全部状态", value: "" },
  { label: "进行中", value: "ACTIVE" },
  { label: "已结算", value: "RESOLVED" },
  { label: "已过期", value: "EXPIRED" },
];

function flattenComments(items: PostComment[]) {
  return items.flatMap((item) => [item, ...(item.replies || [])]);
}

type DeleteDialog = { commentId: number; content: string } | null;

const statusBadgeMap: Record<string, string> = {
  ACTIVE: "is-active",
  RESOLVED: "is-bounty",
  EXPIRED: "is-muted",
};

export function AdminBountiesClient() {
  const [status, setStatus] = useState("");
  const [keyword, setKeyword] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({ status: "", keyword: "" });
  const [selectedPost, setSelectedPost] = useState<AdminBountySummary | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialog>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);

  const bountiesQuery = useAdminBountiesQuery(appliedFilters);
  const commentsQuery = useAdminBountyCommentsQuery(selectedPost?.id ?? null);
  const deleteCommentMutation = useDeleteAdminCommentMutation(
    appliedFilters,
    selectedPost?.id ?? null,
  );

  useEffect(() => {
    const error = bountiesQuery.error ?? commentsQuery.error;
    if (error) toast.error(readError(error));
  }, [bountiesQuery.error, commentsQuery.error]);

  const items = bountiesQuery.data ?? [];
  const comments = commentsQuery.data ?? [];
  const loading = bountiesQuery.isLoading || bountiesQuery.isFetching;
  const commentLoading = commentsQuery.isLoading || commentsQuery.isFetching;

  function openDeleteDialog(comment: PostComment) {
    setDeleteDialog({ commentId: comment.id, content: comment.content ?? "" });
    setDeleteReason("");
    setDeleting(false);
  }

  function closeDeleteDialog() {
    setDeleteDialog(null);
    setDeleteReason("");
    setDeleting(false);
  }

  async function submitDelete() {
    if (!deleteDialog) return;
    if (!deleteReason.trim()) { toast.error("请填写删除原因"); return; }
    setDeleting(true);
    try {
      await deleteCommentMutation.mutateAsync({ commentId: deleteDialog.commentId, reason: deleteReason.trim() });
      toast.success("评论已删除");
      closeDeleteDialog();
    } catch (e) { toast.error(readError(e)); setDeleting(false); }
  }

  return (
    <main className="admin-main">
      <section className="admin-toolbar">
        <div className="admin-filter-grid">
          <Select
            className="admin-input"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            {bountyStatuses.map((option) => (
              <option key={option.value || "ALL"} value={option.value}>{option.label}</option>
            ))}
          </Select>
          <Input
            className="admin-input"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="按标题搜索悬赏帖"
          />
          <Button
            type="button"
            className="admin-btn"
            onClick={() => setAppliedFilters({ status, keyword: keyword.trim() })}
          >
            查询悬赏
          </Button>
        </div>
      </section>

      <section className="admin-table-card">
        <div className="admin-table-head">
          <h2>
            <Award size={17} strokeWidth={2} />
            悬赏异常处理
          </h2>
          <p>查看悬赏状态、候选答案和被删除记录，下架操作在帖子管理中执行。</p>
        </div>

        {loading ? (
          <div className="admin-loading">加载中...</div>
        ) : items.length === 0 ? (
          <div className="admin-empty">暂无悬赏帖</div>
        ) : (
          <div className="admin-table-wrap">
            <Table className="admin-table">
              <TableHeader>
                <TableRow>
                  <TableHead>帖子</TableHead>
                  <TableHead>作者</TableHead>
                  <TableHead>赏金</TableHead>
                  <TableHead>悬赏状态</TableHead>
                  <TableHead>候选答案</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <Link href={`/posts/${item.id}`} className="admin-inline-link">{item.title}</Link>
                        <div className="text-xs text-slate-500">到期 {item.bountyExpireAt ? new Date(item.bountyExpireAt).toLocaleString() : "-"}</div>
                      </div>
                    </TableCell>
                    <TableCell>{item.authorUsername || item.authorId}</TableCell>
                    <TableCell>
                      <span className="coin-balance-num">{item.bountyAmount}</span>
                      <span className="coin-balance-frozen"> 金币</span>
                    </TableCell>
                    <TableCell>
                      <span className={`admin-badge ${statusBadgeMap[item.bountyStatus] || ""}`}>
                        {item.bountyStatus === "ACTIVE" ? "进行中" : item.bountyStatus === "RESOLVED" ? "已结算" : item.bountyStatus === "EXPIRED" ? "已过期" : item.bountyStatus}
                      </span>
                      <div className="text-xs text-slate-500 mt-1">帖子 {item.status}</div>
                    </TableCell>
                    <TableCell>{item.answerCount}</TableCell>
                    <TableCell>
                      <div className="cat-actions">
                        <button type="button" className="cat-btn" onClick={() => setSelectedPost(item)}>查看回答</button>
                        <Link href="/admin/posts" className="cat-btn cat-btn-disable">去下架</Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="admin-table-card">
        <div className="admin-table-head">
          <h2>
            {selectedPost ? <><Award size={17} strokeWidth={2} />回答记录 · #{selectedPost.id}</> : <><Award size={17} strokeWidth={2} />回答记录</>}
          </h2>
          <p>管理员可删除违规候选答案或追问回复，已删除记录会保留处理痕迹。</p>
        </div>

        {selectedPost == null ? (
          <div className="admin-empty">请选择一条悬赏帖查看回答</div>
        ) : commentLoading ? (
          <div className="admin-loading">加载中...</div>
        ) : flattenComments(comments).length === 0 ? (
          <div className="admin-empty">暂无回答记录</div>
        ) : (
          <div className="admin-table-wrap">
            <Table className="admin-table">
              <TableHeader>
                <TableRow>
                  <TableHead>评论</TableHead>
                  <TableHead>作者</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flattenComments(comments).map((comment) => (
                  <TableRow key={comment.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm text-slate-900 whitespace-pre-wrap">
                          {comment.deleted ? (comment.deletedReason || "已删除") : comment.content}
                        </div>
                        <div className="text-xs text-slate-500">{new Date(comment.createdAt).toLocaleString()}</div>
                      </div>
                    </TableCell>
                    <TableCell>{comment.authorUsername || comment.authorId}</TableCell>
                    <TableCell>
                      <span className={`admin-badge ${comment.parentId ? "is-muted" : "is-bounty"}`}>
                        {comment.parentId ? "追问回复" : "候选答案"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {comment.isAccepted
                        ? <span className="admin-badge is-active">已采纳</span>
                        : comment.deleted
                          ? <span className="admin-badge is-banned">已删除</span>
                          : <span className="admin-badge is-normal">正常</span>}
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="cat-btn cat-btn-delete"
                        disabled={comment.deleted || comment.isAccepted}
                        onClick={() => openDeleteDialog(comment)}
                      >
                        删除
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* 删除评论模态框 */}
      <ConfirmDialog
        open={deleteDialog !== null}
        title="删除回答"
        description="请填写删除原因后提交，删除操作不可撤销。"
        confirmLabel="确认删除"
        confirmBusy={deleting}
        confirmDisabled={!deleteReason.trim()}
        onConfirm={() => void submitDelete()}
        onOpenChange={(v) => !v && closeDeleteDialog()}
      >
        {deleteDialog && (
          <div style={{ display: "grid", gap: 10 }}>
            <div className="coin-modal-user">
              <strong>{deleteDialog.content.length > 60 ? deleteDialog.content.slice(0, 60) + "…" : deleteDialog.content}</strong>
              <span>评论 ID {deleteDialog.commentId}</span>
            </div>
            <div className="coin-modal-field">
              <label className="coin-modal-label">删除原因</label>
              <Input
                className="admin-input"
                placeholder="请输入删除原因（必填）"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
              />
            </div>
          </div>
        )}
      </ConfirmDialog>
    </main>
  );
}