import { requireAdmin, requireAuth } from "@/lib/auth/roles";
import { getAnalyticsSummary } from "@/lib/db/analytics";
import { AppShell } from "@/components/layout/app-shell";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, CheckSquare, Clock, FileText, Zap, Users } from "lucide-react";

export async function AnalyticsDashboard({ adminOnly = false }: { adminOnly?: boolean }) {
  const context = adminOnly ? await requireAdmin() : await requireAuth();
  const employeeId = context.role === "employee" ? context.profile.employees?.[0]?.id : undefined;
  const referenceDate = new Date();
  const endDate = referenceDate.toISOString().slice(0, 10);
  referenceDate.setUTCDate(referenceDate.getUTCDate() - 30);
  const startDate = referenceDate.toISOString().slice(0, 10);
  const summary = await getAnalyticsSummary({ startDate, endDate, employeeId });
  const role = context.role === "admin" ? "admin" : "employee";

  return (
    <AppShell role={role} userEmail={context.user.email ?? ""}>
      <div className="mx-auto max-w-7xl space-y-8 p-6 lg:p-8">
        <div className="border-b border-white/[0.08] pb-6">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#24C5E3]">
            <Activity className="size-4" />
            <span>{adminOnly ? "Organization intelligence" : "Personal intelligence"}</span>
          </div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#F5F7FA]">Analytics</h1>
          <p className="mt-1 text-sm text-[#A7AFBC]">Verified activity summary for {startDate} through {endDate}.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total tasks" value={summary.total_tasks} subtitle={`${summary.completed_tasks} completed`} icon={<CheckSquare className="size-5" />} accent="green" />
          <StatCard title="Overdue tasks" value={summary.overdue_tasks} subtitle="Open items past due" icon={<Clock className="size-5" />} accent="amber" />
          <StatCard title="Attendance" value={`${summary.present_days}/${summary.attendance_days}`} subtitle={`${summary.absent_days} absent days`} icon={<Users className="size-5" />} accent="cyan" />
          <StatCard title="Tracked time" value={`${(summary.tracked_seconds / 3600).toFixed(1)}h`} subtitle="Task time entries" icon={<Zap className="size-5" />} accent="purple" />
        </div>

        <Card hover={false}>
          <CardHeader>
            <CardTitle>Reporting health</CardTitle>
            <CardDescription>Daily report submissions in the same verified window.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <FileText className="size-5 text-[#39FF14]" />
                <p className="mt-3 text-2xl font-bold text-[#F5F7FA]">{summary.submitted_report_count}</p>
                <p className="text-xs text-[#A7AFBC]">Submitted reports of {summary.report_count} total</p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <Activity className="size-5 text-[#24C5E3]" />
                <p className="mt-3 text-2xl font-bold text-[#F5F7FA]">{summary.total_tasks ? Math.round((summary.completed_tasks / summary.total_tasks) * 100) : 100}%</p>
                <p className="text-xs text-[#A7AFBC]">Task completion rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
