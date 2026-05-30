import { PublicUserProfileClient } from "@/components/user/public-user-profile-client";

type Props = {
  params: Promise<{ userId: string }>;
};

export default async function PublicUserProfilePage({ params }: Props) {
  const { userId } = await params;
  return <PublicUserProfileClient userId={userId} />;
}
