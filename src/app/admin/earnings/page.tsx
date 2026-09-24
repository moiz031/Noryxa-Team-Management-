import { requireAdmin } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listEarningsEmployees, listRevenueDeals, listRevenueProjects } from "@/lib/db/earnings";
import { AppShell } from "@/components/layout/app-shell";
import { AdminEarningsPanel } from "@/components/earnings/admin-earnings-panel";

export default async function AdminEarningsPage() {
  const context = await requireAdmin();
  const adminDb = createSupabaseAdminClient();
  const [deals, employees, projects, { data: sponsors }] = await Promise.all([
    listRevenueDeals(), listEarningsEmployees(), listRevenueProjects(), adminDb.from("member_sponsors").select("member_employee_id,sponsor_employee_id"),
  ]);
  return <AppShell role="admin" userEmail={context.user.email ?? ""}><div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8"><AdminEarningsPanel initial={{ deals, employees, projects, sponsors: sponsors ?? [] }} /></div></AppShell>;
}
