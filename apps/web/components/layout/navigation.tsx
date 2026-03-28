"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserMenu } from "@/components/layout/user-menu";

export function Navigation() {
  const pathname = usePathname();

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
          <Link href="/" className="nav-link active">
            首页
          </Link>
          <Link href="/posts" className="nav-link">
            帖子
          </Link>
          <Link href="/my" className="nav-link">
            我的
          </Link>
        </div>
        <div className="nav-actions">
          <UserMenu />
          <Link href="/posts/new" className="btn btn-primary btn-sm">
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
