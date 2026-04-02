"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useAdminCategoriesQuery, useAdminPostsQuery, useAdminTagsQuery } from "@/components/admin/use-admin-queries";
import { readError } from "@/components/post/client-helpers";
import { useUpdateAdminPostStatusMutation } from "@/components/admin/use-admin-mutations";
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

export function AdminPostsClient() {
  const [status, setStatus] = useState("");
  const [postType, setPostType] = useState("");
  const [author, setAuthor] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tagId, setTagId] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    status: "",
    postType: "",
    author: "",
    categoryId: "",
    tagId: "",
  });
  const [submittingPostId, setSubmittingPostId] = useState<number | null>(null);
  const postsQuery = useAdminPostsQuery(appliedFilters);
  const categoriesQuery = useAdminCategoriesQuery(postType);
  const tagsQuery = useAdminTagsQuery("");
  const updatePostStatusMutation =
    useUpdateAdminPostStatusMutation(appliedFilters);

  useEffect(() => {
    if (postsQuery.error) {
      toast.error(readError(postsQuery.error));
    }
  }, [postsQuery.error]);

  const posts = postsQuery.data ?? [];
  const loading = postsQuery.isLoading || postsQuery.isFetching;

  async function offlinePost(postId: number) {
    try {
      setSubmittingPostId(postId);
      await updatePostStatusMutation.mutateAsync({ postId, online: false });
      toast.success(`帖子 ${postId} 已下架`);
    } catch (error) {
      toast.error(readError(error));
    } finally {
      setSubmittingPostId(null);
    }
  }

  async function onlinePost(postId: number) {
    try {
      setSubmittingPostId(postId);
      await updatePostStatusMutation.mutateAsync({ postId, online: true });
      toast.success(`帖子 ${postId} 已上架`);
    } catch (error) {
      toast.error(readError(error));
    } finally {
      setSubmittingPostId(null);
    }
  }

  const getBadgeClass = (type: string) => {
    switch (type) {
      case "RESOURCE":
        return "admin-badge is-resource";
      case "BOUNTY":
        return "admin-badge is-bounty";
      default:
        return "admin-badge is-normal";
    }
  };

  const getStatusClass = (value: string) => {
    switch (value) {
      case "OFFLINE":
        return "admin-badge is-banned";
      case "CLOSED":
        return "admin-badge is-muted";
      default:
        return "admin-badge is-active";
    }
  };

  return (
    <main className="admin-main">
      <section className="admin-toolbar">
        <div className="admin-filter-grid">
          <Select
            className="admin-input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">全部状态</option>
            <option value="PUBLISHED">PUBLISHED</option>
            <option value="CLOSED">CLOSED</option>
            <option value="OFFLINE">OFFLINE</option>
            <option value="DELETED">DELETED</option>
          </Select>
          <Select
            className="admin-input"
            value={postType}
            onChange={(e) => {
              setPostType(e.target.value);
              setCategoryId("");
            }}
          >
            <option value="">全部类型</option>
            <option value="NORMAL">NORMAL</option>
            <option value="RESOURCE">RESOURCE</option>
            <option value="BOUNTY">BOUNTY</option>
          </Select>
          <Select
            className="admin-input"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">全部分类</option>
            {(categoriesQuery.data ?? []).map((category) => (
              <option key={category.id} value={String(category.id)}>
                {category.name}
              </option>
            ))}
          </Select>
          <Select
            className="admin-input"
            value={tagId}
            onChange={(e) => setTagId(e.target.value)}
          >
            <option value="">全部标签</option>
            {(tagsQuery.data ?? []).map((tag) => (
              <option key={tag.id} value={String(tag.id)}>
                {tag.name}
              </option>
            ))}
          </Select>
          <Input
            className="admin-input"
            placeholder="按作者搜索"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />
          <Button
            className="admin-btn"
            type="button"
            onClick={() =>
              setAppliedFilters({
                status,
                postType,
                author: author.trim(),
                categoryId,
                tagId,
              })
            }
          >
            查询帖子
          </Button>
        </div>
      </section>

      <section className="admin-table-card">
        <div className="admin-table-head">
          <h2>帖子管理</h2>
          <p>查看帖子当前所属分类和标签，并执行上下架操作。</p>
        </div>
        {loading ? (
          <div className="admin-loading">加载中...</div>
        ) : posts.length === 0 ? (
          <div className="admin-empty">暂无帖子</div>
        ) : (
          <div className="admin-table-wrap">
            <Table className="admin-table">
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>标题</TableHead>
                  <TableHead>作者</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>分类/标签</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell>{post.id}</TableCell>
                    <TableCell>
                      <Link
                        href={`/posts/${post.id}`}
                        className="admin-inline-link"
                      >
                        {post.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {post.authorUsername || post.authorId}
                    </TableCell>
                    <TableCell>
                      <span className={getBadgeClass(post.postType)}>
                        {post.postType}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{post.categoryName || "-"}</div>
                        <div className="text-slate-500">
                          {post.tags?.map((tag) => `#${tag.name}`).join(" ") || "-"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={getStatusClass(post.status)}>
                        {post.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="admin-row-actions">
                        <Button
                          className="admin-btn is-soft"
                          onClick={() => void onlinePost(post.id)}
                          type="button"
                          disabled={
                            post.status !== "OFFLINE" ||
                            submittingPostId === post.id
                          }
                        >
                          上架
                        </Button>
                        <Button
                          className="admin-btn is-danger"
                          onClick={() => void offlinePost(post.id)}
                          type="button"
                          disabled={
                            post.status === "OFFLINE" ||
                            post.status === "DELETED" ||
                            submittingPostId === post.id
                          }
                        >
                          下架
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </main>
  );
}
