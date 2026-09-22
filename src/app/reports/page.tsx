import { requireEmployee } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { QuickForm } from "@/components/quick-form";
import { AppShell } from "@/components/layout/app-shell";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Clock, Calendar, CheckCircle2, AlertCircle } from "lucide-react";

export default async function ReportsPage() {
  const context = await requireEmployee();
  const id = context.profile.employees?.[0]?.id;
  const db = await createSupabaseServerClient();

  const { data } = await db
    .from("daily_reports")
    .select("*")
    .eq("employee_id", id ?? "")
    .order("report_date", { ascending: false });

  const reports = data ?? [];

  return (
    <AppShell
      role="employee"
      userEmail={context.user.email ?? ""}
    >
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b border-white/[0.08] pb-6">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#39FF14]">
            <Clock className="size-3.5" />
            <span>Daily Telemetry</span>
          </div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#F5F7FA]">
            Daily Work Reports
          </h1>
          <p className="mt-1 text-xs text-[#A7AFBC]">
            Log your accomplishments, current blockers, and planned deliverables for agency visibility.
          </p>
        </div>

        {/* Submission Form */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#A7AFBC]">
            Submit New Report
          </h2>
          <QuickForm
            endpoint="/api/employee/daily-reports"
            fields={[
              { name: "reportDate", label: "Report Date", type: "date" },
              { name: "summary", label: "Today's Accomplishments & Work Summary", multiline: true },
              { name: "blockers", label: "Blockers / Impeding Issues (Optional)" },
              { name: "tomorrowPlan", label: "Target Deliverables for Tomorrow" },
            ]}
            submitLabel="Submit Daily Report"
          />
        </div>

        {/* History List */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#A7AFBC]">
            Submission History ({reports.length})
          </h2>

          {reports.length === 0 ? (
            <EmptyState
              icon={<Clock className="size-6" />}
              title="No daily reports submitted yet"
              description="Your submitted reports will appear here chronologically for your review and records."
            />
          ) : (
            <div className="space-y-3">
              {reports.map((row) => (
                <article
                  key={row.id}
                  className="rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 p-5 backdrop-blur-sm transition-all hover:border-white/20"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="size-4 text-[#24C5E3]" />
                      <span className="font-semibold text-sm text-[#F5F7FA]">
                        {row.report_date}
                      </span>
                    </div>
                    <StatusBadge status={row.status} />
                  </div>

                  <p className="mt-3 text-sm text-[#F5F7FA] leading-relaxed">
                    {row.summary}
                  </p>

                  {row.blockers && (
                    <div className="mt-3 rounded-xl border border-[#FF4D67]/20 bg-[#FF4D67]/5 p-3 text-xs text-[#FF4D67] flex items-start gap-2">
                      <AlertCircle className="size-4 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">Blocker: </span>
                        <span>{row.blockers}</span>
                      </div>
                    </div>
                  )}

                  {row.tomorrow_plan && (
                    <div className="mt-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-[#A7AFBC] flex items-start gap-2">
                      <CheckCircle2 className="size-4 shrink-0 text-[#39FF14] mt-0.5" />
                      <div>
                        <span className="font-semibold text-[#F5F7FA]">Tomorrow&apos;s Plan: </span>
                        <span>{row.tomorrow_plan}</span>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
