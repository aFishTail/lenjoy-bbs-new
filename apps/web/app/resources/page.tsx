import { PostTypeFeedClient } from "@/components/post/post-type-feed-client";
import { serverFetchApiData } from "@/lib/server-api";
import type { PostSummary } from "@/components/post/types";

export default async function ResourcesPage() {
  let initialPosts: PostSummary[] | null = null;
  try {
    initialPosts = await serverFetchApiData<PostSummary[]>("/api/v1/posts?postType=RESOURCE");
  } catch (error) {
    console.error("Resources SSR error:", error);
  }

  return (
    <PostTypeFeedClient
      postType="RESOURCE"
      title="资源"
      subtitle="在此发现与分享各种高价值的资源链接与内容。"
      initialPosts={initialPosts}
    />
  );
}
