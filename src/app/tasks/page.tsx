import { requireEmployee } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CheckSquare, FolderKanban, Calendar, Sparkles } from "lucide-react";

export default async function TasksPage() {
  const context = await requireEmployee();
  const eid = context.profile.employees?.[0]?.id;
  const db = await createSupabaseServerClient();

  const { data } = await db
    .from("tasks")
    .select("id,title,status,priority,due_at,projects(name)")
    .eq("assigned_to", eid ?? "")
    .order("due_at", { ascending: true });

  const tasks = data ?? [];
  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const pendingCount = tasks.length - completedCount;

  return (
    <AppShell
      role="employee"
      userEmail={context.user.email ?? ""}
    >
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#39FF14]">
              <CheckSquare className="size-3.5" />
              <span>Personal Queue</span>
            </div>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#F5F7FA]">
              My Tasks
            </h1>
            <p className="mt-1 text-xs text-[#A7AFBC]">
              Review deliverables assigned directly to your agency workflow.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-white/[0.08] bg-[#0E1117] px-3.5 py-1.5 text-xs">
              <span className="text-[#6B7280]">Total: </span>
              <span className="font-bold text-[#F5F7FA]">{tasks.length}</span>
            </div>
            <div className="rounded-xl border border-[#39FF14]/20 bg-[#39FF14]/5 px-3.5 py-1.5 text-xs text-[#39FF14]">
              <span>{pendingCount} active</span>
            </div>
          </div>
        </div>

        {/* Task Cards List */}
        {tasks.length === 0 ? (
          <EmptyState
            icon={<CheckSquare className="size-6" />}
            title="No tasks assigned"
            description="You do not have any tasks in your queue right now. Great job keeping your desk clean!"
          />
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => {
              const projectName =
                task.projects && typeof task.projects === "object" && "name" in task.projects
                  ? (task.projects as { name: string }).name
                  : null;

              return (
                <article
                  key={task.id}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 p-5 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-[#11151C]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <div className="size-2 rounded-full bg-[#39FF14]/80 shadow-[0_0_6px_rgba(57,255,20,0.6)]" />
                      <h2 className="text-base font-semibold text-[#F5F7FA] group-hover:text-[#39FF14] transition-colors truncate">
                        {task.title}
                      </h2>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#A7AFBC]">
                      {projectName && (
                        <span className="flex items-center gap-1 text-[#24C5E3]">
                          <FolderKanban className="size-3.5" />
                          <span>{projectName}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3.5 text-[#6B7280]" />
                        <span>
                          {task.due_at
                            ? `Due ${new Date(task.due_at).toLocaleDateString()}`
                            : "No deadline specified"}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <StatusBadge status={task.priority} />
                    <StatusBadge status={task.status} />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
