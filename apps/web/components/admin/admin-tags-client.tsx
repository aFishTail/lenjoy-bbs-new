"use client";

import { Tag, Plus } from "lucide-react";
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

type DialogMode =
  | { type: "create" }
  | { type: "edit"; tag: TagSummary }
  | { type: "merge"; tag: TagSummary }
  | null;

export function AdminTagsClient() {
  const [keyword, setKeyword] = useState("");
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [name, setName] = useState("");
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [dialogBusy, setDialogBusy] = useState(false);

  const tagsQuery = useAdminTagsQuery(keyword);
  const createTagMutation = useCreateAdminTagMutation(keyword);
  const updateTagMutation = useUpdateAdminTagMutation(keyword);
  const updateStatusMutation = useUpdateAdminTagStatusMutation(keyword);
  const mergeTagMutation = useMergeAdminTagMutation(keyword);
  const deleteTagMutation = useDeleteAdminTagMutation(keyword);

  useEffect(() => {
    if (tagsQuery.error) toast.error(readError(tagsQuery.error));
  }, [tagsQuery.error]);

  const tags = tagsQuery.data ?? [];
  const loading = tagsQuery.isLoading || tagsQuery.isFetching;

  function openCreate() {
    setDialog({ type: "create" });
    setName("");
  }
  function openEdit(tag: TagSummary) {
    setDialog({ type: "edit", tag });
    setName(tag.name);
  }
  function openMerge(tag: TagSummary) {
    setDialog({ type: "merge", tag });
    setMergeTargetId("");
  }
  function closeDialog() {
    setDialog(null);
    setDialogBusy(false);
  }

  async function submitCreate() {
    if (!name.trim()) return;
    setDialogBusy(true);
    try {
      await createTagMutation.mutateAsync({ name: name.trim() });
      toast.success("标签已创建");
      closeDialog();
    } catch (e) { toast.error(readError(e)); setDialogBusy(false); }
  }

  async function submitEdit() {
    if (dialog?.type !== "edit") return;
    if (!name.trim()) return;
    setDialogBusy(true);
    try {
      await updateTagMutation.mutateAsync({ tagId: dialog.tag.id, payload: { name: name.trim() } });
      toast.success("标签已更新");
      closeDialog();
    } catch (e) { toast.error(readError(e)); setDialogBusy(false); }
  }

  async function submitMerge() {
    if (dialog?.type !== "merge") return;
    const targetId = Number(mergeTargetId.trim());
    if (!Number.isInteger(targetId) || targetId <= 0) { toast.error("请输入正确的目标标签 ID"); return; }
    setDialogBusy(true);
    try {
      await mergeTagMutation.mutateAsync({ tagId: dialog.tag.id, targetTagId: targetId });
      toast.success("标签已合并");
      closeDialog();
    } catch (e) { toast.error(readError(e)); setDialogBusy(false); }
  }

  async function toggleStatus(tagId: number, nextStatus: string) {
    try {
      await updateStatusMutation.mutateAsync({ tagId, status: nextStatus });
      toast.success("标签状态已更新");
    } catch (e) { toast.error(readError(e)); }
  }

  async function deleteTag(tagId: number, tagName: string) {
    if (typeof window === "undefined") return;
    if (!window.confirm(`确认删除标签 "${tagName}" 吗？`)) return;
    try {
      await deleteTagMutation.mutateAsync(tagId);
      toast.success("标签已删除");
    } catch (e) { toast.error(readError(e)); }
  }

  const busy = dialogBusy;

  return (
    <main className="admin-main">
      <section className="admin-toolbar">
        <div className="admin-filter-grid">
          <Input
            className="admin-input"
            placeholder="搜索标签"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <Button type="button" className="admin-btn" onClick={openCreate}>
            <Plus size={15} strokeWidth={2.5} />
            新建标签
          </Button>
        </div>
      </section>

      <section className="admin-table-card">
        <div className="admin-table-head">
          <h2>
            <Tag size={17} strokeWidth={2} />
            标签管理
          </h2>
          <p>标签支持弹框创建、编辑、删除与合并操作。</p>
        </div>

        {loading ? (
          <div className="admin-loading">加载中...</div>
        ) : tags.length === 0 ? (
          <div className="admin-empty">暂无标签数据</div>
        ) : (
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
                    <TableCell>
                      <strong className="cat-name">#{tag.name}</strong>
                    </TableCell>
                    <TableCell>
                      <span className={`admin-badge ${tag.status === "ACTIVE" ? "is-active" : "is-muted"}`}>
                        {tag.status === "ACTIVE" ? "启用" : "停用"}
                      </span>
                    </TableCell>
                    <TableCell>{tag.usageCount || 0}</TableCell>
                    <TableCell>
                      <div className="cat-actions">
                        <button type="button" className="cat-btn" onClick={() => openEdit(tag)}>编辑</button>
                        <button
                          type="button"
                          className={`cat-btn ${tag.status === "ACTIVE" ? "cat-btn-disable" : "cat-btn-enable"}`}
                          onClick={() => toggleStatus(tag.id, tag.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}
                        >
                          {tag.status === "ACTIVE" ? "停用" : "启用"}
                        </button>
                        <button type="button" className="cat-btn" onClick={() => openMerge(tag)}>合并</button>
                        <button type="button" className="cat-btn cat-btn-delete" onClick={() => deleteTag(tag.id, tag.name)}>删除</button>
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
        open={dialog?.type === "create" || dialog?.type === "edit"}
        title={dialog?.type === "edit" ? "编辑标签" : "新建标签"}
        description="填写标签名称后提交。"
        confirmLabel={dialog?.type === "edit" ? "保存修改" : "创建标签"}
        confirmBusy={busy}
        confirmDisabled={!name.trim()}
        onConfirm={() => void (dialog?.type === "edit" ? submitEdit() : submitCreate())}
        onOpenChange={(v) => !v && closeDialog()}
      >
        <div style={{ display: "grid", gap: 10 }}>
          <div className="coin-modal-field">
            <label className="coin-modal-label">标签名称</label>
            <Input
              className="admin-input"
              placeholder="输入标签名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>
      </ConfirmDialog>

      {/* 合并 */}
      <ConfirmDialog
        open={dialog?.type === "merge"}
        title="合并标签"
        description="将当前标签的所有帖子合并至目标标签，目标标签 ID 可在标签列表中获取。"
        confirmLabel="确认合并"
        confirmBusy={busy}
        confirmDisabled={!mergeTargetId.trim()}
        onConfirm={() => void submitMerge()}
        onOpenChange={(v) => !v && closeDialog()}
      >
        {dialog?.type === "merge" && (
          <div style={{ display: "grid", gap: 10 }}>
            <div className="coin-modal-user">
              <strong>待合并标签</strong>
              <span>#{dialog.tag.name}（ID {dialog.tag.id}）</span>
            </div>
            <Input
              className="admin-input"
              inputMode="numeric"
              placeholder="目标标签 ID"
              value={mergeTargetId}
              onChange={(e) => setMergeTargetId(e.target.value)}
            />
          </div>
        )}
      </ConfirmDialog>
    </main>
  );
}