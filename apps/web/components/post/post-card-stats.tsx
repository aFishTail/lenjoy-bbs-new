"use client";

type Props = {
  viewCount?: number;
  commentCount?: number;
  likeCount?: number;
  createdAt?: string;
};

export function PostCardStats({ viewCount, commentCount, likeCount, createdAt }: Props) {
  const createdDate = createdAt
    ? new Date(createdAt).toLocaleDateString("zh-CN", {
        month: "numeric",
        day: "numeric",
      })
    : null;

  return (
    <div className="post-card-stats">
      <span className="post-card-stat" title="浏览量">
        <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <span>{viewCount || 0}</span>
      </span>
      <span className="post-card-stat" title="评论数">
        <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span>{commentCount || 0}</span>
      </span>
      <span className="post-card-stat" title="点赞数">
        <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M7 10v10" />
          <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.96 2.39l-1.22 6A2 2 0 0 1 18.61 20H7a2 2 0 0 1-2-2v-8.31a2 2 0 0 1 .59-1.41l5.66-5.66A1 1 0 0 1 13 3.33V5a2 2 0 0 0 2 2Z" />
        </svg>
        <span>{likeCount || 0}</span>
      </span>
      {createdDate ? (
        <span className="post-card-stat is-date" title="发布时间">
          <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          <span>{createdDate}</span>
        </span>
      ) : null}
    </div>
  );
}
