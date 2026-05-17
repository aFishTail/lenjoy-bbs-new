"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { readError } from "@/components/post/client-helpers";
import {
  useMarkAllMessagesReadMutation,
  useMarkMessageReadMutation,
  useMyMessagesQuery,
} from "@/components/my/use-my-queries";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import pageStyles from "./my-pages.module.css";

function formatTime(value: string) {
  return new Date(value).toLocaleString();
}

function actionLabel(actionUrl?: string | null) {
  if (!actionUrl) {
    return null;
  }
  return actionUrl.startsWith("/posts/") ? "查看帖子" : "查看记录";
}

export function MyMessagesClient() {
  const [markingId, setMarkingId] = useState<number | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const messagesQuery = useMyMessagesQuery();
  const markReadMutation = useMarkMessageReadMutation();
  const markAllReadMutation = useMarkAllMessagesReadMutation();

  useEffect(() => {
    if (messagesQuery.error) {
      toast.error(readError(messagesQuery.error));
    }
  }, [messagesQuery.error]);

  const items = messagesQuery.data ?? [];
  const loading = messagesQuery.isLoading;
  const unreadCount = useMemo(
    () => items.filter((item) => !item.read).length,
    [items],
  );

  async function markRead(messageId: number) {
    setMarkingId(messageId);
    try {
      await markReadMutation.mutateAsync(messageId);
    } catch (error) {
      toast.error(readError(error));
    } finally {
      setMarkingId(null);
    }
  }

  async function markAllRead() {
    setMarkingAll(true);
    try {
      await markAllReadMutation.mutateAsync();
      toast.success("已全部标记为已读");
    } catch (error) {
      toast.error(readError(error));
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <main className={`${pageStyles.shell} ${pageStyles.stack}`}>
      <section className={pageStyles.intro}>
        <div>
          <h1>消息中心</h1>
          <p>集中查看购买、申诉、退款等关键通知。</p>
        </div>
      </section>

      <section className={pageStyles.grid3}>
        <Card className={pageStyles.statCard}>
          <CardHeader>
            <CardTitle className="text-base">消息总数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={pageStyles.number}>
              {loading ? "--" : items.length}
            </div>
          </CardContent>
        </Card>
        <Card className={pageStyles.statCard}>
          <CardHeader>
            <CardTitle className="text-base">未读消息</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={pageStyles.number}>
              {loading ? "--" : unreadCount}
            </div>
          </CardContent>
        </Card>
        <Card className={`${pageStyles.statCard} self-start`}>
          <CardHeader>
            <CardTitle className="text-base">快捷操作</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <button
              type="button"
              className={buttonVariants({ variant: "outline" })}
              onClick={() => void markAllRead()}
              disabled={markingAll || loading || unreadCount === 0}
            >
              {markingAll ? "处理中..." : "全部标记已读"}
            </button>
          </CardContent>
        </Card>
      </section>

      <Card className={pageStyles.contentCard}>
        <CardHeader>
          <CardTitle>最近消息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">
              加载消息中...
            </div>
          ) : null}

          {!loading && items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">
              暂无消息，后续购买成功、申诉提交和退款处理都会显示在这里。
            </div>
          ) : null}

          {!loading
            ? items.map((item) => {
                const linkLabel = actionLabel(item.actionUrl);
                return (
                  <article
                    key={item.id}
                    className={`rounded-2xl border px-4 py-4 transition ${
                      item.read
                        ? "border-slate-200 bg-slate-50/70"
                        : "border-blue-200 bg-blue-50/60"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-semibold text-slate-900">
                            {item.title}
                          </h2>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs ${
                              item.read
                                ? "bg-slate-200 text-slate-600"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {item.read ? "已读" : "未读"}
                          </span>
                        </div>
                        <p className="text-sm leading-6 text-slate-600">
                          {item.content}
                        </p>
                        <p className="text-xs text-slate-400">
                          {formatTime(item.createdAt)}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        {item.actionUrl && linkLabel ? (
                          <Link
                            href={item.actionUrl}
                            className={buttonVariants({ variant: "outline" })}
                          >
                            {linkLabel}
                          </Link>
                        ) : null}
                        {!item.read ? (
                          <button
                            type="button"
                            className={buttonVariants()}
                            onClick={() => void markRead(item.id)}
                            disabled={markingId === item.id}
                          >
                            {markingId === item.id ? "处理中..." : "标记已读"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })
            : null}
        </CardContent>
      </Card>
    </main>
  );
}
