"use client";

import { ArrowLeft, Link2, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  useCreateOpenApiBindingMutation,
  useDeleteOpenApiBindingMutation,
  useUpdateOpenApiBindingMutation,
  useUpdateOpenApiBindingStatusMutation,
} from "@/components/admin/use-admin-mutations";
import {
  useAdminOpenApiBindingsQuery,
  useAdminOpenApiClientQuery,
  useAdminUsersQuery,
} from "@/components/admin/use-admin-queries";
import { readError } from "@/components/post/client-helpers";
import type { OpenApiBindingSummary } from "@/components/post/types";
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

type BindingDialog =
  | { type: "create" }
  | { type: "edit"; binding: OpenApiBindingSummary }
  | null;

type ActionDialog =
  | { binding: OpenApiBindingSummary; action: "disable" | "enable" | "delete" }
  | null;

export function AdminOpenApiClientDetailClient({ clientId }: { clientId: string }) {
  const router = useRouter();
  const resolvedClientId = useMemo(() => {
    const parsed = Number(clientId);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [clientId]);

  const [bindingDialog, setBindingDialog] = useState<BindingDialog>(null);
  const [actionDialog, setActionDialog] = useState<ActionDialog>(null);
  const [form, setForm] = useState({ bindingCode: "", userId: "", remark: "", status: "ACTIVE" as "ACTIVE" | "INACTIVE" });
  const [dialogBusy, setDialogBusy] = useState(false);

  const clientQuery = useAdminOpenApiClientQuery(resolvedClientId);
  const bindingsQuery = useAdminOpenApiBindingsQuery(resolvedClientId);
  const usersQuery = useAdminUsersQuery({ status: "", keyword: "" });
  const createMutation = useCreateOpenApiBindingMutation(resolvedClientId ?? 0);
  const updateMutation = useUpdateOpenApiBindingMutation(resolvedClientId ?? 0);
  const updateStatusMutation = useUpdateOpenApiBindingStatusMutation(resolvedClientId ?? 0);
  const deleteMutation = useDeleteOpenApiBindingMutation(resolvedClientId ?? 0);

  useEffect(() => {
    if (clientQuery.error) toast.error(readError(clientQuery.error));
  }, [clientQuery.error]);
  useEffect(() => {
    if (bindingsQuery.error) toast.error(readError(bindingsQuery.error));
  }, [bindingsQuery.error]);

  const client = clientQuery.data;
  const bindings = bindingsQuery.data ?? [];
  const loading = clientQuery.isLoading || bindingsQuery.isLoading || bindingsQuery.isFetching;

  function resetBindingDialog() {
    setBindingDialog(null);
    setForm({ bindingCode: "", userId: "", remark: "", status: "ACTIVE" });
    setDialogBusy(false);
  }

  function openCreateDialog() { setBindingDialog({ type: "create" }); }

  function openEditDialog(binding: OpenApiBindingSummary) {
    setBindingDialog({ type: "edit", binding });
    setForm({
      bindingCode: binding.bindingCode,
      userId: String(binding.userId),
      remark: binding.remark ?? "",
      status: binding.status,
    });
  }

  function openActionDialog(binding: OpenApiBindingSummary, action: "disable" | "enable" | "delete") {
    setActionDialog({ binding, action });
  }

  function closeActionDialog() { setActionDialog(null); }

  async function copyApiKey(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("API Key 已复制");
    } catch { toast.error("复制失败"); }
  }

  async function submitBinding() {
    if (!form.bindingCode.trim()) { toast.error("绑定码不能为空"); return; }
    if (!form.userId.trim()) { toast.error("请选择用户"); return; }
    const userId = Number(form.userId);
    if (!Number.isInteger(userId) || userId <= 0) { toast.error("用户 ID 必须为正整数"); return; }
    setDialogBusy(true);
    try {
      if (bindingDialog?.type === "edit" && bindingDialog.binding) {
        await updateMutation.mutateAsync({ bindingId: bindingDialog.binding.id, payload: { bindingCode: form.bindingCode, userId, remark: form.remark.trim() || undefined, status: form.status } });
        toast.success("绑定已更新");
      } else {
        await createMutation.mutateAsync({ bindingCode: form.bindingCode, userId, remark: form.remark.trim() || undefined, status: form.status });
        toast.success("绑定已创建");
      }
      resetBindingDialog();
    } catch (e) { toast.error(readError(e)); setDialogBusy(false); }
  }

  async function submitAction() {
    if (!actionDialog) return;
    setDialogBusy(true);
    try {
      if (actionDialog.action === "disable") {
        await updateStatusMutation.mutateAsync({ bindingId: actionDialog.binding.id, status: "INACTIVE" });
        toast.success("绑定已停用");
      } else if (actionDialog.action === "enable") {
        await updateStatusMutation.mutateAsync({ bindingId: actionDialog.binding.id, status: "ACTIVE" });
        toast.success("绑定已启用");
      } else {
        await deleteMutation.mutateAsync(actionDialog.binding.id);
        toast.success("绑定已删除");
      }
      setActionDialog(null);
      setDialogBusy(false);
    } catch (e) { toast.error(readError(e)); setDialogBusy(false); }
  }

  return (
    <main className="admin-main">
      <section className="admin-toolbar">
        <div className="admin-filter-grid">
          <Button type="button" className="admin-btn" onClick={() => router.push("/admin/open-api")}>
            <ArrowLeft size={15} strokeWidth={2.5} />
            返回列表
          </Button>
          <Button type="button" className="admin-btn" onClick={openCreateDialog} disabled={resolvedClientId == null}>
            <Link2 size={15} strokeWidth={2.5} />
            新建绑定
          </Button>
        </div>
      </section>

      {client && (
        <section className="admin-table-card">
          <div className="admin-table-head">
            <h2>
              <Link2 size={17} strokeWidth={2} />
              客户端详情
            </h2>
            <p>
              {client.name} |{" "}
              <span className={`admin-badge ${client.status === "ACTIVE" ? "is-active" : "is-muted"}`}>
                {client.status === "ACTIVE" ? "启用" : "停用"}
              </span>
              | {client.apiKeyMasked}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 0 14px" }}>
            <span className="text-sm text-slate-500">完整 API Key：</span>
            <button type="button" className="cat-btn" onClick={() => void copyApiKey(client.apiKeyPlaintext)}>
              <Copy size={12} strokeWidth={2} />
              复制
            </button>
          </div>
        </section>
      )}

      <section className="admin-table-card">
        <div className="admin-table-head">
          <h2>
            <Link2 size={17} strokeWidth={2} />
            绑定管理
          </h2>
          <p>每个绑定码将此客户端映射到一个已有论坛用户账户。</p>
        </div>

        {loading ? (
          <div className="admin-loading">加载中...</div>
        ) : bindings.length === 0 ? (
          <div className="admin-empty">暂无绑定数据</div>
        ) : (
          <div className="admin-table-wrap">
            <Table className="admin-table">
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>绑定码</TableHead>
                  <TableHead>用户</TableHead>
                  <TableHead>联系方式</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>备注</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bindings.map((binding) => (
                  <TableRow key={binding.id}>
                    <TableCell>{binding.id}</TableCell>
                    <TableCell><strong className="cat-name">{binding.bindingCode}</strong></TableCell>
                    <TableCell>{binding.username || "-"} / {binding.userId}</TableCell>
                    <TableCell>{binding.email || binding.phone || "-"}</TableCell>
                    <TableCell>
                      <span className={`admin-badge ${binding.status === "ACTIVE" ? "is-active" : "is-muted"}`}>
                        {binding.status === "ACTIVE" ? "启用" : "停用"}
                      </span>
                    </TableCell>
                    <TableCell>{binding.remark || "-"}</TableCell>
                    <TableCell>
                      <div className="cat-actions">
                        <button type="button" className="cat-btn" onClick={() => openEditDialog(binding)}>编辑</button>
                        <button
                          type="button"
                          className={`cat-btn ${binding.status === "ACTIVE" ? "cat-btn-disable" : "cat-btn-enable"}`}
                          onClick={() => openActionDialog(binding, binding.status === "ACTIVE" ? "disable" : "enable")}
                        >
                          {binding.status === "ACTIVE" ? "停用" : "启用"}
                        </button>
                        <button type="button" className="cat-btn cat-btn-delete" onClick={() => openActionDialog(binding, "delete")}>删除</button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* 创建 / 编辑绑定 */}
      <ConfirmDialog
        open={bindingDialog !== null}
        title={bindingDialog?.type === "edit" ? "编辑绑定" : "新建绑定"}
        description="填写绑定码并选择目标用户。"
        confirmLabel={bindingDialog?.type === "edit" ? "保存修改" : "创建绑定"}
        confirmBusy={dialogBusy}
        confirmDisabled={!form.bindingCode.trim() || !form.userId.trim()}
        onConfirm={() => void submitBinding()}
        onOpenChange={(v) => !v && resetBindingDialog()}
      >
        <div style={{ display: "grid", gap: 10 }}>
          <div className="coin-modal-field">
            <label className="coin-modal-label">绑定码</label>
            <Input className="admin-input" placeholder="输入绑定码" value={form.bindingCode} onChange={(e) => setForm((p) => ({ ...p, bindingCode: e.target.value }))} />
          </div>
          <div className="coin-modal-field">
            <label className="coin-modal-label">关联用户</label>
            <Select
              className="admin-input"
              value={form.userId}
              onChange={(e) => setForm((p) => ({ ...p, userId: e.target.value }))}
            >
              <option value="">选择用户</option>
              {usersQuery.data?.map((user) => (
                <option key={user.id} value={String(user.id)}>
                  {user.username} / {user.id}{user.email ? ` / ${user.email}` : user.phone ? ` / ${user.phone}` : ""}
                </option>
              ))}
            </Select>
          </div>
          <div className="coin-modal-field">
            <label className="coin-modal-label">备注</label>
            <Input className="admin-input" placeholder="输入备注（可选）" value={form.remark} onChange={(e) => setForm((p) => ({ ...p, remark: e.target.value }))} />
          </div>
          <div className="coin-modal-field">
            <label className="coin-modal-label">状态</label>
            <Select className="admin-input" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as "ACTIVE" | "INACTIVE" }))}>
              <option value="ACTIVE">启用</option>
              <option value="INACTIVE">停用</option>
            </Select>
          </div>
        </div>
      </ConfirmDialog>

      {/* 启用/停用/删除 */}
      <ConfirmDialog
        open={actionDialog !== null && actionDialog.action !== "delete"}
        title={
          actionDialog?.action === "enable" ? "启用绑定" :
          actionDialog?.action === "disable" ? "停用绑定" : ""
        }
        description={
          actionDialog && actionDialog.action !== "delete"
            ? `确认${actionDialog.action === "enable" ? "启用" : "停用"}绑定 "${actionDialog.binding.bindingCode}" 吗？`
            : ""
        }
        confirmLabel={actionDialog?.action === "enable" ? "确认启用" : "确认停用"}
        confirmBusy={dialogBusy}
        onConfirm={() => void submitAction()}
        onOpenChange={(v) => !v && closeActionDialog()}
      />

      <ConfirmDialog
        open={actionDialog !== null && actionDialog.action === "delete"}
        title="删除绑定"
        description={
          actionDialog?.action === "delete"
            ? `确认删除绑定 "${actionDialog.binding.bindingCode}" 吗？此操作不可撤销。`
            : ""
        }
        confirmLabel="确认删除"
        confirmBusy={dialogBusy}
        onConfirm={() => void submitAction()}
        onOpenChange={(v) => !v && closeActionDialog()}
      />
    </main>
  );
}