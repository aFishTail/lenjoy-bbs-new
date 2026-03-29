"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readError } from "@/components/post/client-helpers";
import { usePostDetailQuery, usePostCommentsQuery } from "@/components/post/use-post-queries";
import type { PostComment, PostDetail } from "@/components/post/types";
import { useAuth } from "@/components/providers/auth-provider";

import { PostContentSection } from "./detail/post-content-section";
import { PostCommentSection } from "./detail/post-comment-section";
import { PostAuthorActions } from "./detail/post-author-actions";

type Props = {
  postId: string;
  initialPost?: PostDetail | null;
  initialComments?: PostComment[] | null;
};

export function PostDetailClient({ postId, initialPost, initialComments }: Props) {
  const { authData: auth } = useAuth();
  const [errorText, setErrorText] = useState("");

  // Seed the cache with the data prefetched from the Server Component
  const postQuery = usePostDetailQuery(postId, initialPost);
  usePostCommentsQuery(postId, initialComments);

  const post = postQuery.data;
  const loading = postQuery.isLoading;

  useEffect(() => {
    if (postQuery.error) {
      setErrorText(readError(postQuery.error));
    }
  }, [postQuery.error]);

  if (loading && !post) {
    return (
      <main className="page">
        <div className="loading">
          <div className="spinner"></div>
          <span className="ml-3">加载中...</span>
        </div>
      </main>
    );
  }

  const isAuthor = !!auth && !!post && auth.user.id === post.authorId;

  return (
    <main className="page">
      {/* Back Link */}
      <div className="mb-4">
        <Link href="/" className="nav-link">
          <svg
            className="icon-sm"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ display: "inline", marginRight: "4px" }}
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          返回帖子列表
        </Link>
      </div>

      {errorText && (
        <div className="banner banner-error mb-4">
          <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          {errorText}
        </div>
      )}

      {post && (
        <>
          <PostContentSection postId={postId} />
          <PostCommentSection postId={postId} />
          {isAuthor && <PostAuthorActions postId={postId} />}
        </>
      )}
    </main>
  );
}
