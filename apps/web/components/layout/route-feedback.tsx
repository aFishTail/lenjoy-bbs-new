"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

export function RouteFeedback() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const error = searchParams.get("error");
    if (error !== "admin-forbidden") {
      return;
    }

    const nextPath = pathname;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("error");
    const nextQuery = params.toString();

    const timer = window.setTimeout(() => {
      toast.error("你没有管理员权限");
      router.replace(nextQuery ? `${nextPath}?${nextQuery}` : nextPath, {
        scroll: false,
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [pathname, router, searchParams]);

  return null;
}
