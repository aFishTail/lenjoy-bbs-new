"use client";

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

type ClientFormState = {
  name: string;
  remark: string;
  status: "ACTIVE" | "INACTIVE";
};

const DEFAULT_FORM: ClientFormState = {
  name: "",
  remark: "",
  status: "ACTIVE",
};

export function AdminOpenApiClientsClient() {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<OpenApiClientSummary | null>(null);
  const [form, setForm] = useState<ClientFormState>(DEFAULT_FORM);

  const clientsQuery = useAdminOpenApiClientsQuery();
  const createMutation = useCreateOpenApiClientMutation();
  const updateMutation = useUpdateOpenApiClientMutation();
  const updateStatusMutation = useUpdateOpenApiClientStatusMutation();
  const deleteMutation = useDeleteOpenApiClientMutation();

  useEffect(() => {
    if (clientsQuery.error) {
      toast.error(readError(clientsQuery.error));
    }
  }, [clientsQuery.error]);

  function resetForm() {
    setEditingClient(null);
    setForm(DEFAULT_FORM);
  }

  function openCreateDialog() {
    resetForm();
    setDialogOpen(true);
  }

  function openEditDialog(client: OpenApiClientSummary) {
    setEditingClient(client);
    setForm({
      name: client.name,
      remark: client.remark ?? "",
      status: client.status,
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

  async function submitClient() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }

    try {
      if (editingClient) {
        await updateMutation.mutateAsync({
          clientId: editingClient.id,
          payload: form,
        });
        toast.success("Client updated");
      } else {
        await createMutation.mutateAsync(form);
        toast.success("Client created");
      }
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error(readError(error));
    }
  }

  async function copyApiKey(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("API key copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  async function toggleStatus(client: OpenApiClientSummary) {
    try {
      await updateStatusMutation.mutateAsync({
        clientId: client.id,
        status: client.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
      });
      toast.success("Status updated");
    } catch (error) {
      toast.error(readError(error));
    }
  }

  async function deleteClient(client: OpenApiClientSummary) {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(`Delete client "${client.name}"?`);
      if (!confirmed) {
        return;
      }
    }
    try {
      await deleteMutation.mutateAsync(client.id);
      toast.success("Client deleted");
    } catch (error) {
      toast.error(readError(error));
    }
  }

  const clients = clientsQuery.data ?? [];
  const busy = createMutation.isPending || updateMutation.isPending;

  return (
    <main className="admin-main">
      <section className="admin-toolbar">
        <div className="admin-filter-grid">
          <Button type="button" onClick={openCreateDialog}>
            New Client
          </Button>
        </div>
      </section>

      <section className="admin-table-card">
        <div className="admin-table-head">
          <h2>Open API Clients</h2>
          <p>Manage API keys for external posting and maintain author bindings per client.</p>
        </div>
        <div className="admin-table-wrap">
          <Table className="admin-table">
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>API Key</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Bindings</TableHead>
                <TableHead>Remark</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>{client.id}</TableCell>
                  <TableCell>{client.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{client.apiKeyMasked}</span>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void copyApiKey(client.apiKeyPlaintext)}
                      >
                        Copy
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>{client.status}</TableCell>
                  <TableCell>{client.bindingCount}</TableCell>
                  <TableCell>{client.remark || "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => openEditDialog(client)}>
                        Edit
                      </Button>
                      <Button type="button" variant="outline" onClick={() => void toggleStatus(client)}>
                        {client.status === "ACTIVE" ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.push(`/admin/open-api/${client.id}`)}
                      >
                        Bindings
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => void deleteClient(client)}>
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
        title={editingClient ? "Edit Client" : "New Client"}
        description="The list shows a masked API key. Use the Copy button to copy the full value."
        confirmLabel={editingClient ? "Save" : "Create"}
        confirmBusy={busy}
        confirmDisabled={!form.name.trim()}
        onConfirm={() => void submitClient()}
        onOpenChange={closeDialog}
      >
        <div className="space-y-3">
          <Input
            placeholder="Client name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />
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
                status: e.target.value as ClientFormState["status"],
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
