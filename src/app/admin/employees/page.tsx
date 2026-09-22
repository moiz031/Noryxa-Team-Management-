import { requireAdmin } from "@/lib/auth/roles";
import { getEmployees } from "@/lib/db/employees";
import { getDepartments } from "@/lib/db/departments";
import Link from "next/link";
import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Users, Plus, ArrowRight, Mail, Building2 } from "lucide-react";

const employmentStatusStyles: Record<string, string> = {
  active: "bg-[#39FF14]/15 text-[#39FF14] border border-[#39FF14]/30",
  pending: "bg-[#F5B942]/15 text-[#F5B942] border border-[#F5B942]/30",
  suspended: "bg-[#FF4D67]/15 text-[#FF4D67] border border-[#FF4D67]/30",
  inactive: "bg-white/5 text-[#6B7280] border border-white/10",
};

async function EmployeeTable({
  departments,
}: {
  departments: Awaited<ReturnType<typeof getDepartments>>["departments"];
}) {
  const { employees } = await getEmployees({ pageSize: 50 });

  if (employees.length === 0) {
    return (
      <EmptyState
        icon={<Users className="size-6" />}
        title="No employees found"
        description="No employees have been registered yet. Invite your first team member."
        action={
          <Link href="/admin/employees/new">
            <Button variant="primary" size="sm">
              <Plus className="size-3.5" />
              Invite Employee
            </Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0E1117]/80">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.08]">
            <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-widest text-[#6B7280]">Employee</th>
            <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-widest text-[#6B7280]">Role</th>
            <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-widest text-[#6B7280]">Department</th>
            <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-widest text-[#6B7280]">Status</th>
            <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-widest text-[#6B7280]">Joined</th>
            <th className="px-5 py-4 text-right text-[11px] font-semibold uppercase tracking-widest text-[#6B7280]">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05]">
          {employees.map((emp) => (
            <tr
              key={emp.id}
              className="group transition-colors duration-150 hover:bg-white/[0.025]"
            >
              <td className="px-5 py-4">
                <Link
                  href={`/admin/employees/${emp.id}`}
                  className="font-medium text-[#F5F7FA] transition-colors group-hover:text-[#39FF14]"
                >
                  {emp.profiles.full_name || emp.profiles.email}
                </Link>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-[#6B7280]">
                  <Mail className="size-3" />
                  {emp.profiles.email}
                </p>
              </td>
              <td className="px-5 py-4">
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold text-[#A7AFBC]">
                  {emp.profiles.roles?.code === "admin" ? "Admin" : "Employee"}
                </span>
              </td>
              <td className="px-5 py-4">
                <span className="inline-flex items-center gap-1.5 text-xs text-[#A7AFBC]">
                  <Building2 className="size-3 text-[#6B7280]" />
                  {emp.departments?.name || "—"}
                </span>
              </td>
              <td className="px-5 py-4">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                    employmentStatusStyles[emp.employment_status ?? "inactive"] ??
                    employmentStatusStyles.inactive
                  }`}
                >
                  {emp.employment_status ?? "—"}
                </span>
              </td>
              <td className="px-5 py-4 text-xs text-[#A7AFBC]">
                {emp.joined_on
                  ? new Date(emp.joined_on).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : "—"}
              </td>
              <td className="px-5 py-4 text-right">
                <Link
                  href={`/admin/employees/${emp.id}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#24C5E3] transition-colors hover:text-[#39FF14]"
                >
                  View <ArrowRight className="size-3" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function EmployeesPage() {
  const context = await requireAdmin();
  const { departments } = await getDepartments();

  return (
    <AppShell role="admin" userEmail={context.user.email ?? ""}>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#24C5E3]">
              <Users className="size-3.5" />
              <span>Team Roster</span>
            </div>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#F5F7FA]">
              Employee Management
            </h1>
            <p className="mt-1 text-xs text-[#A7AFBC]">
              Manage agency team members, roles, departments, and employment status.
            </p>
          </div>
          <Link href="/admin/employees/new">
            <Button variant="primary" size="sm">
              <Plus className="size-3.5" />
              Invite Employee
            </Button>
          </Link>
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap gap-3 rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 p-4">
          <select
            className="rounded-xl border border-white/[0.1] bg-[#11151C] px-3 py-2 text-xs text-[#F5F7FA] focus:border-[#39FF14]/40 focus:outline-none"
            defaultValue="all"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            className="rounded-xl border border-white/[0.1] bg-[#11151C] px-3 py-2 text-xs text-[#F5F7FA] focus:border-[#39FF14]/40 focus:outline-none"
            defaultValue=""
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
          <input
            type="search"
            placeholder="Search employees…"
            className="flex-1 min-w-[200px] rounded-xl border border-white/[0.1] bg-[#11151C] px-3.5 py-2 text-xs text-[#F5F7FA] placeholder-[#6B7280] focus:border-[#39FF14]/40 focus:outline-none"
          />
        </div>

        {/* Table */}
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-16 text-[#6B7280] text-sm">
              <span className="animate-pulse">Loading employees…</span>
            </div>
          }
        >
          <EmployeeTable departments={departments} />
        </Suspense>
      </div>
    </AppShell>
  );
}