"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { readError } from "@/components/post/client-helpers";
import {
  useAdminTradeAuditQuery,
  useAdminWalletAuditQuery,
} from "@/components/admin/use-admin-queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ViewMode = "wallet" | "trades";

function toIntOrUndefined(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n <= 0) {
    return undefined;
  }
  return n;
}

export function AdminAuditClient() {
  const [viewMode, setViewMode] = useState<ViewMode>("wallet");

  const [walletUserId, setWalletUserId] = useState("");
  const [walletBizType, setWalletBizType] = useState("");
  const [walletLimit, setWalletLimit] = useState("100");

  const [tradeUserId, setTradeUserId] = useState("");
  const [tradePostId, setTradePostId] = useState("");
  const [tradeLimit, setTradeLimit] = useState("100");
  const [walletFilters, setWalletFilters] = useState({
    userId: "",
    bizType: "",
    limit: "100",
  });
  const [tradeFilters, setTradeFilters] = useState({
    userId: "",
    postId: "",
    limit: "100",
  });
  const walletQuery = useAdminWalletAuditQuery(walletFilters);
  const tradeQuery = useAdminTradeAuditQuery(tradeFilters);

  const walletItems = walletQuery.data ?? [];
  const tradeItems = tradeQuery.data ?? [];
  const loading =
    viewMode === "wallet"
      ? walletQuery.isLoading || walletQuery.isFetching
      : tradeQuery.isLoading || tradeQuery.isFetching;

  const walletStats = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const item of walletItems) {
      if (item.direction === "INCOME") {
        income += item.changeAmount;
      }
      if (item.direction === "EXPENSE") {
        expense += item.changeAmount;
      }
    }
    return { income, expense };
  }, [walletItems]);

  const tradeStats = useMemo(() => {
    let total = 0;
    let refunded = 0;
    for (const item of tradeItems) {
      total += item.price;
      refunded += item.refundedAmount;
    }
    return { total, refunded, net: total - refunded };
  }, [tradeItems]);

  function loadWalletAudit() {
    const resolvedLimit = toIntOrUndefined(walletLimit);
    if (!resolvedLimit) {
      toast.error("钱包流水条数必须是正整数");
      return;
    }
    const userId = toIntOrUndefined(walletUserId);
    if (walletUserId.trim() && !userId) {
      toast.error("用户 ID 必须是正整数");
      return;
    }
    setWalletFilters({
      userId: walletUserId.trim(),
      bizType: walletBizType.trim(),
      limit: String(resolvedLimit),
    });
  }

  function loadTradeAudit() {
    const resolvedLimit = toIntOrUndefined(tradeLimit);
    if (!resolvedLimit) {
      toast.error("交易流水条数必须是正整数");
      return;
    }
    const userId = toIntOrUndefined(tradeUserId);
    const postId = toIntOrUndefined(tradePostId);
    if (tradeUserId.trim() && !userId) {
      toast.error("用户 ID 必须是正整数");
      return;
    }
    if (tradePostId.trim() && !postId) {
      toast.error("帖子 ID 必须是正整数");
      return;
    }
    setTradeFilters({
      userId: tradeUserId.trim(),
      postId: tradePostId.trim(),
      limit: String(resolvedLimit),
    });
  }

  useEffect(() => {
    const error = walletQuery.error ?? tradeQuery.error;
    if (error) {
      toast.error(readError(error));
    }
  }, [tradeQuery.error, walletQuery.error]);

  return (
    <main className="admin-main">
      <section className="admin-hero">
        <h1>后台审计可视化</h1>
        <p>覆盖钱包流水与资源交易流水，支持按用户、业务和帖子进行快速核对。</p>
      </section>

      <section className="admin-toolbar">
        <div className="admin-row-actions">
          <Button
            type="button"
            className={`admin-btn ${viewMode === "wallet" ? "" : "is-soft"}`}
            onClick={() => setViewMode("wallet")}
          >
            钱包流水
          </Button>
          <Button
            type="button"
            className={`admin-btn ${viewMode === "trades" ? "" : "is-soft"}`}
            onClick={() => setViewMode("trades")}
          >
            资源交易
          </Button>
        </div>
      </section>

      {viewMode === "wallet" ? (
        <section className="admin-table-card">
          <div className="admin-table-head">
            <h2>钱包流水审计</h2>
            <p>
              总收入 {walletStats.income}，总支出 {walletStats.expense}，净流入{" "}
              {walletStats.income - walletStats.expense}
            </p>
          </div>

          <div className="admin-filter-grid">
            <Input
              className="admin-input"
              value={walletUserId}
              onChange={(event) => setWalletUserId(event.target.value)}
              placeholder="用户 ID（可选）"
            />
            <Input
              className="admin-input"
              value={walletBizType}
              onChange={(event) => setWalletBizType(event.target.value)}
              placeholder="业务类型（可选，如 RESOURCE_PURCHASE）"
            />
            <Input
              className="admin-input"
              value={walletLimit}
              onChange={(event) => setWalletLimit(event.target.value)}
              placeholder="条数（默认 100）"
            />
            <Button
              type="button"
              className="admin-btn"
              onClick={() => void loadWalletAudit()}
              disabled={loading}
            >
              {loading ? "查询中..." : "查询流水"}
            </Button>
          </div>

          {walletItems.length === 0 ? (
            <div className="admin-empty">暂无钱包流水记录</div>
          ) : (
            <div className="admin-table-wrap">
              <Table className="admin-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>方向</TableHead>
                    <TableHead>变动</TableHead>
                    <TableHead>业务类型</TableHead>
                    <TableHead>余额/冻结</TableHead>
                    <TableHead>操作人</TableHead>
                    <TableHead>备注</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {walletItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {new Date(item.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>{item.direction}</TableCell>
                      <TableCell>{item.changeAmount}</TableCell>
                      <TableCell>{item.bizType}</TableCell>
                      <TableCell>
                        可用 {item.balanceAfter} / 冻结 {item.frozenAfter}
                      </TableCell>
                      <TableCell>{item.operatedBy ?? "SYSTEM"}</TableCell>
                      <TableCell>{item.remark || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      ) : (
        <section className="admin-table-card">
          <div className="admin-table-head">
            <h2>资源交易审计</h2>
            <p>
              成交总额 {tradeStats.total}，累计退款 {tradeStats.refunded}
              ，净收入 {tradeStats.net}
            </p>
          </div>

          <div className="admin-filter-grid">
            <Input
              className="admin-input"
              value={tradeUserId}
              onChange={(event) => setTradeUserId(event.target.value)}
              placeholder="用户 ID（买家或卖家，可选）"
            />
            <Input
              className="admin-input"
              value={tradePostId}
              onChange={(event) => setTradePostId(event.target.value)}
              placeholder="帖子 ID（可选）"
            />
            <Input
              className="admin-input"
              value={tradeLimit}
              onChange={(event) => setTradeLimit(event.target.value)}
              placeholder="条数（默认 100）"
            />
            <Button
              type="button"
              className="admin-btn"
              onClick={() => void loadTradeAudit()}
              disabled={loading}
            >
              {loading ? "查询中..." : "查询交易"}
            </Button>
          </div>

          {tradeItems.length === 0 ? (
            <div className="admin-empty">暂无资源交易记录</div>
          ) : (
            <div className="admin-table-wrap">
              <Table className="admin-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>交易时间</TableHead>
                    <TableHead>帖子</TableHead>
                    <TableHead>买家 / 卖家</TableHead>
                    <TableHead>金额 / 退款</TableHead>
                    <TableHead>净值</TableHead>
                    <TableHead>状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tradeItems.map((item) => (
                    <TableRow key={item.purchaseId}>
                      <TableCell>
                        {new Date(item.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-slate-900">
                            #{item.postId}
                          </div>
                          <div className="text-xs text-slate-500">
                            {item.postTitle || "-"}
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
                          <div>成交 {item.price}</div>
                          <div className="text-slate-500">
                            退款 {item.refundedAmount}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{item.price - item.refundedAmount}</TableCell>
                      <TableCell>{item.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
