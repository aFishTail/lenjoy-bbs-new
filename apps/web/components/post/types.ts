export type ApiResponse<T> = {
  success: boolean;
  code: string;
  message: string;
  data: T;
};

export type PaginatedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

export type CategorySummary = {
  id: number;
  name: string;
  slug: string;
  parentId: number;
  contentType: "NORMAL" | "RESOURCE" | "BOUNTY";
  sort: number;
  status: "ACTIVE" | "INACTIVE";
  leaf: boolean;
};

export type TagSummary = {
  id: number;
  name: string;
  slug: string;
  status: "ACTIVE" | "INACTIVE" | "MERGED";
  source: "SYSTEM" | "CUSTOM";
  usageCount?: number;
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
    roles?: string[];
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

export type WalletSummary = {
  availableCoins: number;
  frozenCoins: number;
  totalCoins: number;
  updatedAt?: string;
};

export type WalletLedgerItem = {
  id: number;
  direction: "INCOME" | "EXPENSE" | "FREEZE" | "UNFREEZE";
  changeAmount: number;
  balanceAfter: number;
  frozenAfter: number;
  bizType: string;
  remark?: string | null;
  operatedBy?: number | null;
  createdAt: string;
};

export type PostSummary = {
  id: number;
  postType: "NORMAL" | "RESOURCE" | "BOUNTY";
  title: string;
  status: "PUBLISHED" | "CLOSED" | "OFFLINE" | "DELETED";
  authorId: number;
  authorUsername?: string;
  categoryId?: number | null;
  categoryName?: string | null;
  tags?: TagSummary[];
  viewCount?: number;
  likeCount?: number;
  collectCount?: number;
  commentCount?: number;
  liked?: boolean;
  collected?: boolean;
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
  categoryId?: number | null;
  categoryName?: string | null;
  tags?: TagSummary[];
  content?: string;
  hiddenContent?: string;
  price?: number;
  bountyAmount?: number;
  bountyStatus?: "ACTIVE" | "RESOLVED" | "EXPIRED";
  bountyExpireAt?: string;
  bountySettledAt?: string;
  acceptedCommentId?: number | null;
  viewCount?: number;
  likeCount?: number;
  collectCount?: number;
  commentCount?: number;
  liked?: boolean;
  collected?: boolean;
  resourceUnlocked?: boolean;
  purchased?: boolean;
  canPurchase?: boolean;
  purchaseId?: number | null;
  purchaseStatus?: "PAID" | "PARTIAL_REFUNDED" | "REFUNDED" | null;
  refundedAmount?: number;
  appealStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
  offlineReason?: string;
  offlinedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ResourcePurchaseSummary = {
  purchaseId: number;
  postId: number;
  postTitle: string;
  buyerId: number;
  buyerUsername?: string | null;
  sellerId: number;
  sellerUsername?: string | null;
  price: number;
  refundedAmount: number;
  status: "PAID" | "PARTIAL_REFUNDED" | "REFUNDED";
  appealStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
  purchasedAt: string;
  updatedAt: string;
};

export type ResourceAppeal = {
  id: number;
  purchaseId: number;
  postId: number;
  postTitle?: string | null;
  reason: string;
  detail?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedRefundAmount: number;
  resolvedRefundAmount: number;
  resolutionNote?: string | null;
  buyerId: number;
  buyerUsername?: string | null;
  sellerId: number;
  sellerUsername?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SiteMessage = {
  id: number;
  messageType: string;
  title: string;
  content: string;
  bizType?: string | null;
  bizId?: number | null;
  relatedPostId?: number | null;
  relatedPurchaseId?: number | null;
  relatedAppealId?: number | null;
  read: boolean;
  readAt?: string | null;
  createdAt: string;
  actionUrl?: string | null;
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

export type AdminCoinUserSummary = {
  id: number;
  username: string;
  email?: string;
  phone?: string;
  status: "ACTIVE" | "MUTED" | "BANNED";
  availableCoins: number;
  frozenCoins: number;
  totalCoins: number;
  createdAt: string;
  updatedAt: string;
};

export type PostComment = {
  id: number;
  postId: number;
  authorId: number;
  authorUsername?: string | null;
  parentId?: number | null;
  replyToUserId?: number | null;
  replyToUsername?: string | null;
  content: string;
  accepted: boolean;
  deleted: boolean;
  deletedReason?: string | null;
  likeCount?: number;
  liked?: boolean;
  createdAt: string;
  updatedAt: string;
  replies: PostComment[];
};

export type ToggleInteractionResponse = {
  active: boolean;
  count: number;
};

export type ToggleFollowResponse = {
  following: boolean;
  followerCount: number;
  followingCount: number;
};

export type UserRelation = {
  id: number;
  username: string;
  avatarUrl?: string | null;
  followedAt: string;
};

export type ReportItem = {
  targetType: "POST" | "COMMENT";
  reportId: number;
  targetId: number;
  reporterId: number;
  reporterUsername?: string | null;
  reason: string;
  detail?: string | null;
  status: "PENDING" | "VALID" | "INVALID" | "PUNISHED";
  resolutionNote?: string | null;
  handledBy?: number | null;
  handledByUsername?: string | null;
  createdAt: string;
  handledAt?: string | null;
  targetTitle?: string | null;
};

export type AdminDashboardMetrics = {
  newUserCount: number;
  postCount: number;
  resourcePurchaseCount: number;
  bountyPostCount: number;
  bountyAcceptanceRate: number;
  totalCoinIssued: number;
  totalCoinConsumed: number;
};

export type ResourceTradeAuditItem = {
  purchaseId: number;
  postId: number;
  postTitle?: string | null;
  buyerId: number;
  buyerUsername?: string | null;
  sellerId: number;
  sellerUsername?: string | null;
  price: number;
  refundedAmount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminBountySummary = {
  id: number;
  title: string;
  authorId: number;
  authorUsername?: string | null;
  status: "PUBLISHED" | "CLOSED" | "OFFLINE" | "DELETED";
  bountyStatus: "ACTIVE" | "RESOLVED" | "EXPIRED";
  bountyAmount: number;
  answerCount: number;
  acceptedCommentId?: number | null;
  bountyExpireAt?: string | null;
  bountySettledAt?: string | null;
  createdAt: string;
  updatedAt: string;
};
