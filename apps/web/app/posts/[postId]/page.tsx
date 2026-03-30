import { PostDetailClient } from "@/components/post/post-detail-client";
import { serverFetchApiData } from "@/lib/server-api";
import type { PostDetail, PostComment } from "@/components/post/types";
import type { Metadata } from "next";
import { cache } from "react";

type Props = {
  params: Promise<{ postId: string }>;
};

export const dynamic = "force-dynamic";

const getPostDetail = cache(async (postId: string, allowNotFound = false) =>
  serverFetchApiData<PostDetail>(`/api/v1/posts/${postId}`, { allowNotFound }),
);

const getPostComments = cache(async (postId: string) =>
  serverFetchApiData<PostComment[]>(`/api/v1/posts/${postId}/comments`),
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { postId } = await params;
  let post: PostDetail | null = null;
  try {
    post = await getPostDetail(postId, true);
  } catch (error) {
    console.error("Metadata fetch error:", error);
  }
  
  if (!post) {
    return { title: '帖子未找到' };
  }
  
  const plainDescription = post.content 
    ? post.content.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').substring(0, 160)
    : "在 Lenjoy BBS 上查看详情";
    
  return {
    title: `${post.title} - Lenjoy BBS`,
    description: plainDescription,
  };
}

export default async function PostDetailPage({ params }: Props) {
  const { postId } = await params;
  
  let initialPost: PostDetail | null = null;
  let initialComments: PostComment[] | null = null;

  try {
    initialPost = await getPostDetail(postId);
  } catch (e) {
    console.error("Server fetch post failed, falling back to CSR:", e);
  }

  try {
    initialComments = await getPostComments(postId);
  } catch (e) {
    console.error("Server fetch comments failed, falling back to CSR:", e);
  }

  return <PostDetailClient postId={postId} initialPost={initialPost} initialComments={initialComments} />;
}
