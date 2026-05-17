"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";

import {
  queryKeys,
  readError,
  requestApiData,
} from "@/components/post/client-helpers";
import type { ResourcePurchaseSummary } from "@/components/post/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import pageStyles from "./my-pages.module.css";

export function MySalesClient() {
  const salesQuery = useQuery({
    queryKey: queryKeys.mySales,
    queryFn: () =>
      requestApiData<ResourcePurchaseSummary[]>(
        "/api/users/me/resource-sales",
        {
          withAuth: true,
          cache: "no-store",
        },
      ),
  });

  useEffect(() => {
    if (salesQuery.error) {
      toast.error(readError(salesQuery.error));
    }
  }, [salesQuery.error]);

  const items = salesQuery.data ?? [];
  const loading = salesQuery.isLoading;

  const totalIncome = useMemo(
    () =>
      items.reduce((sum, item) => sum + (item.price - item.refundedAmount), 0),
    [items],
  );

  return (
    <main className={`${pageStyles.wideShell} ${pageStyles.stack}`}>
      <section className={pageStyles.intro}>
        <div>
          <h1>销售记录</h1>
          <p>查看资源成交情况、购买人数和累计净收入。</p>
        </div>
      </section>

      <section className={pageStyles.grid3}>
        <Card className={pageStyles.statCard}>
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">成交笔数</p>
            <p className={`mt-1 ${pageStyles.number}`}>
              {items.length}
            </p>
          </CardContent>
        </Card>
        <Card className={pageStyles.statCard}>
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">购买人数</p>
            <p className={`mt-1 ${pageStyles.number}`}>
              {new Set(items.map((item) => item.buyerId)).size}
            </p>
          </CardContent>
        </Card>
        <Card className={pageStyles.statCard}>
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">累计净收入</p>
            <p className={`mt-1 ${pageStyles.number}`}>
              {totalIncome}
            </p>
          </CardContent>
        </Card>
      </section>

      {loading ? (
        <Card className={pageStyles.contentCard}>
          <CardContent className="p-8 text-sm text-slate-500">
            加载销售记录中...
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card className={pageStyles.contentCard}>
          <CardContent className="p-8 text-sm text-slate-500">
            你的资源还没有成交记录。
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-4">
          {items.map((item) => (
            <Card key={item.purchaseId} className={pageStyles.contentCard}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{item.postTitle}</CardTitle>
                    <p className="mt-2 text-sm text-slate-500">
                      买家：{item.buyerUsername || item.buyerId} ·{" "}
                      {new Date(item.purchasedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className={pageStyles.statusPill}>
                    {item.status}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-600">
                <div className="flex flex-wrap gap-4">
                  <span>成交金额 {item.price}</span>
                  <span>已退款 {item.refundedAmount}</span>
                  <span>净收入 {item.price - item.refundedAmount}</span>
                  <span>申诉状态 {item.appealStatus || "无"}</span>
                </div>
                <Link
                  href={`/posts/${item.postId}`}
                  className={`${pageStyles.blueText} hover:underline`}
                >
                  查看原帖
                </Link>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </main>
  );
}
