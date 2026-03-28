"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PropsWithChildren } from "react";

const menus = [
  { href: "/admin", label: "总览" },
  { href: "/admin/posts", label: "帖子管理" },
  { href: "/admin/users", label: "用户管理" },
];

export function AdminShell({ children }: PropsWithChildren) {
  const pathname = usePathname();

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-mark">LX</span>
          <div>
            <h2>Lenjoy Admin</h2>
            <p>Community Operations</p>
          </div>
        </div>
        <nav className="admin-nav">
          {menus.map((menu) => {
            const isRootAdminMenu = menu.href === "/admin";
            const isActive = isRootAdminMenu
              ? pathname === "/admin"
              : pathname === menu.href || pathname.startsWith(`${menu.href}/`);
            return (
              <Link
                key={menu.href}
                href={menu.href}
                className={`admin-nav-link ${isActive ? "is-active" : ""}`}
              >
                {menu.label}
              </Link>
            );
          })}
        </nav>
        <Link href="/" className="admin-back-home">
          返回社区首页
        </Link>
      </aside>

      <section className="admin-content-wrap">
        <header className="admin-topbar">
          <h1>管理后台</h1>
          <p>内容治理与用户管理</p>
        </header>
        {children}
      </section>
    </div>
  );
}
