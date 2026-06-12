import { proxyOperationsRequest } from "@/lib/admin-operations-proxy";

type RouteContext = {
  params: Promise<{ service: string; path: string[] }>;
};

async function proxy(request: Request, context: RouteContext) {
  const { service, path } = await context.params;
  return proxyOperationsRequest(request, service, path);
}

export const GET = proxy;
export const POST = proxy;
