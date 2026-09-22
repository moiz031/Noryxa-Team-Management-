import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/roles";
import { getEmployeeById } from "@/lib/db/employees";
import { getDepartments } from "@/lib/db/departments";
import { AppShell } from "@/components/layout/app-shell";
import { AdminStatusAction } from "@/components/admin-status-action";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Users,
  Mail,
  Building2,
  Briefcase,
  Calendar,
  Clock,
  Hash,
  Shield,
  CheckCircle2,
  XCircle,
  PauseCircle,
} from "lucide-react";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const [employee, { departments }] = await Promise.all([
    getEmployeeById(id),
    getDepartments({ activeOnly: false, pageSize: 100 }),
  ]);

  if (!employee) redirect("/admin/employees");

  const fullName = employee.profiles.full_name || employee.profiles.email || "Unknown";
  const isAdmin = employee.profiles.roles?.code === "admin";

  const statusConfig = {
    active: {
      label: "Active",
      icon: CheckCircle2,
      color: "text-[#39FF14]",
      bg: "bg-[#39FF14]/10 border-[#39FF14]/30",
    },
    pending: {
      label: "Pending",
      icon: Clock,
      color: "text-[#F5B942]",
      bg: "bg-[#F5B942]/10 border-[#F5B942]/30",
    },
    suspended: {
      label: "Suspended",
      icon: PauseCircle,
      color: "text-[#FF4D67]",
      bg: "bg-[#FF4D67]/10 border-[#FF4D67]/30",
    },
    inactive: {
      label: "Inactive",
      icon: XCircle,
      color: "text-[#6B7280]",
      bg: "bg-white/5 border-white/10",
    },
  };

  const status = employee.employment_status ?? "inactive";
  const sc = statusConfig[status] ?? statusConfig.inactive;
  const StatusIcon = sc.icon;

  const activateEndpoint = `/api/admin/employees/${id}/activate`;

  return (
    <AppShell role="admin" userEmail={""}>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        {/* Back */}
        <Link
          href="/admin/employees"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A7AFBC] hover:text-white transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to Employees
        </Link>

        {/* Profile Hero Card */}
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.1] bg-gradient-to-r from-[#0E1117] via-[#11151C] to-[#0A0D12] p-6 sm:p-8 backdrop-blur-xl">
          <div className="absolute top-0 right-0 size-64 rounded-full bg-[#8B5CF6]/10 blur-[100px] pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-start gap-6">
            {/* Avatar Placeholder */}
            <div className="shrink-0 grid size-20 place-items-center rounded-2xl bg-gradient-to-br from-[#39FF14]/20 to-[#24C5E3]/20 border border-white/10 text-3xl font-black text-[#F5F7FA]">
              {fullName.charAt(0).toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F5F7FA]">
                    {fullName}
                  </h1>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1 text-xs text-[#A7AFBC]">
                      <Mail className="size-3" />
                      {employee.profiles.email}
                    </span>
                    {employee.job_title && (
                      <>
                        <span className="text-[#6B7280]">·</span>
                        <span className="flex items-center gap-1 text-xs text-[#A7AFBC]">
                          <Briefcase className="size-3" />
                          {employee.job_title}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status Badge */}
                <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${sc.bg} ${sc.color}`}>
                  <StatusIcon className="size-3.5" />
                  {sc.label}
                </div>
              </div>

              {/* Role & Department Pills */}
              <div className="mt-4 flex flex-wrap gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold ${isAdmin ? "text-[#24C5E3]" : "text-[#A7AFBC]"}`}>
                  <Shield className="size-3" />
                  {isAdmin ? "Administrator" : "Employee"}
                </span>
                {employee.departments && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-[#A7AFBC]">
                    <Building2 className="size-3" />
                    {employee.departments.name}
                  </span>
                )}
                {employee.employee_code && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-mono text-[#6B7280]">
                    <Hash className="size-3" />
                    {employee.employee_code}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Two-column detail + actions */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Details panel (2 cols) */}
          <div className="lg:col-span-2 rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 backdrop-blur-sm divide-y divide-white/[0.06]">
            <div className="px-6 py-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#6B7280]">
                Employment Details
              </h2>
            </div>
            <dl className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
              {[
                {
                  label: "Department",
                  value: employee.departments?.name ?? "—",
                  icon: Building2,
                },
                {
                  label: "Job Title",
                  value: employee.job_title ?? "—",
                  icon: Briefcase,
                },
                {
                  label: "Employment Status",
                  value: (
                    <span className={`font-semibold capitalize ${sc.color}`}>
                      {status}
                    </span>
                  ),
                  icon: StatusIcon,
                },
                {
                  label: "Joined",
                  value: employee.joined_on
                    ? new Date(employee.joined_on).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "—",
                  icon: Calendar,
                },
                {
                  label: "Account Active",
                  value: employee.profiles.is_active ? "Yes" : "No",
                  icon: CheckCircle2,
                },
                {
                  label: "Timezone",
                  value: employee.profiles.timezone ?? "UTC",
                  icon: Clock,
                },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="px-6 py-4 space-y-1">
                  <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#6B7280]">
                    <Icon className="size-3" />
                    {label}
                  </dt>
                  <dd className="text-sm font-medium text-[#F5F7FA]">{value}</dd>
                </div>
              ))}
            </dl>

            {/* Metadata */}
            <div className="px-6 py-4 text-[11px] text-[#6B7280] flex flex-wrap gap-4">
              <span>
                Created:{" "}
                {new Date(employee.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
              {employee.approved_at && (
                <span>
                  Approved:{" "}
                  {new Date(employee.approved_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              )}
            </div>
          </div>

          {/* Actions panel (1 col) */}
          <div className="space-y-4">
            {/* Status Management */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 backdrop-blur-sm p-5 space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#6B7280]">
                Status Management
              </h2>

              <div className="space-y-2.5">
                {status !== "active" && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-[#A7AFBC]">Activate employment</span>
                    <AdminStatusAction
                      endpoint={activateEndpoint}
                      status="active"
                      label="Activate Employee"
                    />
                  </div>
                )}
                {status === "active" && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-[#A7AFBC]">Suspend access</span>
                    <AdminStatusAction
                      endpoint={activateEndpoint}
                      status="suspended"
                      label="Suspend Employee"
                    />
                  </div>
                )}
                {status === "suspended" && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-[#A7AFBC]">Reactivate account</span>
                    <AdminStatusAction
                      endpoint={activateEndpoint}
                      status="active"
                      label="Reactivate"
                    />
                  </div>
                )}
                {status !== "inactive" && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-[#A7AFBC]">Deactivate employment</span>
                    <AdminStatusAction
                      endpoint={activateEndpoint}
                      status="inactive"
                      label="Reject / Deactivate"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Quick Links */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 backdrop-blur-sm p-5 space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#6B7280]">
                Quick Actions
              </h2>
              <Link href="/admin/employees">
                <Button variant="secondary" size="sm" className="w-full justify-start">
                  <Users className="size-3.5" />
                  Back to Roster
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
