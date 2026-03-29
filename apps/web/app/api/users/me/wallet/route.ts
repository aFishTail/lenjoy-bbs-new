import { NextRequest, NextResponse } from "next/server";

const backendBase = process.env.API_SERVER_BASE_URL || "http://localhost:8080";

export async function GET(request: NextRequest) {
  const response = await fetch(`${backendBase}/api/v1/users/me/wallet`, {
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
