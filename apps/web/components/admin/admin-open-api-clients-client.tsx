"use client";

import { Key, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  useCreateOpenApiClientMutation,
  useDeleteOpenApiClientMutation,
  useUpdateOpenApiClientMutation,
  useUpdateOpenApiClientStatusMutation,
} from "@/components/admin/use-admin-mutations";
import { useAdminOpenApiClientsQuery } from "@/components/admin/use-admin-queries";
import { readError } from "@/components/post/client-helpers";
import type { OpenApiClientSummary } from "@/components/post/types";
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

type ClientDialog =
  | { type: "create" }
  | { type: "edit"; client: OpenApiClientSummary }
  | null;

type ActionDialog =
  | { client: OpenApiClientSummary; action: "disable" | "enable" }
  | { client: OpenApiClientSummary; action: "delete" }
  | null;

export function AdminOpenApiClientsClient() {
  const router = useRouter();
  const [clientDialog, setClientDialog] = useState<ClientDialog>(null);
  const [actionDialog, setActionDialog] = useState<ActionDialog>(null);
  const [form, setForm] = useState({ name: "", remark: "", status: "ACTIVE" as "ACTIVE" | "INACTIVE" });
  const [dialogBusy, setDialogBusy] = useState(false);

  const clientsQuery = useAdminOpenApiClientsQuery();
  const createMutation = useCreateOpenApiClientMutation();
  const updateMutation = useUpdateOpenApiClientMutation();
  const updateStatusMutation = useUpdateOpenApiClientStatusMutation();
  const deleteMutation = useDeleteOpenApiClientMutation();

  useEffect(() => {
    if (clientsQuery.error) toast.error(readError(clientsQuery.error));
  }, [clientsQuery.error]);

  const clients = clientsQuery.data ?? [];
  const loading = clientsQuery.isLoading || clientsQuery.isFetching;

  function resetClientDialog() {
    setClientDialog(null);
    setForm({ name: "", remark: "", status: "ACTIVE" });
    setDialogBusy(false);
  }

  function openCreateDialog() {
    setClientDialog({ type: "create" });
  }

  function openEditDialog(client: OpenApiClientSummary) {
    setClientDialog({ type: "edit", client });
    setForm({ name: client.name, remark: client.remark ?? "", status: client.status });
  }

  function openStatusDialog(client: OpenApiClientSummary, action: "disable" | "enable") {
    setActionDialog({ client, action });
  }

  function openDeleteDialog(client: OpenApiClientSummary) {
    setActionDialog({ client, action: "delete" });
  }

  function closeActionDialog() {
    setActionDialog(null);
  }

  async function copyApiKey(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("API Key 已复制");
    } catch { toast.error("复制失败"); }
  }

  async function submitClient() {
    if (!form.name.trim()) { toast.error("名称不能为空"); return; }
    setDialogBusy(true);
    try {
      if (clientDialog?.type === "edit" && clientDialog.client) {
        await updateMutation.mutateAsync({ clientId: clientDialog.client.id, payload: form });
        toast.success("客户端已更新");
      } else {
        await createMutation.mutateAsync(form);
        toast.success("客户端已创建");
      }
      resetClientDialog();
    } catch (e) { toast.error(readError(e)); setDialogBusy(false); }
  }

  async function submitStatusAction() {
    if (!actionDialog || !("action" in actionDialog)) return;
    setDialogBusy(true);
    try {
      if (actionDialog.action === "disable") {
        await updateStatusMutation.mutateAsync({ clientId: actionDialog.client.id, status: "INACTIVE" });
        toast.success("客户端已停用");
      } else if (actionDialog.action === "enable") {
        await updateStatusMutation.mutateAsync({ clientId: actionDialog.client.id, status: "ACTIVE" });
        toast.success("客户端已启用");
      } else if (actionDialog.action === "delete") {
        await deleteMutation.mutateAsync(actionDialog.client.id);
        toast.success("客户端已删除");
      }
      setActionDialog(null);
      setDialogBusy(false);
    } catch (e) { toast.error(readError(e)); setDialogBusy(false); }
  }

  return (
    <main className="admin-main">
      <section className="admin-toolbar">
        <div className="admin-filter-grid">
          <Button type="button" className="admin-btn" onClick={openCreateDialog}>
            <Key size={15} strokeWidth={2.5} />
            新建客户端
          </Button>
        </div>
      </section>

      <section className="admin-table-card">
        <div className="admin-table-head">
          <h2>
            <Key size={17} strokeWidth={2} />
            Open API 客户端管理
          </h2>
          <p>管理外部发帖的 API Key，支持创建、编辑、启用/停用与删除操作。</p>
        </div>

        {loading ? (
          <div className="admin-loading">加载中...</div>
        ) : clients.length === 0 ? (
          <div className="admin-empty">暂无客户端数据</div>
        ) : (
          <div className="admin-table-wrap">
            <Table className="admin-table">
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>API Key</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>绑定数</TableHead>
                  <TableHead>备注</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>{client.id}</TableCell>
                    <TableCell><strong className="cat-name">{client.name}</strong></TableCell>
                    <TableCell>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="text-sm text-slate-600">{client.apiKeyMasked}</span>
                        <button type="button" className="cat-btn" onClick={() => copyApiKey(client.apiKeyPlaintext)}>
                          <Copy size={12} strokeWidth={2} />
                          复制
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`admin-badge ${client.status === "ACTIVE" ? "is-active" : "is-muted"}`}>
                        {client.status === "ACTIVE" ? "启用" : "停用"}
                      </span>
                    </TableCell>
                    <TableCell>{client.bindingCount}</TableCell>
                    <TableCell>{client.remark || "-"}</TableCell>
                    <TableCell>
                      <div className="cat-actions">
                        <button type="button" className="cat-btn" onClick={() => openEditDialog(client)}>编辑</button>
                        <button
                          type="button"
                          className={`cat-btn ${client.status === "ACTIVE" ? "cat-btn-disable" : "cat-btn-enable"}`}
                          onClick={() => openStatusDialog(client, client.status === "ACTIVE" ? "disable" : "enable")}
                        >
                          {client.status === "ACTIVE" ? "停用" : "启用"}
                        </button>
                        <button type="button" className="cat-btn" onClick={() => router.push(`/admin/open-api/${client.id}`)}>绑定管理</button>
                        <button type="button" className="cat-btn cat-btn-delete" onClick={() => openDeleteDialog(client)}>删除</button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* 创建 / 编辑 */}
      <ConfirmDialog
        open={clientDialog !== null}
        title={clientDialog?.type === "edit" ? "编辑客户端" : "新建客户端"}
        description="填写客户端信息后提交。"
        confirmLabel={clientDialog?.type === "edit" ? "保存修改" : "创建客户端"}
        confirmBusy={dialogBusy}
        confirmDisabled={!form.name.trim()}
        onConfirm={() => void submitClient()}
        onOpenChange={(v) => !v && resetClientDialog()}
      >
        <div style={{ display: "grid", gap: 10 }}>
          <div className="coin-modal-field">
            <label className="coin-modal-label">客户端名称</label>
            <Input className="admin-input" placeholder="输入客户端名称" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="coin-modal-field">
            <label className="coin-modal-label">备注</label>
            <Input className="admin-input" placeholder="输入备注（可选）" value={form.remark} onChange={(e) => setForm((p) => ({ ...p, remark: e.target.value }))} />
          </div>
          <div className="coin-modal-field">
            <label className="coin-modal-label">状态</label>
            <Select
              className="admin-input"
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as "ACTIVE" | "INACTIVE" }))}
            >
            <option value="ACTIVE">启用</option>
            <option value="INACTIVE">停用</option>
          </Select>
          </div>
        </div>
      </ConfirmDialog>

      {/* 启用/停用 */}
      <ConfirmDialog
        open={
          actionDialog !== null &&
          "action" in actionDialog &&
          actionDialog.action !== "delete"
        }
        title={
          actionDialog && "action" in actionDialog
            ? actionDialog.action === "enable"
              ? "启用客户端"
              : "停用客户端"
            : ""
        }
        description={
          actionDialog && "action" in actionDialog
            ? `确认${actionDialog.action === "enable" ? "启用" : "停用"}客户端 "${actionDialog.client.name}" 吗？`
            : ""
        }
        confirmLabel={
          actionDialog && "action" in actionDialog
            ? actionDialog.action === "enable"
              ? "确认启用"
              : "确认停用"
            : ""
        }
        confirmBusy={dialogBusy}
        onConfirm={() => void submitStatusAction()}
        onOpenChange={(v) => !v && closeActionDialog()}
      />

      {/* 删除 */}
      <ConfirmDialog
        open={
          actionDialog !== null &&
          "action" in actionDialog &&
          actionDialog.action === "delete"
        }
        title="删除客户端"
        description={
          actionDialog && "action" in actionDialog
            ? `确认删除客户端 "${actionDialog.client.name}" 吗？此操作不可撤销。`
            : ""
        }
        confirmLabel="确认删除"
        confirmBusy={dialogBusy}
        onConfirm={() => void submitStatusAction()}
        onOpenChange={(v) => !v && closeActionDialog()}
      />
    </main>
  );
}