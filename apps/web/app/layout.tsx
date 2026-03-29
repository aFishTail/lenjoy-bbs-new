import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/layout/navigation";
import { QueryProvider } from "@/components/providers/query-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { Toaster } from "@/components/ui/toaster";
import { getAuthSession } from "@/actions/auth";

export const metadata: Metadata = {
  title: "Lenjoy BBS - 社区",
  description: "内容分享、知识交流和资源变现的互动社区",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authSession = await getAuthSession();

  return (
    <html lang="zh-CN">
      <body>
        <QueryProvider>
          <AuthProvider initialAuth={authSession}>
            <Navigation />
            {children}
            <Toaster />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
