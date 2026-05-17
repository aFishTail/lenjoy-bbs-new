import type { APIRequestContext } from "@playwright/test";

import type { ApiEnvelope, AuthData } from "./types";

type BackendEnvelope<T> = {
  data: T;
  error: { code: string; message: string } | null;
  meta: Record<string, unknown>;
};

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  auth?: AuthData;
  data?: unknown;
};

export async function apiResponse<T>(
  request: APIRequestContext,
  path: string,
  options?: ApiRequestOptions,
): Promise<{
  ok: boolean;
  status: number;
  payload: ApiEnvelope<T>;
}> {
  const response = await request.fetch(path, {
    method: options?.method || "GET",
    headers: {
      Accept: "application/json",
      ...(options?.auth
        ? {
            Authorization: `${options.auth.tokenType || "Bearer"} ${options.auth.accessToken}`,
          }
        : {}),
      ...(options?.data ? { "Content-Type": "application/json" } : {}),
    },
    data: options?.data,
  });

  const rawPayload = (await response.json()) as ApiEnvelope<T> | BackendEnvelope<T>;
  const payload =
    "success" in rawPayload
      ? rawPayload
      : {
          success: !rawPayload.error,
          code: rawPayload.error?.code || "",
          message: rawPayload.error?.message || "",
          data: rawPayload.data,
        };
  return {
    ok: response.ok(),
    status: response.status(),
    payload,
  };
}

export async function apiData<T>(
  request: APIRequestContext,
  path: string,
  options?: ApiRequestOptions,
): Promise<T> {
  const result = await apiResponse<T>(request, path, options);
  if (!result.ok || !result.payload?.success) {
    throw new Error(
      `${options?.method || "GET"} ${path} failed: ${result.status} ${JSON.stringify(result.payload)}`,
    );
  }
  return result.payload.data;
}
