import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/layout/navigation";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Lenjoy BBS - 社区",
  description: "内容分享、知识交流和资源变现的互动社区",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <Navigation />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
