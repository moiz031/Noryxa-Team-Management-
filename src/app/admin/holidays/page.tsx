import Link from "next/link";
import { requireAdmin } from "@/lib/auth/roles";
import { listBatch2 } from "@/lib/db/batch2";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarDays, Building2, Users } from "lucide-react";

export default async function HolidaysPage() {
  const context = await requireAdmin();
  const holidays = await listBatch2("holidays") as {
    id: string;
    name: string;
    holiday_date: string;
    is_company_wide: boolean;
  }[];

  // Sort by holiday_date ascending
  const sorted = [...holidays].sort((a, b) =>
    a.holiday_date.localeCompare(b.holiday_date)
  );

  return (
    <AppShell role="admin" userEmail={context.user.email ?? ""}>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#F5B942]">
              <CalendarDays className="size-3.5" />
              <span>Holiday Calendar</span>
            </div>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#F5F7FA]">
              Holidays
            </h1>
            <p className="mt-1 text-xs text-[#A7AFBC]">
              Company-wide and department-specific holidays.
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-[#0E1117] px-4 py-2 text-xs">
            <span className="text-[#6B7280]">Total Holidays: </span>
            <span className="font-bold text-[#F5F7FA]">{holidays.length}</span>
          </div>
        </div>

        {/* Holiday List / Empty State */}
        {sorted.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="size-6" />}
            title="No holidays configured"
            description="No holidays have been set up yet."
          />
        ) : (
          <div className="rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 divide-y divide-white/[0.05]">
            {sorted.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between gap-4 px-5 py-4 transition-colors duration-150 hover:bg-white/[0.025]"
              >
                <div className="flex items-center gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#F5B942]/15 text-[#F5B942]">
                    <CalendarDays className="size-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#F5F7FA]">{h.name}</h3>
                    <p className="mt-0.5 text-xs text-[#6B7280]">
                      {new Date(h.holiday_date).toLocaleDateString("en-US", {
                        weekday: "short",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold shrink-0 ${
                    h.is_company_wide
                      ? "bg-[#39FF14]/15 text-[#39FF14] border border-[#39FF14]/30"
                      : "bg-[#24C5E3]/15 text-[#24C5E3] border border-[#24C5E3]/30"
                  }`}
                >
                  {h.is_company_wide ? (
                    <>
                      <Building2 className="size-3" /> Company-wide
                    </>
                  ) : (
                    <>
                      <Users className="size-3" /> Department
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
