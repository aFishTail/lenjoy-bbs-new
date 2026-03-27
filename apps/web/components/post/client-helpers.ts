import type { ApiResponse, AuthData } from "@/components/post/types";

const AUTH_STORAGE_KEY = "lenjoy.auth";

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

export async function readApi<T>(response: Response): Promise<ApiResponse<T>> {
  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || "请求失败");
  }
  return payload;
}

export function readError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "请求失败，请稍后重试";
}
