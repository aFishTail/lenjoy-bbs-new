"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type { AuthData } from "@/components/post/types";
import {
  MESSAGE_EVENT,
  getStoredAuth,
  queryKeys,
  requestApiData,
} from "@/components/post/client-helpers";

const AUTH_STORAGE_KEY = "lenjoy.auth";

export function useClientAuth() {
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [authData, setAuthData] = useState<AuthData | null>(null);

  useEffect(() => {
    setMounted(true);
    setAuthData(getStoredAuth());

    const handleStorageChange = () => {
      const nextAuthData = getStoredAuth();
      setAuthData(nextAuthData);
      if (nextAuthData?.token) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount });
        return;
      }
      queryClient.removeQueries({ queryKey: queryKeys.unreadCount });
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [queryClient]);

  function clearAuth() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthData(null);
    queryClient.removeQueries({ queryKey: queryKeys.unreadCount });
  }

  return {
    mounted,
    authData,
    user: authData?.user ?? null,
    hasAuth: !!authData?.token,
    clearAuth,
  };
}

export function useUnreadCount(enabled: boolean) {
  const queryClient = useQueryClient();

  const unreadCountQuery = useQuery({
    queryKey: queryKeys.unreadCount,
    queryFn: () =>
      requestApiData<number>("/api/users/me/messages/unread-count", {
        withAuth: true,
        cache: "no-store",
      }),
    enabled,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const handleMessageChange = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount });
    };

    window.addEventListener(MESSAGE_EVENT, handleMessageChange);
    return () => window.removeEventListener(MESSAGE_EVENT, handleMessageChange);
  }, [queryClient]);

  return {
    ...unreadCountQuery,
    unreadCount: unreadCountQuery.data ?? 0,
  };
}
