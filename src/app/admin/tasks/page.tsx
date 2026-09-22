import { requireAdmin } from "@/lib/auth/roles";
import { getTasks, getProjects } from "@/lib/db";
import Link from "next/link";
import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { CheckSquare, Plus, FolderKanban, User, ArrowRight } from "lucide-react";

const priorityStyles: Record<string, string> = {
  urgent: "bg-[#FF4D67]/15 text-[#FF4D67] border border-[#FF4D67]/30",
  high: "bg-[#F5B942]/15 text-[#F5B942] border border-[#F5B942]/30",
  medium: "bg-[#24C5E3]/15 text-[#24C5E3] border border-[#24C5E3]/30",
  low: "bg-white/5 text-[#A7AFBC] border border-white/10",
};

async function TasksTable() {
  const tasks = await getTasks({ pageSize: 50 });
  const projects = await getProjects({ pageSize: 100 });
  const projectMap = new Map(projects.projects?.map((p) => [p.id, p.name]) || []);

  if (tasks.tasks.length === 0) {
    return (
      <EmptyState
        icon={<CheckSquare className="size-6" />}
        title="No tasks found"
        description="No tasks have been created yet. Create your first task to get started."
        action={
          <Link href="/admin/tasks/new">
            <Button variant="primary" size="sm">
              <Plus className="size-3.5" />
              Create First Task
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
            <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-widest text-[#6B7280]">Task</th>
            <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-widest text-[#6B7280]">Project</th>
            <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-widest text-[#6B7280]">Status</th>
            <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-widest text-[#6B7280]">Priority</th>
            <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-widest text-[#6B7280]">Assigned To</th>
            <th className="px-5 py-4 text-right text-[11px] font-semibold uppercase tracking-widest text-[#6B7280]">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05]">
          {tasks.tasks.map((task) => (
            <tr
              key={task.id}
              className="group transition-colors duration-150 hover:bg-white/[0.025]"
            >
              <td className="px-5 py-4">
                <Link
                  href={`/admin/tasks/${task.id}`}
                  className="font-medium text-[#F5F7FA] transition-colors group-hover:text-[#39FF14]"
                >
                  {task.title}
                </Link>
              </td>
              <td className="px-5 py-4">
                {task.project_id ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-[#A7AFBC]">
                    <FolderKanban className="size-3 text-[#24C5E3]" />
                    {projectMap.get(task.project_id) || "—"}
                  </span>
                ) : (
                  <span className="text-[#6B7280]">—</span>
                )}
              </td>
              <td className="px-5 py-4">
                <StatusBadge status={task.status as Parameters<typeof StatusBadge>[0]["status"]} />
              </td>
              <td className="px-5 py-4">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                    priorityStyles[task.priority ?? "low"] ?? priorityStyles.low
                  }`}
                >
                  {task.priority ?? "—"}
                </span>
              </td>
              <td className="px-5 py-4">
                <span className="inline-flex items-center gap-1.5 text-xs text-[#A7AFBC]">
                  <User className="size-3 text-[#6B7280]" />
                  {task.employees?.profiles?.full_name || "—"}
                </span>
              </td>
              <td className="px-5 py-4 text-right">
                <Link
                  href={`/admin/tasks/${task.id}`}
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

export default async function TasksPage() {
  const context = await requireAdmin();

  return (
    <AppShell role="admin" userEmail={context.user.email ?? ""}>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#39FF14]">
              <CheckSquare className="size-3.5" />
              <span>Task Management</span>
            </div>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#F5F7FA]">
              All Tasks
            </h1>
            <p className="mt-1 text-xs text-[#A7AFBC]">
              Monitor and manage all tasks across every project and team member.
            </p>
          </div>
          <Link href="/admin/tasks/new">
            <Button variant="primary" size="sm">
              <Plus className="size-3.5" />
              Create Task
            </Button>
          </Link>
        </div>

        {/* Suspense Table */}
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-16 text-[#6B7280] text-sm">
              <span className="animate-pulse">Loading tasks…</span>
            </div>
          }
        >
          <TasksTable />
        </Suspense>
      </div>
    </AppShell>
  );
}