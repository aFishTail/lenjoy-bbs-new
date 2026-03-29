import { PostTypeFeedClient } from "@/components/post/post-type-feed-client";

export default function BountiesPage() {
  return (
    <PostTypeFeedClient
      postType="BOUNTY"
      title="悬赏"
      subtitle="这里展示带有悬赏奖励的问题帖，帮助他人并获得回报。"
    />
  );
}
