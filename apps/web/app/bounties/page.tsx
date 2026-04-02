import { PostTypeFeedClient } from "@/components/post/post-type-feed-client";
import { serverFetchApiData } from "@/lib/server-api";
import type {
  CategorySummary,
  PaginatedResponse,
  PostSummary,
  TagSummary,
} from "@/components/post/types";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readQueryValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BountiesPage({ searchParams }: Props) {
  const resolved = (await searchParams) || {};
  const categoryId = readQueryValue(resolved.categoryId);
  const tagId = readQueryValue(resolved.tagId);
  const keyword = readQueryValue(resolved.keyword);

  let initialPosts: PaginatedResponse<PostSummary> | null = null;
  let initialCategories: CategorySummary[] | null = null;
  let initialHotTags: TagSummary[] | null = null;
  try {
    const params = new URLSearchParams({ postType: "BOUNTY" });
    if (categoryId) params.set("categoryId", categoryId);
    if (tagId) params.set("tagId", tagId);
    if (keyword) params.set("keyword", keyword);
    initialPosts = await serverFetchApiData<PaginatedResponse<PostSummary>>(
      `/api/v1/posts?${params.toString()}`,
    );
    initialCategories = await serverFetchApiData<CategorySummary[]>(
      "/api/v1/taxonomy/categories?contentType=BOUNTY",
    );
    initialHotTags = await serverFetchApiData<TagSummary[]>(
      "/api/v1/taxonomy/tags/hot?contentType=BOUNTY",
    );
  } catch (error) {
    console.error("Bounties SSR error:", error);
  }

  return (
    <PostTypeFeedClient
      postType="BOUNTY"
      title="悬赏"
      subtitle="按任务分类浏览悬赏内容，用标签归纳题材。"
      initialPosts={initialPosts}
      initialCategories={initialCategories}
      initialHotTags={initialHotTags}
    />
  );
}
