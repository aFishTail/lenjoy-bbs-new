"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  useCreateAdminTagMutation,
  useMergeAdminTagMutation,
  useUpdateAdminTagStatusMutation,
} from "@/components/admin/use-admin-mutations";
import { useAdminTagsQuery } from "@/components/admin/use-admin-queries";
import { readError } from "@/components/post/client-helpers";
import { Button } from "@/components/ui/button";
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
  const [name, setName] = useState("");
  const [mergeTarget, setMergeTarget] = useState<Record<number, string>>({});

  const tagsQuery = useAdminTagsQuery(keyword);
  const createTagMutation = useCreateAdminTagMutation(keyword);
  const updateStatusMutation = useUpdateAdminTagStatusMutation(keyword);
  const mergeTagMutation = useMergeAdminTagMutation(keyword);

  useEffect(() => {
    if (tagsQuery.error) {
      toast.error(readError(tagsQuery.error));
    }
  }, [tagsQuery.error]);

  async function createTag() {
    try {
      await createTagMutation.mutateAsync({ name });
      setName("");
      toast.success("标签已创建");
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
      toast.error("请输入合并目标标签 ID");
      return;
    }
    try {
      await mergeTagMutation.mutateAsync({ tagId, targetTagId });
      toast.success("标签已合并");
    } catch (error) {
      toast.error(readError(error));
    }
  }

  const tags = tagsQuery.data ?? [];

  return (
    <main className="admin-main">
      <section className="admin-toolbar">
        <div className="admin-filter-grid">
          <Input
            placeholder="搜索标签"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <Input
            placeholder="新标签名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="button" onClick={() => void createTag()}>
            新建标签
          </Button>
        </div>
      </section>

      <section className="admin-table-card">
        <div className="admin-table-head">
          <h2>标签管理</h2>
          <p>标签是全站统一话题，可停用、合并、查看使用量。</p>
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
    </main>
  );
}
