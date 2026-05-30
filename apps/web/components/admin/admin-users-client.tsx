"use client";

import { Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { readError } from "@/components/post/client-helpers";
import { useAdminUsersQuery } from "@/components/admin/use-admin-queries";
import { useUpdateAdminUserStatusMutation } from "@/components/admin/use-admin-mutations";
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
  { label: "正常", value: "ACTIVE" },
  { label: "禁言", value: "MUTED" },
  { label: "封禁", value: "BANNED" },
];

type UserAction =
  | { type: "ACTIVE" | "MUTED" | "BANNED"; userId: number; username: string }
  | null;

export function AdminUsersClient() {
  const [status, setStatus] = useState("");
  const [keyword, setKeyword] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({ status: "", keyword: "" });
  const [actionDialog, setActionDialog] = useState<UserAction>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const usersQuery = useAdminUsersQuery(appliedFilters);
  const updateStatusMutation = useUpdateAdminUserStatusMutation(appliedFilters);

  const statusBadgeMap = useMemo(
    () => ({ ACTIVE: "is-active", MUTED: "is-muted", BANNED: "is-banned" }),
    [],
  );

  useEffect(() => {
    if (usersQuery.error) toast.error(readError(usersQuery.error));
  }, [usersQuery.error]);

  const users = usersQuery.data ?? [];
  const loading = usersQuery.isLoading || usersQuery.isFetching;

  function openActionDialog(userId: number, username: string, action: "ACTIVE" | "MUTED" | "BANNED") {
    setActionDialog({ type: action, userId, username });
    setReason("");
  }

  function closeActionDialog() {
    setActionDialog(null);
    setReason("");
    setSubmitting(false);
  }

  const actionLabels: Record<string, string> = {
    ACTIVE: "恢复",
    MUTED: "禁言",
    BANNED: "封禁",
  };

  async function submitAction() {
    if (!actionDialog) return;
    if (!reason.trim()) { toast.error("请填写操作原因"); return; }
    setSubmitting(true);
    try {
      await updateStatusMutation.mutateAsync({
        userId: actionDialog.userId,
        nextStatus: actionDialog.type,
        reason: reason.trim(),
      });
      toast.success(`用户 ${actionDialog.username} 已${actionLabels[actionDialog.type]}`);
      closeActionDialog();
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
          <Button
            className="admin-btn"
            type="button"
            onClick={() => setAppliedFilters({ status, keyword: keyword.trim() })}
          >
            查询用户
          </Button>
        </div>
      </section>

      <section className="admin-table-card">
        <div className="admin-table-head">
          <h2>
            <Users size={17} strokeWidth={2} />
            用户管理
          </h2>
          <p>支持通过模态框执行恢复、禁言与封禁操作。</p>
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
                  <TableHead>联系方式</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.id}</TableCell>
                    <TableCell><strong>{user.username}</strong></TableCell>
                    <TableCell>{user.email || user.phone || "-"}</TableCell>
                    <TableCell>{user.roles.join(", ")}</TableCell>
                    <TableCell>
                      <span className={`admin-badge ${statusBadgeMap[user.status as keyof typeof statusBadgeMap] || ""}`}>
                        {user.status === "ACTIVE" ? "正常" : user.status === "MUTED" ? "禁言" : user.status === "BANNED" ? "封禁" : user.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="cat-actions">
                        <button
                          type="button"
                          className={`cat-btn ${user.status === "MUTED" || user.status === "BANNED" ? "cat-btn-enable" : ""}`}
                          onClick={() => openActionDialog(user.id, user.username, "ACTIVE")}
                        >
                          恢复
                        </button>
                        <button
                          type="button"
                          className={`cat-btn ${user.status === "MUTED" ? "" : "cat-btn-disable"}`}
                          onClick={() => openActionDialog(user.id, user.username, "MUTED")}
                        >
                          禁言
                        </button>
                        <button
                          type="button"
                          className={`cat-btn ${user.status === "BANNED" ? "" : "cat-btn-delete"}`}
                          onClick={() => openActionDialog(user.id, user.username, "BANNED")}
                        >
                          封禁
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

      {/* 操作原因模态框 */}
      <ConfirmDialog
        open={actionDialog !== null}
        title={actionDialog ? `${actionLabels[actionDialog.type]}用户` : ""}
        description="请填写操作原因以便审计追溯。"
        confirmLabel={actionDialog ? actionLabels[actionDialog.type] : ""}
        confirmBusy={submitting}
        confirmDisabled={!reason.trim()}
        onConfirm={() => void submitAction()}
        onOpenChange={(v) => !v && closeActionDialog()}
      >
        {actionDialog && (
          <div style={{ display: "grid", gap: 10 }}>
            <div className="coin-modal-user">
              <strong>{actionDialog.username}</strong>
              <span>ID {actionDialog.userId}</span>
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