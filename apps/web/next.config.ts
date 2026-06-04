import type { NextConfig } from "next";

const minioPublicProxyTarget =
  process.env.MINIO_PUBLIC_PROXY_TARGET || "http://localhost:9000/lenjoy-bbs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async rewrites() {
    return [
      {
        source: "/lenjoy-bbs/:path*",
        destination: `${minioPublicProxyTarget.replace(/\/$/, "")}/:path*`,
      },
    ];
  },
};

export default nextConfig;
