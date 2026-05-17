"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { readError } from "@/components/post/client-helpers";
import { PaginationControls } from "@/components/post/pagination-controls";
import { PostCardStats } from "@/components/post/post-card-stats";
import { usePostsQuery } from "@/components/post/use-post-queries";
import { useAuth } from "@/components/providers/auth-provider";
import type { PaginatedResponse, PostSummary } from "@/components/post/types";
import styles from "./post-list.module.css";

const PAGE_SIZE = 20;

gsap.registerPlugin(ScrollTrigger, useGSAP);

type PostHomeClientProps = {
  initialPosts?: PaginatedResponse<PostSummary> | null;
};

export function PostHomeClient({ initialPosts }: PostHomeClientProps = {}) {
  const rootRef = useRef<HTMLElement>(null);
  const [errorText, setErrorText] = useState("");
  const [page, setPage] = useState(1);
  const { authData: auth, hasAuth } = useAuth();
  const isAdmin = auth?.user.roles?.some(
    (role) => role === "ADMIN" || role === "ROLE_ADMIN",
  );

  const postsQuery = usePostsQuery(
    page,
    PAGE_SIZE,
    page === 1 ? initialPosts : undefined,
  );

  const postsPage = postsQuery.data;
  const posts = postsPage?.items ?? [];
  const loading = postsQuery.isLoading;
  const featuredPosts = posts.slice(0, 3);

  const forumMix = useMemo(() => {
    const normal = posts.filter((post) => post.postType === "NORMAL").length;
    const resource = posts.filter((post) => post.postType === "RESOURCE").length;
    const bounty = posts.filter((post) => post.postType === "BOUNTY").length;
    return { normal, resource, bounty };
  }, [posts]);

  useEffect(() => {
    if (postsQuery.error) {
      setErrorText(readError(postsQuery.error));
    }
  }, [postsQuery.error]);

  useGSAP(
    () => {
      const cards = gsap.utils.toArray<HTMLElement>(`.${styles.motionCard}`);
      cards.forEach((card) => {
        gsap.fromTo(
          card,
          { opacity: 0.72, scale: 0.92, y: 36 },
          {
            opacity: 1,
            scale: 1,
            y: 0,
            ease: "power2.out",
            scrollTrigger: {
              trigger: card,
              start: "top 86%",
              end: "bottom 18%",
              scrub: 0.7,
            },
          },
        );
      });

      const revealWords = gsap.utils.toArray<HTMLElement>(
        `.${styles.revealWord}`,
      );
      gsap.fromTo(
        revealWords,
        { opacity: 0.18, y: 8 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.08,
          ease: "none",
          scrollTrigger: {
            trigger: `.${styles.desire}`,
            start: "top 70%",
            end: "bottom 58%",
            scrub: 1,
          },
        },
      );

      gsap.to(`.${styles.heroImage}`, {
        yPercent: -8,
        scale: 1.04,
        ease: "none",
        scrollTrigger: {
          trigger: `.${styles.hero}`,
          start: "top top",
          end: "bottom top",
          scrub: 1,
        },
      });
    },
    { scope: rootRef, dependencies: [posts.length] },
  );

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
    <main ref={rootRef} className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <h1 className={styles.heroTitle}>
            好问题与好资源
            <span className={styles.inlineImage} aria-hidden="true" />
            被认真看见
          </h1>
          <p className={styles.heroSubtitle}>
            Lenjoy 是面向创造者与学习者的社区论坛。讨论想法、交换资源、发布悬赏，把碎片信息沉淀成可检索的知识。
          </p>
          <div className={styles.heroActions}>
            <Link
              href={hasAuth ? "/posts/new" : "/auth"}
              className={styles.primaryAction}
            >
              发布帖子
            </Link>
            <Link
              href={hasAuth ? "/my" : "/auth"}
              className={styles.secondaryAction}
            >
              {hasAuth ? "个人中心" : "登录 / 注册"}
            </Link>
          </div>
        </div>
        <div className={styles.heroMedia} aria-hidden="true">
          <div className={styles.heroImage} />
          <div className={styles.heroPanel}>
            <span>正在发生</span>
            <strong>{featuredPosts[0]?.title ?? "新的讨论正在等待第一条回复"}</strong>
          </div>
        </div>
      </section>

      <section className={styles.interest}>
        <div className={styles.sectionIntro}>
          <h2>社区入口保持清晰，内容流动更安静。</h2>
          <p>
            把讨论、资源和悬赏分成明确路径，减少视觉噪音，让用户能快速判断下一步该读、该发还是该解决问题。
          </p>
        </div>

        <div className={styles.bento}>
          <Link
            href="/discussions"
            className={`${styles.bentoCard} ${styles.bentoLarge} ${styles.motionCard}`}
          >
            <span>{forumMix.normal || "开放"}</span>
            <h3>讨论广场</h3>
            <p>沉淀经验、追问细节、把一个问题聊透。</p>
          </Link>
          <Link
            href="/resources"
            className={`${styles.bentoCard} ${styles.motionCard}`}
          >
            <span>{forumMix.resource || "精选"}</span>
            <h3>资源交换</h3>
            <p>可购买、可收藏、可追踪的资料与模板。</p>
          </Link>
          <Link
            href="/bounties"
            className={`${styles.bentoCard} ${styles.motionCard}`}
          >
            <span>{forumMix.bounty || "协作"}</span>
            <h3>悬赏问答</h3>
            <p>把复杂问题拆成明确回报和可信答案。</p>
          </Link>
          <div
            className={`${styles.bentoCard} ${styles.bentoWide} ${styles.motionCard}`}
          >
            <span>Fresh</span>
            <h3>最新动态</h3>
            <div className={styles.marquee}>
              <div>
                {featuredPosts.map((post) => (
                  <strong key={post.id}>{post.title}</strong>
                ))}
                {featuredPosts.length === 0 ? (
                  <strong>等待第一篇帖子</strong>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.desire}>
        <div className={styles.pinnedCopy}>
          <h2>读起来更像一张安静的工作台。</h2>
        </div>
        <p className={styles.revealText}>
          {"每一张帖子卡片都保留作者、类型、热度和时间，但减少装饰负担；用户可以连续扫描标题，也能立刻进入发帖、刷新或后台管理。"
            .split("")
            .map((word, index) => (
              <span key={`${word}-${index}`} className={styles.revealWord}>
                {word}
              </span>
            ))}
        </p>
      </section>

      {errorText && <div className="banner banner-error mb-4">{errorText}</div>}

      <section className={styles.feed}>
        <div className={styles.feedHeader}>
          <div>
            <h2>最新帖子</h2>
            <p>{postsPage?.total ?? posts.length} 条内容正在社区中流转</p>
          </div>
          <div className={styles.feedActions}>
            {isAdmin && (
              <Link href="/admin" className={styles.softButton}>
                管理后台
              </Link>
            )}
            <button
              type="button"
              className={styles.softButton}
              onClick={() => void postsQuery.refetch()}
            >
              刷新
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
            <span className="ml-3">加载中...</span>
          </div>
        ) : posts.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">-</div>
            <p className="empty-title">暂无帖子</p>
            <p className="text-muted">成为第一个发布帖子的人</p>
          </div>
        ) : (
          <>
            <div className={styles.postGrid}>
              {posts.map((post) => (
                <Link
                  key={post.id}
                  href={`/posts/${post.id}`}
                  className={`${styles.item} ${styles.motionCard}`}
                >
                  <div className={styles.header}>
                    <span className={getBadgeClass(post.postType)}>
                      {getTypeText(post.postType)}
                    </span>
                    <span className="badge badge-info">{post.status}</span>
                    <span className={styles.meta}>
                      by {post.authorUsername || post.authorId}
                    </span>
                  </div>
                  <h3 className={styles.title}>{post.title}</h3>
                  {post.tags && post.tags.length > 0 ? (
                    <div className={styles.tags}>
                      {post.tags.slice(0, 3).map((tag) => (
                        <span key={tag.id}>{tag.name}</span>
                      ))}
                    </div>
                  ) : null}
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
      </section>

      <section className={styles.action}>
        <h2>把今天遇到的问题，变成明天能被找到的答案。</h2>
        <Link href={hasAuth ? "/posts/new" : "/auth"}>开始发布</Link>
      </section>
    </main>
  );
}
