import Link from "next/link";
import { requireAdmin } from "@/lib/auth/roles";
import { listBatch2 } from "@/lib/db/batch2";
import { AppShell } from "@/components/layout/app-shell";
import { ArrowLeft, Users, Shield } from "lucide-react";

export default async function ProjectMembersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requireAdmin();
  const { id } = await params;
  const members = await listBatch2<{ employee_id: string; role: string }>("project_members", { project_id: id });

  return (
    <AppShell
      role="admin"
      userEmail={context.user.email ?? ""}
    >
      <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        <Link
          href="/admin/projects"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A7AFBC] hover:text-white transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Projects</span>
        </Link>

        <div className="border-b border-white/[0.08] pb-6">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#24C5E3]">
            <Users className="size-3.5" />
            <span>Project Allocations</span>
          </div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#F5F7FA]">
            Project Members
          </h1>
          <p className="mt-1 text-xs text-[#A7AFBC]">
            Manage owner, manager, member, and viewer access scopes for this initiative.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0E1117]/85 backdrop-blur-sm">
          {members.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#6B7280]">
              No members assigned to this project yet.
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {members.map((m) => (
                <div
                  key={m.employee_id}
                  className="flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid size-9 place-items-center rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-[#F5F7FA]">
                      <Users className="size-4 text-[#24C5E3]" />
                    </div>
                    <div>
                      <p className="font-mono text-xs text-[#F5F7FA]">
                        {m.employee_id}
                      </p>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-semibold capitalize text-[#39FF14]">
                    <Shield className="size-3" />
                    {m.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
