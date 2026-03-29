"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  useUnreadCount,
} from "@/components/layout/use-auth-unread";
import { useAuth } from "@/components/providers/auth-provider";
import type { AuthData } from "@/components/post/types";

type AuthUser = AuthData["user"];

function Avatar({ user, sizeClass }: { user: AuthUser; sizeClass?: string }) {
  const avatarUrl = user.avatarUrl?.trim();
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`${user.username} 的头像`}
        className={`avatar avatar-image ${sizeClass || ""}`.trim()}
      />
    );
  }

  return (
    <div className={`avatar ${sizeClass || ""}`.trim()}>
      {user.username.charAt(0).toUpperCase()}
    </div>
  );
}

export function UserMenu() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, hasAuth, clearAuth } = useAuth();
  const unreadCountQuery = useUnreadCount(hasAuth);
  const unreadCount = unreadCountQuery.unreadCount;

  useEffect(() => {
    if (isOpen && user) {
      void unreadCountQuery.refetch();
    }
  }, [isOpen, unreadCountQuery, user]);

  // 点击外部关闭菜单
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  function handleLogout() {
    clearAuth();
    setIsOpen(false);
    router.replace("/");
  }

  // 未登录时显示登录按钮
  if (!user) {
    return (
      <Link href="/auth" className="btn btn-ghost btn-sm">
        登录 / 注册
      </Link>
    );
  }

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        type="button"
        className="user-menu-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Avatar user={user} sizeClass="avatar-sm" />
        <span className="user-menu-name">{user.username}</span>
        <svg
          className={`user-menu-arrow ${isOpen ? "open" : ""}`}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className="user-menu-dropdown">
          <div className="user-menu-header">
            <Avatar user={user} />
            <div className="user-menu-info">
              <div className="user-menu-username">{user.username}</div>
              <div className="user-menu-email">
                {user.email || user.phone || "未绑定邮箱"}
              </div>
            </div>
          </div>
          <div className="user-menu-divider" />
          <Link
            href="/my/posts"
            className="user-menu-item"
            onClick={() => setIsOpen(false)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            我的帖子
          </Link>
          <Link
            href="/my"
            className="user-menu-item"
            onClick={() => setIsOpen(false)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            个人中心
          </Link>
          <Link
            href="/my/wallet"
            className="user-menu-item"
            onClick={() => setIsOpen(false)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <path d="M16 12h.01" />
            </svg>
            我的钱包
          </Link>
          <Link
            href="/my/ledger"
            className="user-menu-item"
            onClick={() => setIsOpen(false)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 3v18h18" />
              <path d="M7 13l3-3 3 2 4-5" />
            </svg>
            金币流水
          </Link>
          <Link
            href="/my/purchases"
            className="user-menu-item"
            onClick={() => setIsOpen(false)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 7h16" />
              <path d="M7 3v4" />
              <path d="M17 3v4" />
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="m9 13 2 2 4-4" />
            </svg>
            已购资源
          </Link>
          <Link
            href="/my/sales"
            className="user-menu-item"
            onClick={() => setIsOpen(false)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 3v18h18" />
              <path d="m19 9-5 5-4-4-3 3" />
            </svg>
            销售记录
          </Link>
          <Link
            href="/my/messages"
            className="user-menu-item"
            onClick={() => setIsOpen(false)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            消息中心
            {unreadCount > 0 ? (
              <span className="ml-auto rounded-full bg-cyan-100 px-2 py-0.5 text-xs text-cyan-700">
                {unreadCount}
              </span>
            ) : null}
          </Link>
          <div className="user-menu-divider" />
          <button
            type="button"
            className="user-menu-item user-menu-logout"
            onClick={handleLogout}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            退出登录
          </button>
        </div>
      )}
    </div>
  );
}
