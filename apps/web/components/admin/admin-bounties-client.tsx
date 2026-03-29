"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { readError } from "@/components/post/client-helpers";
import type { AdminBountySummary, PostComment } from "@/components/post/types";
import {
  useAdminBountiesQuery,
  useAdminBountyCommentsQuery,
} from "@/components/admin/use-admin-queries";
import { useDeleteAdminCommentMutation } from "@/components/admin/use-admin-mutations";
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

const bountyStatuses = ["", "ACTIVE", "RESOLVED", "EXPIRED"] as const;

function flattenComments(items: PostComment[]) {
  return items.flatMap((item) => [item, ...(item.replies || [])]);
}

export function AdminBountiesClient() {
  const [status, setStatus] = useState("");
  const [keyword, setKeyword] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    status: "",
    keyword: "",
  });
  const [selectedPost, setSelectedPost] = useState<AdminBountySummary | null>(
    null,
  );
  const [deletingCommentId, setDeletingCommentId] = useState<number | null>(
    null,
  );
  const bountiesQuery = useAdminBountiesQuery(appliedFilters);
  const commentsQuery = useAdminBountyCommentsQuery(selectedPost?.id ?? null);
  const deleteCommentMutation = useDeleteAdminCommentMutation(
    appliedFilters,
    selectedPost?.id ?? null,
  );

  useEffect(() => {
    const error = bountiesQuery.error ?? commentsQuery.error;
    if (error) {
      toast.error(readError(error));
    }
  }, [bountiesQuery.error, commentsQuery.error]);

  const items = bountiesQuery.data ?? [];
  const comments = commentsQuery.data ?? [];
  const loading = bountiesQuery.isLoading || bountiesQuery.isFetching;
  const commentLoading = commentsQuery.isLoading || commentsQuery.isFetching;

  function loadComments(post: AdminBountySummary) {
    setSelectedPost(post);
  }

  async function deleteComment(commentId: number) {
    const reason = window.prompt("请输入删除原因", "管理员删除违规回答");
    if (!reason?.trim()) {
      return;
    }
    try {
      setDeletingCommentId(commentId);
      await deleteCommentMutation.mutateAsync({
        commentId,
        reason: reason.trim(),
      });
      toast.success("评论已删除");
    } catch (error) {
      toast.error(readError(error));
    } finally {
      setDeletingCommentId(null);
    }
  }

  return (
    <main className="admin-main">
      <section className="admin-toolbar">
        <div className="admin-filter-grid">
          <Select
            className="admin-input"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            {bountyStatuses.map((option) => (
              <option key={option || "ALL"} value={option}>
                {option || "全部悬赏状态"}
              </option>
            ))}
          </Select>
          <Input
            className="admin-input"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="按标题搜索悬赏帖"
          />
          <Button
            type="button"
            className="admin-btn"
            onClick={() =>
              setAppliedFilters({ status, keyword: keyword.trim() })
            }
          >
            查询悬赏
          </Button>
        </div>
      </section>

      <section className="admin-table-card">
        <div className="admin-table-head">
          <h2>悬赏异常处理</h2>
          <p>
            查看悬赏状态、候选答案和被删除记录。下架悬赏帖仍在帖子管理中执行，未结算赏金会自动退回。
          </p>
        </div>
        {loading ? (
          <div className="admin-loading">加载中...</div>
        ) : items.length === 0 ? (
          <div className="admin-empty">暂无悬赏帖</div>
        ) : (
          <div className="admin-table-wrap">
            <Table className="admin-table">
              <TableHeader>
                <TableRow>
                  <TableHead>帖子</TableHead>
                  <TableHead>作者</TableHead>
                  <TableHead>赏金</TableHead>
                  <TableHead>悬赏状态</TableHead>
                  <TableHead>候选答案</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <Link
                          href={`/posts/${item.id}`}
                          className="admin-inline-link"
                        >
                          {item.title}
                        </Link>
                        <div className="text-xs text-slate-500">
                          到期{" "}
                          {item.bountyExpireAt
                            ? new Date(item.bountyExpireAt).toLocaleString()
                            : "-"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.authorUsername || item.authorId}
                    </TableCell>
                    <TableCell>{item.bountyAmount} 金币</TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <div>{item.bountyStatus}</div>
                        <div className="text-slate-500">帖子 {item.status}</div>
                      </div>
                    </TableCell>
                    <TableCell>{item.answerCount}</TableCell>
                    <TableCell>
                      <div className="admin-row-actions">
                        <Button
                          type="button"
                          className="admin-btn is-soft"
                          onClick={() => void loadComments(item)}
                        >
                          查看回答
                        </Button>
                        <Link href="/admin/posts" className="admin-inline-link">
                          去下架帖子
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="admin-table-card">
        <div className="admin-table-head">
          <h2>
            {selectedPost ? `回答记录 · #${selectedPost.id}` : "回答记录"}
          </h2>
          <p>管理员可删除违规候选答案或追问回复。已删除记录会保留处理痕迹。</p>
        </div>
        {selectedPost == null ? (
          <div className="admin-empty">请选择一条悬赏帖查看回答</div>
        ) : commentLoading ? (
          <div className="admin-loading">加载中...</div>
        ) : flattenComments(comments).length === 0 ? (
          <div className="admin-empty">暂无回答记录</div>
        ) : (
          <div className="admin-table-wrap">
            <Table className="admin-table">
              <TableHeader>
                <TableRow>
                  <TableHead>评论</TableHead>
                  <TableHead>作者</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flattenComments(comments).map((comment) => (
                  <TableRow key={comment.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm text-slate-900 whitespace-pre-wrap">
                          {comment.deleted
                            ? comment.deletedReason || "已删除"
                            : comment.content}
                        </div>
                        <div className="text-xs text-slate-500">
                          {new Date(comment.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {comment.authorUsername || comment.authorId}
                    </TableCell>
                    <TableCell>
                      {comment.parentId ? "追问回复" : "候选答案"}
                    </TableCell>
                    <TableCell>
                      {comment.accepted
                        ? "已采纳"
                        : comment.deleted
                          ? "已删除"
                          : "正常"}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        className="admin-btn is-danger"
                        disabled={comment.deleted || comment.accepted}
                        onClick={() => void deleteComment(comment.id)}
                      >
                        {deletingCommentId === comment.id
                          ? "删除中..."
                          : "删除"}
                      </Button>
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
