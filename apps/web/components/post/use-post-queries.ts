"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys, requestApiData } from "@/components/post/client-helpers";
import type {
  PostComment,
  PostDetail,
  PostSummary,
} from "@/components/post/types";

export function usePostsQuery(initialData?: PostSummary[] | null) {
  return useQuery({
    queryKey: queryKeys.posts,
    queryFn: () =>
      requestApiData<PostSummary[]>("/api/posts", { cache: "no-store" }),
    initialData: initialData || undefined,
  });
}

export function usePostFeedQuery(postType: "NORMAL" | "RESOURCE" | "BOUNTY", initialData?: PostSummary[] | null) {
  return useQuery({
    queryKey: queryKeys.postFeed(postType),
    queryFn: () => {
      const params = new URLSearchParams({ postType });
      return requestApiData<PostSummary[]>(`/api/posts?${params.toString()}`, {
        cache: "no-store",
      });
    },
    initialData: initialData || undefined,
  });
}

export function useMyPostsQuery() {
  return useQuery({
    queryKey: queryKeys.myPosts,
    queryFn: () =>
      requestApiData<PostSummary[]>("/api/posts/mine", {
        withAuth: true,
        cache: "no-store",
      }),
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
