"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { readError } from "@/components/post/client-helpers";
import { useAdminUsersQuery } from "@/components/admin/use-admin-queries";
import { useUpdateAdminUserStatusMutation } from "@/components/admin/use-admin-mutations";
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

export function AdminUsersClient() {
  const [status, setStatus] = useState("");
  const [keyword, setKeyword] = useState("");
  const [reasonById, setReasonById] = useState<Record<number, string>>({});
  const [appliedFilters, setAppliedFilters] = useState({
    status: "",
    keyword: "",
  });
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  const usersQuery = useAdminUsersQuery(appliedFilters);
  const updateStatusMutation = useUpdateAdminUserStatusMutation(appliedFilters);

  async function updateStatus(
    userId: number,
    nextStatus: "ACTIVE" | "MUTED" | "BANNED",
  ) {
    const reason = (reasonById[userId] || "").trim();
    if (!reason) {
      toast.error("请先填写操作原因");
      return;
    }

    try {
      setUpdatingUserId(userId);
      await updateStatusMutation.mutateAsync({ userId, nextStatus, reason });
      toast.success(`用户 ${userId} 状态已更新为 ${nextStatus}`);
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
    if (usersQuery.error) {
      toast.error(readError(usersQuery.error));
    }
  }, [usersQuery.error]);

  const users = usersQuery.data ?? [];
  const loading = usersQuery.isLoading || usersQuery.isFetching;

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
            className="admin-btn"
            type="button"
            onClick={() =>
              setAppliedFilters({ status, keyword: keyword.trim() })
            }
          >
            查询用户
          </Button>
        </div>
      </section>

      <section className="admin-table-card">
        <div className="admin-table-head">
          <h2>用户管理</h2>
          <p>支持禁言与封禁操作，操作原因必填。</p>
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
                  <TableHead>原因</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.id}</TableCell>
                    <TableCell>
                      <strong>{user.username}</strong>
                    </TableCell>
                    <TableCell>{user.email || user.phone || "-"}</TableCell>
                    <TableCell>{user.roles.join(", ")}</TableCell>
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
                      <Input
                        className="admin-input"
                        placeholder="填写处理原因"
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
                      <div className="admin-row-actions">
                        <Button
                          className="admin-btn is-soft"
                          type="button"
                          onClick={() => void updateStatus(user.id, "ACTIVE")}
                          disabled={updatingUserId === user.id}
                        >
                          恢复
                        </Button>
                        <Button
                          className="admin-btn is-warn"
                          type="button"
                          onClick={() => void updateStatus(user.id, "MUTED")}
                          disabled={updatingUserId === user.id}
                        >
                          禁言
                        </Button>
                        <Button
                          className="admin-btn is-danger"
                          type="button"
                          onClick={() => void updateStatus(user.id, "BANNED")}
                          disabled={updatingUserId === user.id}
                        >
                          封禁
                        </Button>
                      </div>
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
