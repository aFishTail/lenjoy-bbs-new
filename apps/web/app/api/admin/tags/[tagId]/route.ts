import { NextRequest, NextResponse } from "next/server";

const backendBase = process.env.API_SERVER_BASE_URL || "http://localhost:8080";

type Params = {
  params: Promise<{ tagId: string }>;
};

export async function PUT(request: NextRequest, { params }: Params) {
  const { tagId } = await params;
  const body = await request.text();
  const response = await fetch(`${backendBase}/api/v1/admin/tags/${tagId}`, {
    method: "PUT",
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

export async function DELETE(request: NextRequest, { params }: Params) {
  const { tagId } = await params;
  const response = await fetch(`${backendBase}/api/v1/admin/tags/${tagId}`, {
    method: "DELETE",
    headers: {
      Authorization: request.headers.get("authorization") || "",
    },
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
