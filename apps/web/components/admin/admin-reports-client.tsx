"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { readError } from "@/components/post/client-helpers";
import { useAdminReportsQuery } from "@/components/admin/use-admin-queries";
import { useReviewAdminReportMutation } from "@/components/admin/use-admin-mutations";
import type { ReportItem } from "@/components/post/types";
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

const statusOptions = ["", "PENDING", "VALID", "INVALID", "PUNISHED"] as const;
const targetOptions = ["", "POST", "COMMENT"] as const;

export function AdminReportsClient() {
  const [status, setStatus] = useState("");
  const [targetType, setTargetType] = useState("");
  const [keyword, setKeyword] = useState("");
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [appliedFilters, setAppliedFilters] = useState({
    status: "",
    targetType: "",
    keyword: "",
  });
  const [reviewingKey, setReviewingKey] = useState<string | null>(null);
  const reportsQuery = useAdminReportsQuery(appliedFilters);
  const reviewMutation = useReviewAdminReportMutation(appliedFilters);

  useEffect(() => {
    if (reportsQuery.error) {
      toast.error(readError(reportsQuery.error));
    }
  }, [reportsQuery.error]);

  const items = reportsQuery.data ?? [];
  const loading = reportsQuery.isLoading || reportsQuery.isFetching;

  async function review(
    item: ReportItem,
    nextStatus: "VALID" | "INVALID" | "PUNISHED",
  ) {
    const note = (noteById[`${item.targetType}-${item.reportId}`] || "").trim();
    try {
      const requestKey = `${item.targetType}-${item.reportId}`;
      const endpoint =
        item.targetType === "POST"
          ? `/api/admin/reports/posts/${item.reportId}`
          : `/api/admin/reports/comments/${item.reportId}`;
      setReviewingKey(requestKey);
      await reviewMutation.mutateAsync({
        endpoint,
        nextStatus,
        note,
        targetType: item.targetType,
      });
      toast.success("举报处理完成");
    } catch (error) {
      toast.error(readError(error));
    } finally {
      setReviewingKey(null);
    }
  }

  return (
    <main className="admin-main">
      <section className="admin-toolbar">
        <div className="admin-filter-grid">
          <Select
            className="admin-input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {statusOptions.map((option) => (
              <option key={option || "ALL"} value={option}>
                {option || "全部状态"}
              </option>
            ))}
          </Select>
          <Select
            className="admin-input"
            value={targetType}
            onChange={(e) => setTargetType(e.target.value)}
          >
            {targetOptions.map((option) => (
              <option key={option || "ALL"} value={option}>
                {option || "全部目标"}
              </option>
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
            onClick={() =>
              setAppliedFilters({
                status,
                targetType,
                keyword: keyword.trim(),
              })
            }
          >
            查询举报
          </Button>
        </div>
      </section>

      <section className="admin-table-card">
        <div className="admin-table-head">
          <h2>举报管理</h2>
          <p>支持标记有效、无效，并可联动下架帖子或删除评论。</p>
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
                  <TableHead>处理说明</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={`${item.targetType}-${item.reportId}`}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-slate-900">
                          {item.targetType} #{item.targetId}
                        </div>
                        <div className="text-xs text-slate-500">
                          {item.targetTitle || "-"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.reporterUsername || item.reporterId}
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
                        value={
                          noteById[`${item.targetType}-${item.reportId}`] ||
                          item.resolutionNote ||
                          ""
                        }
                        onChange={(e) =>
                          setNoteById((prev) => ({
                            ...prev,
                            [`${item.targetType}-${item.reportId}`]:
                              e.target.value,
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
                            className="admin-btn"
                            type="button"
                            onClick={() => void review(item, "VALID")}
                            disabled={
                              reviewingKey ===
                              `${item.targetType}-${item.reportId}`
                            }
                          >
                            有效
                          </Button>
                          <Button
                            className="admin-btn is-soft"
                            type="button"
                            onClick={() => void review(item, "INVALID")}
                            disabled={
                              reviewingKey ===
                              `${item.targetType}-${item.reportId}`
                            }
                          >
                            无效
                          </Button>
                          <Button
                            className="admin-btn is-danger"
                            type="button"
                            onClick={() => void review(item, "PUNISHED")}
                            disabled={
                              reviewingKey ===
                              `${item.targetType}-${item.reportId}`
                            }
                          >
                            已处罚
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
