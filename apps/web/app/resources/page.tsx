import { PostTypeFeedClient } from "@/components/post/post-type-feed-client";

export default function ResourcesPage() {
  return (
    <PostTypeFeedClient
      postType="RESOURCE"
      title="资源"
      subtitle="这里展示可下载或付费获取的资源帖，按需查找你需要的内容。"
    />
  );
}
