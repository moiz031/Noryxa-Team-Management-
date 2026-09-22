import { requireAdmin } from "@/lib/auth/roles";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import {
  Shield,
  FolderKanban,
  CheckSquare,
  Users,
  Building2,
  ClipboardList,
  UserCheck,
  Calendar,
  Clock,
  CalendarDays,
  Megaphone,
  Plus,
  ArrowRight,
  Activity,
  Layers,
} from "lucide-react";

export default async function AdminPage() {
  const context = await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const [
    { count: projectCount },
    { count: taskCount },
    { count: employeeCount },
    { count: pendingLeaveCount },
  ] = await Promise.all([
    supabase.from("projects").select("*", { count: "exact", head: true }),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .not("status", "in", '("completed","cancelled")'),
    supabase.from("employees").select("*", { count: "exact", head: true }),
    supabase
      .from("leave_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  const modules = [
    {
      title: "Projects",
      desc: "Create initiatives, define milestones, and monitor deliverable completion.",
      href: "/admin/projects",
      icon: FolderKanban,
      accent: "cyan" as const,
      tag: "Initiatives",
    },
    {
      title: "Tasks",
      desc: "Assign, balance priority queues, and inspect team workload workflows.",
      href: "/admin/tasks",
      icon: CheckSquare,
      accent: "green" as const,
      tag: "Operations",
    },
    {
      title: "Employees",
      desc: "Manage roster, invite staff, assign departments, and configure roles.",
      href: "/admin/employees",
      icon: Users,
      accent: "purple" as const,
      tag: "Workforce",
    },
    {
      title: "Teams",
      desc: "Organize functional units, appoint team leads, and align department goals.",
      href: "/admin/teams",
      icon: Layers,
      accent: "cyan" as const,
      tag: "Structure",
    },
    {
      title: "Clients",
      desc: "Track client accounts, commercial relationships, and active project ties.",
      href: "/admin/clients",
      icon: Building2,
      accent: "amber" as const,
      tag: "Accounts",
    },
    {
      title: "Daily Reports",
      desc: "Audit employee daily accomplishments, blockers, and forward plans.",
      href: "/admin/daily-reports",
      icon: ClipboardList,
      accent: "green" as const,
      tag: "Reviews",
    },
    {
      title: "Attendance",
      desc: "Realtime presence tracking, daily clock-in timestamps, and absence logs.",
      href: "/admin/attendance",
      icon: UserCheck,
      accent: "cyan" as const,
      tag: "Presence",
    },
    {
      title: "Leave Approvals",
      desc: "Review pending employee vacation, sick, and personal leave applications.",
      href: "/admin/leave",
      icon: Calendar,
      accent: "amber" as const,
      tag: "Approvals",
    },
    {
      title: "Work Schedules",
      desc: "Configure working hours, shift expectations, and time zone policies.",
      href: "/admin/schedules",
      icon: Clock,
      accent: "purple" as const,
      tag: "Policies",
    },
    {
      title: "Holidays",
      desc: "Maintain official agency holiday calendars and department off-days.",
      href: "/admin/holidays",
      icon: CalendarDays,
      accent: "cyan" as const,
      tag: "Calendar",
    },
    {
      title: "Announcements",
      desc: "Broadcast executive bulletins and pinned agency communications.",
      href: "/admin/announcements",
      icon: Megaphone,
      accent: "green" as const,
      tag: "Broadcasts",
    },
  ];

  return (
    <AppShell
      role="admin"
      userEmail={context.user.email ?? ""}
    >
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
        {/* Hero Admin Header */}
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.1] bg-gradient-to-r from-[#0E1117] via-[#11151C] to-[#0A0D12] p-6 sm:p-8 backdrop-blur-xl">
          <div className="absolute top-0 right-0 size-80 rounded-full bg-[#24C5E3]/10 blur-[120px] pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#24C5E3]/30 bg-[#24C5E3]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#24C5E3]">
                <Shield className="size-3.5" />
                <span>Executive Command Console</span>
              </div>
              <h1 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[#F5F7FA]">
                Organization Overview
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm text-[#A7AFBC]">
                Complete operational authority over NORYXA projects, team rosters, and client deliverables.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link href="/admin/employees/new">
                <Button size="sm" variant="primary">
                  <Plus className="size-3.5" />
                  Invite Employee
                </Button>
              </Link>
              <Link href="/admin/announcements">
                <Button size="sm" variant="secondary">
                  <Megaphone className="size-3.5 text-[#39FF14]" />
                  Broadcast
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Realtime KPI StatCards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Projects"
            value={projectCount ?? 0}
            subtitle="Active client & internal"
            icon={<FolderKanban className="size-5" />}
            accent="cyan"
            href="/admin/projects"
          />
          <StatCard
            title="Active Tasks"
            value={taskCount ?? 0}
            subtitle="Deliverables in flight"
            icon={<CheckSquare className="size-5" />}
            accent="green"
            href="/admin/tasks"
          />
          <StatCard
            title="Team Members"
            value={employeeCount ?? 0}
            subtitle="Staff on record"
            icon={<Users className="size-5" />}
            accent="purple"
            href="/admin/employees"
          />
          <StatCard
            title="Pending Leaves"
            value={pendingLeaveCount ?? 0}
            subtitle="Awaiting sign-off"
            icon={<Calendar className="size-5" />}
            accent="amber"
            href="/admin/leave"
          />
        </div>

        {/* Modules Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#F5F7FA]">
              Administrative Subsystems
            </h2>
            <span className="text-xs text-[#6B7280]">
              {modules.length} modules online
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((mod) => {
              const Icon = mod.icon;
              return (
                <Link
                  key={mod.href}
                  href={mod.href}
                  className="group relative flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 p-5 backdrop-blur-sm transition-all duration-200 hover:-translate-y-1 hover:border-white/20 hover:bg-[#11151C] hover:shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="grid size-11 place-items-center rounded-xl bg-white/[0.03] border border-white/10 text-[#39FF14] group-hover:scale-110 group-hover:border-[#39FF14]/40 transition-all">
                        <Icon className="size-5" />
                      </div>
                      <span className="rounded-full bg-white/5 border border-white/10 px-2.5 py-0.5 text-[10px] font-semibold text-[#A7AFBC]">
                        {mod.tag}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-[#F5F7FA] group-hover:text-[#39FF14] transition-colors">
                      {mod.title}
                    </h3>
                    <p className="mt-1.5 text-xs text-[#A7AFBC] leading-relaxed">
                      {mod.desc}
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-[#6B7280] group-hover:text-[#39FF14] transition-colors">
                    <span className="font-medium">Launch console</span>
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}