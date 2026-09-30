import { requireAdmin } from "@/lib/auth/roles";
import { AppShell } from "@/components/layout/app-shell";
import DepartmentsClientPage from "@/components/departments-page-client";

export default async function DepartmentsPage() {
  const context = await requireAdmin();
  return (
    <AppShell role="admin" userEmail={context.user.email ?? ""}>
      <DepartmentsClientPage />
    </AppShell>
  );
}
