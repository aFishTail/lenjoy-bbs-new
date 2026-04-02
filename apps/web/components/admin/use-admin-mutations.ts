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

export function useCreateAdminCategoryMutation(contentType: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      name: string;
      contentType: string;
      parentId: number;
      sort: number;
      leaf: boolean;
    }) =>
      requestApi(`/api/admin/categories`, {
        method: "POST",
        withAuth: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adminCategories(contentType),
      });
    },
  });
}

export function useUpdateAdminCategoryStatusMutation(contentType: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ categoryId, status }: { categoryId: number; status: string }) =>
      requestApi(`/api/admin/categories/${categoryId}/status`, {
        method: "PATCH",
        withAuth: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adminCategories(contentType),
      });
    },
  });
}

export function useCreateAdminTagMutation(keyword: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { name: string }) =>
      requestApi(`/api/admin/tags`, {
        method: "POST",
        withAuth: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adminTags(keyword),
      });
    },
  });
}

export function useUpdateAdminTagStatusMutation(keyword: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tagId, status }: { tagId: number; status: string }) =>
      requestApi(`/api/admin/tags/${tagId}/status`, {
        method: "PATCH",
        withAuth: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adminTags(keyword),
      });
    },
  });
}

export function useMergeAdminTagMutation(keyword: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      tagId,
      targetTagId,
    }: {
      tagId: number;
      targetTagId: number;
    }) =>
      requestApi(`/api/admin/tags/${tagId}/merge`, {
        method: "POST",
        withAuth: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ targetTagId }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adminTags(keyword),
      });
    },
  });
}
