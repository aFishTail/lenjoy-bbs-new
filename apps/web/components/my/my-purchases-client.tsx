"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  fireMessageChanged,
  queryKeys,
  readError,
  requestApi,
  requestApiData,
} from "@/components/post/client-helpers";
import type {
  ResourceAppeal,
  ResourcePurchaseSummary,
} from "@/components/post/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MyPurchasesClient() {
  const [reasonById, setReasonById] = useState<Record<number, string>>({});
  const [detailById, setDetailById] = useState<Record<number, string>>({});
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const queryClient = useQueryClient();

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

  const appealMutation = useMutation({
    mutationFn: ({
      purchaseId,
      reason,
      detail,
    }: {
      purchaseId: number;
      reason: string;
      detail: string;
    }) =>
      requestApi<ResourceAppeal>(
        `/api/resource-purchases/${purchaseId}/appeal`,
        {
          method: "POST",
          withAuth: true,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason, detail }),
        },
      ),
    onSuccess: async () => {
      fireMessageChanged();
      await queryClient.invalidateQueries({ queryKey: queryKeys.myPurchases });
    },
  });

  useEffect(() => {
    if (purchasesQuery.error) {
      toast.error(readError(purchasesQuery.error));
    }
  }, [purchasesQuery.error]);

  const items = purchasesQuery.data ?? [];
  const loading = purchasesQuery.isLoading;

  async function submitAppeal(item: ResourcePurchaseSummary) {
    const reason = (reasonById[item.purchaseId] || "").trim();
    const detail = (detailById[item.purchaseId] || "").trim();
    if (!reason) {
      toast.error("请填写申诉原因");
      return;
    }
    setSubmittingId(item.purchaseId);
    try {
      await appealMutation.mutateAsync({
        purchaseId: item.purchaseId,
        reason,
        detail,
      });
      toast.success("申诉已提交，请等待后台处理");
      setReasonById((prev) => ({ ...prev, [item.purchaseId]: "" }));
      setDetailById((prev) => ({ ...prev, [item.purchaseId]: "" }));
    } catch (error) {
      toast.error(readError(error));
    } finally {
      setSubmittingId(null);
    }
  }

  const settledTotal = useMemo(
    () =>
      items.reduce((sum, item) => sum + (item.price - item.refundedAmount), 0),
    [items],
  );

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <section className="rounded-3xl border border-amber-200 bg-linear-to-br from-amber-50 via-white to-orange-50 p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.24em] text-amber-700">
          Purchased Resources
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">已购资源</h1>
        <p className="mt-2 text-sm text-slate-600">
          查看你已经解锁的资源，必要时可提交资源失效或内容不符申诉。
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">购买笔数</p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">
              {items.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">累计支付</p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">
              {items.reduce((sum, item) => sum + item.price, 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">当前净支出</p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">
              {settledTotal}
            </p>
          </CardContent>
        </Card>
      </section>

      {loading ? (
        <Card>
          <CardContent className="p-8 text-sm text-slate-500">
            加载购买记录中...
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-sm text-slate-500">
            你还没有购买任何资源。
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-4">
          {items.map((item) => {
            const canAppeal = !item.appealStatus && item.status !== "REFUNDED";
            return (
              <Card key={item.purchaseId}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">
                        {item.postTitle}
                      </CardTitle>
                      <p className="mt-2 text-sm text-slate-500">
                        卖家：{item.sellerUsername || item.sellerId} ·{" "}
                        {new Date(item.purchasedAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      {item.status}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-slate-600">
                  <div className="flex flex-wrap gap-4">
                    <span>支付金币 {item.price}</span>
                    <span>已退款 {item.refundedAmount}</span>
                    <span>申诉状态 {item.appealStatus || "未申诉"}</span>
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
                  {canAppeal && (
                    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="grid gap-2">
                        <Label htmlFor={`appeal-reason-${item.purchaseId}`}>
                          申诉原因
                        </Label>
                        <Input
                          id={`appeal-reason-${item.purchaseId}`}
                          value={reasonById[item.purchaseId] || ""}
                          onChange={(event) =>
                            setReasonById((prev) => ({
                              ...prev,
                              [item.purchaseId]: event.target.value,
                            }))
                          }
                          placeholder="例如：下载链接失效、内容与描述不符"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor={`appeal-detail-${item.purchaseId}`}>
                          补充说明
                        </Label>
                        <textarea
                          id={`appeal-detail-${item.purchaseId}`}
                          className="min-h-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-all focus-visible:border-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-700/20"
                          value={detailById[item.purchaseId] || ""}
                          onChange={(event) =>
                            setDetailById((prev) => ({
                              ...prev,
                              [item.purchaseId]: event.target.value,
                            }))
                          }
                          placeholder="补充具体情况，方便后台核验"
                        />
                      </div>
                      <div>
                        <Button
                          type="button"
                          disabled={submittingId === item.purchaseId}
                          onClick={() => void submitAppeal(item)}
                        >
                          {submittingId === item.purchaseId
                            ? "提交中..."
                            : "提交申诉"}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}
    </main>
  );
}
