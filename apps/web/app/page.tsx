import { PostHomeClient } from "@/components/post/post-home-client";
import { serverFetchApiData } from "@/lib/server-api";
import type { PostSummary } from "@/components/post/types";

export default async function HomePage() {
  let initialPosts: PostSummary[] | null = null;
  try {
    initialPosts = await serverFetchApiData<PostSummary[]>("/api/v1/posts");
  } catch (error) {
    console.error("Home SSR error:", error);
  }
  return <PostHomeClient initialPosts={initialPosts} />;
}
