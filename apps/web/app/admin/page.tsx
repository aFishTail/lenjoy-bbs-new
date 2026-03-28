import Link from "next/link";

export default function AdminHomePage() {
  return (
    <main className="admin-main">
      <section className="admin-hero">
        <h1>运营控制台</h1>
        <p>集中处理帖子治理与用户状态管理，所有操作都面向真实业务数据。</p>
      </section>

      <section className="admin-kpi-grid">
        <article className="admin-kpi-card">
          <h3>帖子治理</h3>
          <p>筛选与下架违规帖子，记录处理原因。</p>
          <Link href="/admin/posts" className="admin-kpi-link">
            进入帖子管理
          </Link>
        </article>
        <article className="admin-kpi-card">
          <h3>用户治理</h3>
          <p>执行禁言与封禁操作，维护社区秩序。</p>
          <Link href="/admin/users" className="admin-kpi-link">
            进入用户管理
          </Link>
        </article>
      </section>
    </main>
  );
}
