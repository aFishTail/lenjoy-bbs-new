import { SearchPageClient } from "@/components/post/search-page-client";
import { serverFetchApiData } from "@/lib/server-api";
import type { PaginatedResponse, PostSummary } from "@/components/post/types";
import type { PostSearchFilters } from "@/components/post/use-post-queries";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readQueryValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function readPostType(
  value: string | undefined,
): PostSearchFilters["postType"] {
  if (value === "NORMAL" || value === "RESOURCE" || value === "BOUNTY") {
    return value;
  }
  return "";
}

export default async function SearchPage({ searchParams }: Props) {
  const resolved = (await searchParams) || {};
  const keyword = (readQueryValue(resolved.q) || "").trim();
  const postType = readPostType(readQueryValue(resolved.type));
  const rawPage = Number(readQueryValue(resolved.page) || 1);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  let initialPosts: PaginatedResponse<PostSummary> | null = null;

  if (keyword) {
    try {
      const params = new URLSearchParams({
        keyword,
        page: String(page),
        pageSize: "20",
      });
      if (postType) {
        params.set("postType", postType);
      }
      initialPosts = await serverFetchApiData<PaginatedResponse<PostSummary>>(
        `/api/v1/posts?${params.toString()}`,
      );
    } catch (error) {
      console.error("Search SSR error:", error);
    }
  }

  return (
    <SearchPageClient
      initialPosts={initialPosts}
      initialKeyword={keyword}
      initialType={postType}
      initialPage={page}
    />
  );
}
