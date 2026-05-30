"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { readError } from "@/components/post/client-helpers";
import type { BountyDeleteRequestItem } from "@/components/post/types";
import { useReviewBountyDeleteRequestMutation } from "@/components/admin/use-admin-mutations";
import { useAdminBountyDeleteRequestsQuery } from "@/components/admin/use-admin-queries";
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

const statusOptions = ["", "PENDING", "APPROVED", "REJECTED"] as const;

type ReviewDialog =
  | { item: BountyDeleteRequestItem; action: "APPROVE" }
  | { item: BountyDeleteRequestItem; action: "REJECT" }
  | null;

const statusBadgeMap: Record<BountyDeleteRequestItem["status"], string> = {
  PENDING: "is-active",
  APPROVED: "is-bounty",
  REJECTED: "is-muted",
};

const statusLabels: Record<BountyDeleteRequestItem["status"], string> = {
  PENDING: "待处理",
  APPROVED: "已通过",
  REJECTED: "已驳回",
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function formatCoins(value?: number | null) {
  if (value == null) return "-";
  return `${value} 金币`;
}

export function AdminBountyDeleteRequestsClient() {
  const [status, setStatus] = useState("");
  const [keyword, setKeyword] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    status: "",
    keyword: "",
  });
  const [reviewDialog, setReviewDialog] = useState<ReviewDialog>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const requestsQuery = useAdminBountyDeleteRequestsQuery(appliedFilters);
  const reviewMutation = useReviewBountyDeleteRequestMutation(appliedFilters);

  useEffect(() => {
    if (requestsQuery.error) toast.error(readError(requestsQuery.error));
  }, [requestsQuery.error]);

  const items = requestsQuery.data ?? [];
  const loading = requestsQuery.isLoading || requestsQuery.isFetching;

  function openReviewDialog(
    item: BountyDeleteRequestItem,
    action: "APPROVE" | "REJECT",
  ) {
    setReviewDialog({ item, action });
    setNote(item.resolutionNote || "");
    setSubmitting(false);
  }

  function closeReviewDialog() {
    setReviewDialog(null);
    setNote("");
    setSubmitting(false);
  }

  async function submitReview() {
    if (!reviewDialog) return;
    setSubmitting(true);
    try {
      await reviewMutation.mutateAsync({
        requestId: reviewDialog.item.id,
        action: reviewDialog.action,
        resolutionNote: note.trim(),
      });
      toast.success(
        reviewDialog.action === "APPROVE" ? "删除申请已通过" : "删除申请已驳回",
      );
      closeReviewDialog();
    } catch (e) {
      toast.error(readError(e));
      setSubmitting(false);
    }
  }

  const dialogTitle =
    reviewDialog?.action === "APPROVE" ? "通过删除申请" : "驳回删除申请";
  const dialogDescription =
    reviewDialog?.action === "APPROVE"
      ? "确认后将按后端规则处理悬赏退款并删除帖子。"
      : "确认后申请会被标记为驳回，帖子保持可见。";

  return (
    <main className="admin-main">
      <section className="admin-toolbar">
        <div className="admin-filter-grid">
          <Select
            className="admin-input"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            {statusOptions.map((option) => (
              <option key={option || "ALL"} value={option}>
                {option ? statusLabels[option] : "全部状态"}
              </option>
            ))}
          </Select>
          <Input
            className="admin-input"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="按标题、作者、原因搜索"
          />
          <Button
            type="button"
            className="admin-btn"
            onClick={() =>
              setAppliedFilters({ status, keyword: keyword.trim() })
            }
          >
            查询申请
          </Button>
        </div>
      </section>

      <section className="admin-table-card">
        <div className="admin-table-head">
          <h2>
            <Trash2 size={17} strokeWidth={2} />
            悬赏删除申请
          </h2>
          <p>审核作者提交的悬赏帖删除申请，处理结果会同步到帖子和站内消息。</p>
        </div>

        {loading ? (
          <div className="admin-loading">加载中...</div>
        ) : items.length === 0 ? (
          <div className="admin-empty">暂无删除申请</div>
        ) : (
          <div className="admin-table-wrap">
            <Table className="admin-table">
              <TableHeader>
                <TableRow>
                  <TableHead>帖子</TableHead>
                  <TableHead>作者</TableHead>
                  <TableHead>悬赏</TableHead>
                  <TableHead>申请原因</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>提交时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <Link
                          href={`/posts/${item.postId}`}
                          className="admin-inline-link"
                        >
                          {item.postTitle || `帖子 #${item.postId}`}
                        </Link>
                        <div className="text-xs text-slate-500">
                          ID {item.postId}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{item.authorUsername || item.authorId}</TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <div>{formatCoins(item.bountyAmount)}</div>
                        <div className="text-slate-500">
                          回答 {item.answerCount ?? 0}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <div className="whitespace-pre-wrap">{item.reason}</div>
                        {item.resolutionNote ? (
                          <div className="text-slate-500">
                            处理说明：{item.resolutionNote}
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`admin-badge ${statusBadgeMap[item.status]}`}>
                        {statusLabels[item.status]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <div>{formatDate(item.createdAt)}</div>
                        {item.handledAt ? (
                          <div className="text-xs text-slate-500">
                            处理 {formatDate(item.handledAt)}
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.status === "PENDING" ? (
                        <div className="cat-actions">
                          <button
                            type="button"
                            className="cat-btn"
                            onClick={() => openReviewDialog(item, "APPROVE")}
                          >
                            通过
                          </button>
                          <button
                            type="button"
                            className="cat-btn cat-btn-disable"
                            onClick={() => openReviewDialog(item, "REJECT")}
                          >
                            驳回
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">
                          {item.resolutionNote || "已处理"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={reviewDialog !== null}
        title={dialogTitle}
        description={dialogDescription}
        confirmLabel={dialogTitle}
        confirmBusy={submitting}
        confirmDisabled={false}
        onConfirm={() => void submitReview()}
        onOpenChange={(open) => !open && closeReviewDialog()}
      >
        {reviewDialog && (
          <div style={{ display: "grid", gap: 10 }}>
            <div className="coin-modal-user">
              <strong>
                {reviewDialog.item.postTitle ||
                  `帖子 #${reviewDialog.item.postId}`}
              </strong>
              <span>{reviewDialog.item.reason}</span>
            </div>
            <div className="coin-modal-field">
              <label className="coin-modal-label">处理说明</label>
              <Input
                className="admin-input"
                placeholder="请输入处理说明（可选）"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
          </div>
        )}
      </ConfirmDialog>
    </main>
  );
}
