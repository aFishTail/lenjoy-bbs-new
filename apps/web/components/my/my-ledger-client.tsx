"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";

import {
  queryKeys,
  readError,
  requestApiData,
} from "@/components/post/client-helpers";
import type { WalletLedgerItem } from "@/components/post/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const directionLabelMap: Record<WalletLedgerItem["direction"], string> = {
  INCOME: "收入",
  EXPENSE: "支出",
  FREEZE: "冻结",
  UNFREEZE: "解冻",
};

export function MyLedgerClient() {
  const ledgerQuery = useQuery({
    queryKey: queryKeys.myLedger,
    queryFn: () =>
      requestApiData<WalletLedgerItem[]>("/api/users/me/ledger?limit=50", {
        withAuth: true,
        cache: "no-store",
      }),
  });

  useEffect(() => {
    if (ledgerQuery.error) {
      toast.error(readError(ledgerQuery.error));
    }
  }, [ledgerQuery.error]);

  const items = ledgerQuery.data ?? [];
  const loading = ledgerQuery.isLoading;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <section className="rounded-3xl border border-cyan-200 bg-linear-to-br from-cyan-50 via-white to-sky-50 p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-700">
          Ledger Feed
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">金币流水</h1>
        <p className="mt-2 text-sm text-slate-600">
          最近 50
          条资产变动记录会展示在这里，便于追踪注册赠送、后台调整和后续交易结算。
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>资产记录</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-sm text-slate-500">加载流水中...</div>
          ) : items.length === 0 ? (
            <div className="py-8 text-sm text-slate-500">暂无金币流水</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>方向</TableHead>
                    <TableHead>变动</TableHead>
                    <TableHead>业务类型</TableHead>
                    <TableHead>说明</TableHead>
                    <TableHead>变动后余额</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {new Date(item.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>{directionLabelMap[item.direction]}</TableCell>
                      <TableCell
                        className={
                          item.direction === "INCOME"
                            ? "text-emerald-600"
                            : "text-rose-600"
                        }
                      >
                        {item.direction === "INCOME" ? "+" : "-"}
                        {item.changeAmount}
                      </TableCell>
                      <TableCell>{item.bizType}</TableCell>
                      <TableCell>{item.remark || "-"}</TableCell>
                      <TableCell>{item.balanceAfter}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
