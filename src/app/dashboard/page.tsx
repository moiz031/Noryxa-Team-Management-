import { requireEmployee } from "@/lib/auth/roles";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { AppShell } from "@/components/layout/app-shell";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import {
  CheckSquare,
  Clock,
  Bell,
  Sparkles,
  ArrowRight,
  FolderKanban,
  Megaphone,
  UserCheck,
  Calendar,
  Layers,
  Plus,
} from "lucide-react";

export default async function DashboardPage() {
  const context = await requireEmployee();
  const supabase = await createSupabaseServerClient();
  const employeeId = context.profile.employees?.[0]?.id;
  const fullName = context.profile.full_name || context.user.email?.split("@")[0] || "Team Member";

  const [
    { count: taskCount },
    { count: reportCount },
    { count: unreadCount },
    { data: activeTasks },
    { data: announcements },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("assigned_to", employeeId ?? "")
      .not("status", "in", '("completed","cancelled")'),
    supabase
      .from("daily_reports")
      .select("*", { count: "exact", head: true })
      .eq("employee_id", employeeId ?? "")
      .eq("status", "draft"),
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("recipient_id", context.user.id)
      .is("read_at", null),
    supabase
      .from("tasks")
      .select("id,title,status,priority,due_at,projects(name)")
      .eq("assigned_to", employeeId ?? "")
      .not("status", "in", '("completed","cancelled")')
      .order("due_at", { ascending: true })
      .limit(5),
    supabase
      .from("announcements")
      .select("id,title,body,published_at,is_pinned")
      .order("is_pinned", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(3),
  ]);

  return (
    <AppShell
      role="employee"
      userEmail={context.user.email ?? ""}
      unreadCount={unreadCount ?? 0}
    >
      <RealtimeRefresh
        tables={["tasks", "daily_reports", "notifications", "attendance", "feed_posts"]}
      />

      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
        {/* Hero Welcome Banner */}
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.1] bg-gradient-to-r from-[#0E1117] via-[#11151C] to-[#0A0D12] p-6 sm:p-8 backdrop-blur-xl">
          <div className="absolute top-0 right-0 size-72 rounded-full bg-[#39FF14]/10 blur-[100px] pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#39FF14]/20 bg-[#39FF14]/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#39FF14]">
                <Sparkles className="size-3" />
                <span>NORYXA Workspace</span>
              </div>
              <h1 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[#F5F7FA]">
                Good day, {fullName}
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm text-[#A7AFBC]">
                Your personal agency workstation is synchronized and active.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/reports">
                <Button size="sm" variant="primary">
                  <Plus className="size-3.5" />
                  Log Daily Report
                </Button>
              </Link>
              <Link href="/attendance">
                <Button size="sm" variant="secondary">
                  <UserCheck className="size-3.5 text-[#24C5E3]" />
                  Attendance
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* KPI Metrics Row */}
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            title="Open Tasks"
            value={taskCount ?? 0}
            subtitle="Assigned to your queue"
            icon={<CheckSquare className="size-5" />}
            accent="green"
            href="/tasks"
          />
          <StatCard
            title="Draft Reports"
            value={reportCount ?? 0}
            subtitle="Pending submission"
            icon={<Clock className="size-5" />}
            accent="cyan"
            href="/reports"
          />
          <StatCard
            title="Unread Alerts"
            value={unreadCount ?? 0}
            subtitle="Inbox notifications"
            icon={<Bell className="size-5" />}
            accent="purple"
            href="/notifications"
          />
        </div>

        {/* Two-Column Grid: Active Tasks & Latest Announcements */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Active Tasks Column (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="size-4 text-[#39FF14]" />
                <h2 className="text-base font-semibold text-[#F5F7FA]">
                  Active Deliverables
                </h2>
              </div>
              <Link
                href="/tasks"
                className="text-xs text-[#24C5E3] hover:underline flex items-center gap-1"
              >
                View all tasks
                <ArrowRight className="size-3" />
              </Link>
            </div>

            {(activeTasks ?? []).length === 0 ? (
              <EmptyState
                icon={<CheckSquare className="size-6" />}
                title="No pending tasks"
                description="Your queue is completely clear. You are all caught up with your deliverables."
                action={
                  <Link href="/tasks">
                    <Button variant="secondary" size="sm">
                      Check Task Backlog
                    </Button>
                  </Link>
                }
              />
            ) : (
              <div className="space-y-2.5">
                {(activeTasks ?? []).map((t) => {
                  const projectName =
                    t.projects && typeof t.projects === "object" && "name" in t.projects
                      ? (t.projects as { name: string }).name
                      : null;

                  return (
                    <div
                      key={t.id}
                      className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 p-4 backdrop-blur-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-white/20 hover:bg-[#11151C]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-[#F5F7FA] truncate group-hover:text-[#39FF14] transition-colors">
                            {t.title}
                          </p>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[#A7AFBC]">
                          {projectName && (
                            <span className="flex items-center gap-1 text-[#24C5E3]">
                              <FolderKanban className="size-3" />
                              {projectName}
                            </span>
                          )}
                          <span>•</span>
                          <span>Due: {t.due_at ? new Date(t.due_at).toLocaleDateString() : "No deadline"}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-center">
                        <StatusBadge status={t.priority} />
                        <StatusBadge status={t.status} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Announcements & Hub Shortcuts (1 col) */}
          <div className="space-y-6">
            {/* Announcements Panel */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Megaphone className="size-4 text-[#24C5E3]" />
                  <h2 className="text-base font-semibold text-[#F5F7FA]">
                    Announcements
                  </h2>
                </div>
                <Link
                  href="/announcements"
                  className="text-xs text-[#24C5E3] hover:underline"
                >
                  View all
                </Link>
              </div>

              {(announcements ?? []).length === 0 ? (
                <div className="rounded-2xl border border-white/[0.08] bg-[#0E1117]/60 p-5 text-center text-xs text-[#6B7280]">
                  No broadcast announcements.
                </div>
              ) : (
                <div className="space-y-3">
                  {(announcements ?? []).map((a) => (
                    <div
                      key={a.id}
                      className="rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 p-4 backdrop-blur-sm hover:border-white/20 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-[#F5F7FA] truncate">
                          {a.title}
                        </h4>
                        {a.is_pinned && (
                          <span className="text-[10px] uppercase font-bold text-[#39FF14] bg-[#39FF14]/10 px-1.5 py-0.5 rounded border border-[#39FF14]/20">
                            Pinned
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-xs text-[#A7AFBC] line-clamp-2 leading-relaxed">
                        {a.body}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Hub Navigation Links */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 p-5 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
                Quick Workspaces
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Link
                  href="/projects"
                  className="flex items-center gap-2 rounded-xl p-2.5 bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.06] hover:text-[#39FF14] transition-colors"
                >
                  <FolderKanban className="size-3.5 text-[#24C5E3]" />
                  <span>Projects</span>
                </Link>
                <Link
                  href="/feed"
                  className="flex items-center gap-2 rounded-xl p-2.5 bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.06] hover:text-[#39FF14] transition-colors"
                >
                  <Sparkles className="size-3.5 text-[#39FF14]" />
                  <span>Team Feed</span>
                </Link>
                <Link
                  href="/leave"
                  className="flex items-center gap-2 rounded-xl p-2.5 bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.06] hover:text-[#39FF14] transition-colors"
                >
                  <Calendar className="size-3.5 text-[#F5B942]" />
                  <span>Time Off</span>
                </Link>
                <Link
                  href="/documents"
                  className="flex items-center gap-2 rounded-xl p-2.5 bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.06] hover:text-[#39FF14] transition-colors"
                >
                  <Layers className="size-3.5 text-[#8B5CF6]" />
                  <span>Knowledge</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
