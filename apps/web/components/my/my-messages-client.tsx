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
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <section className="rounded-3xl border border-cyan-200 bg-linear-to-br from-cyan-50 via-white to-emerald-50 p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-700">
          Message Center
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">消息中心</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          这里会收拢资源购买、申诉提交和退款处理等关键通知，避免交易状态只停留在
          toast。
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card className="border-cyan-200 bg-white/95">
          <CardHeader>
            <CardTitle className="text-base">消息总数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">
              {loading ? "--" : items.length}
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-white/95">
          <CardHeader>
            <CardTitle className="text-base">未读消息</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">
              {loading ? "--" : unreadCount}
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-white/95">
          <CardHeader>
            <CardTitle className="text-base">快捷操作</CardTitle>
          </CardHeader>
          <CardContent className="flex h-full items-center">
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

      <Card>
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
                        : "border-cyan-200 bg-cyan-50/60"
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
                                : "bg-cyan-100 text-cyan-700"
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
