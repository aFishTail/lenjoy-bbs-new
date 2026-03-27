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

export async function GET(request: NextRequest) {
  try {
    const target = new URL(`${backendBase}/api/v1/posts`);
    request.nextUrl.searchParams.forEach((value, key) => {
      target.searchParams.set(key, value);
    });

    const response = await fetch(target.toString(), {
      method: "GET",
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const response = await fetch(`${backendBase}/api/v1/posts`, {
      method: "POST",
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
  } catch {
    return upstreamUnavailableResponse();
  }
}
