import Link from "next/link";
import { requireAdmin } from "@/lib/auth/roles";
import { listBatch2 } from "@/lib/db/batch2";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Users, ArrowRight, FileText } from "lucide-react";

export default async function TeamsPage() {
  const context = await requireAdmin();
  const teams = await listBatch2("teams") as {
    id: string;
    name: string;
    status: string;
    description: string | null;
  }[];

  const statusStyles: Record<string, string> = {
    active: "bg-[#39FF14]/15 text-[#39FF14] border border-[#39FF14]/30",
    inactive: "bg-white/5 text-[#6B7280] border border-white/10",
    archived: "bg-white/5 text-[#6B7280] border border-white/10",
  };

  return (
    <AppShell role="admin" userEmail={context.user.email ?? ""}>
      <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#24C5E3]">
              <Users className="size-3.5" />
              <span>Team Units</span>
            </div>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#F5F7FA]">
              Teams
            </h1>
            <p className="mt-1 text-xs text-[#A7AFBC]">
              Manage organizational team units and their member rosters.
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-[#0E1117] px-4 py-2 text-xs">
            <span className="text-[#6B7280]">Total Teams: </span>
            <span className="font-bold text-[#F5F7FA]">{teams.length}</span>
          </div>
        </div>

        {/* Team Cards / Empty State */}
        {teams.length === 0 ? (
          <EmptyState
            icon={<Users className="size-6" />}
            title="No teams configured"
            description="No team units have been set up yet."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => (
              <Link
                key={team.id}
                href={`/admin/teams/${team.id}`}
                className="group flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#24C5E3]/30 to-[#8B5CF6]/20 text-[#24C5E3]">
                    <Users className="size-5" />
                  </div>
                  <span
                    className={`mt-0.5 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                      statusStyles[team.status] ?? statusStyles.inactive
                    }`}
                  >
                    {team.status}
                  </span>
                </div>

                <div>
                  <h2 className="font-semibold text-[#F5F7FA] transition-colors group-hover:text-[#39FF14]">
                    {team.name}
                  </h2>
                  {team.description && (
                    <p className="mt-1 flex items-start gap-1.5 text-xs text-[#6B7280] line-clamp-2">
                      <FileText className="size-3 mt-0.5 shrink-0" />
                      {team.description}
                    </p>
                  )}
                </div>

                <div className="mt-auto flex items-center gap-1 text-xs font-medium text-[#24C5E3] transition-colors group-hover:text-[#39FF14]">
                  View team <ArrowRight className="size-3" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
