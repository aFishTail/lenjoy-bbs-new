import { PostTypeFeedClient } from "@/components/post/post-type-feed-client";
import { serverFetchApiData } from "@/lib/server-api";
import type { PostSummary } from "@/components/post/types";

export default async function DiscussionsPage() {
  let initialPosts: PostSummary[] | null = null;
  try {
    initialPosts = await serverFetchApiData<PostSummary[]>("/api/v1/posts?postType=NORMAL");
  } catch (error) {
    console.error("Discussions SSR error:", error);
  }

  return (
    <PostTypeFeedClient
      postType="NORMAL"
      title="讨论"
      subtitle="这里展示社区里的普通讨论帖，适合交流观点与经验。"
      initialPosts={initialPosts}
    />
  );
}
