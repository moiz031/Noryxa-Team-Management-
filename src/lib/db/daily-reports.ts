import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DailyReport = {
  id: string;
  employee_id: string;
  report_date: string;
  status: "draft" | "submitted" | "reviewed";
  summary: string;
  blockers: string | null;
  tomorrow_plan: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string | null;
  employees?: { id: string; profiles: { full_name: string | null; email: string | null } } | null;
};

export type DailyReportListParams = {
  employeeId?: string | null;
  status?: "draft" | "submitted" | "reviewed" | "all";
  startDate?: string | null;
  endDate?: string | null;
  page?: number;
  pageSize?: number;
};

export async function getDailyReports(params: DailyReportListParams = {}): Promise<{ reports: DailyReport[]; total: number }> {
  const supabase = await createSupabaseServerClient();
  const { employeeId, status = "all", startDate, endDate, page = 1, pageSize = 20 } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("daily_reports")
    .select(
      `*,
      employees!left(id, profiles!employees_profile_id_fkey(full_name, email))`,
      { count: "exact" }
    )
    .order("report_date", { ascending: false })
    .range(from, to);

  if (employeeId) query = query.eq("employee_id", employeeId);
  if (status !== "all") query = query.eq("status", status);
  if (startDate) query = query.gte("report_date", startDate);
  if (endDate) query = query.lte("report_date", endDate);

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to fetch daily reports: ${error.message}`);
  return { reports: data as DailyReport[], total: count ?? 0 };
}

export async function getDailyReportById(id: string): Promise<DailyReport | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("daily_reports")
    .select(`*, employees!left(id, profiles!employees_profile_id_fkey(full_name, email))`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to fetch daily report: ${error.message}`);
  return data as DailyReport | null;
}

export async function getDailyReportByEmployeeAndDate(employeeId: string, reportDate: string): Promise<DailyReport | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("daily_reports")
    .select(`*, employees!left(id, profiles!employees_profile_id_fkey(full_name, email))`)
    .eq("employee_id", employeeId)
    .eq("report_date", reportDate)
    .maybeSingle();
  if (error) throw new Error(`Failed to fetch daily report: ${error.message}`);
  return data as DailyReport | null;
}

export type CreateDailyReportInput = {
  employee_id: string;
  report_date: string;
  status?: "draft" | "submitted" | "reviewed";
  summary: string;
  blockers?: string | null;
  tomorrow_plan?: string | null;
  created_by: string;
};

export async function createDailyReport(input: CreateDailyReportInput): Promise<DailyReport> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("daily_reports")
    .insert({ ...input, status: input.status ?? "draft", created_by: input.created_by, updated_by: input.created_by })
    .select(`*, employees!left(id, profiles!employees_profile_id_fkey(full_name, email))`)
    .single();
  if (error) throw new Error(`Failed to create daily report: ${error.message}`);
  return data as DailyReport;
}

export type UpdateDailyReportInput = Partial<CreateDailyReportInput> & { id: string; updated_by: string };

export async function updateDailyReport(input: UpdateDailyReportInput): Promise<DailyReport> {
  const supabase = await createSupabaseServerClient();
  const { id, updated_by, ...rest } = input;
  const { data, error } = await supabase
    .from("daily_reports")
    .update({ ...rest, updated_by, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(`*, employees!left(id, profiles!employees_profile_id_fkey(full_name, email))`)
    .single();
  if (error) throw new Error(`Failed to update daily report: ${error.message}`);
  return data as DailyReport;
}

export async function deleteDailyReport(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("daily_reports").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete daily report: ${error.message}`);
}