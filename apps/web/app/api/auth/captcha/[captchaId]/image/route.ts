import { NextRequest, NextResponse } from "next/server";

const backendBase = process.env.API_SERVER_BASE_URL || "http://localhost:8080";

type Params = {
  params: Promise<{ captchaId: string }>;
};

export async function GET(request: NextRequest, context: Params) {
  const { captchaId } = await context.params;
  const search = request.nextUrl.searchParams.toString();
  const query = search ? `?${search}` : "";

  const response = await fetch(
    `${backendBase}/api/v1/auth/captcha/${captchaId}/image${query}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  const image = await response.arrayBuffer();
  return new NextResponse(image, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "image/png",
      "Cache-Control": "no-store",
    },
  });
}
