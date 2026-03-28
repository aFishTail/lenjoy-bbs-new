import { NextRequest, NextResponse } from "next/server";

const backendBase = process.env.API_SERVER_BASE_URL || "http://localhost:8080";

function upstreamUnavailableResponse() {
  return NextResponse.json(
    {
      success: false,
      code: "UPSTREAM_UNAVAILABLE",
      message: "后端服务不可用，请稍后重试",
      data: null,
    },
    {
      status: 502,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const response = await fetch(`${backendBase}/api/v1/files/images`, {
      method: "POST",
      headers: {
        Authorization: request.headers.get("authorization") || "",
      },
      body: formData,
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
  } catch {
    return upstreamUnavailableResponse();
  }
}
