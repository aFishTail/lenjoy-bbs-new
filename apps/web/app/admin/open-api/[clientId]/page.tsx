import { AdminOpenApiClientDetailClient } from "@/components/admin/admin-open-api-client-detail-client";

export default async function AdminOpenApiClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return <AdminOpenApiClientDetailClient clientId={clientId} />;
}
