"use client";

import { LayoutGrid, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  useCreateAdminCategoryMutation,
  useDeleteAdminCategoryMutation,
  useUpdateAdminCategoryMutation,
  useUpdateAdminCategoryStatusMutation,
} from "@/components/admin/use-admin-mutations";
import { useAdminCategoriesQuery } from "@/components/admin/use-admin-queries";
import { readError } from "@/components/post/client-helpers";
import type { CategorySummary } from "@/components/post/types";
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

type CategoryFormState = {
  name: string;
  contentType: "RESOURCE" | "NORMAL" | "BOUNTY";
  sort: string;
};

const DEFAULT_FORM: CategoryFormState = {
  name: "",
  contentType: "RESOURCE",
  sort: "0",
};

const CONTENT_TYPE_OPTIONS = [
  { label: "全部分类", value: "" },
  { label: "资源帖", value: "RESOURCE" },
  { label: "普通帖", value: "NORMAL" },
  { label: "悬赏帖", value: "BOUNTY" },
] as const;

const CONTENT_TYPE_FORM_OPTIONS = [
  { label: "资源帖", value: "RESOURCE" },
  { label: "普通帖", value: "NORMAL" },
  { label: "悬赏帖", value: "BOUNTY" },
] as const;

export function AdminCategoriesClient() {
  const [contentType, setContentType] = useState<"" | "RESOURCE" | "NORMAL" | "BOUNTY">("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategorySummary | null>(null);
  const [form, setForm] = useState<CategoryFormState>(DEFAULT_FORM);
  const [deleteDialog, setDeleteDialog] = useState<CategorySummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const categoriesQuery = useAdminCategoriesQuery(contentType);
  const createCategoryMutation = useCreateAdminCategoryMutation(contentType);
  const updateCategoryMutation = useUpdateAdminCategoryMutation(contentType);
  const updateStatusMutation = useUpdateAdminCategoryStatusMutation(contentType);
  const deleteCategoryMutation = useDeleteAdminCategoryMutation(contentType);

  useEffect(() => {
    if (categoriesQuery.error) toast.error(readError(categoriesQuery.error));
  }, [categoriesQuery.error]);

  const dialogBusy = createCategoryMutation.isPending || updateCategoryMutation.isPending;
  const categories = categoriesQuery.data ?? [];
  const loading = categoriesQuery.isLoading || categoriesQuery.isFetching;

  function resetDialogState() {
    setEditingCategory(null);
    setForm({ name: "", contentType: "RESOURCE", sort: "0" });
  }

  function openCreateDialog() {
    resetDialogState();
    setDialogOpen(true);
  }

  function openEditDialog(category: CategorySummary) {
    setEditingCategory(category);
    setForm({
      name: category.name,
      contentType: category.contentType as "RESOURCE" | "NORMAL" | "BOUNTY",
      sort: String(category.sort ?? 0),
    });
    setDialogOpen(true);
  }

  function closeDialog(open: boolean) {
    if (!open && !dialogBusy) {
      setDialogOpen(false);
      resetDialogState();
    }
  }

  async function submitCategory() {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name,
      contentType: form.contentType,
      parentId: 0,
      sort: Number(form.sort || 0),
      leaf: true,
    };
    try {
      if (editingCategory) {
        await updateCategoryMutation.mutateAsync({ categoryId: editingCategory.id, payload });
        toast.success("分类已更新");
      } else {
        await createCategoryMutation.mutateAsync(payload);
        toast.success("分类已创建");
      }
      setContentType("RESOURCE");
      setDialogOpen(false);
      resetDialogState();
    } catch (e) { toast.error(readError(e)); }
  }

  async function toggleStatus(categoryId: number, nextStatus: string) {
    try {
      await updateStatusMutation.mutateAsync({ categoryId, status: nextStatus });
      toast.success("分类状态已更新");
    } catch (e) { toast.error(readError(e)); }
  }

  async function submitDelete() {
    if (!deleteDialog) return;
    setDeleting(true);
    try {
      await deleteCategoryMutation.mutateAsync(deleteDialog.id);
      toast.success("分类已删除");
      setDeleteDialog(null);
    } catch (e) { toast.error(readError(e)); setDeleting(false); }
  }

  return (
    <main className="admin-main">
      <section className="admin-toolbar">
        <div className="admin-filter-grid">
          <Select
            className="admin-input"
            value={contentType}
            onChange={(e) => setContentType(e.target.value as "" | "RESOURCE" | "NORMAL" | "BOUNTY")}
          >
            {CONTENT_TYPE_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </Select>
          <Button type="button" className="admin-btn" onClick={openCreateDialog}>
            <Plus size={15} strokeWidth={2.5} />
            新建分类
          </Button>
        </div>
      </section>

      <section className="admin-table-card">
        <div className="admin-table-head">
          <h2>
            <LayoutGrid size={17} strokeWidth={2} />
            分类管理
          </h2>
          <p>按帖子类型维护分类，支持创建、编辑、停用与删除操作。</p>
        </div>

        {loading ? (
          <div className="admin-loading">加载中...</div>
        ) : categories.length === 0 ? (
          <div className="admin-empty">暂无分类数据</div>
        ) : (
          <div className="admin-table-wrap">
            <Table className="admin-table">
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>排序</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>{category.id}</TableCell>
                    <TableCell><strong className="cat-name">{category.name}</strong></TableCell>
                    <TableCell>
                      <span className={`admin-badge ${category.contentType === "RESOURCE" ? "is-resource" : category.contentType === "BOUNTY" ? "is-bounty" : "is-active"}`}>
                        {category.contentType === "RESOURCE" ? "资源帖" : category.contentType === "BOUNTY" ? "悬赏帖" : "普通帖"}
                      </span>
                    </TableCell>
                    <TableCell>{category.sort}</TableCell>
                    <TableCell>
                      <span className={`admin-badge ${category.status === "ACTIVE" ? "is-active" : category.status === "INACTIVE" ? "is-muted" : "is-banned"}`}>
                        {category.status === "ACTIVE" ? "启用" : "停用"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="cat-actions">
                        <button type="button" className="cat-btn" onClick={() => openEditDialog(category)}>编辑</button>
                        <button
                          type="button"
                          className={`cat-btn ${category.status === "ACTIVE" ? "cat-btn-disable" : "cat-btn-enable"}`}
                          onClick={() => toggleStatus(category.id, category.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}
                        >
                          {category.status === "ACTIVE" ? "停用" : "启用"}
                        </button>
                        <button type="button" className="cat-btn cat-btn-delete" onClick={() => setDeleteDialog(category)}>删除</button>
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
        open={dialogOpen}
        title={editingCategory ? "编辑分类" : "新建分类"}
        description="填写分类信息后提交。"
        confirmLabel={editingCategory ? "保存修改" : "创建分类"}
        confirmBusy={dialogBusy}
        confirmDisabled={!form.name.trim()}
        onConfirm={() => void submitCategory()}
        onOpenChange={closeDialog}
      >
        <div style={{ display: "grid", gap: 10 }}>
          <div className="coin-modal-field">
            <label className="coin-modal-label">分类名称</label>
            <Input
              className="admin-input"
              placeholder="输入分类名称"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div className="coin-modal-field">
            <label className="coin-modal-label">帖子类型</label>
            <Select
              className="admin-input"
              value={form.contentType}
              onChange={(e) => setForm((p) => ({ ...p, contentType: e.target.value as "RESOURCE" | "NORMAL" | "BOUNTY" }))}
            >
              {CONTENT_TYPE_FORM_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </Select>
          </div>
          <div className="coin-modal-field">
            <label className="coin-modal-label">排序值</label>
            <Input
              className="admin-input"
              inputMode="numeric"
              placeholder="数值越小排越前"
              value={form.sort}
              onChange={(e) => setForm((p) => ({ ...p, sort: e.target.value }))}
            />
          </div>
        </div>
      </ConfirmDialog>

      {/* 删除确认 */}
      <ConfirmDialog
        open={deleteDialog !== null}
        title="删除分类"
        description="删除后不可恢复，请确认。"
        confirmLabel="确认删除"
        confirmBusy={deleting}
        confirmDisabled={deleting}
        onConfirm={() => void submitDelete()}
        onOpenChange={(v) => !v && setDeleteDialog(null)}
      >
        {deleteDialog && (
          <div className="coin-modal-user">
            <strong>{deleteDialog.name}</strong>
            <span>ID {deleteDialog.id}</span>
          </div>
        )}
      </ConfirmDialog>
    </main>
  );
}