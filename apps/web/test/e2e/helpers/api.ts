import type { APIRequestContext } from "@playwright/test";

import type { AuthData } from "../../helpers/types";

type ApiEnvelope<T> = {
  success: boolean;
  code: string;
  message: string;
  data: T;
};

function authHeaders(auth: AuthData): Record<string, string> {
  return {
    Authorization: `${auth.tokenType || "Bearer"} ${auth.accessToken}`,
  };
}

async function apiRequest<T>(
  request: APIRequestContext,
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  auth?: AuthData,
  data?: unknown,
): Promise<{ ok: boolean; status: number; data: T }> {
  const response = await request.fetch(path, {
    method,
    headers: {
      Accept: "application/json",
      ...(auth ? authHeaders(auth) : {}),
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    data,
  });

  const payload = (await response.json()) as ApiEnvelope<T>;
  return { ok: response.ok(), status: response.status(), data: payload.data };
}

export type WalletSummary = {
  availableCoins: number;
  frozenCoins: number;
  totalCoins: number;
  updatedAt: string;
};

export type CreatedPost = {
  id: number;
  postType: string;
  title: string;
  authorId: number;
  authorUsername: string;
};

export type SiteMessage = {
  id: number;
  messageType: string;
  title: string;
  read: boolean;
  actionUrl?: string | null;
};

export async function createPostViaApi(
  request: APIRequestContext,
  auth: AuthData,
  payload: {
    postType: "NORMAL" | "RESOURCE" | "BOUNTY";
    title: string;
    content: string;
    hiddenContent?: string;
    price?: number;
    bountyAmount?: number;
    bountyExpireAt?: string;
  },
): Promise<CreatedPost> {
  const result = await apiRequest<CreatedPost>(request, "POST", "/api/posts", auth, payload);
  if (!result.ok) {
    throw new Error(`createPostViaApi failed: ${result.status}`);
  }
  return result.data;
}

export async function getWalletSummary(
  request: APIRequestContext,
  auth: AuthData,
): Promise<WalletSummary> {
  const result = await apiRequest<WalletSummary>(request, "GET", "/api/users/me/wallet", auth);
  if (!result.ok) {
    throw new Error(`getWalletSummary failed: ${result.status}`);
  }
  return result.data;
}

export async function purchaseResourceViaApi(
  request: APIRequestContext,
  auth: AuthData,
  postId: number,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  return apiRequest(request, "POST", `/api/posts/${postId}/purchase`, auth);
}

export async function submitCommentViaApi(
  request: APIRequestContext,
  auth: AuthData,
  postId: number,
  content: string,
  parentId?: number | null,
): Promise<{ id: number; content: string; authorUsername: string }> {
  const result = await apiRequest<{ id: number; content: string; authorUsername: string }>(
    request,
    "POST",
    `/api/posts/${postId}/comments`,
    auth,
    { content, parentId: parentId ?? null },
  );
  if (!result.ok) {
    throw new Error(`submitCommentViaApi failed: ${result.status}`);
  }
  return result.data;
}

export async function acceptAnswerViaApi(
  request: APIRequestContext,
  auth: AuthData,
  postId: number,
  commentId: number,
): Promise<void> {
  const result = await apiRequest(
    request,
    "POST",
    `/api/posts/${postId}/comments/${commentId}/accept`,
    auth,
  );
  if (!result.ok) {
    throw new Error(`acceptAnswerViaApi failed: ${result.status}`);
  }
}

export async function getMessages(
  request: APIRequestContext,
  auth: AuthData,
): Promise<SiteMessage[]> {
  const result = await apiRequest<SiteMessage[]>(
    request,
    "GET",
    "/api/users/me/messages?limit=50",
    auth,
  );
  return result.data ?? [];
}

export async function getUnreadCount(
  request: APIRequestContext,
  auth: AuthData,
): Promise<number> {
  const result = await apiRequest<number>(
    request,
    "GET",
    "/api/users/me/messages/unread-count",
    auth,
  );
  return result.data ?? 0;
}

export async function markMessageRead(
  request: APIRequestContext,
  auth: AuthData,
  messageId: number,
): Promise<void> {
  await apiRequest(request, "PATCH", `/api/users/me/messages/${messageId}/read`, auth);
}

export async function markAllMessagesRead(
  request: APIRequestContext,
  auth: AuthData,
): Promise<number> {
  const result = await apiRequest<number>(
    request,
    "PATCH",
    "/api/users/me/messages/read-all",
    auth,
  );
  return result.data ?? 0;
}

export async function getPostDetailViaApi(
  request: APIRequestContext,
  postId: number,
  auth?: AuthData,
): Promise<{
  id: number;
  postType: string;
  title: string;
  status: string;
  hiddenContent?: string | null;
  purchased?: boolean;
  resourceUnlocked?: boolean;
  canPurchase?: boolean;
  bountyStatus?: string;
  acceptedCommentId?: number | null;
  answerCount?: number;
}> {
  const result = await apiRequest<ReturnType<typeof getPostDetailViaApi> extends Promise<infer R> ? R : never>(
    request,
    "GET",
    `/api/posts/${postId}`,
    auth,
  );
  return result.data;
}

export async function getPostCommentsViaApi(
  request: APIRequestContext,
  postId: number,
  auth?: AuthData,
): Promise<
  Array<{
    id: number;
    content: string | null;
    authorUsername: string;
    isAccepted?: boolean;
    canViewContent?: boolean;
    maskedSummary?: string;
  }>
> {
  const result = await apiRequest<ReturnType<typeof getPostCommentsViaApi> extends Promise<infer R> ? R : never>(
    request,
    "GET",
    `/api/posts/${postId}/comments`,
    auth,
  );
  return result.data ?? [];
}
