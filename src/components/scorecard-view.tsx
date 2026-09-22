import { requireAdmin, requireAuth } from "@/lib/auth/roles";
import { calculateEmployeeScorecard, type ScorecardMetrics } from "@/lib/db/scorecards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Activity, CheckCircle2, UserCheck, Zap } from "lucide-react";

function ScorecardCard({ scorecard, name }: { scorecard: ScorecardMetrics; name: string }) {
  return (
    <Card hover={false}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span>{name}</span>
          <span className="text-2xl text-[#39FF14]">{scorecard.overallScore}</span>
        </CardTitle>
        <CardDescription>{scorecard.startDate} to {scorecard.endDate} · transparent monthly scorecard</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Task completion" value={`${scorecard.taskCompletionRate}%`} trend={scorecard.taskCompletionRateTrend} />
          <Metric label="On-time completion" value={`${scorecard.onTimeCompletionRate}%`} trend={scorecard.onTimeCompletionRateTrend} />
          <Metric label="Attendance" value={`${scorecard.attendanceRate}%`} trend={scorecard.attendanceRateTrend} />
          <Metric label="Reports" value={`${scorecard.reportConsistencyRate}%`} trend={scorecard.reportConsistencyRateTrend} />
        </div>
        <p className="mt-4 text-xs text-[#6B7280]">No keystroke, mouse, screen, or hidden surveillance data is used.</p>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, trend }: { label: string; value: string; trend?: number }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
      <p className="text-[11px] uppercase tracking-wider text-[#A7AFBC]">{label}</p>
      <p className="mt-2 text-xl font-bold text-[#F5F7FA]">{value}</p>
      {typeof trend === "number" && <p className={trend >= 0 ? "mt-1 text-xs text-[#39FF14]" : "mt-1 text-xs text-[#FF4D67]"}>{trend >= 0 ? "+" : ""}{trend} pts vs prior period</p>}
    </div>
  );
}

export async function ScorecardView({ adminOnly = false }: { adminOnly?: boolean }) {
  const context = adminOnly ? await requireAdmin() : await requireAuth();
  const db = await createSupabaseServerClient();
  const referenceDate = new Date();
  const today = referenceDate.toISOString().slice(0, 10);
  referenceDate.setUTCDate(referenceDate.getUTCDate() - 30);
  const start = referenceDate.toISOString().slice(0, 10);
  const scores: Array<{ name: string; scorecard: ScorecardMetrics }> = [];

  if (adminOnly) {
    const { data: employees } = await db.from("employees").select("id, employee_code, profiles(full_name, email)").eq("employment_status", "active").order("employee_code");
    for (const employee of employees ?? []) {
      const profile = Array.isArray(employee.profiles) ? employee.profiles[0] : employee.profiles;
      const scorecard = await calculateEmployeeScorecard({ employeeId: employee.id, startDate: start, endDate: today, period: "monthly" });
      scores.push({ name: profile?.full_name ?? profile?.email ?? employee.employee_code ?? "Employee", scorecard });
    }
  } else {
    const employeeId = context.profile.employees?.[0]?.id;
    if (employeeId) {
      scores.push({ name: context.profile.full_name ?? context.user.email ?? "My scorecard", scorecard: await calculateEmployeeScorecard({ employeeId, startDate: start, endDate: today, period: "monthly" }) });
    }
  }

  return (
    <AppShell role={adminOnly ? "admin" : "employee"} userEmail={context.user.email ?? ""}>
      <div className="mx-auto max-w-7xl space-y-8 p-6 lg:p-8">
        <div className="border-b border-white/[0.08] pb-6">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#39FF14]"><Activity className="size-4" /><span>Performance signals</span></div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#F5F7FA]">{adminOnly ? "Team scorecards" : "My scorecard"}</h1>
          <p className="mt-1 text-sm text-[#A7AFBC]">Deterministic, explainable metrics from tasks, attendance, reports, and tracked time.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard title="Scoring model" value="40/25/20/15" subtitle="Tasks / on-time / attendance / reports" icon={<CheckCircle2 className="size-5" />} accent="green" />
          <StatCard title="Review period" value="30 days" subtitle={`${start} through ${today}`} icon={<UserCheck className="size-5" />} accent="cyan" />
          <StatCard title="Tracked time" value={scores.length ? `${scores[0].scorecard.trackedHours}h` : "—"} subtitle="No surveillance telemetry" icon={<Zap className="size-5" />} accent="purple" />
        </div>
        <div className="space-y-4">{scores.length ? scores.map((item) => <ScorecardCard key={item.scorecard.employeeId} {...item} />) : <Card hover={false}><CardContent><p className="text-sm text-[#A7AFBC]">No employee scorecard data is available yet.</p></CardContent></Card>}</div>
      </div>
    </AppShell>
  );
}
