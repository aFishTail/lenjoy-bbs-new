"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys, requestApiData } from "@/components/post/client-helpers";
import type {
  PaginatedResponse,
  PostComment,
  PostDetail,
  PostSummary,
} from "@/components/post/types";

export type PostFeedFilters = {
  categoryId?: string;
  tagId?: string;
  keyword?: string;
};

function buildFeedQuery(
  postType: "NORMAL" | "RESOURCE" | "BOUNTY",
  page: number,
  pageSize: number,
  filters?: PostFeedFilters,
) {
  const params = new URLSearchParams({
    postType,
    page: String(page),
    pageSize: String(pageSize),
  });
  if (filters?.categoryId) {
    params.set("categoryId", filters.categoryId);
  }
  if (filters?.tagId) {
    params.set("tagId", filters.tagId);
  }
  if (filters?.keyword) {
    params.set("keyword", filters.keyword);
  }
  return `/api/posts?${params.toString()}`;
}

export function usePostsQuery(
  page: number,
  pageSize: number,
  initialData?: PaginatedResponse<PostSummary> | null,
) {
  return useQuery({
    queryKey: queryKeys.posts(page, pageSize),
    queryFn: () =>
      requestApiData<PaginatedResponse<PostSummary>>(
        `/api/posts?page=${page}&pageSize=${pageSize}`,
        { cache: "no-store" },
      ),
    initialData: initialData || undefined,
  });
}

export function usePostFeedQuery(
  postType: "NORMAL" | "RESOURCE" | "BOUNTY",
  page: number,
  pageSize: number,
  filters?: PostFeedFilters,
  initialData?: PaginatedResponse<PostSummary> | null,
) {
  return useQuery({
    queryKey: queryKeys.postFeedFilters(
      postType,
      {
        categoryId: filters?.categoryId || "",
        tagId: filters?.tagId || "",
        keyword: filters?.keyword || "",
      },
      page,
      pageSize,
    ),
    queryFn: () =>
      requestApiData<PaginatedResponse<PostSummary>>(
        buildFeedQuery(postType, page, pageSize, filters),
        { cache: "no-store" },
      ),
    initialData: initialData || undefined,
  });
}

export function useMyPostsQuery(page: number, pageSize: number) {
  return useQuery({
    queryKey: queryKeys.myPosts(page, pageSize),
    queryFn: () =>
      requestApiData<PaginatedResponse<PostSummary>>(
        `/api/posts/mine?page=${page}&pageSize=${pageSize}`,
        {
          withAuth: true,
          cache: "no-store",
        },
      ),
  });
}

export function usePostDetailQuery(postId: string, initialData?: PostDetail | null) {
  return useQuery({
    queryKey: queryKeys.postDetail(postId),
    queryFn: () =>
      requestApiData<PostDetail>(`/api/posts/${postId}`, {
        withAuth: true,
        cache: "no-store",
      }),
    initialData: initialData || undefined,
  });
}

export function usePostCommentsQuery(postId: string, initialData?: PostComment[] | null) {
  return useQuery({
    queryKey: queryKeys.postComments(postId),
    queryFn: () =>
      requestApiData<PostComment[]>(`/api/posts/${postId}/comments`, {
        withAuth: true,
        cache: "no-store",
      }),
    initialData: initialData || undefined,
  });
}

export function useRefreshPostData(postId: string) {
  const queryClient = useQueryClient();

  return async function refreshPostData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.postDetail(postId) }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.postComments(postId),
      }),
    ]);
  };
}
