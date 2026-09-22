import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/roles";
import { getProjectById } from "@/lib/db/projects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  FolderKanban,
  Building2,
  Calendar,
  CheckSquare,
  Users,
  ArrowRight,
  Flag,
  FileText,
} from "lucide-react";

const statusColors: Record<string, string> = {
  planning: "text-[#A7AFBC] bg-white/5 border-white/10",
  active: "text-[#39FF14] bg-[#39FF14]/10 border-[#39FF14]/30",
  on_hold: "text-[#F5B942] bg-[#F5B942]/10 border-[#F5B942]/30",
  completed: "text-[#24C5E3] bg-[#24C5E3]/10 border-[#24C5E3]/30",
  archived: "text-[#6B7280] bg-white/5 border-white/10",
};

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const [project, { count: taskCount }, { count: memberCount }] = await Promise.all([
    getProjectById(id),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("project_id", id),
    supabase
      .from("project_members")
      .select("*", { count: "exact", head: true })
      .eq("project_id", id),
  ]);

  if (!project) redirect("/admin/projects");

  const sc = statusColors[project.status] ?? statusColors.archived;

  const formatDate = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "—";

  return (
    <AppShell role="admin" userEmail={""}>
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        {/* Back */}
        <Link
          href="/admin/projects"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A7AFBC] hover:text-white transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to Projects
        </Link>

        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.1] bg-gradient-to-r from-[#0E1117] via-[#11151C] to-[#0A0D12] p-6 sm:p-8 backdrop-blur-xl">
          <div className="absolute top-0 right-0 size-72 rounded-full bg-[#24C5E3]/8 blur-[120px] pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="shrink-0 grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-[#24C5E3]/30 to-[#39FF14]/10 border border-white/10 text-[#24C5E3]">
                <FolderKanban className="size-7" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#24C5E3]">
                  <FolderKanban className="size-3.5" />
                  <span>Agency Initiative</span>
                </div>
                <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F5F7FA]">
                  {project.name}
                </h1>
                {project.description && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-[#A7AFBC] max-w-xl leading-relaxed">
                    <FileText className="size-3 mt-0.5 shrink-0" />
                    {project.description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 sm:flex-col sm:items-end">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold capitalize ${sc}`}
              >
                <Flag className="size-3" />
                {project.status.replace("_", " ")}
              </span>
              <Link href={`/admin/projects/${id}/members`}>
                <Button variant="secondary" size="sm">
                  <Users className="size-3.5" />
                  Manage Members
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              label: "Tasks",
              value: taskCount ?? 0,
              icon: CheckSquare,
              color: "text-[#39FF14]",
              href: `/admin/tasks?project=${id}`,
            },
            {
              label: "Members",
              value: memberCount ?? 0,
              icon: Users,
              color: "text-[#24C5E3]",
              href: `/admin/projects/${id}/members`,
            },
            {
              label: "Department",
              value: project.departments?.name ?? "—",
              icon: Building2,
              color: "text-[#8B5CF6]",
              href: undefined,
            },
            {
              label: "Client",
              value: project.clients?.name ?? project.client_name ?? "—",
              icon: Building2,
              color: "text-[#F5B942]",
              href: undefined,
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
                    View all <ArrowRight className="size-3" />
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

        {/* Details Card */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 backdrop-blur-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#6B7280]">
              Project Details
            </h2>
          </div>
          <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
            {[
              { label: "Status", value: <StatusBadge status={project.status} />, icon: Flag },
              {
                label: "Start Date",
                value: formatDate(project.starts_on),
                icon: Calendar,
              },
              { label: "Due Date", value: formatDate(project.due_on), icon: Calendar },
              {
                label: "Department",
                value: project.departments?.name ?? "—",
                icon: Building2,
              },
              {
                label: "Client",
                value: project.clients?.name ?? project.client_name ?? "—",
                icon: Building2,
              },
              {
                label: "Created",
                value: formatDate(project.created_at),
                icon: Calendar,
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
        </div>
      </div>
    </AppShell>
  );
}
