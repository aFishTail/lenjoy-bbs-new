export type ApiResponse<T> = {
  success: boolean;
  code: string;
  message: string;
  data: T;
};

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
  };
};

export type MyProfile = {
  id: number;
  username: string;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  postCount: number;
  followingCount: number;
  followerCount: number;
};

export type PostSummary = {
  id: number;
  postType: "NORMAL" | "RESOURCE" | "BOUNTY";
  title: string;
  status: "PUBLISHED" | "CLOSED" | "OFFLINE" | "DELETED";
  authorId: number;
  authorUsername?: string;
  viewCount?: number;
  likeCount?: number;
  collectCount?: number;
  commentCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type PostDetail = {
  id: number;
  postType: "NORMAL" | "RESOURCE" | "BOUNTY";
  title: string;
  status: "PUBLISHED" | "CLOSED" | "OFFLINE" | "DELETED";
  authorId: number;
  authorUsername?: string;
  content?: string;
  hiddenContent?: string;
  price?: number;
  bountyAmount?: number;
  viewCount?: number;
  likeCount?: number;
  collectCount?: number;
  commentCount?: number;
  offlineReason?: string;
  offlinedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminUserSummary = {
  id: number;
  username: string;
  email?: string;
  phone?: string;
  status: "ACTIVE" | "MUTED" | "BANNED";
  roles: string[];
  createdAt: string;
  updatedAt: string;
};
