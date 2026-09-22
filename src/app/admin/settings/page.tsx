import { requireAdmin } from "@/lib/auth/roles";
import { getOrganizationSettings } from "@/lib/db/organization-settings";
import { AppShell } from "@/components/layout/app-shell";
import { OrganizationSettingsForm } from "@/components/organization-settings-form";
import { Settings } from "lucide-react";

export default async function AdminSettingsPage() {
  const context = await requireAdmin();
  const settings = await getOrganizationSettings();
  return <AppShell role="admin" userEmail={context.user.email ?? ""}><div className="mx-auto max-w-5xl space-y-8 p-6 lg:p-8"><div className="border-b border-white/[0.08] pb-6"><div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#24C5E3]"><Settings className="size-4" />Organization policy</div><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#F5F7FA]">Organization settings</h1><p className="mt-1 text-sm text-[#A7AFBC]">Control shared defaults used by schedules, files, leave, and communication policy.</p></div><OrganizationSettingsForm initial={settings} /></div></AppShell>;
}
