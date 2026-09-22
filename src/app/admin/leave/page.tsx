import { requireAdmin } from "@/lib/auth/roles";
import { getLeaveRequests } from "@/lib/db/leave-requests";
import { AdminStatusAction } from "@/components/admin-status-action";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/badge";
import { Calendar, User, CalendarDays, CheckCircle2, XCircle } from "lucide-react";

export default async function AdminLeavePage() {
  const context = await requireAdmin();
  const { leaveRequests } = await getLeaveRequests({ status: "all", pageSize: 100 });

  const pendingCount = leaveRequests.filter((r) => r.status === "pending").length;
  const approvedCount = leaveRequests.filter((r) => r.status === "approved").length;

  return (
    <AppShell role="admin" userEmail={context.user.email ?? ""}>
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="border-b border-white/[0.08] pb-6">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#F5B942]">
            <Calendar className="size-3.5" />
            <span>Leave Management</span>
          </div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#F5F7FA]">
            Leave Requests
          </h1>
          <p className="mt-1 text-xs text-[#A7AFBC]">
            Review and action employee leave requests.
          </p>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">Total Requests</p>
            <p className="mt-2 text-3xl font-extrabold text-[#F5F7FA]">{leaveRequests.length}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">Pending</p>
            <p className="mt-2 text-3xl font-extrabold text-[#F5B942]">{pendingCount}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">Approved</p>
            <p className="mt-2 text-3xl font-extrabold text-[#39FF14]">{approvedCount}</p>
          </div>
        </div>

        {/* Request Cards / Empty State */}
        {leaveRequests.length === 0 ? (
          <EmptyState
            icon={<Calendar className="size-6" />}
            title="No leave requests"
            description="No leave requests have been submitted yet."
          />
        ) : (
          <div className="space-y-3">
            {leaveRequests.map((request) => (
              <article
                key={request.id}
                className="rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 p-5 transition-all duration-150 hover:border-white/20"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="flex items-center gap-1.5 font-semibold text-[#F5F7FA]">
                      <User className="size-3.5 text-[#6B7280]" />
                      {request.employees?.profiles.full_name ||
                        request.employees?.profiles.email ||
                        "Unknown employee"}
                    </h2>
                    <p className="flex items-center gap-1.5 text-xs text-[#A7AFBC]">
                      <CalendarDays className="size-3 text-[#24C5E3]" />
                      <span className="font-medium capitalize">{request.leave_type}</span>
                      <span className="text-[#6B7280]">·</span>
                      {request.starts_on} → {request.ends_on}
                    </p>
                    {request.reason && (
                      <p className="mt-2 text-xs text-[#6B7280] italic">&ldquo;{request.reason}&rdquo;</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusBadge status={request.status as Parameters<typeof StatusBadge>[0]["status"]} />
                    {request.status === "pending" && (
                      <>
                        <AdminStatusAction
                          endpoint={`/api/admin/leave-requests/${request.id}`}
                          status="approved"
                          label="Approve"
                        />
                        <AdminStatusAction
                          endpoint={`/api/admin/leave-requests/${request.id}`}
                          status="rejected"
                          label="Reject"
                        />
                      </>
                    )}
                    {request.status === "approved" && (
                      <span className="inline-flex items-center gap-1 text-xs text-[#39FF14]">
                        <CheckCircle2 className="size-3" /> Approved
                      </span>
                    )}
                    {request.status === "rejected" && (
                      <span className="inline-flex items-center gap-1 text-xs text-[#FF4D67]">
                        <XCircle className="size-3" /> Rejected
                      </span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
