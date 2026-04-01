export type AuthData = {
  token: string;
  tokenType: string;
  expiresIn: number;
  user: {
    id: number;
    username: string;
    email?: string;
    phone?: string;
    avatarUrl?: string | null;
    bio?: string | null;
    roles?: string[];
  };
};

export type Sessions = Partial<{
  user_a: AuthData;
  user_b: AuthData;
  admin: AuthData;
}>;

export type ApiEnvelope<T> = {
  success: boolean;
  code: string;
  message: string;
  data: T;
};

export type PostDetail = {
  id: number;
  postType: "NORMAL" | "RESOURCE" | "BOUNTY";
  title: string;
  purchased?: boolean;
  hiddenContent?: string;
  purchaseId?: number | null;
  bountyStatus?: "ACTIVE" | "RESOLVED" | "EXPIRED";
  acceptedCommentId?: number | null;
};

export type PostComment = {
  id: number;
  postId: number;
  authorId: number;
  parentId?: number | null;
  content: string;
};
