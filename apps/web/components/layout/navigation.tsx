"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageNotification } from "@/components/layout/message-notification";
import { UserMenu } from "@/components/layout/user-menu";
import { useAuth } from "@/components/providers/auth-provider";

export function Navigation() {
  const pathname = usePathname();
  const { hasAuth } = useAuth();

  const isHome = pathname === "/";
  const isDiscussion =
    pathname === "/discussions" || pathname.startsWith("/posts");
  const isResource = pathname === "/resources";
  const isBounty = pathname === "/bounties";

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return null;
  }

  return (
    <nav className="nav">
      <div className="nav-container">
        <Link href="/" className="nav-logo">
          <span className="nav-logo-icon">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </span>
          Lenjoy
        </Link>
        <div className="nav-links">
          <Link href="/" className={`nav-link ${isHome ? "active" : ""}`}>
            首页
          </Link>
          <Link
            href="/discussions"
            className={`nav-link ${isDiscussion ? "active" : ""}`}
          >
            讨论
          </Link>
          <Link
            href="/resources"
            className={`nav-link ${isResource ? "active" : ""}`}
          >
            资源
          </Link>
          <Link
            href="/bounties"
            className={`nav-link ${isBounty ? "active" : ""}`}
          >
            悬赏
          </Link>
        </div>
        <div className="nav-actions">
          <MessageNotification />
          <UserMenu />
          <Link href={hasAuth ? "/posts/new" : "/auth"} className="btn btn-primary btn-sm">
            <svg
              className="icon-sm"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            发帖
          </Link>
        </div>
      </div>
    </nav>
  );
}
