import { PostHomeClient } from "@/components/post/post-home-client";
import { serverFetchApiData } from "@/lib/server-api";
import type { PaginatedResponse, PostSummary } from "@/components/post/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let initialPosts: PaginatedResponse<PostSummary> | null = null;
  try {
    initialPosts = await serverFetchApiData<PaginatedResponse<PostSummary>>("/api/v1/posts");
  } catch (error) {
    console.error("Home SSR error:", error);
  }
  return <PostHomeClient initialPosts={initialPosts} />;
}
