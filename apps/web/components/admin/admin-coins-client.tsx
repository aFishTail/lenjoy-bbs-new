"use client";

import { Coins } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { queryKeys, readError } from "@/components/post/client-helpers";
import type { AdminCoinUserSummary } from "@/components/post/types";
import { useAdminCoinsQuery } from "@/components/admin/use-admin-queries";
import { useUpdateAdminCoinsMutation } from "@/components/admin/use-admin-mutations";
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
  { label: "正常", value: "ACTIVE" },
  { label: "禁言", value: "MUTED" },
  { label: "封禁", value: "BANNED" },
];

type CoinModalState = {
  user: AdminCoinUserSummary;
  operation: "CREDIT" | "DEBIT";
  amount: string;
  reason: string;
};

export function AdminCoinsClient() {
  const [status, setStatus] = useState("");
  const [keyword, setKeyword] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    status: "",
    keyword: "",
  });
  const [modal, setModal] = useState<CoinModalState | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const queryClient = useQueryClient();
  const coinsQuery = useAdminCoinsQuery(appliedFilters);
  const updateCoinsMutation = useUpdateAdminCoinsMutation();

  const statusBadgeMap = useMemo(
    () => ({ ACTIVE: "is-active", MUTED: "is-muted", BANNED: "is-banned" }),
    [],
  );

  useEffect(() => {
    if (coinsQuery.error) toast.error(readError(coinsQuery.error));
  }, [coinsQuery.error]);

  const users = coinsQuery.data ?? [];
  const loading = coinsQuery.isLoading || coinsQuery.isFetching;

  function openModal(user: AdminCoinUserSummary, operation: "CREDIT" | "DEBIT") {
    setModal({ user, operation, amount: "", reason: "" });
    setSubmitting(false);
  }

  function closeModal() {
    setModal(null);
    setSubmitting(false);
  }

  async function submitModal() {
    if (!modal) return;
    const { user, operation, amount, reason } = modal;
    if (!reason.trim()) { toast.error("请填写操作原因"); return; }
    const n = Number(amount);
    if (!Number.isInteger(n) || n <= 0) { toast.error("请输入大于 0 的整数金币数量"); return; }
    setSubmitting(true);
    try {
      const payload = await updateCoinsMutation.mutateAsync({
        userId: user.id,
        operation,
        amount: n,
        reason: reason.trim(),
      });
      queryClient.setQueryData<AdminCoinUserSummary[]>(
        queryKeys.adminCoins(appliedFilters),
        (prev = []) =>
          prev.map((u) =>
            u.id === user.id
              ? { ...u, availableCoins: payload.availableCoins, frozenCoins: payload.frozenCoins, totalCoins: payload.totalCoins }
              : u,
          ),
      );
      toast.success(operation === "CREDIT" ? "加币成功" : "扣币成功");
      closeModal();
    } catch (e) { toast.error(readError(e)); setSubmitting(false); }
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
              <option key={option.value || "ALL"} value={option.value}>{option.label}</option>
            ))}
          </Select>
          <Input
            className="admin-input"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="按用户名/邮箱/手机号搜索"
          />
        </div>
      </section>

      <section className="admin-table-card">
        <div className="admin-table-head">
          <h2>
            <Coins size={17} strokeWidth={2} />
            金币管理
          </h2>
          <p>调整用户金币余额，加扣币操作均会记录流水。</p>
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
                  <TableHead>可用 / 冻结</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.id}</TableCell>
                    <TableCell>
                      <div className="coin-cell-user">
                        <strong>{user.username}</strong>
                        <div className="text-xs text-slate-500">{user.email || user.phone || "-"}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`admin-badge ${statusBadgeMap[user.status as keyof typeof statusBadgeMap] || ""}`}>
                        {user.status === "ACTIVE" ? "正常" : user.status === "MUTED" ? "禁言" : user.status === "BANNED" ? "封禁" : user.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="coin-cell-balance">
                        <span className="coin-balance-num">{user.availableCoins}</span>
                        <span className="coin-balance-sep">/</span>
                        <span className="coin-balance-frozen">{user.frozenCoins}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="cat-actions">
                        <button
                          type="button"
                          className="cat-btn cat-btn-enable"
                          onClick={() => openModal(user, "CREDIT")}
                        >
                          加币
                        </button>
                        <button
                          type="button"
                          className="cat-btn cat-btn-delete"
                          onClick={() => openModal(user, "DEBIT")}
                        >
                          扣币
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* 调整金币模态框 */}
      <ConfirmDialog
        open={modal !== null}
        title={modal?.operation === "DEBIT" ? "扣减金币" : "增加金币"}
        description="填写金币数量和操作原因后提交。"
        confirmLabel={modal?.operation === "DEBIT" ? "确认扣减" : "确认增加"}
        confirmBusy={submitting}
        confirmDisabled={modal ? (!modal.amount.trim() || !modal.reason.trim()) : false}
        onConfirm={() => void submitModal()}
        onOpenChange={(v) => !v && closeModal()}
      >
        {modal && (
          <div style={{ display: "grid", gap: 10 }}>
            <div className="coin-modal-user">
              <strong>{modal.user.username}</strong>
              <span>可用 {modal.user.availableCoins} / 冻结 {modal.user.frozenCoins}</span>
            </div>
            <div className="coin-modal-field">
              <label className="coin-modal-label">金币数量</label>
              <Input
                className="admin-input"
                inputMode="numeric"
                placeholder="输入金币数量（正整数）"
                value={modal.amount}
                onChange={(e) => setModal((p) => p && { ...p, amount: e.target.value })}
              />
            </div>
            <div className="coin-modal-field">
              <label className="coin-modal-label">操作原因</label>
              <Input
                className="admin-input"
                placeholder="请输入操作原因（必填）"
                value={modal.reason}
                onChange={(e) => setModal((p) => p && { ...p, reason: e.target.value })}
              />
            </div>
          </div>
        )}
      </ConfirmDialog>
    </main>
  );
}