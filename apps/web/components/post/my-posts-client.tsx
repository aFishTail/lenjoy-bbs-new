"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { readError } from "@/components/post/client-helpers";
import { PostCardStats } from "@/components/post/post-card-stats";
import { PaginationControls } from "@/components/post/pagination-controls";
import { useMyPostsQuery } from "@/components/post/use-post-queries";
import pageStyles from "@/components/my/my-pages.module.css";
import styles from "./post-list.module.css";

const PAGE_SIZE = 20;

export function MyPostsClient() {
  const [errorText, setErrorText] = useState("");
  const [page, setPage] = useState(1);
  const postsQuery = useMyPostsQuery(page, PAGE_SIZE);

  useEffect(() => {
    if (postsQuery.error) {
      setErrorText(readError(postsQuery.error));
    }
  }, [postsQuery.error]);

  const postsPage = postsQuery.data;
  const posts = postsPage?.items ?? [];
  const loading = postsQuery.isLoading;

  const getBadgeClass = (type: string) => {
    switch (type) {
      case "RESOURCE":
        return "badge badge-resource";
      case "BOUNTY":
        return "badge badge-bounty";
      default:
        return "badge badge-normal";
    }
  };

  const getTypeText = (type: string) => {
    switch (type) {
      case "RESOURCE":
        return "资源";
      case "BOUNTY":
        return "悬赏";
      default:
        return "讨论";
    }
  };

  return (
    <main className={`${pageStyles.wideShell} ${pageStyles.stack}`}>
      <div className="mb-4">
        <Link
          href="/"
          className={pageStyles.plainLink}
        >
          返回首页
        </Link>
      </div>

      <section className={pageStyles.intro}>
        <div>
          <h1>我的帖子</h1>
          <p>查看你发布过的讨论、资源与悬赏。</p>
        </div>
      </section>

      {errorText && <div className="banner banner-error mb-4">{errorText}</div>}

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <span className="ml-3">加载中...</span>
        </div>
      ) : posts.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">-</div>
          <p className="empty-title">暂无帖子</p>
          <p className="text-muted">你还没有发布任何帖子</p>
          <Link href="/posts/new" className="btn btn-primary mt-4">
            去发帖
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-3">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/posts/${post.id}`}
                className={styles.item}
              >
                <div className={styles.header}>
                  <span className={getBadgeClass(post.postType)}>
                    {getTypeText(post.postType)}
                  </span>
                  <span className="badge badge-info">{post.status}</span>
                </div>
                <h3 className={styles.title}>{post.title}</h3>
                <PostCardStats
                  viewCount={post.viewCount}
                  commentCount={post.commentCount}
                  likeCount={post.likeCount}
                  createdAt={post.createdAt}
                />
              </Link>
            ))}
          </div>
          {postsPage && (
            <PaginationControls
              page={postsPage.page}
              totalPages={postsPage.totalPages}
              total={postsPage.total}
              pageSize={postsPage.pageSize}
              hasNext={postsPage.hasNext}
              hasPrevious={postsPage.hasPrevious}
              disabled={postsQuery.isFetching}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </main>
  );
}
