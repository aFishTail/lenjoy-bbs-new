"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  queryKeys,
  requestApi,
  requestApiData,
} from "@/components/post/client-helpers";
import type { ResourceAppeal, ReportItem, WalletSummary } from "@/components/post/types";
import type {
  AdminBountiesFilters,
  AdminReportsFilters,
  AdminResourceAppealsFilters,
  AdminUsersFilters,
  AdminPostsFilters,
} from "@/components/admin/use-admin-queries";

export function useUpdateAdminUserStatusMutation(filters: AdminUsersFilters) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      nextStatus,
      reason,
    }: {
      userId: number;
      nextStatus: "ACTIVE" | "MUTED" | "BANNED";
      reason: string;
    }) =>
      requestApi(`/api/admin/users/${userId}/status`, {
        method: "PATCH",
        withAuth: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus, reason }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adminUsers(filters),
      });
    },
  });
}

export function useReviewAdminReportMutation(filters: AdminReportsFilters) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      endpoint,
      nextStatus,
      note,
      targetType,
    }: {
      endpoint: string;
      nextStatus: "VALID" | "INVALID" | "PUNISHED";
      note: string;
      targetType: "POST" | "COMMENT";
    }) =>
      requestApi<ReportItem>(endpoint, {
        method: "PATCH",
        withAuth: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: nextStatus,
          resolutionNote: note,
          action:
            nextStatus === "VALID"
              ? targetType === "POST"
                ? "OFFLINE_POST"
                : "DELETE_COMMENT"
              : null,
        }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adminReports(filters),
      });
    },
  });
}

export function useReviewResourceAppealMutation(
  filters: AdminResourceAppealsFilters,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      itemId,
      action,
      refundAmount,
      note,
    }: {
      itemId: number;
      action: "APPROVE" | "REJECT";
      refundAmount: number;
      note: string;
    }) =>
      requestApi<ResourceAppeal>(`/api/admin/resource-appeals/${itemId}`, {
        method: "PATCH",
        withAuth: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          refundAmount: action === "APPROVE" ? refundAmount : 0,
          resolutionNote: note,
        }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adminResourceAppeals(filters),
      });
    },
  });
}

export function useUpdateAdminCoinsMutation() {
  return useMutation({
    mutationFn: ({
      userId,
      operation,
      amount,
      reason,
    }: {
      userId: number;
      operation: "CREDIT" | "DEBIT";
      amount: number;
      reason: string;
    }) =>
      requestApiData<WalletSummary>(`/api/admin/coins/users/${userId}`, {
        method: "PATCH",
        withAuth: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ operation, amount, reason }),
      }),
  });
}

export function useDeleteAdminCommentMutation(
  filters: AdminBountiesFilters,
  postId: number | null,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      commentId,
      reason,
    }: {
      commentId: number;
      reason: string;
    }) =>
      requestApi(`/api/admin/comments/${commentId}`, {
        method: "DELETE",
        withAuth: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason }),
      }),
    onSuccess: async () => {
      if (postId != null) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.adminBountyComments(postId),
        });
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adminBounties(filters),
      });
    },
  });
}

export function useUpdateAdminPostStatusMutation(filters: AdminPostsFilters) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, online }: { postId: number; online: boolean }) =>
      requestApi(
        `/api/admin/posts/${postId}/${online ? "online" : "offline"}`,
        {
          method: "PATCH",
          withAuth: true,
          headers: online
            ? undefined
            : {
                "Content-Type": "application/json",
              },
          body: online ? undefined : JSON.stringify({ reason: "管理员下架" }),
        },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adminPosts(filters),
      });
    },
  });
}