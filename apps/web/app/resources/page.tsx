import { PostTypeFeedClient } from "@/components/post/post-type-feed-client";
import { serverFetchApiData } from "@/lib/server-api";
import type { PaginatedResponse, PostSummary } from "@/components/post/types";

export const dynamic = "force-dynamic";

export default async function ResourcesPage() {
  let initialPosts: PaginatedResponse<PostSummary> | null = null;
  try {
    initialPosts = await serverFetchApiData<PaginatedResponse<PostSummary>>(
      "/api/v1/posts?postType=RESOURCE",
    );
  } catch (error) {
    console.error("Resources SSR error:", error);
  }

  return (
    <PostTypeFeedClient
      postType="RESOURCE"
      title="资源"
      subtitle="在这里发现和分享高价值资源链接与内容。"
      initialPosts={initialPosts}
    />
  );
}
