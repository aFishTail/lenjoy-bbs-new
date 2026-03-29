import type { ApiResponse, AuthData } from "@/components/post/types";

const AUTH_STORAGE_KEY = "lenjoy.auth";
export const MESSAGE_EVENT = "lenjoy.messages.changed";

export const queryKeys = {
  authSession: ["auth", "session"] as const,
  captcha: ["auth", "captcha"] as const,
  posts: ["posts"] as const,
  postFeed: (postType: string) => ["posts", "feed", postType] as const,
  postDetail: (postId: string) => ["posts", postId] as const,
  postComments: (postId: string) => ["posts", postId, "comments"] as const,
  myPosts: ["posts", "mine"] as const,
  myProfile: ["users", "me"] as const,
  myWallet: ["users", "me", "wallet"] as const,
  mySales: ["users", "me", "resource-sales"] as const,
  myPurchases: ["users", "me", "resource-purchases"] as const,
  myLedger: ["users", "me", "ledger"] as const,
  myMessages: ["users", "me", "messages"] as const,
  unreadCount: ["users", "me", "messages", "unread-count"] as const,
  adminOverview: ["admin", "overview"] as const,
  adminUsers: (filters: Record<string, unknown>) =>
    ["admin", "users", filters] as const,
  adminResourceAppeals: (filters: Record<string, unknown>) =>
    ["admin", "resource-appeals", filters] as const,
  adminReports: (filters: Record<string, unknown>) =>
    ["admin", "reports", filters] as const,
  adminCoins: (filters: Record<string, unknown>) =>
    ["admin", "coins", filters] as const,
  adminBounties: (filters: Record<string, unknown>) =>
    ["admin", "bounties", filters] as const,
  adminBountyComments: (postId: number | null) =>
    ["admin", "bounties", postId, "comments"] as const,
  adminWalletAudit: (filters: Record<string, unknown>) =>
    ["admin", "audit", "wallet", filters] as const,
  adminTradeAudit: (filters: Record<string, unknown>) =>
    ["admin", "audit", "trades", filters] as const,
  adminPosts: (filters: Record<string, unknown>) =>
    ["admin", "posts", filters] as const,
};

export function clearAuthAndRedirectToLogin(): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(AUTH_STORAGE_KEY);
  window.dispatchEvent(new Event("storage"));

  if (window.location.pathname !== "/auth") {
    window.location.replace("/auth");
  }
}

export function handleForbiddenStatus(status: number): void {
  if (status === 403) {
    clearAuthAndRedirectToLogin();
  }
}

export function getStoredAuth(): AuthData | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as AuthData;
  } catch {
    return null;
  }
}

export function authHeaders(): HeadersInit {
  const auth = getStoredAuth();
  if (!auth?.token) {
    return {};
  }
  return {
    Authorization: `${auth.tokenType || "Bearer"} ${auth.token}`,
  };
}

export function fireMessageChanged(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(MESSAGE_EVENT));
}

export async function readApi<T>(response: Response): Promise<ApiResponse<T>> {
  let payload: ApiResponse<T> | null = null;

  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    handleForbiddenStatus(response.status);
    const fallback = `请求失败（HTTP ${response.status}）`;
    throw new Error(payload?.message || fallback);
  }

  if (!payload || !payload.success) {
    throw new Error(payload?.message || "请求失败");
  }
  return payload;
}

export function readError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "请求失败，请稍后重试";
}

type RequestApiOptions = Omit<RequestInit, "headers"> & {
  headers?: HeadersInit;
  withAuth?: boolean;
  cache?: RequestCache;
};

export async function requestApi<T>(
  input: RequestInfo | URL,
  options?: RequestApiOptions,
): Promise<ApiResponse<T>> {
  const { withAuth = false, headers, ...init } = options ?? {};

  return readApi<T>(
    await fetch(input, {
      ...init,
      headers: {
        ...(withAuth ? authHeaders() : {}),
        ...headers,
      },
    }),
  );
}

export async function requestApiData<T>(
  input: RequestInfo | URL,
  options?: RequestApiOptions,
): Promise<T> {
  const payload = await requestApi<T>(input, options);
  return payload.data;
}
