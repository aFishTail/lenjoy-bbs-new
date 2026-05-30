"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys, readError } from "@/components/post/client-helpers";
import { useRecordPostViewMutation } from "@/components/post/use-post-mutations";
import {
  usePostDetailQuery,
  usePostCommentsQuery,
} from "@/components/post/use-post-queries";
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

export function PostDetailClient({
  postId,
  initialPost,
  initialComments,
}: Props) {
  const queryClient = useQueryClient();
  const { authData: auth, authReady } = useAuth();
  const [errorText, setErrorText] = useState("");
  const hasRecordedView = useRef(false);
  const lastViewerScope = useRef<string | null>(null);

  // Seed the cache with the data prefetched from the Server Component
  const postQuery = usePostDetailQuery(postId, initialPost);
  usePostCommentsQuery(postId, initialComments);
  const recordPostViewMutation = useRecordPostViewMutation(postId);

  const post = postQuery.data;
  const loading = postQuery.isLoading;

  useEffect(() => {
    if (postQuery.error) {
      setErrorText(readError(postQuery.error));
    }
  }, [postQuery.error]);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    const nextViewerScope = auth?.user.id ? `user:${auth.user.id}` : "guest";
    if (lastViewerScope.current === null) {
      lastViewerScope.current = nextViewerScope;
      if (auth) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.postDetail(postId),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.postComments(postId),
        });
      }
      return;
    }

    if (lastViewerScope.current !== nextViewerScope) {
      lastViewerScope.current = nextViewerScope;
      void queryClient.invalidateQueries({
        queryKey: queryKeys.postDetail(postId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.postComments(postId),
      });
    }
  }, [auth, authReady, postId, queryClient]);

  useEffect(() => {
    if (!post || hasRecordedView.current) {
      return;
    }

    hasRecordedView.current = true;
    void recordPostViewMutation.mutateAsync().catch((error) => {
      console.error("Record post view failed", error);
    });
  }, [post, recordPostViewMutation]);

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
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2 font-medium text-[var(--text-sub)] no-underline hover:bg-[rgba(47,111,237,0.08)] hover:text-[var(--color-primary)]"
        >
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
          <svg
            className="icon-sm"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
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
