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
import pageStyles from "./my-pages.module.css";

const directionLabelMap: Record<WalletLedgerItem["direction"], string> = {
  IN: "收入",
  OUT: "支出",
  FREEZE: "冻结",
  UNFREEZE: "解冻",
  INCOME: "收入",
  EXPENSE: "支出",
};

function isIncomeDirection(direction: WalletLedgerItem["direction"]) {
  return (
    direction === "IN" || direction === "INCOME" || direction === "UNFREEZE"
  );
}

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
    <main className={`${pageStyles.wideShell} ${pageStyles.stack}`}>
      <section className={pageStyles.intro}>
        <div>
          <h1>金币流水</h1>
          <p>查看最近 50 条资产变动，追踪赠送、调整和交易结算。</p>
        </div>
      </section>

      <Card className={pageStyles.contentCard}>
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
                  {items.map((item) => {
                    const isIncome = isIncomeDirection(item.direction);

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          {new Date(item.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {directionLabelMap[item.direction]}
                        </TableCell>
                        <TableCell
                          className={
                            isIncome ? "text-blue-600" : "text-rose-600"
                          }
                        >
                          {isIncome ? "+" : "-"}
                          {item.changeAmount}
                        </TableCell>
                        <TableCell>{item.bizType}</TableCell>
                        <TableCell>{item.remark || "-"}</TableCell>
                        <TableCell>{item.balanceAfter}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
