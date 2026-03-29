"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { queryKeys, readError } from "@/components/post/client-helpers";
import type { AdminCoinUserSummary } from "@/components/post/types";
import { useAdminCoinsQuery } from "@/components/admin/use-admin-queries";
import { useUpdateAdminCoinsMutation } from "@/components/admin/use-admin-mutations";
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

const statusOptions = ["", "ACTIVE", "MUTED", "BANNED"] as const;
const operationOptions = ["CREDIT", "DEBIT"] as const;

export function AdminCoinsClient() {
  const [status, setStatus] = useState("");
  const [keyword, setKeyword] = useState("");
  const [reasonById, setReasonById] = useState<Record<number, string>>({});
  const [amountById, setAmountById] = useState<Record<number, string>>({});
  const [operationById, setOperationById] = useState<
    Record<number, "CREDIT" | "DEBIT">
  >({});
  const [appliedFilters, setAppliedFilters] = useState({
    status: "",
    keyword: "",
  });
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const coinsQuery = useAdminCoinsQuery(appliedFilters);
  const updateCoinsMutation = useUpdateAdminCoinsMutation();

  async function updateCoins(userId: number) {
    const reason = (reasonById[userId] || "").trim();
    const rawAmount = (amountById[userId] || "").trim();
    const amount = Number(rawAmount);
    const operation = operationById[userId] || "CREDIT";

    if (!reason) {
      toast.error("请先填写操作原因");
      return;
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      toast.error("请输入大于 0 的整数金币数量");
      return;
    }

    try {
      setUpdatingUserId(userId);
      const payload = await updateCoinsMutation.mutateAsync({
        userId,
        operation,
        amount,
        reason,
      });
      queryClient.setQueryData<AdminCoinUserSummary[]>(
        queryKeys.adminCoins(appliedFilters),
        (prev = []) =>
          prev.map((user) =>
            user.id === userId
              ? {
                  ...user,
                  availableCoins: payload.availableCoins,
                  frozenCoins: payload.frozenCoins,
                  totalCoins: payload.totalCoins,
                }
              : user,
          ),
      );
      setReasonById((prev) => ({ ...prev, [userId]: "" }));
      setAmountById((prev) => ({ ...prev, [userId]: "" }));
      toast.success(`${operation === "CREDIT" ? "加币" : "扣币"}成功`);
    } catch (error) {
      toast.error(readError(error));
    } finally {
      setUpdatingUserId(null);
    }
  }

  const statusBadgeMap = useMemo(
    () => ({
      ACTIVE: "admin-badge is-active",
      MUTED: "admin-badge is-muted",
      BANNED: "admin-badge is-banned",
    }),
    [],
  );

  useEffect(() => {
    if (coinsQuery.error) {
      toast.error(readError(coinsQuery.error));
    }
  }, [coinsQuery.error]);

  const users = coinsQuery.data ?? [];
  const loading = coinsQuery.isLoading || coinsQuery.isFetching;

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
          <Input
            className="admin-input"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="按用户名/邮箱/手机号搜索"
          />
          <Button
            type="button"
            className="admin-btn"
            onClick={() =>
              setAppliedFilters({ status, keyword: keyword.trim() })
            }
          >
            查询钱包
          </Button>
        </div>
      </section>

      <section className="admin-table-card">
        <div className="admin-table-head">
          <h2>金币管理</h2>
          <p>支持按用户执行加币和扣币，所有操作都会落流水。</p>
        </div>

        {loading ? (
          <div className="admin-loading">加载中...</div>
        ) : users.length === 0 ? (
          <div className="admin-empty">暂无用户数据</div>
        ) : (
          <div className="admin-table-wrap">
            <Table className="admin-table">
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>用户</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>可用/冻结</TableHead>
                  <TableHead>操作</TableHead>
                  <TableHead>数量</TableHead>
                  <TableHead>原因</TableHead>
                  <TableHead>提交</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.id}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <strong>{user.username}</strong>
                        <div className="text-xs text-slate-500">
                          {user.email || user.phone || "-"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          statusBadgeMap[
                            user.status as keyof typeof statusBadgeMap
                          ] || "admin-badge"
                        }
                      >
                        {user.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <div>可用 {user.availableCoins}</div>
                        <div className="text-slate-500">
                          冻结 {user.frozenCoins}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        className="admin-input"
                        value={operationById[user.id] || "CREDIT"}
                        onChange={(e) =>
                          setOperationById((prev) => ({
                            ...prev,
                            [user.id]: e.target.value as "CREDIT" | "DEBIT",
                          }))
                        }
                      >
                        {operationOptions.map((option) => (
                          <option key={option} value={option}>
                            {option === "CREDIT" ? "加币" : "扣币"}
                          </option>
                        ))}
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        className="admin-input"
                        inputMode="numeric"
                        placeholder="金币数"
                        value={amountById[user.id] || ""}
                        onChange={(e) =>
                          setAmountById((prev) => ({
                            ...prev,
                            [user.id]: e.target.value,
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="admin-input"
                        placeholder="填写操作原因"
                        value={reasonById[user.id] || ""}
                        onChange={(e) =>
                          setReasonById((prev) => ({
                            ...prev,
                            [user.id]: e.target.value,
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        className="admin-btn"
                        onClick={() => void updateCoins(user.id)}
                        disabled={updatingUserId === user.id}
                      >
                        提交
                      </Button>
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
