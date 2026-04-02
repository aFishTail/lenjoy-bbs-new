"use client";

import { useEffect, useMemo, useState } from "react";
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

export function AdminCategoriesClient() {
  const [contentType, setContentType] = useState<CategoryFormState["contentType"]>("RESOURCE");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategorySummary | null>(null);
  const [form, setForm] = useState<CategoryFormState>(DEFAULT_FORM);

  const categoriesQuery = useAdminCategoriesQuery(contentType);
  const createCategoryMutation = useCreateAdminCategoryMutation(contentType);
  const updateCategoryMutation = useUpdateAdminCategoryMutation(contentType);
  const updateStatusMutation = useUpdateAdminCategoryStatusMutation(contentType);
  const deleteCategoryMutation = useDeleteAdminCategoryMutation(contentType);

  useEffect(() => {
    if (categoriesQuery.error) {
      toast.error(readError(categoriesQuery.error));
    }
  }, [categoriesQuery.error]);

  const dialogBusy = createCategoryMutation.isPending || updateCategoryMutation.isPending;
  const dialogTitle = editingCategory ? "编辑分类" : "新建分类";
  const dialogConfirmLabel = editingCategory ? "保存修改" : "创建分类";
  const categories = categoriesQuery.data ?? [];

  const sortedContentTypes = useMemo(
    () => [
      { label: "RESOURCE", value: "RESOURCE" },
      { label: "NORMAL", value: "NORMAL" },
      { label: "BOUNTY", value: "BOUNTY" },
    ] as const,
    [],
  );

  function resetDialogState(nextContentType: CategoryFormState["contentType"] = contentType) {
    setEditingCategory(null);
    setForm({
      ...DEFAULT_FORM,
      contentType: nextContentType,
    });
  }

  function openCreateDialog() {
    resetDialogState();
    setDialogOpen(true);
  }

  function openEditDialog(category: CategorySummary) {
    setEditingCategory(category);
    setForm({
      name: category.name,
      contentType: category.contentType,
      sort: String(category.sort ?? 0),
    });
    setDialogOpen(true);
  }

  function closeDialog(open: boolean) {
    if (!open && !dialogBusy) {
      setDialogOpen(false);
      resetDialogState();
      return;
    }
    setDialogOpen(open);
  }

  async function submitCategory() {
    const payload = {
      name: form.name,
      contentType: form.contentType,
      parentId: 0,
      sort: Number(form.sort || 0),
      leaf: true,
    };

    try {
      if (editingCategory) {
        await updateCategoryMutation.mutateAsync({
          categoryId: editingCategory.id,
          payload,
        });
        toast.success("分类已更新");
      } else {
        await createCategoryMutation.mutateAsync(payload);
        toast.success("分类已创建");
      }
      setContentType(form.contentType);
      setDialogOpen(false);
      resetDialogState(form.contentType);
    } catch (error) {
      toast.error(readError(error));
    }
  }

  async function toggleStatus(categoryId: number, nextStatus: string) {
    try {
      await updateStatusMutation.mutateAsync({ categoryId, status: nextStatus });
      toast.success("分类状态已更新");
    } catch (error) {
      toast.error(readError(error));
    }
  }

  async function deleteCategory(categoryId: number, categoryName: string) {
    if (typeof window === "undefined") {
      return;
    }
    const confirmed = window.confirm(`确认删除分类 "${categoryName}" 吗？`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteCategoryMutation.mutateAsync(categoryId);
      toast.success("分类已删除");
    } catch (error) {
      toast.error(readError(error));
    }
  }

  return (
    <main className="admin-main">
      <section className="admin-toolbar">
        <div className="admin-filter-grid">
          <Select
            value={contentType}
            onChange={(e) => setContentType(e.target.value as CategoryFormState["contentType"])}
          >
            {sortedContentTypes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
          <Button type="button" onClick={() => openCreateDialog()}>
            新建分类
          </Button>
        </div>
      </section>

      <section className="admin-table-card">
        <div className="admin-table-head">
          <h2>分类管理</h2>
          <p>按帖子类型维护分类，并通过弹框统一完成创建和编辑。</p>
        </div>
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
                  <TableCell>{category.name}</TableCell>
                  <TableCell>{category.contentType}</TableCell>
                  <TableCell>{category.sort}</TableCell>
                  <TableCell>{category.status}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => openEditDialog(category)}>
                        编辑
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          void toggleStatus(
                            category.id,
                            category.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                          )
                        }
                      >
                        {category.status === "ACTIVE" ? "停用" : "启用"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => void deleteCategory(category.id, category.name)}
                      >
                        删除
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
        title={dialogTitle}
        description="填写分类信息后提交，创建与编辑共用同一弹框。"
        confirmLabel={dialogConfirmLabel}
        confirmBusy={dialogBusy}
        confirmDisabled={!form.name.trim()}
        onConfirm={() => void submitCategory()}
        onOpenChange={closeDialog}
      >
        <div className="space-y-3">
          <Input
            placeholder="分类名称"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <Select
            value={form.contentType}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                contentType: e.target.value as CategoryFormState["contentType"],
              }))
            }
          >
            {sortedContentTypes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
          <Input
            placeholder="排序"
            type="number"
            value={form.sort}
            onChange={(e) => setForm((prev) => ({ ...prev, sort: e.target.value }))}
          />
        </div>
      </ConfirmDialog>
    </main>
  );
}
