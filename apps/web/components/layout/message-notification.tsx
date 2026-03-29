"use client";

import Link from "next/link";
import {
  useClientAuth,
  useUnreadCount,
} from "@/components/layout/use-auth-unread";

export function MessageNotification() {
  const { mounted, hasAuth } = useClientAuth();
  const { unreadCount } = useUnreadCount(mounted && hasAuth);

  if (!mounted || !hasAuth) {
    return null;
  }

  return (
    <Link
      href="/my/messages"
      className="nav-message-btn"
      aria-label="消息通知"
      title="消息通知"
    >
      <svg
        className="icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
        <path d="M9 17a3 3 0 0 0 6 0" />
      </svg>
      {unreadCount > 0 ? (
        <span className="nav-message-badge">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
