"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys, requestApiData } from "@/components/post/client-helpers";
import type {
  AdminBountySummary,
  CategorySummary,
  AdminCoinUserSummary,
  AdminDashboardMetrics,
  AdminUserSummary,
  PostSummary,
  PostComment,
  ReportItem,
  ResourceTradeAuditItem,
  ResourceAppeal,
  TagSummary,
  WalletLedgerItem,
} from "@/components/post/types";

export type AdminUsersFilters = {
  status: string;
  keyword: string;
};

export type AdminPostsFilters = {
  status: string;
  postType: string;
  author: string;
  categoryId: string;
  tagId: string;
};

export type AdminReportsFilters = {
  status: string;
  targetType: string;
  keyword: string;
};

export type AdminResourceAppealsFilters = {
  status: string;
  keyword: string;
};

export type AdminCoinsFilters = {
  status: string;
  keyword: string;
};

export type AdminBountiesFilters = {
  status: string;
  keyword: string;
};

export type AdminWalletAuditFilters = {
  userId: string;
  bizType: string;
  limit: string;
};

export type AdminTradeAuditFilters = {
  userId: string;
  postId: string;
  limit: string;
};

function buildSearchParams(filters: Record<string, string>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });
  return params.toString();
}

function toIntOrUndefined(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n <= 0) {
    return undefined;
  }
  return n;
}

export function useAdminOverviewQuery() {
  return useQuery({
    queryKey: queryKeys.adminOverview,
    queryFn: () =>
      requestApiData<AdminDashboardMetrics>("/api/admin/metrics/dashboard", {
        withAuth: true,
        cache: "no-store",
      }),
  });
}

export function useAdminUsersQuery(filters: AdminUsersFilters) {
  return useQuery({
    queryKey: queryKeys.adminUsers(filters),
    queryFn: () => {
      const query = buildSearchParams(filters);
      return requestApiData<AdminUserSummary[]>(
        `/api/admin/users${query ? `?${query}` : ""}`,
        {
          withAuth: true,
          cache: "no-store",
        },
      );
    },
  });
}

export function useAdminPostsQuery(filters: AdminPostsFilters) {
  return useQuery({
    queryKey: queryKeys.adminPosts(filters),
    queryFn: () => {
      const query = buildSearchParams(filters);
      return requestApiData<PostSummary[]>(
        `/api/admin/posts${query ? `?${query}` : ""}`,
        {
          withAuth: true,
          cache: "no-store",
        },
      );
    },
  });
}

export function useAdminCategoriesQuery(contentType: string) {
  return useQuery({
    queryKey: queryKeys.adminCategories(contentType),
    queryFn: () =>
      requestApiData<CategorySummary[]>(
        `/api/admin/categories${contentType ? `?contentType=${contentType}` : ""}`,
        {
          withAuth: true,
          cache: "no-store",
        },
      ),
  });
}

export function useAdminTagsQuery(keyword: string) {
  return useQuery({
    queryKey: queryKeys.adminTags(keyword),
    queryFn: () =>
      requestApiData<TagSummary[]>(
        `/api/admin/tags${keyword ? `?keyword=${encodeURIComponent(keyword)}` : ""}`,
        {
          withAuth: true,
          cache: "no-store",
        },
      ),
  });
}

export function useAdminReportsQuery(filters: AdminReportsFilters) {
  return useQuery({
    queryKey: queryKeys.adminReports(filters),
    queryFn: () => {
      const query = buildSearchParams(filters);
      return requestApiData<ReportItem[]>(
        `/api/admin/reports${query ? `?${query}` : ""}`,
        {
          withAuth: true,
          cache: "no-store",
        },
      );
    },
  });
}

export function useAdminResourceAppealsQuery(
  filters: AdminResourceAppealsFilters,
) {
  return useQuery({
    queryKey: queryKeys.adminResourceAppeals(filters),
    queryFn: () => {
      const query = buildSearchParams(filters);
      return requestApiData<ResourceAppeal[]>(
        `/api/admin/resource-appeals${query ? `?${query}` : ""}`,
        {
          withAuth: true,
          cache: "no-store",
        },
      );
    },
  });
}

export function useAdminCoinsQuery(filters: AdminCoinsFilters) {
  return useQuery({
    queryKey: queryKeys.adminCoins(filters),
    queryFn: () => {
      const query = buildSearchParams(filters);
      return requestApiData<AdminCoinUserSummary[]>(
        `/api/admin/coins/users${query ? `?${query}` : ""}`,
        {
          withAuth: true,
          cache: "no-store",
        },
      );
    },
  });
}

export function useAdminBountiesQuery(filters: AdminBountiesFilters) {
  return useQuery({
    queryKey: queryKeys.adminBounties(filters),
    queryFn: () => {
      const query = buildSearchParams(filters);
      return requestApiData<AdminBountySummary[]>(
        `/api/admin/bounties${query ? `?${query}` : ""}`,
        {
          withAuth: true,
          cache: "no-store",
        },
      );
    },
  });
}

export function useAdminBountyCommentsQuery(postId: number | null) {
  return useQuery({
    queryKey: queryKeys.adminBountyComments(postId),
    queryFn: () =>
      requestApiData<PostComment[]>(`/api/admin/bounties/${postId}/comments`, {
        withAuth: true,
        cache: "no-store",
      }),
    enabled: postId != null,
  });
}

export function useAdminWalletAuditQuery(filters: AdminWalletAuditFilters) {
  return useQuery({
    queryKey: queryKeys.adminWalletAudit(filters),
    queryFn: () => {
      const resolvedLimit = toIntOrUndefined(filters.limit);
      if (!resolvedLimit) {
        throw new Error("钱包流水条数必须是正整数");
      }
      const userId = toIntOrUndefined(filters.userId);
      if (filters.userId.trim() && !userId) {
        throw new Error("用户 ID 必须是正整数");
      }

      const params = new URLSearchParams();
      params.set("limit", String(resolvedLimit));
      if (userId) {
        params.set("userId", String(userId));
      }
      if (filters.bizType.trim()) {
        params.set("bizType", filters.bizType.trim().toUpperCase());
      }
      return requestApiData<WalletLedgerItem[]>(
        `/api/admin/audit/wallet-ledger?${params.toString()}`,
        {
          withAuth: true,
          cache: "no-store",
        },
      );
    },
  });
}

export function useAdminTradeAuditQuery(filters: AdminTradeAuditFilters) {
  return useQuery({
    queryKey: queryKeys.adminTradeAudit(filters),
    queryFn: () => {
      const resolvedLimit = toIntOrUndefined(filters.limit);
      if (!resolvedLimit) {
        throw new Error("交易流水条数必须是正整数");
      }
      const userId = toIntOrUndefined(filters.userId);
      const postId = toIntOrUndefined(filters.postId);
      if (filters.userId.trim() && !userId) {
        throw new Error("用户 ID 必须是正整数");
      }
      if (filters.postId.trim() && !postId) {
        throw new Error("帖子 ID 必须是正整数");
      }

      const params = new URLSearchParams();
      params.set("limit", String(resolvedLimit));
      if (userId) {
        params.set("userId", String(userId));
      }
      if (postId) {
        params.set("postId", String(postId));
      }
      return requestApiData<ResourceTradeAuditItem[]>(
        `/api/admin/audit/resource-trades?${params.toString()}`,
        {
          withAuth: true,
          cache: "no-store",
        },
      );
    },
  });
}
