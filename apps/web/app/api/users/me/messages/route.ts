import { NextRequest, NextResponse } from "next/server";

const backendBase = process.env.API_SERVER_BASE_URL || "http://localhost:8080";

export async function GET(request: NextRequest) {
  const search = new URL(request.url).searchParams;
  const limit = search.get("limit");
  const target = new URL(`${backendBase}/api/v1/users/me/messages`);
  if (limit) {
    target.searchParams.set("limit", limit);
  }

  const response = await fetch(target, {
    method: "GET",
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
