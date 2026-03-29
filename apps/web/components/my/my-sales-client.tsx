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
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <section className="rounded-3xl border border-emerald-200 bg-linear-to-br from-emerald-50 via-white to-lime-50 p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.24em] text-emerald-700">
          Sales Records
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">
          资源销售记录
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          查看资源被购买情况、购买人数和累计净收入。
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">成交笔数</p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">
              {items.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">购买人数</p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">
              {new Set(items.map((item) => item.buyerId)).size}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">累计净收入</p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">
              {totalIncome}
            </p>
          </CardContent>
        </Card>
      </section>

      {loading ? (
        <Card>
          <CardContent className="p-8 text-sm text-slate-500">
            加载销售记录中...
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-sm text-slate-500">
            你的资源还没有成交记录。
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-4">
          {items.map((item) => (
            <Card key={item.purchaseId}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{item.postTitle}</CardTitle>
                    <p className="mt-2 text-sm text-slate-500">
                      买家：{item.buyerUsername || item.buyerId} ·{" "}
                      {new Date(item.purchasedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
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
                  className="text-emerald-700 hover:text-emerald-800"
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
