"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PropsWithChildren } from "react";
import styles from "./admin-shell.module.css";
import { AdminReadOnlyBanner } from "./admin-read-only-banner";

type AdminMenuLink = { href: string; label: string };
type AdminMenu = AdminMenuLink | { label: string; children: AdminMenuLink[] };

const menus: AdminMenu[] = [
  { href: "/admin", label: "总览" },
  { href: "/admin/posts", label: "帖子管理" },
  { href: "/admin/categories", label: "分类管理" },
  { href: "/admin/tags", label: "标签管理" },
  { href: "/admin/users", label: "用户管理" },
  { href: "/admin/audit", label: "审计中心" },
  { href: "/admin/coins", label: "金币管理" },
  { href: "/admin/appeals", label: "资源申诉" },
  {
    label: "悬赏管理",
    children: [
      { href: "/admin/bounties", label: "悬赏治理" },
      { href: "/admin/bounty-delete-requests", label: "删除申请" },
    ],
  },
  { href: "/admin/reports", label: "举报管理" },
  { href: "/admin/open-api", label: "Open API" },
  { href: "/admin/operations", label: "任务中心" },
];

function isMenuActive(pathname: string, href: string) {
  return href === "/admin"
    ? pathname === "/admin"
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children }: PropsWithChildren) {
  const pathname = usePathname();

  return (
    <div className={styles.shell}>
      <AdminReadOnlyBanner />
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
            if ("href" in menu) {
              const isActive = isMenuActive(pathname, menu.href);
              return (
                <Link
                  key={menu.href}
                  href={menu.href}
                  className={`admin-nav-link ${isActive ? "is-active" : ""}`}
                >
                  {menu.label}
                </Link>
              );
            }

            return (
              <div key={menu.label}>
                <div className="admin-nav-link">{menu.label}</div>
                {menu.children.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={`admin-nav-link ${
                      isMenuActive(pathname, child.href) ? "is-active" : ""
                    }`}
                    style={{ paddingLeft: 28 }}
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
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
          <p>内容治理与运营配置</p>
        </header>
        {children}
      </section>
    </div>
  );
}
