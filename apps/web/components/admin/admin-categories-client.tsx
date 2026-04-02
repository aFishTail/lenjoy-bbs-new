"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  useCreateAdminCategoryMutation,
  useUpdateAdminCategoryStatusMutation,
} from "@/components/admin/use-admin-mutations";
import { useAdminCategoriesQuery } from "@/components/admin/use-admin-queries";
import { readError } from "@/components/post/client-helpers";
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

export function AdminCategoriesClient() {
  const [contentType, setContentType] = useState("RESOURCE");
  const [name, setName] = useState("");
  const [sort, setSort] = useState("0");

  const categoriesQuery = useAdminCategoriesQuery(contentType);
  const createCategoryMutation = useCreateAdminCategoryMutation(contentType);
  const updateStatusMutation = useUpdateAdminCategoryStatusMutation(contentType);

  useEffect(() => {
    if (categoriesQuery.error) {
      toast.error(readError(categoriesQuery.error));
    }
  }, [categoriesQuery.error]);

  async function createCategory() {
    try {
      await createCategoryMutation.mutateAsync({
        name,
        contentType,
        parentId: 0,
        sort: Number(sort || 0),
        leaf: true,
      });
      setName("");
      setSort("0");
      toast.success("分类已创建");
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

  const categories = categoriesQuery.data ?? [];

  return (
    <main className="admin-main">
      <section className="admin-toolbar">
        <div className="admin-filter-grid">
          <Select value={contentType} onChange={(e) => setContentType(e.target.value)}>
            <option value="RESOURCE">RESOURCE</option>
            <option value="NORMAL">NORMAL</option>
            <option value="BOUNTY">BOUNTY</option>
          </Select>
          <Input
            placeholder="新分类名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            placeholder="排序"
            type="number"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          />
          <Button type="button" onClick={() => void createCategory()}>
            新建分类
          </Button>
        </div>
      </section>

      <section className="admin-table-card">
        <div className="admin-table-head">
          <h2>分类管理</h2>
          <p>按帖子类型维护独立分类体系。</p>
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
