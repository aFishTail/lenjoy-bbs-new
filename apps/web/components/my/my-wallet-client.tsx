"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect } from "react";
import { toast } from "sonner";

import {
  queryKeys,
  readError,
  requestApiData,
} from "@/components/post/client-helpers";
import type { WalletSummary } from "@/components/post/types";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MyWalletClient() {
  const walletQuery = useQuery({
    queryKey: queryKeys.myWallet,
    queryFn: () =>
      requestApiData<WalletSummary>("/api/users/me/wallet", {
        withAuth: true,
        cache: "no-store",
      }),
  });

  useEffect(() => {
    if (walletQuery.error) {
      toast.error(readError(walletQuery.error));
    }
  }, [walletQuery.error]);

  const wallet = walletQuery.data ?? null;
  const loading = walletQuery.isLoading;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <section className="rounded-3xl border border-amber-200 bg-linear-to-br from-amber-50 via-white to-orange-50 p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.24em] text-amber-700">
          Wallet Center
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">我的钱包</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          查看当前可用金币、冻结金币和最近资产变化，后续资源购买与悬赏结算都会汇总到这里。
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="border-amber-200/70 bg-white/95">
          <CardHeader>
            <CardTitle className="text-base">可用金币</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">
              {loading ? "--" : (wallet?.availableCoins ?? 0)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-white/95">
          <CardHeader>
            <CardTitle className="text-base">冻结金币</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">
              {loading ? "--" : (wallet?.frozenCoins ?? 0)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200/70 bg-white/95">
          <CardHeader>
            <CardTitle className="text-base">总资产</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">
              {loading ? "--" : (wallet?.totalCoins ?? 0)}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>钱包说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-600">
          <p>
            新注册用户会自动获得 100
            金币，管理员也可以在后台为用户执行加币或扣币。
          </p>
          <p>
            当前更新时间：
            {wallet?.updatedAt
              ? new Date(wallet.updatedAt).toLocaleString()
              : "--"}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/my/ledger" className={buttonVariants()}>
              查看流水
            </Link>
            <Link href="/my" className={buttonVariants({ variant: "outline" })}>
              返回个人中心
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
