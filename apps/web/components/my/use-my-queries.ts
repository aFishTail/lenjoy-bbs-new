"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fireMessageChanged,
  queryKeys,
  requestApi,
  requestApiData,
} from "@/components/post/client-helpers";
import type {
  MyProfile,
  SiteMessage,
  WalletSummary,
} from "@/components/post/types";

export function useMyProfileQuery() {
  return useQuery({
    queryKey: queryKeys.myProfile,
    queryFn: () =>
      requestApiData<MyProfile>("/api/users/me", {
        withAuth: true,
        cache: "no-store",
      }),
  });
}

export function useMyWalletQuery() {
  return useQuery({
    queryKey: queryKeys.myWallet,
    queryFn: () =>
      requestApiData<WalletSummary>("/api/users/me/wallet", {
        withAuth: true,
        cache: "no-store",
      }),
  });
}

export function useSaveProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      username: string;
      avatarUrl: string;
      bio: string;
    }) =>
      requestApiData<MyProfile>("/api/users/me", {
        method: "PATCH",
        withAuth: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }),
    onSuccess: (nextProfile) => {
      queryClient.setQueryData(queryKeys.myProfile, nextProfile);
    },
  });
}

export function useMyMessagesQuery() {
  return useQuery({
    queryKey: queryKeys.myMessages,
    queryFn: () =>
      requestApiData<SiteMessage[]>("/api/users/me/messages", {
        withAuth: true,
        cache: "no-store",
      }),
  });
}

export function useMarkMessageReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId: number) =>
      requestApiData<SiteMessage>(`/api/users/me/messages/${messageId}/read`, {
        method: "PATCH",
        withAuth: true,
      }),
    onSuccess: (payload) => {
      queryClient.setQueryData<SiteMessage[]>(
        queryKeys.myMessages,
        (prev = []) =>
          prev.map((item) => (item.id === payload.id ? payload : item)),
      );
      fireMessageChanged();
      void queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount });
    },
  });
}

export function useMarkAllMessagesReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      requestApi<number>("/api/users/me/messages/read-all", {
        method: "PATCH",
        withAuth: true,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.myMessages });
      fireMessageChanged();
      void queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount });
    },
  });
}
