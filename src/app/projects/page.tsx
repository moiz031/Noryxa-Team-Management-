import { requireEmployee } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FolderKanban, Building2, Calendar } from "lucide-react";

export default async function ProjectsPage() {
  const context = await requireEmployee();
  const db = await createSupabaseServerClient();
  const { data } = await db
    .from("projects")
    .select("id,name,status,client_name,due_on")
    .order("created_at", { ascending: false });

  const projects = data ?? [];

  return (
    <AppShell
      role="employee"
      userEmail={context.user.email ?? ""}
    >
      <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#24C5E3]">
              <FolderKanban className="size-3.5" />
              <span>Agency Deliverables</span>
            </div>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#F5F7FA]">
              Active Projects
            </h1>
            <p className="mt-1 text-xs text-[#A7AFBC]">
              Overview of all active agency and client initiatives.
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-[#0E1117] px-4 py-2 text-xs">
            <span className="text-[#6B7280]">Total Projects: </span>
            <span className="font-bold text-[#F5F7FA]">{projects.length}</span>
          </div>
        </div>

        {/* Project Grid */}
        {projects.length === 0 ? (
          <EmptyState
            icon={<FolderKanban className="size-6" />}
            title="No projects available"
            description="There are currently no active projects recorded in this workspace."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <article
                key={project.id}
                className="group flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 p-5 backdrop-blur-sm transition-all duration-200 hover:-translate-y-1 hover:border-white/20 hover:bg-[#11151C] hover:shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="grid size-9 place-items-center rounded-xl bg-[#24C5E3]/10 border border-[#24C5E3]/20 text-[#24C5E3]">
                      <FolderKanban className="size-4" />
                    </div>
                    <StatusBadge status={project.status} />
                  </div>

                  <h2 className="text-base font-bold text-[#F5F7FA] group-hover:text-[#39FF14] transition-colors line-clamp-1">
                    {project.name}
                  </h2>

                  <div className="mt-3 flex items-center gap-1.5 text-xs text-[#A7AFBC]">
                    <Building2 className="size-3.5 text-[#6B7280]" />
                    <span className="truncate">
                      {project.client_name ? `Client: ${project.client_name}` : "Internal Initiative"}
                    </span>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-[#6B7280]">
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3 text-[#6B7280]" />
                    <span>{project.due_on ? `Target: ${project.due_on}` : "No deadline"}</span>
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
