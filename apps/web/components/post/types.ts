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
  };
};

export type PostSummary = {
  id: number;
  postType: "NORMAL" | "RESOURCE" | "BOUNTY";
  title: string;
  status: "PUBLISHED" | "CLOSED" | "OFFLINE" | "DELETED";
  authorId: number;
  authorUsername?: string;
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
  publicContent?: string;
  hiddenContent?: string;
  price?: number;
  bountyAmount?: number;
  offlineReason?: string;
  offlinedAt?: string;
  createdAt: string;
  updatedAt: string;
};
