import { requireEmployee } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { QuickForm } from "@/components/quick-form";
import { AppShell } from "@/components/layout/app-shell";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Calendar, Clock, CheckCircle2, AlertCircle } from "lucide-react";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function LeavePage() {
  const context = await requireEmployee();
  const employeeId = context.profile.employees?.[0]?.id;
  const db = await createSupabaseServerClient();

  const { data: requests } = await db
    .from("leave_requests")
    .select("*")
    .eq("employee_id", employeeId ?? "")
    .order("created_at", { ascending: false });

  const list = requests ?? [];
  const pending = list.filter((r) => r.status === "pending").length;
  const approved = list.filter((r) => r.status === "approved").length;

  return (
    <AppShell
      role="employee"
      userEmail={context.user.email ?? ""}
    >
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b border-white/[0.08] pb-6">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#F5B942]">
            <Calendar className="size-3.5" />
            <span>Time Off Management</span>
          </div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#F5F7FA]">
            Leave & Absences
          </h1>
          <p className="mt-1 text-xs text-[#A7AFBC]">
            Request planned time off and track status updates from agency leadership.
          </p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Total Requests"
            value={list.length}
            subtitle="All recorded leaves"
            icon={<Calendar className="size-5" />}
            accent="purple"
          />
          <StatCard
            title="Pending Review"
            value={pending}
            subtitle="Awaiting admin approval"
            icon={<Clock className="size-5" />}
            accent="amber"
          />
          <StatCard
            title="Approved Leaves"
            value={approved}
            subtitle="Scheduled absence"
            icon={<CheckCircle2 className="size-5" />}
            accent="green"
          />
        </div>

        {/* Leave Request Form */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#A7AFBC]">
            Submit Time Off Request
          </h2>
          <QuickForm
            endpoint="/api/employee/leave-requests"
            fields={[
              { name: "leaveType", label: "Leave Type (annual / sick / personal / unpaid)" },
              { name: "startsOn", label: "Start Date", type: "date" },
              { name: "endsOn", label: "End Date", type: "date" },
              { name: "reason", label: "Reason or Notes (Optional)", multiline: true },
            ]}
            submitLabel="Submit Leave Request"
          />
        </div>

        {/* Request History */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#A7AFBC]">
            Request History ({list.length})
          </h2>

          {list.length === 0 ? (
            <EmptyState
              icon={<Calendar className="size-6" />}
              title="No leave requests found"
              description="When you apply for time off, your submissions will appear here."
            />
          ) : (
            <div className="space-y-3">
              {list.map((row) => (
                <article
                  key={row.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 p-5 backdrop-blur-sm transition-all hover:border-white/20"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-[#F5F7FA] capitalize">
                        {row.leave_type ?? "Leave"}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-[#A7AFBC] flex items-center gap-1.5">
                      <Calendar className="size-3 text-[#24C5E3]" />
                      <span>
                        {formatDate(row.starts_on)} – {formatDate(row.ends_on)}
                      </span>
                    </p>
                    {row.reason && (
                      <p className="mt-2 text-xs text-[#6B7280] italic">
                        &ldquo;{row.reason}&rdquo;
                      </p>
                    )}
                  </div>

                  <div className="self-start sm:self-center">
                    <StatusBadge status={row.status} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
