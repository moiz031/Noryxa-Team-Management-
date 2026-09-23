import { requireAdmin } from "@/lib/auth/roles";
import { AppShell } from "@/components/layout/app-shell";
import { LearningAdminPanel } from "@/components/learning/learning-admin-panel";

export default async function AdminLearnPage() {
  const context = await requireAdmin();
  return (
    <AppShell role="admin" userEmail={context.user.email ?? ""}>
      <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        <LearningAdminPanel />
      </div>
    </AppShell>
  );
}
