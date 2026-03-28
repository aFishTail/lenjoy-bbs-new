"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  authHeaders,
  readApi,
  readError,
} from "@/components/post/client-helpers";
import type { PostSummary } from "@/components/post/types";
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
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [status, setStatus] = useState("");
  const [postType, setPostType] = useState("");
  const [author, setAuthor] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) {
        params.set("status", status);
      }
      if (postType) {
        params.set("postType", postType);
      }
      if (author.trim()) {
        params.set("author", author.trim());
      }

      const response = await fetch(`/api/admin/posts?${params.toString()}`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      const payload = await readApi<PostSummary[]>(response);
      setPosts(payload.data);
    } catch (error) {
      toast.error(readError(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function offlinePost(postId: number) {
    try {
      const response = await fetch(`/api/admin/posts/${postId}/offline`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ reason: "管理员下架" }),
      });
      await readApi(response);
      toast.success(`帖子 ${postId} 已下架`);
      await load();
    } catch (error) {
      toast.error(readError(error));
    }
  }

  async function onlinePost(postId: number) {
    try {
      const response = await fetch(`/api/admin/posts/${postId}/online`, {
        method: "PATCH",
        headers: {
          ...authHeaders(),
        },
      });
      await readApi(response);
      toast.success(`帖子 ${postId} 已上架`);
      await load();
    } catch (error) {
      toast.error(readError(error));
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
            onChange={(e) => setPostType(e.target.value)}
          >
            <option value="">全部类型</option>
            <option value="NORMAL">NORMAL</option>
            <option value="RESOURCE">RESOURCE</option>
            <option value="BOUNTY">BOUNTY</option>
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
            onClick={() => void load()}
          >
            查询帖子
          </Button>
        </div>
      </section>

      <section className="admin-table-card">
        <div className="admin-table-head">
          <h2>帖子管理</h2>
          <p>针对违规或不合规内容执行下架与上架处理。</p>
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
                          disabled={post.status !== "OFFLINE"}
                        >
                          上架
                        </Button>
                        <Button
                          className="admin-btn is-danger"
                          onClick={() => void offlinePost(post.id)}
                          type="button"
                          disabled={
                            post.status === "OFFLINE" ||
                            post.status === "DELETED"
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

      <div className="admin-footer-link">
        <Link href="/admin/users" className="admin-inline-link">
          前往用户管理
        </Link>
      </div>
    </main>
  );
}
