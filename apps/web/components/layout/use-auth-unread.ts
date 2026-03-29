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
