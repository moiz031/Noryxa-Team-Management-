import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AnalyticsSummary = {
  total_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  attendance_days: number;
  present_days: number;
  absent_days: number;
  report_count: number;
  submitted_report_count: number;
  tracked_seconds: number;
};

export type AnalyticsSummaryParams = {
  startDate?: string;
  endDate?: string;
  employeeId?: string | null;
};

const DEFAULT_WINDOW_DAYS = 30;

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function getAnalyticsSummary(params: AnalyticsSummaryParams = {}): Promise<AnalyticsSummary> {
  const endDate = params.endDate ?? dateOnly(new Date());
  const startDate = params.startDate ?? dateOnly(new Date(Date.now() - DEFAULT_WINDOW_DAYS * 86400000));
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_analytics_summary", {
    p_start_date: startDate,
    p_end_date: endDate,
    p_employee_id: params.employeeId ?? null,
  });
  if (error) throw new Error(`Failed to fetch analytics summary: ${error.message}`);
  const row = (Array.isArray(data) ? data[0] : data) as AnalyticsSummary | null;
  if (!row) throw new Error("Analytics summary was empty");
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, Number(value ?? 0)])
  ) as AnalyticsSummary;
}
