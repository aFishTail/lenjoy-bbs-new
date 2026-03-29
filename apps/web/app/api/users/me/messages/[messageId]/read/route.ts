import { NextRequest, NextResponse } from "next/server";

const backendBase = process.env.API_SERVER_BASE_URL || "http://localhost:8080";

type Params = {
  params: Promise<{ messageId: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  const { messageId } = await params;
  const response = await fetch(
    `${backendBase}/api/v1/users/me/messages/${messageId}/read`,
    {
      method: "PATCH",
      headers: {
        Authorization: request.headers.get("authorization") || "",
      },
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
