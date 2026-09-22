import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/roles";
import { listBatch2 } from "@/lib/db/batch2";
import { getEmployees } from "@/lib/db/employees";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowLeft, Users, FileText, User, Hash } from "lucide-react";

type Team = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
};

type TeamMember = {
  id: string;
  employee_id: string;
  team_id: string;
  role: string | null;
};

const statusStyles: Record<string, string> = {
  active: "bg-[#39FF14]/15 text-[#39FF14] border border-[#39FF14]/30",
  inactive: "bg-white/5 text-[#6B7280] border border-white/10",
  archived: "bg-white/5 text-[#6B7280] border border-white/10",
};

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const [teams, members] = await Promise.all([
    listBatch2<Team>("teams", { id }),
    listBatch2<TeamMember>("team_members", { team_id: id }),
  ]);

  const team = teams[0];
  if (!team) redirect("/admin/teams");

  // Fetch employee details for each member
  const { employees } = await getEmployees({ pageSize: 100 });
  const employeeMap = new Map(employees.map((e) => [e.id, e]));

  const memberEmployees = members
    .map((m) => ({ member: m, employee: employeeMap.get(m.employee_id) }))
    .filter((x) => !!x.employee);

  return (
    <AppShell role="admin" userEmail={""}>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        {/* Back */}
        <Link
          href="/admin/teams"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A7AFBC] hover:text-white transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to Teams
        </Link>

        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.1] bg-gradient-to-r from-[#0E1117] via-[#11151C] to-[#0A0D12] p-6 sm:p-8 backdrop-blur-xl">
          <div className="absolute top-0 right-0 size-64 rounded-full bg-[#24C5E3]/8 blur-[100px] pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-[#24C5E3]/30 to-[#8B5CF6]/20 border border-white/10 text-[#24C5E3]">
                <Users className="size-7" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#24C5E3]">
                  <Users className="size-3.5" />
                  <span>Team Unit</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F5F7FA]">
                  {team.name}
                </h1>
                {team.description && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-[#A7AFBC]">
                    <FileText className="size-3 shrink-0" />
                    {team.description}
                  </p>
                )}
              </div>
            </div>

            <span
              className={`self-start sm:self-center inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold capitalize ${
                statusStyles[team.status] ?? statusStyles.inactive
              }`}
            >
              {team.status}
            </span>
          </div>
        </div>

        {/* Members Section */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 backdrop-blur-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-[#24C5E3]" />
              <h2 className="text-sm font-semibold text-[#F5F7FA]">Team Members</h2>
            </div>
            <span className="rounded-full bg-white/5 border border-white/10 px-2.5 py-0.5 text-xs font-semibold text-[#A7AFBC]">
              {memberEmployees.length} member{memberEmployees.length !== 1 ? "s" : ""}
            </span>
          </div>

          {memberEmployees.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Users className="size-6" />}
                title="No members yet"
                description="No employees have been assigned to this team."
              />
            </div>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {memberEmployees.map(({ member, employee }) => {
                const emp = employee!;
                const fullName = emp.profiles.full_name || emp.profiles.email || "Unknown";
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-[#39FF14]/10 to-[#24C5E3]/10 border border-white/10 text-xs font-bold text-[#F5F7FA]">
                        {fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#F5F7FA] group-hover:text-[#39FF14] transition-colors">
                          {fullName}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {emp.profiles.email && (
                            <span className="text-xs text-[#6B7280]">{emp.profiles.email}</span>
                          )}
                          {emp.job_title && (
                            <>
                              <span className="text-[#6B7280]">·</span>
                              <span className="text-xs text-[#A7AFBC]">{emp.job_title}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {member.role && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold capitalize text-[#24C5E3]">
                          <User className="size-3" />
                          {member.role}
                        </span>
                      )}
                      {emp.employee_code && (
                        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-[#6B7280]">
                          <Hash className="size-3" />
                          {emp.employee_code}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Meta */}
        <p className="text-[11px] text-[#6B7280] px-1">
          Team created:{" "}
          {new Date(team.created_at).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>
    </AppShell>
  );
}
