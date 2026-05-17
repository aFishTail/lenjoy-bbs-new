"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { MessageNotification } from "@/components/layout/message-notification";
import { UserMenu } from "@/components/layout/user-menu";
import { queryKeys, requestApiData } from "@/components/post/client-helpers";
import type { PostDetail } from "@/components/post/types";
import { useAuth } from "@/components/providers/auth-provider";
import styles from "./navigation.module.css";

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchKeyword, setSearchKeyword] = useState("");
  const { hasAuth } = useAuth();
  const detailPostId = pathname.match(/^\/posts\/([^/]+)$/)?.[1] ?? null;
  const detailPostTypeQuery = useQuery({
    queryKey: detailPostId
      ? queryKeys.postDetail(detailPostId)
      : ["posts", "detail-nav"],
    queryFn: () =>
      requestApiData<PostDetail>(`/api/posts/${detailPostId}`, {
        withAuth: true,
        cache: "no-store",
      }),
    enabled: !!detailPostId,
  });
  const detailPostType = detailPostTypeQuery.data?.postType;

  const isHome = pathname === "/";
  const isDiscussion =
    pathname === "/discussions" ||
    (!!detailPostId && (!detailPostType || detailPostType === "NORMAL"));
  const isResource =
    pathname === "/resources" ||
    (!!detailPostId && detailPostType === "RESOURCE");
  const isBounty =
    pathname === "/bounties" || (!!detailPostId && detailPostType === "BOUNTY");

  useEffect(() => {
    if (pathname === "/search") {
      setSearchKeyword(searchParams.get("q") || "");
    }
  }, [pathname, searchParams]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const keyword = searchKeyword.trim();
    if (!keyword) {
      return;
    }
    const params = new URLSearchParams({ q: keyword });
    router.push(`/search?${params.toString()}`);
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return null;
  }

  return (
    <nav className={styles.nav}>
      <div className={styles.container}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoIcon}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </span>
          Lenjoy
        </Link>
        <div className={styles.links}>
          <Link
            href="/"
            className={`${styles.link} ${isHome ? styles.active : ""}`}
          >
            首页
          </Link>
          <Link
            href="/discussions"
            className={`${styles.link} ${isDiscussion ? styles.active : ""}`}
          >
            讨论
          </Link>
          <Link
            href="/resources"
            className={`${styles.link} ${isResource ? styles.active : ""}`}
          >
            资源
          </Link>
          <Link
            href="/bounties"
            className={`${styles.link} ${isBounty ? styles.active : ""}`}
          >
            悬赏
          </Link>
        </div>
        <form className={styles.search} onSubmit={handleSearchSubmit}>
          <input
            className={styles.searchInput}
            value={searchKeyword}
            onChange={(event) => setSearchKeyword(event.target.value)}
            placeholder="搜索帖子"
            aria-label="搜索帖子"
            maxLength={100}
          />
          <button className={styles.searchButton} type="submit" aria-label="搜索">
            <svg
              className="icon-sm"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </button>
        </form>
        <div className={styles.actions}>
          <MessageNotification />
          <UserMenu />
          <Link
            href={hasAuth ? "/posts/new" : "/auth"}
            className={styles.newPost}
          >
            <svg
              className="icon-sm"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            发帖
          </Link>
        </div>
      </div>
    </nav>
  );
}
