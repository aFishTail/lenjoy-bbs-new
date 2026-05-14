import { notFound } from "next/navigation";
import { getAuthSession } from "@/actions/auth";

const backendBase = process.env.API_SERVER_BASE_URL || "http://localhost:8080";

type LegacyApiResponse<T> = {
  success: boolean;
  message?: string;
  data: T;
};

type ApiEnvelopeError = {
  code: string;
  message: string;
};

type BackendApiEnvelope<T> = {
  data: T;
  error: ApiEnvelopeError | null;
  meta: Record<string, unknown>;
};

type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
};

type FetchOptions = RequestInit & {
  // If true, will not throw but return null on 404
  allowNotFound?: boolean;
};

function readPaginationMeta(meta: Record<string, unknown> | undefined): PaginationMeta | null {
  if (!meta) {
    return null;
  }

  const page = meta.page;
  const pageSize = meta.pageSize;
  const total = meta.total;

  if (
    typeof page !== "number" ||
    typeof pageSize !== "number" ||
    typeof total !== "number"
  ) {
    return null;
  }

  return { page, pageSize, total };
}

function normalizeServerPayloadData<T>(
  data: T,
  meta: Record<string, unknown> | undefined,
): T {
  const pagination = readPaginationMeta(meta);
  if (!pagination || !Array.isArray(data)) {
    return data;
  }

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));

  return {
    items: data,
    page: pagination.page,
    pageSize: pagination.pageSize,
    total: pagination.total,
    totalPages,
    hasNext: pagination.page < totalPages,
    hasPrevious: pagination.page > 1,
  } as T;
}

function readServerPayloadData<T>(payload: unknown): T {
  if (!payload || typeof payload !== "object") {
    throw new Error("Server API returned an invalid payload");
  }

  if ("success" in payload) {
    const legacyPayload = payload as LegacyApiResponse<T>;
    if (!legacyPayload.success) {
      throw new Error(
        legacyPayload.message || "Server API returned error status",
      );
    }
    return legacyPayload.data;
  }

  const envelopePayload = payload as BackendApiEnvelope<T>;
  if (envelopePayload.error) {
    throw new Error(
      envelopePayload.error.message || "Server API returned error status",
    );
  }

  return normalizeServerPayloadData(envelopePayload.data, envelopePayload.meta);
}

export async function serverFetchApiData<T>(
  path: string,
  options?: FetchOptions,
): Promise<T | null> {
  const url = `${backendBase}${path}`;

  let authHeader = "";
  try {
    const session = await getAuthSession();
    if (session?.accessToken) {
      authHeader = `${session.tokenType || "Bearer"} ${session.accessToken}`;
    }
  } catch (e) {
    // Ignore errors that occur if cookies() is called outside a valid request context
  }
  console.log(`[Server Fetch API] Fetching ${url} with options:`, options);
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: authHeader,
        ...options?.headers,
      },
      // Default to no-store for dynamic data unless overridden
      cache: options?.cache || "no-store",
    });

    if (response.status === 404) {
      if (options?.allowNotFound) return null;
      notFound();
    }

    if (!response.ok) {
      let errBody = "";
      try {
        errBody = await response.text();
      } catch (e) {}
      console.error(
        `[Server Fetch API Error] ${response.status} ${response.statusText} for URL: ${url}. Body: ${errBody}`,
      );
      throw new Error(
        `Server API Error: ${response.status} ${response.statusText}`,
      );
    }

    const json = await response.json();
    return readServerPayloadData<T>(json);
  } catch (error) {
    console.error(`[Server Fetch Data] Failed to fetch ${url}`, error);
    if ((error as any).message?.includes("fetch failed")) {
      throw new Error("后端服务不可用，请稍后重试");
    }
    throw error;
  }
}
