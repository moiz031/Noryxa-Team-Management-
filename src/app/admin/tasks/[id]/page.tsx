import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/roles";
import { getTaskById } from "@/lib/db/tasks";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  CheckSquare,
  FolderKanban,
  Calendar,
  User,
  Flag,
  AlertTriangle,
  FileText,
  Clock,
  MessageSquare,
  Edit,
  Trash2,
} from "lucide-react";

const priorityStyles: Record<string, string> = {
  urgent: "bg-[#FF4D67]/15 text-[#FF4D67] border border-[#FF4D67]/30",
  high: "bg-[#F5B942]/15 text-[#F5B942] border border-[#F5B942]/30",
  medium: "bg-[#24C5E3]/15 text-[#24C5E3] border border-[#24C5E3]/30",
  low: "bg-white/5 text-[#A7AFBC] border border-white/10",
};

const statusColors: Record<string, string> = {
  pending: "text-[#A7AFBC] bg-white/5 border-white/10",
  in_progress: "text-[#24C5E3] bg-[#24C5E3]/10 border-[#24C5E3]/30",
  review: "text-[#F5B942] bg-[#F5B942]/10 border-[#F5B942]/30",
  completed: "text-[#39FF14] bg-[#39FF14]/10 border-[#39FF14]/30",
  cancelled: "text-[#6B7280] bg-white/5 border-white/10",
};

const formatDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

const formatDateTime = (d: string | null) =>
  d
    ? new Date(d).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const [task, { count: commentCount }, { count: attachmentCount }] = await Promise.all([
    getTaskById(id),
    supabase
      .from("task_comments")
      .select("*", { count: "exact", head: true })
      .eq("task_id", id),
    supabase
      .from("task_attachments")
      .select("*", { count: "exact", head: true })
      .eq("task_id", id),
  ]);

  if (!task) redirect("/admin/tasks");

  const sc = statusColors[task.status] ?? statusColors.pending;
  const pc = priorityStyles[task.priority ?? "low"] ?? priorityStyles.low;

  return (
    <AppShell role="admin" userEmail={""}>
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        {/* Back */}
        <Link
          href="/admin/tasks"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A7AFBC] hover:text-white transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to Tasks
        </Link>

        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.1] bg-gradient-to-r from-[#0E1117] via-[#11151C] to-[#0A0D12] p-6 sm:p-8 backdrop-blur-xl">
          <div className="absolute top-0 right-0 size-72 rounded-full bg-[#24C5E3]/8 blur-[120px] pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="shrink-0 grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-[#24C5E3]/30 to-[#39FF14]/10 border border-white/10 text-[#24C5E3]">
                <CheckSquare className="size-7" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#24C5E3]">
                  <CheckSquare className="size-3.5" />
                  <span>Task Detail</span>
                </div>
                <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F5F7FA]">
                  {task.title}
                </h1>
                {task.description && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-[#A7AFBC] max-w-xl leading-relaxed">
                    <FileText className="size-3 mt-0.5 shrink-0" />
                    {task.description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 sm:flex-col sm:items-end">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold capitalize ${sc}`}
              >
                <Flag className="size-3" />
                {task.status.replace("_", " ")}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold capitalize ${pc}`}
              >
                <AlertTriangle className="size-3" />
                {task.priority ?? "—"}
              </span>
              <Link href={`/admin/tasks/${id}/edit`}>
                <Button variant="secondary" size="sm">
                  <Edit className="size-3.5" />
                  Edit Task
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              label: "Project",
              value: task.projects?.name ?? "—",
              icon: FolderKanban,
              color: "text-[#24C5E3]",
              href: task.projects ? `/admin/projects/${task.projects.id}` : undefined,
            },
            {
              label: "Assignee",
              value: task.employees?.profiles?.full_name ?? task.employees?.profiles?.email ?? "—",
              icon: User,
              color: "text-[#39FF14]",
              href: task.employees ? `/admin/employees/${task.employees.id}` : undefined,
            },
            {
              label: "Comments",
              value: commentCount ?? 0,
              icon: MessageSquare,
              color: "text-[#8B5CF6]",
              href: `/admin/tasks/${id}#comments`,
            },
            {
              label: "Attachments",
              value: attachmentCount ?? 0,
              icon: FileText,
              color: "text-[#F5B942]",
              href: `/admin/tasks/${id}#attachments`,
            },
          ].map(({ label, value, icon: Icon, color, href }) => {
            const card = (
              <div className="rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 p-4 hover:border-white/20 transition-colors group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#6B7280]">
                    {label}
                  </span>
                  <Icon className={`size-4 ${color}`} />
                </div>
                <p className={`text-xl font-extrabold tracking-tight ${color}`}>
                  {typeof value === "number" ? value : value}
                </p>
                {href && (
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-[#6B7280] group-hover:text-[#24C5E3] transition-colors">
                    View <ArrowRight className="size-3" />
                  </div>
                )}
              </div>
            );
            return href ? (
              <Link key={label} href={href}>
                {card}
              </Link>
            ) : (
              <div key={label}>{card}</div>
            );
          })}
        </div>

        {/* Details & Metadata Card */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 backdrop-blur-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#6B7280]">
              Task Information
            </h2>
          </div>
          <dl className="grid sm:grid-cols-2 lg:grid-cols-4 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
            {[
              { label: "Status", value: <StatusBadge status={task.status as Parameters<typeof StatusBadge>[0]["status"]} />, icon: Flag },
              { label: "Priority", value: <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${pc}`}>{task.priority ?? "—"}</span>, icon: AlertTriangle },
              { label: "Due Date", value: formatDate(task.due_at), icon: Calendar },
              { label: "Created", value: formatDateTime(task.created_at), icon: Clock },
              { label: "Updated", value: formatDateTime(task.updated_at), icon: Clock },
              { label: "Created By", value: task.created_by_profiles?.full_name ?? task.created_by_profiles?.email ?? "—", icon: User },
              { label: "Project", value: task.projects?.name ?? "—", icon: FolderKanban },
              { label: "Assignee", value: task.employees?.profiles?.full_name ?? task.employees?.profiles?.email ?? "Unassigned", icon: User },
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
        </div>

        {/* Comments Section */}
        <div id="comments" className="rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 backdrop-blur-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#6B7280]">Comments</h2>
            <span className="text-[11px] text-[#6B7280]">{commentCount ?? 0} comments</span>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-[#A7AFBC] text-center py-8">Comments will be displayed here. Connect to realtime for live updates.</p>
          </div>
        </div>

        {/* Attachments Section */}
        <div id="attachments" className="rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 backdrop-blur-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#6B7280]">Attachments</h2>
            <span className="text-[11px] text-[#6B7280]">{attachmentCount ?? 0} files</span>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-[#A7AFBC] text-center py-8">Attachments will be displayed here.</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}