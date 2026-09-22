import Link from "next/link";
import { requireAdmin } from "@/lib/auth/roles";
import { listBatch2 } from "@/lib/db/batch2";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarDays, Clock, Globe } from "lucide-react";

export default async function SchedulesPage() {
  const context = await requireAdmin();
  const schedules = await listBatch2("work_schedules") as {
    id: string;
    name: string;
    timezone: string;
    description?: string | null;
  }[];

  return (
    <AppShell role="admin" userEmail={context.user.email ?? ""}>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="border-b border-white/[0.08] pb-6">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#24C5E3]">
            <CalendarDays className="size-3.5" />
            <span>Work Schedules</span>
          </div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#F5F7FA]">
            Schedules
          </h1>
          <p className="mt-1 text-xs text-[#A7AFBC]">
            Manage work schedule templates and timezone configurations.
          </p>
        </div>

        {/* Schedules Grid / Empty State */}
        {schedules.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="size-6" />}
            title="No schedules configured"
            description="No work schedules have been set up yet."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {schedules.map((s) => (
              <div
                key={s.id}
                className="flex items-start gap-4 rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 p-5 transition-all duration-150 hover:border-white/20"
              >
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#24C5E3]/25 to-[#8B5CF6]/15 text-[#24C5E3]">
                  <CalendarDays className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-[#F5F7FA]">{s.name}</h2>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-[#A7AFBC]">
                      <Globe className="size-3 text-[#24C5E3]" />
                      {s.timezone}
                    </span>
                  </div>
                  {s.description && (
                    <p className="mt-2 text-xs text-[#6B7280]">{s.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
