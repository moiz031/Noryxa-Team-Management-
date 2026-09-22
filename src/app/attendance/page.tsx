import { requireEmployee } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { QuickForm } from "@/components/quick-form";
import { AppShell } from "@/components/layout/app-shell";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { UserCheck, Calendar, Clock } from "lucide-react";

export default async function AttendancePage() {
  const context = await requireEmployee();
  const id = context.profile.employees?.[0]?.id;
  const db = await createSupabaseServerClient();

  const { data } = await db
    .from("attendance")
    .select("*")
    .eq("employee_id", id ?? "")
    .order("attendance_date", { ascending: false })
    .limit(30);

  const records = data ?? [];

  return (
    <AppShell
      role="employee"
      userEmail={context.user.email ?? ""}
    >
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b border-white/[0.08] pb-6">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#39FF14]">
            <UserCheck className="size-3.5" />
            <span>Time & Presence</span>
          </div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#F5F7FA]">
            Attendance Telemetry
          </h1>
          <p className="mt-1 text-xs text-[#A7AFBC]">
            Log daily check-ins and inspect your 30-day attendance timeline.
          </p>
        </div>

        {/* Clock In Form */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#A7AFBC]">
            Clock In / Record Presence
          </h2>
          <QuickForm
            endpoint="/api/employee/attendance"
            fields={[
              { name: "attendanceDate", label: "Date", type: "date" },
              { name: "checkInAt", label: "Check-in Time (Optional)", type: "datetime-local" },
            ]}
            submitLabel="Record Attendance"
          />
        </div>

        {/* Attendance Log Table */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#A7AFBC]">
            Recent Presence Records (Last 30 Days)
          </h2>

          {records.length === 0 ? (
            <EmptyState
              icon={<UserCheck className="size-6" />}
              title="No attendance records found"
              description="Record your first check-in above to begin tracking attendance telemetry."
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0E1117]/80">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/[0.08] bg-white/[0.02] text-[#6B7280] uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Check In Time</th>
                    <th className="px-5 py-3.5">Check Out Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {records.map((record) => (
                    <tr key={record.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-4 font-semibold text-[#F5F7FA]">
                        <div className="flex items-center gap-2">
                          <Calendar className="size-3.5 text-[#24C5E3]" />
                          <span>{record.attendance_date}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={record.status} />
                      </td>
                      <td className="px-5 py-4 text-[#A7AFBC]">
                        {record.check_in_at ? (
                          <span className="flex items-center gap-1.5 font-mono text-xs">
                            <Clock className="size-3 text-[#39FF14]" />
                            {new Date(record.check_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-5 py-4 text-[#A7AFBC]">
                        {record.check_out_at ? (
                          <span className="flex items-center gap-1.5 font-mono text-xs">
                            <Clock className="size-3 text-[#6B7280]" />
                            {new Date(record.check_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
