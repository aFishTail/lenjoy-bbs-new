"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { readError } from "@/components/post/client-helpers";
import { useAdminResourceAppealsQuery } from "@/components/admin/use-admin-queries";
import { useReviewResourceAppealMutation } from "@/components/admin/use-admin-mutations";
import type { ResourceAppeal } from "@/components/post/types";
import { Button } from "@/components/ui/button";
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

export function AdminResourceAppealsClient() {
  const [status, setStatus] = useState("");
  const [keyword, setKeyword] = useState("");
  const [refundById, setRefundById] = useState<Record<number, string>>({});
  const [noteById, setNoteById] = useState<Record<number, string>>({});
  const [appliedFilters, setAppliedFilters] = useState({
    status: "",
    keyword: "",
  });
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const appealsQuery = useAdminResourceAppealsQuery(appliedFilters);
  const reviewMutation = useReviewResourceAppealMutation(appliedFilters);

  useEffect(() => {
    if (appealsQuery.error) {
      toast.error(readError(appealsQuery.error));
    }
  }, [appealsQuery.error]);

  const items = appealsQuery.data ?? [];
  const loading = appealsQuery.isLoading || appealsQuery.isFetching;

  async function handleReview(
    item: ResourceAppeal,
    action: "APPROVE" | "REJECT",
  ) {
    const note = (noteById[item.id] || "").trim();
    const rawRefund = (refundById[item.id] || "").trim();
    const refundAmount = rawRefund
      ? Number(rawRefund)
      : item.requestedRefundAmount;

    if (
      action === "APPROVE" &&
      (!Number.isInteger(refundAmount) || refundAmount <= 0)
    ) {
      toast.error("请输入正确的退款金币数量");
      return;
    }

    try {
      setReviewingId(item.id);
      await reviewMutation.mutateAsync({
        itemId: item.id,
        action,
        refundAmount,
        note,
      });
      toast.success(action === "APPROVE" ? "申诉已退款处理" : "申诉已驳回");
    } catch (error) {
      toast.error(readError(error));
    } finally {
      setReviewingId(null);
    }
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
              <option key={option || "ALL"} value={option}>
                {option || "全部状态"}
              </option>
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
            onClick={() =>
              setAppliedFilters({ status, keyword: keyword.trim() })
            }
          >
            查询申诉
          </Button>
        </div>
      </section>

      <section className="admin-table-card">
        <div className="admin-table-head">
          <h2>资源申诉处理</h2>
          <p>支持驳回、部分退款和全额退款，退款金额默认取买家剩余可退额度。</p>
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
                  <TableHead>退款</TableHead>
                  <TableHead>备注</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-slate-900">
                          {item.postTitle}
                        </div>
                        <div className="text-xs text-slate-500">
                          {new Date(item.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <div>买家 {item.buyerUsername || item.buyerId}</div>
                        <div className="text-slate-500">
                          卖家 {item.sellerUsername || item.sellerId}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <div>{item.reason}</div>
                        <div className="text-slate-500">
                          {item.detail || "-"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{item.status}</TableCell>
                    <TableCell>
                      <Input
                        className="admin-input"
                        inputMode="numeric"
                        value={
                          refundById[item.id] ||
                          String(item.requestedRefundAmount)
                        }
                        onChange={(event) =>
                          setRefundById((prev) => ({
                            ...prev,
                            [item.id]: event.target.value,
                          }))
                        }
                        disabled={item.status !== "PENDING"}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="admin-input"
                        value={noteById[item.id] || item.resolutionNote || ""}
                        onChange={(event) =>
                          setNoteById((prev) => ({
                            ...prev,
                            [item.id]: event.target.value,
                          }))
                        }
                        placeholder="处理说明"
                        disabled={item.status !== "PENDING"}
                      />
                    </TableCell>
                    <TableCell>
                      {item.status === "PENDING" ? (
                        <div className="admin-row-actions">
                          <Button
                            type="button"
                            className="admin-btn"
                            onClick={() => void handleReview(item, "APPROVE")}
                            disabled={reviewingId === item.id}
                          >
                            退款
                          </Button>
                          <Button
                            type="button"
                            className="admin-btn is-soft"
                            onClick={() => void handleReview(item, "REJECT")}
                            disabled={reviewingId === item.id}
                          >
                            驳回
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">已处理</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </main>
  );
}
