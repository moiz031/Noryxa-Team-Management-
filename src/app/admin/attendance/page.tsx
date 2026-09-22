import { requireAdmin } from "@/lib/auth/roles";
import { getAttendance } from "@/lib/db/attendance";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/badge";
import { UserCheck, Calendar, Clock } from "lucide-react";

export default async function AdminAttendancePage() {
  const context = await requireAdmin();
  const { attendance } = await getAttendance({ status: "all", pageSize: 100 });

  return (
    <AppShell role="admin" userEmail={context.user.email ?? ""}>
      <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="border-b border-white/[0.08] pb-6">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#24C5E3]">
            <UserCheck className="size-3.5" />
            <span>Attendance Records</span>
          </div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#F5F7FA]">
            Attendance Management
          </h1>
          <p className="mt-1 text-xs text-[#A7AFBC]">
            Review attendance records and check-in/out times across the organization.
          </p>
        </div>

        {/* Table / Empty State */}
        {attendance.length === 0 ? (
          <EmptyState
            icon={<UserCheck className="size-6" />}
            title="No attendance records"
            description="No attendance records have been logged yet."
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0E1117]/80">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-widest text-[#6B7280]">Employee</th>
                  <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-widest text-[#6B7280]">Date</th>
                  <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-widest text-[#6B7280]">Status</th>
                  <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-widest text-[#6B7280]">Check In</th>
                  <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-widest text-[#6B7280]">Check Out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {attendance.map((record) => (
                  <tr
                    key={record.id}
                    className="group transition-colors duration-150 hover:bg-white/[0.025]"
                  >
                    <td className="px-5 py-4 font-medium text-[#F5F7FA]">
                      {record.employees?.profiles.full_name ||
                        record.employees?.profiles.email ||
                        "Unknown"}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 text-xs text-[#A7AFBC]">
                        <Calendar className="size-3 text-[#6B7280]" />
                        {record.attendance_date}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={record.status as Parameters<typeof StatusBadge>[0]["status"]} />
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 text-xs text-[#A7AFBC]">
                        <Clock className="size-3 text-[#39FF14]" />
                        {record.check_in_at
                          ? new Date(record.check_in_at).toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 text-xs text-[#A7AFBC]">
                        <Clock className="size-3 text-[#FF4D67]" />
                        {record.check_out_at
                          ? new Date(record.check_out_at).toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </span>
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
