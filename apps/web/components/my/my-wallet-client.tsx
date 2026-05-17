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
import pageStyles from "./my-pages.module.css";

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
    <main className={`${pageStyles.shell} ${pageStyles.stack}`}>
      <section className={pageStyles.intro}>
        <div>
          <h1>我的钱包</h1>
          <p>查看可用金币、冻结金币和当前资产概览。</p>
        </div>
      </section>

      <section className={pageStyles.grid3}>
        <Card className={pageStyles.statCard}>
          <CardHeader>
            <CardTitle className="text-base">可用金币</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={pageStyles.number}>
              {loading ? "--" : (wallet?.availableCoins ?? 0)}
            </div>
          </CardContent>
        </Card>
        <Card className={pageStyles.statCard}>
          <CardHeader>
            <CardTitle className="text-base">冻结金币</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={pageStyles.number}>
              {loading ? "--" : (wallet?.frozenCoins ?? 0)}
            </div>
          </CardContent>
        </Card>
        <Card className={pageStyles.statCard}>
          <CardHeader>
            <CardTitle className="text-base">总资产</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={pageStyles.number}>
              {loading ? "--" : (wallet?.totalCoins ?? 0)}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className={pageStyles.contentCard}>
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
