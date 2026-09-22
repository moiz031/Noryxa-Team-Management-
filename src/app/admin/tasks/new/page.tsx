import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/roles";
import { getProjects } from "@/lib/db/projects";
import { getEmployees } from "@/lib/db/employees";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import {
  ArrowLeft,
  CheckSquare,
  FolderKanban,
  User,
  Calendar,
  Flag,
  FileText,
  AlertTriangle,
} from "lucide-react";

export default async function NewTaskPage() {
  const context = await requireAdmin();
  const [{ projects }, { employees }] = await Promise.all([
    getProjects({ status: "active", pageSize: 100 }),
    getEmployees({ status: "active", pageSize: 100 }),
  ]);

  async function handleCreate(formData: FormData) {
    "use server";
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const projectId = formData.get("projectId") as string;
    const assignedTo = formData.get("assignedTo") as string;
    const priority = formData.get("priority") as string;
    const status = formData.get("status") as string;
    const dueAt = formData.get("dueAt") as string;

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/admin/tasks`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title?.trim(),
          description: description?.trim() || undefined,
          project_id: projectId || undefined,
          assigned_to: assignedTo || undefined,
          priority: priority || "medium",
          status: status || "pending",
          due_at: dueAt || undefined,
        }),
      }
    );

    if (res.ok) {
      redirect("/admin/tasks");
    }
  }

  return (
    <AppShell role="admin" userEmail={context.user.email ?? ""}>
      <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
        {/* Back */}
        <Link
          href="/admin/tasks"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A7AFBC] hover:text-white transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to Tasks
        </Link>

        {/* Header */}
        <div className="border-b border-white/[0.08] pb-6">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#39FF14]">
            <CheckSquare className="size-3.5" />
            <span>New Deliverable</span>
          </div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#F5F7FA]">
            Create Task
          </h1>
          <p className="mt-1 text-xs text-[#A7AFBC]">
            Define a new task, assign it to a team member, and link it to a project.
          </p>
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 backdrop-blur-sm p-6 space-y-6">
          <form action={handleCreate} className="space-y-5">
            {/* Title */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
                <CheckSquare className="size-3.5" />
                Task Title <span className="text-[#FF4D67]">*</span>
              </label>
              <Input
                name="title"
                type="text"
                required
                placeholder="e.g. Redesign landing page hero section"
                autoComplete="off"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
                <FileText className="size-3.5" />
                Description
              </label>
              <Textarea
                name="description"
                placeholder="Detailed task requirements, acceptance criteria, or context…"
                className="min-h-24"
              />
            </div>

            {/* Project + Assignee row */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
                  <FolderKanban className="size-3.5" />
                  Project
                </label>
                <Select name="projectId" defaultValue="">
                  <option value="">— No project —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
                  <User className="size-3.5" />
                  Assign To
                </label>
                <Select name="assignedTo" defaultValue="">
                  <option value="">— Unassigned —</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.profiles.full_name || emp.profiles.email || emp.id}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Priority + Status row */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
                  <AlertTriangle className="size-3.5" />
                  Priority
                </label>
                <Select name="priority" defaultValue="medium">
                  <option value="urgent">🔴 Urgent</option>
                  <option value="high">🟡 High</option>
                  <option value="medium">🔵 Medium</option>
                  <option value="low">⚪ Low</option>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
                  <Flag className="size-3.5" />
                  Status
                </label>
                <Select name="status" defaultValue="pending">
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="review">In Review</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </Select>
              </div>
            </div>

            {/* Due date */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
                <Calendar className="size-3.5" />
                Due Date
              </label>
              <Input name="dueAt" type="datetime-local" />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/[0.06]">
              <Link href="/admin/tasks">
                <Button type="button" variant="secondary" size="sm">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" variant="primary" size="sm">
                <CheckSquare className="size-3.5" />
                Create Task
              </Button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
