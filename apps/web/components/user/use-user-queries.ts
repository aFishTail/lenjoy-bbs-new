"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys, requestApiData } from "@/components/post/client-helpers";
import type {
  PublicUserProfile,
  ToggleFollowResponse,
} from "@/components/post/types";

export function usePublicUserProfileQuery(userId: string) {
  return useQuery({
    queryKey: queryKeys.publicUserProfile(userId),
    queryFn: () =>
      requestApiData<PublicUserProfile>(
        `/api/users/${encodeURIComponent(userId)}`,
        {
          withAuth: true,
          cache: "no-store",
        },
      ),
    enabled: userId.trim().length > 0,
  });
}

export function useToggleUserFollowMutation(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      requestApiData<ToggleFollowResponse>(
        `/api/users/${encodeURIComponent(userId)}/follow/toggle`,
        {
          method: "POST",
          withAuth: true,
          cache: "no-store",
        },
      ),
    onSuccess: (payload) => {
      queryClient.setQueryData<PublicUserProfile>(
        queryKeys.publicUserProfile(userId),
        (profile) =>
          profile
            ? {
                ...profile,
                followedByMe: payload.following,
                followerCount: payload.followerCount,
              }
            : profile,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.myProfile });
    },
  });
}
