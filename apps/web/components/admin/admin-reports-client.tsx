"use client";

import { Flag } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { readError } from "@/components/post/client-helpers";
import { useAdminReportsQuery } from "@/components/admin/use-admin-queries";
import { useReviewAdminReportMutation } from "@/components/admin/use-admin-mutations";
import type { ReportItem } from "@/components/post/types";
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

const statusOptions = ["", "PENDING", "VALID", "INVALID", "PUNISHED"] as const;
const targetOptions = ["", "POST", "COMMENT"] as const;

type ReviewDialog = {
  item: ReportItem;
  nextStatus: "VALID" | "INVALID" | "PUNISHED";
} | null;

const statusBadgeMap: Record<string, string> = {
  PENDING: "is-active",
  VALID: "is-bounty",
  INVALID: "is-muted",
  PUNISHED: "is-banned",
};

const statusLabels: Record<string, string> = {
  PENDING: "待处理",
  VALID: "有效",
  INVALID: "无效",
  PUNISHED: "已处罚",
};

export function AdminReportsClient() {
  const [status, setStatus] = useState("");
  const [targetType, setTargetType] = useState("");
  const [keyword, setKeyword] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({ status: "", targetType: "", keyword: "" });
  const [reviewDialog, setReviewDialog] = useState<ReviewDialog>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reportsQuery = useAdminReportsQuery(appliedFilters);
  const reviewMutation = useReviewAdminReportMutation(appliedFilters);

  useEffect(() => {
    if (reportsQuery.error) toast.error(readError(reportsQuery.error));
  }, [reportsQuery.error]);

  const items = reportsQuery.data ?? [];
  const loading = reportsQuery.isLoading || reportsQuery.isFetching;

  function openReviewDialog(item: ReportItem, nextStatus: "VALID" | "INVALID" | "PUNISHED") {
    setReviewDialog({ item, nextStatus });
    setNote(item.resolutionNote || "");
    setSubmitting(false);
  }

  function closeReviewDialog() {
    setReviewDialog(null);
    setNote("");
    setSubmitting(false);
  }

  const reviewLabels: Record<string, string> = {
    VALID: "标记有效",
    INVALID: "标记无效",
    PUNISHED: "已处罚",
  };

  async function submitReview() {
    if (!reviewDialog) return;
    setSubmitting(true);
    try {
      const endpoint =
        reviewDialog.item.targetType === "POST"
          ? `/api/admin/reports/posts/${reviewDialog.item.reportId}`
          : `/api/admin/reports/comments/${reviewDialog.item.reportId}`;
      await reviewMutation.mutateAsync({
        endpoint,
        nextStatus: reviewDialog.nextStatus,
        note: note.trim(),
        targetType: reviewDialog.item.targetType,
      });
      toast.success("举报处理完成");
      closeReviewDialog();
    } catch (e) { toast.error(readError(e)); setSubmitting(false); }
  }

  return (
    <main className="admin-main">
      <section className="admin-toolbar">
        <div className="admin-filter-grid">
          <Select className="admin-input" value={status} onChange={(e) => setStatus(e.target.value)}>
            {statusOptions.map((option) => (
              <option key={option || "ALL"} value={option}>{option || "全部状态"}</option>
            ))}
          </Select>
          <Select className="admin-input" value={targetType} onChange={(e) => setTargetType(e.target.value)}>
            {targetOptions.map((option) => (
              <option key={option || "ALL"} value={option}>{option || "全部目标"}</option>
            ))}
          </Select>
          <Input
            className="admin-input"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="按举报人/原因/内容搜索"
          />
          <Button
            className="admin-btn"
            type="button"
            onClick={() => setAppliedFilters({ status, targetType, keyword: keyword.trim() })}
          >
            查询举报
          </Button>
        </div>
      </section>

      <section className="admin-table-card">
        <div className="admin-table-head">
          <h2>
            <Flag size={17} strokeWidth={2} />
            举报管理
          </h2>
          <p>通过模态框填写处理说明并提交审核结果。</p>
        </div>

        {loading ? (
          <div className="admin-loading">加载中...</div>
        ) : items.length === 0 ? (
          <div className="admin-empty">暂无举报记录</div>
        ) : (
          <div className="admin-table-wrap">
            <Table className="admin-table">
              <TableHeader>
                <TableRow>
                  <TableHead>目标</TableHead>
                  <TableHead>举报人</TableHead>
                  <TableHead>原因</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={`${item.targetType}-${item.reportId}`}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-slate-900">{item.targetType} #{item.targetId}</div>
                        <div className="text-xs text-slate-500">{item.targetTitle || "-"}</div>
                      </div>
                    </TableCell>
                    <TableCell>{item.reporterUsername || item.reporterId}</TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <div>{item.reason}</div>
                        <div className="text-slate-500">{item.detail || "-"}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`admin-badge ${statusBadgeMap[item.status] || ""}`}>
                        {statusLabels[item.status] || item.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      {item.status === "PENDING" ? (
                        <div className="cat-actions">
                          <button type="button" className="cat-btn" onClick={() => openReviewDialog(item, "VALID")}>有效</button>
                          <button type="button" className="cat-btn cat-btn-enable" onClick={() => openReviewDialog(item, "INVALID")}>无效</button>
                          <button type="button" className="cat-btn cat-btn-delete" onClick={() => openReviewDialog(item, "PUNISHED")}>已处罚</button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">已处理 · {item.resolutionNote || "-"}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* 审核模态框 */}
      <ConfirmDialog
        open={reviewDialog !== null}
        title={reviewDialog ? reviewLabels[reviewDialog.nextStatus] : ""}
        description="填写处理说明后提交审核结果。"
        confirmLabel={reviewDialog ? reviewLabels[reviewDialog.nextStatus] : ""}
        confirmBusy={submitting}
        confirmDisabled={false}
        onConfirm={() => void submitReview()}
        onOpenChange={(v) => !v && closeReviewDialog()}
      >
        {reviewDialog && (
          <div style={{ display: "grid", gap: 10 }}>
            <div className="coin-modal-user">
              <strong>{reviewDialog.item.targetType} #{reviewDialog.item.targetId}</strong>
              <span>{reviewDialog.item.reason}</span>
            </div>
            <div className="coin-modal-field">
              <label className="coin-modal-label">处理说明</label>
              <Input
                className="admin-input"
                placeholder="请输入处理说明（可选）"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
        )}
      </ConfirmDialog>
    </main>
  );
}