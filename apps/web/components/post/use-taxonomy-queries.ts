"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys, requestApiData } from "@/components/post/client-helpers";
import type { CategorySummary, TagSummary } from "@/components/post/types";

export function useCategoriesQuery(
  contentType: "NORMAL" | "RESOURCE" | "BOUNTY",
  initialData?: CategorySummary[] | null,
) {
  return useQuery({
    queryKey: queryKeys.taxonomyCategories(contentType),
    queryFn: () =>
      requestApiData<CategorySummary[]>(
        `/api/taxonomy/categories?contentType=${contentType}`,
        {
          cache: "no-store",
        },
      ),
    initialData: initialData || undefined,
  });
}

export function useTagsQuery(keyword = "", initialData?: TagSummary[] | null) {
  return useQuery({
    queryKey: queryKeys.taxonomyTags(keyword),
    queryFn: () =>
      requestApiData<TagSummary[]>(
        `/api/taxonomy/tags${keyword ? `?keyword=${encodeURIComponent(keyword)}` : ""}`,
        {
          cache: "no-store",
        },
      ),
    initialData: initialData || undefined,
  });
}

export function useHotTagsQuery(
  contentType: "NORMAL" | "RESOURCE" | "BOUNTY",
  initialData?: TagSummary[] | null,
) {
  return useQuery({
    queryKey: queryKeys.taxonomyHotTags(contentType),
    queryFn: () =>
      requestApiData<TagSummary[]>(
        `/api/taxonomy/tags/hot?contentType=${contentType}`,
        {
          cache: "no-store",
        },
      ),
    initialData: initialData || undefined,
  });
}
