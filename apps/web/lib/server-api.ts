import { notFound } from "next/navigation";
import { getAuthSession } from "@/actions/auth";

const backendBase = process.env.API_SERVER_BASE_URL || "http://localhost:8080";

type FetchOptions = RequestInit & {
  // If true, will not throw but return null on 404
  allowNotFound?: boolean;
};

export async function serverFetchApiData<T>(
  path: string,
  options?: FetchOptions
): Promise<T | null> {
  const url = `${backendBase}${path}`;
  
  let authHeader = "";
  try {
    const session = await getAuthSession();
    if (session?.token) {
      authHeader = `${session.tokenType || "Bearer"} ${session.token}`;
    }
  } catch (e) {
    // Ignore errors that occur if cookies() is called outside a valid request context
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": authHeader,
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
      try { errBody = await response.text(); } catch(e) {}
      console.error(`[Server Fetch API Error] ${response.status} ${response.statusText} for URL: ${url}. Body: ${errBody}`);
      throw new Error(`Server API Error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    if (!json.success) {
      throw new Error(json.message || "Server API returned error status");
    }

    return json.data as T;
  } catch (error) {
    console.error(`[Server Fetch Data] Failed to fetch ${url}`, error);
    if ((error as any).message?.includes("fetch failed")) {
      throw new Error("后端服务不可用，请稍后重试");
    }
    throw error;
  }
}
