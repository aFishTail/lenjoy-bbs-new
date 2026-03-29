"use client";

import Link from "next/link";
import { useEffect } from "react";
import { toast } from "sonner";

import { readError } from "@/components/post/client-helpers";
import { useAdminOverviewQuery } from "@/components/admin/use-admin-queries";

export function AdminOverviewClient() {
  const overviewQuery = useAdminOverviewQuery();

  useEffect(() => {
    if (overviewQuery.error) {
      toast.error(readError(overviewQuery.error));
    }
  }, [overviewQuery.error]);

  const metrics = overviewQuery.data ?? null;
  const loading = overviewQuery.isLoading;

  return (
    <main className="admin-main">
      <section className="admin-hero">
        <h1>运营控制台</h1>
        <p>集中处理互动治理、举报处置和资产审计。</p>
      </section>

      <section className="admin-kpi-grid">
        <article className="admin-kpi-card">
          <h3>新增用户</h3>
          <p>{loading ? "加载中..." : `${metrics?.newUserCount ?? 0} 人`}</p>
        </article>
        <article className="admin-kpi-card">
          <h3>帖子总量</h3>
          <p>{loading ? "加载中..." : `${metrics?.postCount ?? 0} 条`}</p>
        </article>
        <article className="admin-kpi-card">
          <h3>资源购买单</h3>
          <p>
            {loading
              ? "加载中..."
              : `${metrics?.resourcePurchaseCount ?? 0} 单`}
          </p>
        </article>
        <article className="admin-kpi-card">
          <h3>悬赏采纳率</h3>
          <p>
            {loading
              ? "加载中..."
              : `${((metrics?.bountyAcceptanceRate ?? 0) * 100).toFixed(2)}%`}
          </p>
        </article>
      </section>

      <section className="admin-kpi-grid">
        <article className="admin-kpi-card">
          <h3>举报处理</h3>
          <p>帖子与评论举报统一处理。</p>
          <Link href="/admin/reports" className="admin-kpi-link">
            进入举报管理
          </Link>
        </article>
        <article className="admin-kpi-card">
          <h3>资产审计</h3>
          <p>按用户和业务类型查看交易流水。</p>
          <Link href="/admin/audit" className="admin-kpi-link">
            进入资产审计
          </Link>
        </article>
        <article className="admin-kpi-card">
          <h3>金币发放总量</h3>
          <p>{loading ? "加载中..." : `${metrics?.totalCoinIssued ?? 0}`}</p>
        </article>
        <article className="admin-kpi-card">
          <h3>金币消耗总量</h3>
          <p>{loading ? "加载中..." : `${metrics?.totalCoinConsumed ?? 0}`}</p>
        </article>
      </section>
    </main>
  );
}
