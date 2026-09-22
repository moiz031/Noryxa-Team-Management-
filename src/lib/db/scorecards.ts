import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface ScorecardMetrics {
  period: "weekly" | "monthly";
  startDate: string;
  endDate: string;
  employeeId: string;
  // Measurable signals
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  taskCompletionRate: number; // 0 - 100%
  onTimeCompletionRate: number; // 0 - 100%
  attendanceDays: number;
  presentDays: number;
  attendanceRate: number; // 0 - 100%
  submittedReports: number;
  reportConsistencyRate: number; // 0 - 100%
  trackedHours: number;
  // Transparent Composite Index (Weighted 0-100)
  overallScore: number;
  formula: {
    taskWeight: "40%";
    onTimeWeight: "25%";
    attendanceWeight: "20%";
    reportWeight: "15%";
    surveillance: "none (no keystroke, mouse, or screen tracking)";
  };
  // New fields
  taskCompletionRateTrend?: number; // % change vs previous period
  onTimeCompletionRateTrend?: number;
  attendanceRateTrend?: number;
  reportConsistencyRateTrend?: number;
  trackedHoursTrend?: number;
  managerNotes?: string;
}

/**
 * Computes transparent, deterministic employee performance scorecard
 * derived directly from verified database activity records.
 */
export async function calculateEmployeeScorecard(params: {
  employeeId: string;
  startDate: string;
  endDate: string;
  period?: "weekly" | "monthly";
}): Promise<ScorecardMetrics> {
  const { employeeId, startDate, endDate, period = "monthly" } = params;
  const supabase = await createSupabaseServerClient();

  // 1. Query tasks assigned to employee in range
  const { data: tasks, error: tasksErr } = await supabase
    .from("tasks")
    .select("id, status, due_at, completed_at, created_at")
    .eq("assigned_to", employeeId)
    .gte("created_at", `${startDate}T00:00:00Z`)
    .lte("created_at", `${endDate}T23:59:59Z`);

  if (tasksErr) throw new Error(`Failed to load tasks for scorecard: ${tasksErr.message}`);

  const totalTasks = tasks?.length ?? 0;
  const completedTasks = tasks?.filter((t) => t.status === "completed").length ?? 0;
  const overdueTasks = tasks?.filter((t) => {
    if (t.status === "completed") return false;
    if (!t.due_at) return false;
    return new Date(t.due_at) < new Date();
  }).length ?? 0;

  const onTimeTasks = tasks?.filter((t) => {
    if (t.status !== "completed" || !t.completed_at || !t.due_at) return false;
    return new Date(t.completed_at) <= new Date(t.due_at);
  }).length ?? 0;

  const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;
  const onTimeCompletionRate = completedTasks > 0 ? Math.round((onTimeTasks / completedTasks) * 100) : 100;

  // 2. Query attendance in range
  const { data: attendance, error: attErr } = await supabase
    .from("attendance")
    .select("id, status, attendance_date")
    .eq("employee_id", employeeId)
    .gte("attendance_date", startDate)
    .lte("attendance_date", endDate);

  if (attErr) throw new Error(`Failed to load attendance for scorecard: ${attErr.message}`);

  const attendanceDays = attendance?.length ?? 0;
  const presentDays = attendance?.filter((a) => a.status === "present" || a.status === "remote").length ?? 0;
  const attendanceRate = attendanceDays > 0 ? Math.round((presentDays / attendanceDays) * 100) : 100;

  // 3. Query daily reports in range
  const { data: reports, error: repErr } = await supabase
    .from("daily_reports")
    .select("id, status, report_date")
    .eq("employee_id", employeeId)
    .gte("report_date", startDate)
    .lte("report_date", endDate);

  if (repErr) throw new Error(`Failed to load reports for scorecard: ${repErr.message}`);

  const submittedReports = reports?.filter((r) => r.status === "submitted").length ?? 0;
  const expectedReports = Math.max(1, attendanceDays || 1);
  const reportConsistencyRate = Math.min(100, Math.round((submittedReports / expectedReports) * 100));

  // 4. Query tracked time entries in range
  const { data: timeEntries, error: timeErr } = await supabase
    .from("time_entries")
    .select("duration_seconds")
    .eq("employee_id", employeeId)
    .gte("started_at", `${startDate}T00:00:00Z`)
    .lte("started_at", `${endDate}T23:59:59Z`);

  if (timeErr) throw new Error(`Failed to load time entries for scorecard: ${timeErr.message}`);

  const totalSeconds = (timeEntries ?? []).reduce((sum, entry) => sum + (entry.duration_seconds ?? 0), 0);
  const trackedHours = Math.round((totalSeconds / 3600) * 10) / 10;

  // Calculate previous period for trend comparison
  const startObj = new Date(startDate);
  const endObj = new Date(endDate);
  const diffTime = Math.abs(endObj.getTime() - startObj.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  const prevEndObj = new Date(startObj);
  prevEndObj.setDate(prevEndObj.getDate() - 1);
  const prevStartObj = new Date(prevEndObj);
  prevStartObj.setDate(prevStartObj.getDate() - diffDays + 1);

  const prevStartDate = prevStartObj.toISOString().split("T")[0];
  const prevEndDate = prevEndObj.toISOString().split("T")[0];

  // 1b. Query previous tasks for trend
  const { data: prevTasks } = await supabase
    .from("tasks")
    .select("id, status, due_at, completed_at, created_at")
    .eq("assigned_to", employeeId)
    .gte("created_at", `${prevStartDate}T00:00:00Z`)
    .lte("created_at", `${prevEndDate}T23:59:59Z`);

  const prevTotalTasks = prevTasks?.length ?? 0;
  const prevCompletedTasks = prevTasks?.filter((t) => t.status === "completed").length ?? 0;
  const prevOnTimeTasks = prevTasks?.filter((t) => {
    if (t.status !== "completed" || !t.completed_at || !t.due_at) return false;
    return new Date(t.completed_at) <= new Date(t.due_at);
  }).length ?? 0;

  const prevTaskCompletionRate = prevTotalTasks > 0 ? Math.round((prevCompletedTasks / prevTotalTasks) * 100) : 100;
  const prevOnTimeCompletionRate = prevCompletedTasks > 0 ? Math.round((prevOnTimeTasks / prevCompletedTasks) * 100) : 100;
  const taskCompletionRateTrend = taskCompletionRate - prevTaskCompletionRate;
  const onTimeCompletionRateTrend = onTimeCompletionRate - prevOnTimeCompletionRate;

  // 2b. Query previous attendance for trend
  const { data: prevAttendance } = await supabase
    .from("attendance")
    .select("id, status, attendance_date")
    .eq("employee_id", employeeId)
    .gte("attendance_date", prevStartDate)
    .lte("attendance_date", prevEndDate);

  const prevAttendanceDays = prevAttendance?.length ?? 0;
  const prevPresentDays = prevAttendance?.filter((a) => a.status === "present" || a.status === "remote").length ?? 0;
  const prevAttendanceRate = prevAttendanceDays > 0 ? Math.round((prevPresentDays / prevAttendanceDays) * 100) : 100;
  const attendanceRateTrend = attendanceRate - prevAttendanceRate;

  // 3b. Query previous daily reports for trend
  const { data: prevReports } = await supabase
    .from("daily_reports")
    .select("id, status, report_date")
    .eq("employee_id", employeeId)
    .gte("report_date", prevStartDate)
    .lte("report_date", prevEndDate);

  const prevSubmittedReports = prevReports?.filter((r) => r.status === "submitted").length ?? 0;
  const prevExpectedReports = Math.max(1, prevAttendanceDays || 1);
  const prevReportConsistencyRate = Math.min(100, Math.round((prevSubmittedReports / prevExpectedReports) * 100));
  const reportConsistencyRateTrend = reportConsistencyRate - prevReportConsistencyRate;

  // 4b. Query previous tracked time entries for trend
  const { data: prevTimeEntries } = await supabase
    .from("time_entries")
    .select("duration_seconds")
    .eq("employee_id", employeeId)
    .gte("started_at", `${prevStartDate}T00:00:00Z`)
    .lte("started_at", `${prevEndDate}T23:59:59Z`);

  const prevTotalSeconds = (prevTimeEntries ?? []).reduce((sum, entry) => sum + (entry.duration_seconds ?? 0), 0);
  const prevTrackedHours = Math.round((prevTotalSeconds / 3600) * 10) / 10;
  const trackedHoursTrend = Math.round((trackedHours - prevTrackedHours) * 10) / 10;

  const managerNotes: string | undefined = undefined;

  // 5. Transparent composite index formula (40% task, 25% on-time, 20% attendance, 15% reports)
  const overallScore = Math.round(
    taskCompletionRate * 0.4 +
    onTimeCompletionRate * 0.25 +
    attendanceRate * 0.2 +
    reportConsistencyRate * 0.15
  );

  return {
    period,
    startDate,
    endDate,
    employeeId,
    totalTasks,
    completedTasks,
    overdueTasks,
    taskCompletionRate,
    onTimeCompletionRate,
    attendanceDays,
    presentDays,
    attendanceRate,
    submittedReports,
    reportConsistencyRate,
    trackedHours,
    overallScore,
    formula: {
      taskWeight: "40%",
      onTimeWeight: "25%",
      attendanceWeight: "20%",
      reportWeight: "15%",
      surveillance: "none (no keystroke, mouse, or screen tracking)",
    },
    taskCompletionRateTrend,
    onTimeCompletionRateTrend,
    attendanceRateTrend,
    reportConsistencyRateTrend,
    trackedHoursTrend,
    managerNotes,
  };
}
