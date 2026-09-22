import { requireAdmin } from "@/lib/auth/roles";
import { getDailyReports } from "@/lib/db/daily-reports";
import { AdminStatusAction } from "@/components/admin-status-action";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/badge";
import { ClipboardList, User, Calendar, CheckCircle2 } from "lucide-react";

export default async function AdminDailyReportsPage() {
  const context = await requireAdmin();
  const { reports } = await getDailyReports({ status: "all", pageSize: 100 });

  return (
    <AppShell role="admin" userEmail={context.user.email ?? ""}>
      <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="border-b border-white/[0.08] pb-6">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#39FF14]">
            <ClipboardList className="size-3.5" />
            <span>Daily Reports</span>
          </div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#F5F7FA]">
            Daily Reports Management
          </h1>
          <p className="mt-1 text-xs text-[#A7AFBC]">
            Review submitted work summaries and follow up on blockers.
          </p>
        </div>

        {/* Table */}
        {reports.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="size-6" />}
            title="No reports submitted"
            description="No daily reports have been submitted yet."
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0E1117]/80">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-widest text-[#6B7280]">Employee</th>
                  <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-widest text-[#6B7280]">Date</th>
                  <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-widest text-[#6B7280]">Summary</th>
                  <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-widest text-[#6B7280]">Status</th>
                  <th className="px-5 py-4 text-right text-[11px] font-semibold uppercase tracking-widest text-[#6B7280]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {reports.map((report) => (
                  <tr
                    key={report.id}
                    className="group transition-colors duration-150 hover:bg-white/[0.025]"
                  >
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 font-medium text-[#F5F7FA]">
                        <User className="size-3.5 text-[#6B7280]" />
                        {report.employees?.profiles.full_name ||
                          report.employees?.profiles.email ||
                          "Unknown"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 text-xs text-[#A7AFBC]">
                        <Calendar className="size-3 text-[#6B7280]" />
                        {report.report_date}
                      </span>
                    </td>
                    <td className="max-w-xs px-5 py-4 text-xs text-[#A7AFBC] line-clamp-2">
                      {report.summary}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={report.status as Parameters<typeof StatusBadge>[0]["status"]} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      {report.status !== "reviewed" ? (
                        <AdminStatusAction
                          endpoint={`/api/admin/daily-reports/${report.id}`}
                          status="reviewed"
                          label="Mark reviewed"
                        />
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-[#39FF14]">
                          <CheckCircle2 className="size-3" /> Reviewed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
