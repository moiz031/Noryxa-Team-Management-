import { requireAdmin } from "@/lib/auth/roles";
import { AppShell } from "@/components/layout/app-shell";
import ProfilePage from "@/components/profile-page-client";

export default async function AdminProfilePage() {
  const context = await requireAdmin();
  return (
    <AppShell role="admin" userEmail={context.user.email ?? ""}>
      <ProfilePage />
    </AppShell>
  );
}
