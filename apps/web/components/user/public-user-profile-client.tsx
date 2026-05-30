"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import pageStyles from "@/components/my/my-pages.module.css";
import { PaginationControls } from "@/components/post/pagination-controls";
import { PostCardStats } from "@/components/post/post-card-stats";
import { readError } from "@/components/post/client-helpers";
import styles from "@/components/post/post-list.module.css";
import { useUserPostsQuery } from "@/components/post/use-post-queries";
import { useAuth } from "@/components/providers/auth-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  usePublicUserProfileQuery,
  useToggleUserFollowMutation,
} from "./use-user-queries";

const PAGE_SIZE = 20;

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className={pageStyles.statCard}>
      <CardContent className="p-4">
        <p className="text-xs text-slate-500">{label}</p>
        <p className={`mt-1 ${pageStyles.number}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function getBadgeClass(type: string) {
  switch (type) {
    case "RESOURCE":
      return "badge badge-resource";
    case "BOUNTY":
      return "badge badge-bounty";
    default:
      return "badge badge-normal";
  }
}

function getTypeText(type: string) {
  switch (type) {
    case "RESOURCE":
      return "资源";
    case "BOUNTY":
      return "悬赏";
    default:
      return "讨论";
  }
}

type Props = {
  userId: string;
};

export function PublicUserProfileClient({ userId }: Props) {
  const router = useRouter();
  const { authData: auth } = useAuth();
  const [page, setPage] = useState(1);
  const [errorText, setErrorText] = useState("");
  const profileQuery = usePublicUserProfileQuery(userId);
  const postsQuery = useUserPostsQuery(userId, page, PAGE_SIZE);
  const toggleFollowMutation = useToggleUserFollowMutation(userId);

  const profile = profileQuery.data ?? null;
  const displayName = profile?.nickname || profile?.username || "";
  const postsPage = postsQuery.data;
  const posts = postsPage?.items ?? [];
  const loading = profileQuery.isLoading || postsQuery.isLoading;

  useEffect(() => {
    const error = profileQuery.error ?? postsQuery.error;
    if (error) {
      setErrorText(readError(error));
    }
  }, [profileQuery.error, postsQuery.error]);

  async function toggleFollow() {
    if (!auth) {
      router.push("/auth");
      return;
    }

    try {
      const payload = await toggleFollowMutation.mutateAsync();
      toast.success(payload.following ? "已关注" : "已取消关注");
    } catch (error) {
      toast.error(readError(error));
    }
  }

  if (loading && !profile) {
    return (
      <main className={`${pageStyles.wideShell} ${pageStyles.stack}`}>
        <Card className={pageStyles.contentCard}>
          <CardContent className="p-8 text-sm text-slate-500">
            加载用户资料中...
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className={`${pageStyles.wideShell} ${pageStyles.stack}`}>
      <div>
        <Link href="/" className={pageStyles.plainLink}>
          返回首页
        </Link>
      </div>

      {errorText && <div className="banner banner-error">{errorText}</div>}

      {profile ? (
        <>
          <section className={pageStyles.intro}>
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-2xl font-semibold text-slate-500">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={`${displayName} 的头像`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  displayName.charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <h1>{displayName}</h1>
                <p>{profile.bio || "这个用户还没有填写简介。"}</p>
              </div>
            </div>
            {profile.isSelf ? (
              <Link href="/my" className={buttonVariants()}>
                个人中心
              </Link>
            ) : (
              <Button
                type="button"
                variant={profile.followedByMe ? "outline" : "default"}
                onClick={() => void toggleFollow()}
                disabled={toggleFollowMutation.isPending}
              >
                {toggleFollowMutation.isPending
                  ? "处理中..."
                  : profile.followedByMe
                    ? "取消关注"
                    : "关注"}
              </Button>
            )}
          </section>

          <section className={pageStyles.grid3}>
            <StatCard label="发帖数" value={profile.postCount} />
            <StatCard label="关注数" value={profile.followingCount} />
            <StatCard label="粉丝数" value={profile.followerCount} />
          </section>

          <section className={pageStyles.stack}>
            <div className={pageStyles.intro}>
              <div>
                <h1>公开帖子</h1>
                <p>查看 {displayName} 已发布且公开可见的内容。</p>
              </div>
            </div>

            {postsQuery.isLoading ? (
              <div className="loading">
                <div className="spinner"></div>
                <span className="ml-3">加载中...</span>
              </div>
            ) : posts.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">-</div>
                <p className="empty-title">暂无公开帖子</p>
                <p className="text-muted">这个用户还没有发布公开内容。</p>
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
                {postsPage ? (
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
                ) : null}
              </>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
