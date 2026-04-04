"use client";

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

type BindingFormState = {
  bindingCode: string;
  userId: string;
  remark: string;
  status: "ACTIVE" | "INACTIVE";
};

const DEFAULT_FORM: BindingFormState = {
  bindingCode: "",
  userId: "",
  remark: "",
  status: "ACTIVE",
};

export function AdminOpenApiClientDetailClient({ clientId }: { clientId: string }) {
  const router = useRouter();
  const resolvedClientId = useMemo(() => {
    const parsed = Number(clientId);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [clientId]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBinding, setEditingBinding] = useState<OpenApiBindingSummary | null>(null);
  const [form, setForm] = useState<BindingFormState>(DEFAULT_FORM);

  const clientQuery = useAdminOpenApiClientQuery(resolvedClientId);
  const bindingsQuery = useAdminOpenApiBindingsQuery(resolvedClientId);
  const usersQuery = useAdminUsersQuery({ status: "", keyword: "" });
  const createMutation = useCreateOpenApiBindingMutation(resolvedClientId ?? 0);
  const updateMutation = useUpdateOpenApiBindingMutation(resolvedClientId ?? 0);
  const updateStatusMutation = useUpdateOpenApiBindingStatusMutation(resolvedClientId ?? 0);
  const deleteMutation = useDeleteOpenApiBindingMutation(resolvedClientId ?? 0);

  useEffect(() => {
    if (clientQuery.error) {
      toast.error(readError(clientQuery.error));
    }
  }, [clientQuery.error]);

  useEffect(() => {
    if (bindingsQuery.error) {
      toast.error(readError(bindingsQuery.error));
    }
  }, [bindingsQuery.error]);

  useEffect(() => {
    if (usersQuery.error) {
      toast.error(readError(usersQuery.error));
    }
  }, [usersQuery.error]);

  function resetForm() {
    setEditingBinding(null);
    setForm(DEFAULT_FORM);
  }

  function openCreateDialog() {
    resetForm();
    setDialogOpen(true);
  }

  function openEditDialog(binding: OpenApiBindingSummary) {
    setEditingBinding(binding);
    setForm({
      bindingCode: binding.bindingCode,
      userId: String(binding.userId),
      remark: binding.remark ?? "",
      status: binding.status,
    });
    setDialogOpen(true);
  }

  function closeDialog(open: boolean) {
    if (!open) {
      setDialogOpen(false);
      resetForm();
      return;
    }
    setDialogOpen(open);
  }

  async function copyApiKey(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("API key copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  async function submitBinding() {
    if (!form.bindingCode.trim()) {
      toast.error("Binding code is required");
      return;
    }
    if (!form.userId.trim()) {
      toast.error("User is required");
      return;
    }

    const userId = form.userId.trim() ? Number(form.userId) : undefined;
    if (form.userId.trim() && (!Number.isInteger(userId) || Number(userId) <= 0)) {
      toast.error("User ID must be a positive integer");
      return;
    }

    const payload = {
      bindingCode: form.bindingCode,
      userId,
      remark: form.remark.trim() || undefined,
      status: form.status,
    };

    try {
      if (editingBinding) {
        await updateMutation.mutateAsync({
          bindingId: editingBinding.id,
          payload,
        });
        toast.success("Binding updated");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Binding created");
      }
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error(readError(error));
    }
  }

  async function toggleStatus(binding: OpenApiBindingSummary) {
    try {
      await updateStatusMutation.mutateAsync({
        bindingId: binding.id,
        status: binding.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
      });
      toast.success("Binding status updated");
    } catch (error) {
      toast.error(readError(error));
    }
  }

  async function deleteBinding(binding: OpenApiBindingSummary) {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(`Delete binding "${binding.bindingCode}"?`);
      if (!confirmed) {
        return;
      }
    }
    try {
      await deleteMutation.mutateAsync(binding.id);
      toast.success("Binding deleted");
    } catch (error) {
      toast.error(readError(error));
    }
  }

  const client = clientQuery.data;
  const bindings = bindingsQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const busy = createMutation.isPending || updateMutation.isPending;

  return (
    <main className="admin-main">
      <section className="admin-toolbar">
        <div className="admin-filter-grid">
          <Button type="button" variant="outline" onClick={() => router.push("/admin/open-api")}>
            Back
          </Button>
          <Button type="button" onClick={openCreateDialog} disabled={resolvedClientId == null}>
            New Binding
          </Button>
        </div>
      </section>

      <section className="admin-table-card">
        <div className="admin-table-head">
          <h2>Client Detail</h2>
          {client ? (
            <p>
              {client.name} | {client.status} | {client.apiKeyMasked}
            </p>
          ) : (
            <p>Loading client...</p>
          )}
        </div>
        {client ? (
          <div className="flex items-center gap-3">
            <span>Copy the full API key from here.</span>
            <Button type="button" variant="outline" onClick={() => void copyApiKey(client.apiKeyPlaintext)}>
              Copy
            </Button>
          </div>
        ) : null}
      </section>

      <section className="admin-table-card">
        <div className="admin-table-head">
          <h2>Bindings</h2>
          <p>Each binding code maps this client to one existing forum user account.</p>
        </div>
        <div className="admin-table-wrap">
          <Table className="admin-table">
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Binding Code</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Remark</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bindings.map((binding) => (
                <TableRow key={binding.id}>
                  <TableCell>{binding.id}</TableCell>
                  <TableCell>{binding.bindingCode}</TableCell>
                  <TableCell>
                    {binding.username || "-"} / {binding.userId}
                  </TableCell>
                  <TableCell>{binding.email || binding.phone || "-"}</TableCell>
                  <TableCell>{binding.status}</TableCell>
                  <TableCell>{binding.remark || "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => openEditDialog(binding)}>
                        Edit
                      </Button>
                      <Button type="button" variant="outline" onClick={() => void toggleStatus(binding)}>
                        {binding.status === "ACTIVE" ? "Disable" : "Enable"}
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => void deleteBinding(binding)}>
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <ConfirmDialog
        open={dialogOpen}
        title={editingBinding ? "Edit Binding" : "New Binding"}
        description="Fill binding code and select the target user."
        confirmLabel={editingBinding ? "Save" : "Create"}
        confirmBusy={busy}
        confirmDisabled={!form.bindingCode.trim()}
        onConfirm={() => void submitBinding()}
        onOpenChange={closeDialog}
      >
        <div className="space-y-3">
          <Input
            placeholder="Binding code"
            value={form.bindingCode}
            onChange={(e) => setForm((prev) => ({ ...prev, bindingCode: e.target.value }))}
          />
          <Select
            value={form.userId}
            onChange={(e) => setForm((prev) => ({ ...prev, userId: e.target.value }))}
          >
            <option value="">Select user</option>
            {users.map((user) => (
              <option key={user.id} value={String(user.id)}>
                {user.username} / {user.id}
                {user.email ? ` / ${user.email}` : user.phone ? ` / ${user.phone}` : ""}
              </option>
            ))}
          </Select>
          <Input
            placeholder="Remark"
            value={form.remark}
            onChange={(e) => setForm((prev) => ({ ...prev, remark: e.target.value }))}
          />
          <Select
            value={form.status}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                status: e.target.value as BindingFormState["status"],
              }))
            }
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </Select>
        </div>
      </ConfirmDialog>
    </main>
  );
}
