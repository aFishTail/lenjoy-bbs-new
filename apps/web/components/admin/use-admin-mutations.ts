"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  queryKeys,
  requestApi,
  requestApiData,
} from "@/components/post/client-helpers";
import type {
  OpenApiBindingSummary,
  OpenApiClientSummary,
  ResourceAppeal,
  ReportItem,
  WalletSummary,
} from "@/components/post/types";
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

export function useUpdateAdminCategoryMutation(contentType: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      categoryId,
      payload,
    }: {
      categoryId: number;
      payload: {
        name: string;
        contentType: string;
        parentId: number;
        sort: number;
        leaf: boolean;
      };
    }) =>
      requestApi(`/api/admin/categories/${categoryId}`, {
        method: "PUT",
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

export function useDeleteAdminCategoryMutation(contentType: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (categoryId: number) =>
      requestApi(`/api/admin/categories/${categoryId}`, {
        method: "DELETE",
        withAuth: true,
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

export function useUpdateAdminTagMutation(keyword: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tagId, payload }: { tagId: number; payload: { name: string } }) =>
      requestApi(`/api/admin/tags/${tagId}`, {
        method: "PUT",
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

export function useDeleteAdminTagMutation(keyword: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tagId: number) =>
      requestApi(`/api/admin/tags/${tagId}`, {
        method: "DELETE",
        withAuth: true,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adminTags(keyword),
      });
    },
  });
}

export function useCreateOpenApiClientMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { name: string; remark?: string; status: string }) =>
      requestApiData<OpenApiClientSummary>("/api/admin/open-api/clients", {
        method: "POST",
        withAuth: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adminOpenApiClients,
      });
    },
  });
}

export function useUpdateOpenApiClientMutation(clientId?: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      clientId: currentClientId,
      payload,
    }: {
      clientId: number;
      payload: { name: string; remark?: string; status: string };
    }) =>
      requestApiData<OpenApiClientSummary>(
        `/api/admin/open-api/clients/${currentClientId}`,
        {
          method: "PUT",
          withAuth: true,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adminOpenApiClients,
      });
      if (clientId != null) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.adminOpenApiClient(clientId),
        });
      }
    },
  });
}

export function useUpdateOpenApiClientStatusMutation(clientId?: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      clientId: currentClientId,
      status,
    }: {
      clientId: number;
      status: "ACTIVE" | "INACTIVE";
    }) =>
      requestApiData<OpenApiClientSummary>(
        `/api/admin/open-api/clients/${currentClientId}/status`,
        {
          method: "PATCH",
          withAuth: true,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adminOpenApiClients,
      });
      if (clientId != null) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.adminOpenApiClient(clientId),
        });
      }
    },
  });
}

export function useDeleteOpenApiClientMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (clientId: number) =>
      requestApi(`/api/admin/open-api/clients/${clientId}`, {
        method: "DELETE",
        withAuth: true,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adminOpenApiClients,
      });
    },
  });
}

export function useCreateOpenApiBindingMutation(clientId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      bindingCode: string;
      userId?: number;
      username?: string;
      remark?: string;
      status: string;
    }) =>
      requestApiData<OpenApiBindingSummary>(
        `/api/admin/open-api/clients/${clientId}/bindings`,
        {
          method: "POST",
          withAuth: true,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adminOpenApiBindings(clientId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adminOpenApiClient(clientId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adminOpenApiClients,
      });
    },
  });
}

export function useUpdateOpenApiBindingMutation(clientId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      bindingId,
      payload,
    }: {
      bindingId: number;
      payload: {
        bindingCode: string;
        userId?: number;
        username?: string;
        remark?: string;
        status: string;
      };
    }) =>
      requestApiData<OpenApiBindingSummary>(
        `/api/admin/open-api/clients/${clientId}/bindings/${bindingId}`,
        {
          method: "PUT",
          withAuth: true,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adminOpenApiBindings(clientId),
      });
    },
  });
}

export function useUpdateOpenApiBindingStatusMutation(clientId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      bindingId,
      status,
    }: {
      bindingId: number;
      status: "ACTIVE" | "INACTIVE";
    }) =>
      requestApiData<OpenApiBindingSummary>(
        `/api/admin/open-api/clients/${clientId}/bindings/${bindingId}/status`,
        {
          method: "PATCH",
          withAuth: true,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adminOpenApiBindings(clientId),
      });
    },
  });
}

export function useDeleteOpenApiBindingMutation(clientId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bindingId: number) =>
      requestApi(`/api/admin/open-api/clients/${clientId}/bindings/${bindingId}`, {
        method: "DELETE",
        withAuth: true,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adminOpenApiBindings(clientId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adminOpenApiClient(clientId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adminOpenApiClients,
      });
    },
  });
}
