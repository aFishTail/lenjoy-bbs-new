import { NextRequest, NextResponse } from "next/server";

const backendBase = process.env.API_SERVER_BASE_URL || "http://localhost:8080";

type Params = {
  params: Promise<{ categoryId: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  const { categoryId } = await params;
  const body = await request.text();
  const response = await fetch(`${backendBase}/api/v1/admin/categories/${categoryId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: request.headers.get("authorization") || "",
    },
    body,
    cache: "no-store",
  });
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
