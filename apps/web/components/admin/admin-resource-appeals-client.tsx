"use client";

import { MessageCircleWarning } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { readError } from "@/components/post/client-helpers";
import { useAdminResourceAppealsQuery } from "@/components/admin/use-admin-queries";
import { useReviewResourceAppealMutation } from "@/components/admin/use-admin-mutations";
import type { ResourceAppeal } from "@/components/post/types";
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

const statusOptions: { label: string; value: string }[] = [
  { label: "全部状态", value: "" },
  { label: "待处理", value: "PENDING" },
  { label: "已退款", value: "APPROVED" },
  { label: "已驳回", value: "REJECTED" },
];

type AppealDialog =
  | { item: ResourceAppeal; action: "APPROVE" }
  | { item: ResourceAppeal; action: "REJECT" }
  | null;

const statusBadgeMap: Record<string, string> = {
  PENDING: "is-active",
  APPROVED: "is-bounty",
  REJECTED: "is-muted",
};

const statusLabels: Record<string, string> = {
  PENDING: "待处理",
  APPROVED: "已退款",
  REJECTED: "已驳回",
};

export function AdminResourceAppealsClient() {
  const [status, setStatus] = useState("");
  const [keyword, setKeyword] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({ status: "", keyword: "" });
  const [appealDialog, setAppealDialog] = useState<AppealDialog>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const appealsQuery = useAdminResourceAppealsQuery(appliedFilters);
  const reviewMutation = useReviewResourceAppealMutation(appliedFilters);

  useEffect(() => {
    if (appealsQuery.error) toast.error(readError(appealsQuery.error));
  }, [appealsQuery.error]);

  const items = appealsQuery.data ?? [];
  const loading = appealsQuery.isLoading || appealsQuery.isFetching;

  function openApproveDialog(item: ResourceAppeal) {
    setAppealDialog({ item, action: "APPROVE" });
    setRefundAmount(String(item.requestedRefundAmount));
    setNote(item.resolutionNote || "");
    setSubmitting(false);
  }

  function openRejectDialog(item: ResourceAppeal) {
    setAppealDialog({ item, action: "REJECT" });
    setRefundAmount(String(item.requestedRefundAmount));
    setNote(item.resolutionNote || "");
    setSubmitting(false);
  }

  function closeDialog() {
    setAppealDialog(null);
    setRefundAmount("");
    setNote("");
    setSubmitting(false);
  }

  async function submitReview() {
    if (!appealDialog) return;
    const amount = Number(refundAmount.trim());
    const noteText = note.trim();
    if (appealDialog.action === "APPROVE") {
      if (!Number.isInteger(amount) || amount <= 0) { toast.error("请输入正确的退款金币数量"); return; }
    }
    setSubmitting(true);
    try {
      await reviewMutation.mutateAsync({
        itemId: appealDialog.item.id,
        action: appealDialog.action,
        refundAmount: amount,
        note: noteText,
      });
      toast.success(appealDialog.action === "APPROVE" ? "申诉已退款处理" : "申诉已驳回");
      closeDialog();
    } catch (e) { toast.error(readError(e)); setSubmitting(false); }
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
            {statusOptions.map((option) => (
              <option key={option.value || "ALL"} value={option.value}>{option.label}</option>
            ))}
          </Select>
          <Input
            className="admin-input"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="按帖子/买家/卖家搜索"
          />
          <Button
            type="button"
            className="admin-btn"
            onClick={() => setAppliedFilters({ status, keyword: keyword.trim() })}
          >
            查询申诉
          </Button>
        </div>
      </section>

      <section className="admin-table-card">
        <div className="admin-table-head">
          <h2>
            <MessageCircleWarning size={17} strokeWidth={2} />
            资源申诉处理
          </h2>
          <p>通过模态框填写退款金额和处理说明，完成申诉处理。</p>
        </div>

        {loading ? (
          <div className="admin-loading">加载中...</div>
        ) : items.length === 0 ? (
          <div className="admin-empty">暂无申诉记录</div>
        ) : (
          <div className="admin-table-wrap">
            <Table className="admin-table">
              <TableHeader>
                <TableRow>
                  <TableHead>帖子</TableHead>
                  <TableHead>买家 / 卖家</TableHead>
                  <TableHead>申诉原因</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-slate-900">{item.postTitle}</div>
                        <div className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <div>买家 {item.buyerUsername || item.buyerId}</div>
                        <div className="text-slate-500">卖家 {item.sellerUsername || item.sellerId}</div>
                      </div>
                    </TableCell>
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
                          <button type="button" className="cat-btn" onClick={() => openApproveDialog(item)}>退款</button>
                          <button type="button" className="cat-btn cat-btn-disable" onClick={() => openRejectDialog(item)}>驳回</button>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <span className="text-xs text-slate-500">{item.resolutionNote || "-"}</span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* 申诉处理模态框 */}
      <ConfirmDialog
        open={appealDialog !== null}
        title={appealDialog?.action === "APPROVE" ? "退款处理" : "驳回申诉"}
        description={appealDialog?.action === "APPROVE" ? "填写退款金额后提交，金额默认取买家请求额度。" : "确认驳回此申诉请求。"}
        confirmLabel={appealDialog?.action === "APPROVE" ? "确认退款" : "确认驳回"}
        confirmBusy={submitting}
        confirmDisabled={appealDialog?.action === "APPROVE" && !refundAmount.trim()}
        onConfirm={() => void submitReview()}
        onOpenChange={(v) => !v && closeDialog()}
      >
        {appealDialog && (
          <div style={{ display: "grid", gap: 10 }}>
            <div className="coin-modal-user">
              <strong>{appealDialog.item.postTitle}</strong>
              <span>买家 {appealDialog.item.buyerUsername || appealDialog.item.buyerId}</span>
            </div>
            {appealDialog.action === "APPROVE" && (
              <div className="coin-modal-field">
                <label className="coin-modal-label">退款金币数量</label>
                <Input
                  className="admin-input"
                  inputMode="numeric"
                  placeholder="输入退款金币数量"
                  value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
              />
              </div>
            )}
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