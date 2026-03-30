import { PostTypeFeedClient } from "@/components/post/post-type-feed-client";
import { serverFetchApiData } from "@/lib/server-api";
import type { PaginatedResponse, PostSummary } from "@/components/post/types";

export const dynamic = "force-dynamic";

export default async function BountiesPage() {
  let initialPosts: PaginatedResponse<PostSummary> | null = null;
  try {
    initialPosts = await serverFetchApiData<PaginatedResponse<PostSummary>>(
      "/api/v1/posts?postType=BOUNTY",
    );
  } catch (error) {
    console.error("Bounties SSR error:", error);
  }

  return (
    <PostTypeFeedClient
      postType="BOUNTY"
      title="悬赏"
      subtitle="这里展示带有悬赏奖励的问题帖，帮助他人并获得回报。"
      initialPosts={initialPosts}
    />
  );
}
