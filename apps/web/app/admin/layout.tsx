import { redirect } from "next/navigation";

import { getAuthSession } from "@/actions/auth";
import { AdminShell } from "@/components/admin/admin-shell";

function isAdmin(roles: string[] | undefined): boolean {
  if (!roles?.length) {
    return false;
  }

  return roles.some((role) => role === "ADMIN" || role === "ROLE_ADMIN");
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authSession = await getAuthSession();

  if (!authSession?.token) {
    redirect("/auth");
  }

  if (!isAdmin(authSession.user.roles)) {
    redirect("/?error=admin-forbidden");
  }

  return <AdminShell>{children}</AdminShell>;
}
