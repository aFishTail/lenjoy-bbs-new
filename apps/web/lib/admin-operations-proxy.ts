import { getAuthSession } from "@/actions/auth";

const forumApiBase =
  process.env.API_SERVER_BASE_URL || "http://localhost:8080";

const serviceBases = {
  automation:
    process.env.AUTOMATION_SERVICE_BASE_URL || "http://localhost:8010",
  transfer: process.env.TRANSFER_SERVICE_BASE_URL || "http://localhost:8008",
} as const;

type ServiceName = keyof typeof serviceBases;

const allowedPrefixes: Record<ServiceName, string[]> = {
  automation: ["automation/tasks", "automation/items/"],
  transfer: ["auth/quark/status", "resource/transfer"],
};

async function requireAdminSession(): Promise<Response | null> {
  const session = await getAuthSession();
  if (!session?.accessToken) {
    return Response.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const response = await fetch(`${forumApiBase}/api/v1/admin/metrics/dashboard`, {
    headers: {
      Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return Response.json(
      { detail: response.status === 401 ? "Unauthorized" : "Forbidden" },
      { status: response.status === 401 ? 401 : 403 },
    );
  }
  return null;
}

export async function proxyOperationsRequest(
  request: Request,
  service: string,
  pathSegments: string[],
): Promise<Response> {
  const authError = await requireAdminSession();
  if (authError) {
    return authError;
  }

  if (!(service in serviceBases)) {
    return Response.json({ detail: "Unknown service" }, { status: 404 });
  }

  const serviceName = service as ServiceName;
  const path = pathSegments.join("/");
  if (!allowedPrefixes[serviceName].some((prefix) => path.startsWith(prefix))) {
    return Response.json({ detail: "Operation not allowed" }, { status: 403 });
  }

  const target = new URL(`/api/v1/${path}`, serviceBases[serviceName]);
  target.search = new URL(request.url).search;
  const headers = new Headers();
  headers.set("X-Service-Token", process.env.INTERNAL_SERVICE_TOKEN || "");
  if (request.headers.get("content-type")) {
    headers.set("Content-Type", request.headers.get("content-type")!);
  }

  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.text(),
      cache: "no-store",
    });
    const text = await response.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }
    if (!response.ok) {
      const detail = payload && typeof payload === "object" && "detail" in payload
        ? String(payload.detail)
        : `${serviceName} request failed`;
      return Response.json({
        data: null,
        error: { code: `OPERATIONS_${response.status}`, message: detail },
        meta: { apiVersion: "v1" },
      }, { status: response.status });
    }
    return Response.json({
      data: payload,
      error: null,
      meta: { apiVersion: "v1" },
    }, {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({
      data: null,
      error: {
        code: "OPERATIONS_SERVICE_UNAVAILABLE",
        message: `${serviceName} service unavailable`,
      },
      meta: { apiVersion: "v1" },
    }, { status: 502 });
  }
}
