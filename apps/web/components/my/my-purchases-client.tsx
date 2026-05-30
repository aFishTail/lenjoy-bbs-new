"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";

import {
  queryKeys,
  readError,
  requestApiData,
} from "@/components/post/client-helpers";
import type { ResourcePurchaseSummary } from "@/components/post/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import pageStyles from "./my-pages.module.css";

export function MyPurchasesClient() {
  const purchasesQuery = useQuery({
    queryKey: queryKeys.myPurchases,
    queryFn: () =>
      requestApiData<ResourcePurchaseSummary[]>(
        "/api/users/me/resource-purchases",
        {
          withAuth: true,
          cache: "no-store",
        },
      ),
  });

  useEffect(() => {
    if (purchasesQuery.error) {
      toast.error(readError(purchasesQuery.error));
    }
  }, [purchasesQuery.error]);

  const items = purchasesQuery.data ?? [];
  const loading = purchasesQuery.isLoading;

  const settledTotal = useMemo(
    () =>
      items.reduce((sum, item) => sum + (item.price - item.refundedAmount), 0),
    [items],
  );

  return (
    <main className={`${pageStyles.wideShell} ${pageStyles.stack}`}>
      <section className={pageStyles.intro}>
        <div>
          <h1>已购资源</h1>
          <p>查看已解锁资源和购买记录。</p>
        </div>
      </section>

      <section className={pageStyles.grid3}>
        <Card className={pageStyles.statCard}>
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">购买笔数</p>
            <p className={`mt-1 ${pageStyles.number}`}>
              {items.length}
            </p>
          </CardContent>
        </Card>
        <Card className={pageStyles.statCard}>
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">累计支付</p>
            <p className={`mt-1 ${pageStyles.number}`}>
              {items.reduce((sum, item) => sum + item.price, 0)}
            </p>
          </CardContent>
        </Card>
        <Card className={pageStyles.statCard}>
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">当前净支出</p>
            <p className={`mt-1 ${pageStyles.number}`}>
              {settledTotal}
            </p>
          </CardContent>
        </Card>
      </section>

      {loading ? (
        <Card className={pageStyles.contentCard}>
          <CardContent className="p-8 text-sm text-slate-500">
            加载购买记录中...
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card className={pageStyles.contentCard}>
          <CardContent className="p-8 text-sm text-slate-500">
            你还没有购买任何资源。
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
                      卖家：{item.sellerUsername || item.sellerId} ·{" "}
                      {new Date(item.purchasedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className={pageStyles.statusPill}>
                    {item.status}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-slate-600">
                <div className="flex flex-wrap gap-4">
                  <span>支付金币 {item.price}</span>
                  <span>已退款 {item.refundedAmount}</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    onClick={() => {
                      window.location.href = `/posts/${item.postId}`;
                    }}
                  >
                    回到详情页
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </main>
  );
}
