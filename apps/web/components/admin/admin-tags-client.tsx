"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  useCreateAdminTagMutation,
  useDeleteAdminTagMutation,
  useMergeAdminTagMutation,
  useUpdateAdminTagMutation,
  useUpdateAdminTagStatusMutation,
} from "@/components/admin/use-admin-mutations";
import { useAdminTagsQuery } from "@/components/admin/use-admin-queries";
import { readError } from "@/components/post/client-helpers";
import type { TagSummary } from "@/components/post/types";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function AdminTagsClient() {
  const [keyword, setKeyword] = useState("");
  const [mergeTarget, setMergeTarget] = useState<Record<number, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagSummary | null>(null);
  const [name, setName] = useState("");

  const tagsQuery = useAdminTagsQuery(keyword);
  const createTagMutation = useCreateAdminTagMutation(keyword);
  const updateTagMutation = useUpdateAdminTagMutation(keyword);
  const updateStatusMutation = useUpdateAdminTagStatusMutation(keyword);
  const mergeTagMutation = useMergeAdminTagMutation(keyword);
  const deleteTagMutation = useDeleteAdminTagMutation(keyword);

  useEffect(() => {
    if (tagsQuery.error) {
      toast.error(readError(tagsQuery.error));
    }
  }, [tagsQuery.error]);

  const tags = tagsQuery.data ?? [];
  const dialogBusy = createTagMutation.isPending || updateTagMutation.isPending;

  function resetDialogState() {
    setEditingTag(null);
    setName("");
  }

  function openCreateDialog() {
    resetDialogState();
    setDialogOpen(true);
  }

  function openEditDialog(tag: TagSummary) {
    setEditingTag(tag);
    setName(tag.name);
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

  async function submitTag() {
    try {
      if (editingTag) {
        await updateTagMutation.mutateAsync({
          tagId: editingTag.id,
          payload: { name },
        });
        toast.success("标签已更新");
      } else {
        await createTagMutation.mutateAsync({ name });
        toast.success("标签已创建");
      }
      setDialogOpen(false);
      resetDialogState();
    } catch (error) {
      toast.error(readError(error));
    }
  }

  async function toggleStatus(tagId: number, nextStatus: string) {
    try {
      await updateStatusMutation.mutateAsync({ tagId, status: nextStatus });
      toast.success("标签状态已更新");
    } catch (error) {
      toast.error(readError(error));
    }
  }

  async function mergeTag(tagId: number) {
    const targetTagId = Number(mergeTarget[tagId] || "");
    if (!targetTagId) {
      toast.error("请输入目标标签 ID");
      return;
    }
    try {
      await mergeTagMutation.mutateAsync({ tagId, targetTagId });
      toast.success("标签已合并");
    } catch (error) {
      toast.error(readError(error));
    }
  }

  async function deleteTag(tagId: number, tagName: string) {
    if (typeof window === "undefined") {
      return;
    }
    const confirmed = window.confirm(`确认删除标签 "${tagName}" 吗？`);
    if (!confirmed) {
      return;
    }
    try {
      await deleteTagMutation.mutateAsync(tagId);
      toast.success("标签已删除");
    } catch (error) {
      toast.error(readError(error));
    }
  }

  return (
    <main className="admin-main">
      <section className="admin-toolbar">
        <div className="admin-filter-grid">
          <Input
            placeholder="搜索标签"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <Button type="button" onClick={() => openCreateDialog()}>
            新建标签
          </Button>
        </div>
      </section>

      <section className="admin-table-card">
        <div className="admin-table-head">
          <h2>标签管理</h2>
          <p>标签支持弹框创建、编辑、删除，合并操作保留独立入口。</p>
        </div>
        <div className="admin-table-wrap">
          <Table className="admin-table">
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>使用量</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.map((tag) => (
                <TableRow key={tag.id}>
                  <TableCell>{tag.id}</TableCell>
                  <TableCell>#{tag.name}</TableCell>
                  <TableCell>{tag.status}</TableCell>
                  <TableCell>{tag.usageCount || 0}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => openEditDialog(tag)}>
                        编辑
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          void toggleStatus(
                            tag.id,
                            tag.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                          )
                        }
                      >
                        {tag.status === "ACTIVE" ? "停用" : "启用"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => void deleteTag(tag.id, tag.name)}
                      >
                        删除
                      </Button>
                      <Input
                        placeholder="目标标签 ID"
                        value={mergeTarget[tag.id] || ""}
                        onChange={(e) =>
                          setMergeTarget((prev) => ({
                            ...prev,
                            [tag.id]: e.target.value,
                          }))
                        }
                      />
                      <Button type="button" onClick={() => void mergeTag(tag.id)}>
                        合并
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
        title={editingTag ? "编辑标签" : "新建标签"}
        description="创建与编辑共用同一弹框。"
        confirmLabel={editingTag ? "保存修改" : "创建标签"}
        confirmBusy={dialogBusy}
        confirmDisabled={!name.trim()}
        onConfirm={() => void submitTag()}
        onOpenChange={closeDialog}
      >
        <Input placeholder="标签名称" value={name} onChange={(e) => setName(e.target.value)} />
      </ConfirmDialog>
    </main>
  );
}
