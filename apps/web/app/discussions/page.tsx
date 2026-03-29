import { PostTypeFeedClient } from "@/components/post/post-type-feed-client";

export default function DiscussionsPage() {
  return (
    <PostTypeFeedClient
      postType="NORMAL"
      title="讨论"
      subtitle="这里展示社区里的普通讨论帖，适合交流观点与经验。"
    />
  );
}
