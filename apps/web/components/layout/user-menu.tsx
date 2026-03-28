"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AuthData, AuthUser } from "@/components/auth/types";

const AUTH_STORAGE_KEY = "lenjoy.auth";

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
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    // 从 localStorage 读取用户信息
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      try {
        const authData = JSON.parse(raw) as AuthData;
        setUser(authData.user);
      } catch {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }

    // 监听 storage 变化（跨页面同步登录状态）
    const handleStorageChange = () => {
      const newRaw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (newRaw) {
        try {
          const authData = JSON.parse(newRaw) as AuthData;
          setUser(authData.user);
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

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
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setUser(null);
    setIsOpen(false);
    router.replace("/");
  }

  // 未挂载或未登录时显示登录按钮
  if (!mounted || !user) {
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
