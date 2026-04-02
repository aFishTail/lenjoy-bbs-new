"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  fireMessageChanged,
  queryKeys,
  requestApi,
  requestApiData,
} from "@/components/post/client-helpers";
import type {
  PostComment,
  PostDetail,
  ToggleInteractionResponse,
} from "@/components/post/types";

export type CreatePostInput = {
  postType: "NORMAL" | "RESOURCE" | "BOUNTY";
  title: string;
  categoryId: number;
  tagIds: number[];
  content: string;
  hiddenContent?: string;
  price?: number;
  bountyAmount?: number;
  bountyExpireAt?: string;
};

function patchCommentLike(
  items: PostComment[],
  commentId: number,
  payload: ToggleInteractionResponse,
): PostComment[] {
  return items.map((item) => {
    if (item.id === commentId) {
      return {
        ...item,
        liked: payload.active,
        likeCount: payload.count,
      };
    }
    if (item.replies?.length) {
      return {
        ...item,
        replies: patchCommentLike(item.replies, commentId, payload),
      };
    }
    return item;
  });
}

export function useUpdatePostMutation(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      title: string;
      categoryId: number;
      tagIds: number[];
      content: string;
      hiddenContent: string;
      price: number | null;
      bountyAmount: number | null;
      bountyExpireAt: string | null;
    }) =>
      requestApi(`/api/posts/${postId}`, {
        method: "PUT",
        withAuth: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.postDetail(postId),
      });
    },
  });
}

export function useClosePostMutation(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      requestApi(`/api/posts/${postId}/close`, {
        method: "POST",
        withAuth: true,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.postDetail(postId),
      });
    },
  });
}

export function useDeletePostMutation(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      requestApi(`/api/posts/${postId}`, {
        method: "DELETE",
        withAuth: true,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["posts"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["admin", "posts"],
        }),
      ]);
    },
  });
}

export function usePurchaseResourceMutation(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      requestApiData<PostDetail>(`/api/posts/${postId}/purchase`, {
        method: "POST",
        withAuth: true,
      }),
    onSuccess: (payload) => {
      queryClient.setQueryData(queryKeys.postDetail(postId), payload);
      fireMessageChanged();
    },
  });
}

export function useSubmitPostCommentMutation(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      parentId,
      content,
    }: {
      parentId?: number;
      content: string;
    }) =>
      requestApi(`/api/posts/${postId}/comments`, {
        method: "POST",
        withAuth: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          parentId: parentId || null,
          content,
        }),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.postDetail(postId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.postComments(postId),
        }),
      ]);
    },
  });
}

export function useAcceptAnswerMutation(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: number) =>
      requestApi(`/api/posts/${postId}/comments/${commentId}/accept`, {
        method: "POST",
        withAuth: true,
      }),
    onSuccess: async () => {
      fireMessageChanged();
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.postDetail(postId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.postComments(postId),
        }),
      ]);
    },
  });
}

export function useTogglePostLikeMutation(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      requestApiData<ToggleInteractionResponse>(
        `/api/posts/${postId}/likes/toggle`,
        {
          method: "POST",
          withAuth: true,
        },
      ),
    onSuccess: (payload) => {
      queryClient.setQueryData<PostDetail | null>(
        queryKeys.postDetail(postId),
        (prev) =>
          prev
            ? {
                ...prev,
                liked: payload.active,
                likeCount: payload.count,
              }
            : prev,
      );
      fireMessageChanged();
    },
  });
}

export function useTogglePostFavoriteMutation(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      requestApiData<ToggleInteractionResponse>(
        `/api/posts/${postId}/favorites/toggle`,
        {
          method: "POST",
          withAuth: true,
        },
      ),
    onSuccess: (payload) => {
      queryClient.setQueryData<PostDetail | null>(
        queryKeys.postDetail(postId),
        (prev) =>
          prev
            ? {
                ...prev,
                collected: payload.active,
                collectCount: payload.count,
              }
            : prev,
      );
      fireMessageChanged();
    },
  });
}

export function useToggleCommentLikeMutation(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: number) =>
      requestApiData<ToggleInteractionResponse>(
        `/api/comments/${commentId}/likes/toggle`,
        {
          method: "POST",
          withAuth: true,
        },
      ),
    onSuccess: (payload, commentId) => {
      queryClient.setQueryData<PostComment[]>(
        queryKeys.postComments(postId),
        (prev = []) => patchCommentLike(prev, commentId, payload),
      );
      fireMessageChanged();
    },
  });
}

export function useDeleteOwnCommentMutation(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: number) =>
      requestApi(`/api/posts/${postId}/comments/${commentId}`, {
        method: "DELETE",
        withAuth: true,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.postDetail(postId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.postComments(postId),
        }),
      ]);
    },
  });
}

export function useReportPostMutation(postId: string) {
  return useMutation({
    mutationFn: ({ reason, detail }: { reason: string; detail: string }) =>
      requestApi(`/api/posts/${postId}/reports`, {
        method: "POST",
        withAuth: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason, detail }),
      }),
  });
}

export function useReportCommentMutation() {
  return useMutation({
    mutationFn: ({
      commentId,
      reason,
      detail,
    }: {
      commentId: number;
      reason: string;
      detail: string;
    }) =>
      requestApi(`/api/comments/${commentId}/reports`, {
        method: "POST",
        withAuth: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason, detail }),
      }),
  });
}

export function useCreatePostMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreatePostInput) =>
      requestApiData<{ id: number }>("/api/posts", {
        method: "POST",
        withAuth: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["posts"] });
      await queryClient.invalidateQueries({ queryKey: ["posts", "mine"] });
    },
  });
}
