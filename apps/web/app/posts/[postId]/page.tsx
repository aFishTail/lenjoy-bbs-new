import { PostDetailClient } from "@/components/post/post-detail-client";

type Props = {
  params: Promise<{ postId: string }>;
};

export default async function PostDetailPage({ params }: Props) {
  const { postId } = await params;
  return <PostDetailClient postId={postId} />;
}
