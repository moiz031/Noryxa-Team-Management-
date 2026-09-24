import { requireEmployee } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getMemberEarningsSummary } from "@/lib/db/earnings";
import { AppShell } from "@/components/layout/app-shell";
import { MemberEarningsPanel } from "@/components/earnings/member-earnings-panel";

export default async function EarningsPage() {
  const context = await requireEmployee();
  const { data: employee } = await createSupabaseAdminClient().from("employees").select("id").eq("profile_id", context.user.id).maybeSingle();
  if (!employee) return null;
  const summary = await getMemberEarningsSummary(employee.id);
  return <AppShell role="employee" userEmail={context.user.email ?? ""}><div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8"><MemberEarningsPanel summary={summary} /></div></AppShell>;
}
