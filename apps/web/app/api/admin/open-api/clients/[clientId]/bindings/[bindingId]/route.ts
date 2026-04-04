import { NextRequest, NextResponse } from "next/server";

const backendBase = process.env.API_SERVER_BASE_URL || "http://localhost:8080";

function buildHeaders(request: NextRequest, withJson = false): HeadersInit {
  return {
    ...(withJson ? { "Content-Type": "application/json" } : {}),
    Authorization: request.headers.get("authorization") || "",
  };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; bindingId: string }> },
) {
  const { clientId, bindingId } = await params;
  const body = await request.text();
  const response = await fetch(
    `${backendBase}/api/v1/admin/open-api/clients/${clientId}/bindings/${bindingId}`,
    {
      method: "PUT",
      headers: buildHeaders(request, true),
      body,
      cache: "no-store",
    },
  );
  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("Content-Type") ||
        "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; bindingId: string }> },
) {
  const { clientId, bindingId } = await params;
  const response = await fetch(
    `${backendBase}/api/v1/admin/open-api/clients/${clientId}/bindings/${bindingId}`,
    {
      method: "DELETE",
      headers: buildHeaders(request),
      cache: "no-store",
    },
  );
  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("Content-Type") ||
        "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
