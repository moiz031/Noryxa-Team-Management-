import { requireUser } from "@/lib/auth/roles";
import { AppShell } from "@/components/layout/app-shell";
import ProfilePage from "@/components/profile-page-client";

export default async function UserProfilePage() {
  const context = await requireUser();
  return (
    <AppShell role={context.role} userEmail={context.user.email ?? ""}>
      <ProfilePage />
    </AppShell>
  );
}
