import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications/engine";

export type JobType =
  | "overdue_task_notifications"
  | "missing_daily_report_reminders"
  | "leave_aware_report_suppression"
  | "onboarding_check"
  | "recurring_tasks_generation"
  | "late_attendance_detection"
  | "notification_generation";

export type JobStatus = "pending" | "processing" | "running" | "completed" | "failed" | "retry";

export type Schedule = {
  id: string;
  timezone: string;
  grace_period_minutes?: number | null;
  [key: string]: unknown;
};

export type EmployeeWithSchedule = {
  id: string;
  profile_id: string;
  department_id: string | null;
  employment_status: string;
  joined_on: string | null;
  created_at: string;
};

const ACTIVE_TASK_STATUSES = ["backlog", "todo", "in_progress", "blocked", "review"];

export function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function previousDate(date: Date): string {
  const value = new Date(date);
  value.setUTCDate(value.getUTCDate() - 1);
  return dateOnly(value);
}

export function getLocalScheduleDetails(date: Date, timeZone = "UTC") {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const year = getPart("year");
    const month = getPart("month");
    const day = getPart("day");
    const weekday = (getPart("weekday") || "").toLowerCase();
    const hour = parseInt(getPart("hour") || "0", 10);
    const minute = parseInt(getPart("minute") || "0", 10);
    const timeInMinutes = hour * 60 + minute;
    return {
      dateStr: `${year}-${month}-${day}`,
      localDate: `${year}-${month}-${day}`,
      weekday,
      timeStr: `${getPart("hour")}:${getPart("minute")}:${getPart("second")}`,
      timeString: `${getPart("hour")}:${getPart("minute")}`,
      timeInMinutes,
    };
  } catch {
    const dateStr = dateOnly(date);
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const weekday = dayNames[date.getUTCDay()];
    const hour = date.getUTCHours();
    const minute = date.getUTCMinutes();
    const hhmm = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    return {
      dateStr,
      localDate: dateStr,
      weekday,
      timeStr: `${hhmm}:00`,
      timeString: hhmm,
      timeInMinutes: hour * 60 + minute,
    };
  }
}

export function isScheduledForWorkday(schedule: Schedule | null | undefined, weekday: string): boolean {
  if (!schedule) {
    return ["monday", "tuesday", "wednesday", "thursday", "friday"].includes(weekday);
  }
  const startKey = `${weekday}_start`;
  const endKey = `${weekday}_end`;
  return Boolean(schedule[startKey] && schedule[endKey]);
}

export function parseTimeToMinutes(timeStr: string | null | undefined): number | null {
  if (!timeStr) return null;
  const parts = String(timeStr).split(":");
  if (parts.length < 2) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

export async function claimJob(
  db: ReturnType<typeof createSupabaseAdminClient>,
  jobType: JobType,
  key: string,
  payload: Record<string, unknown>,
  preferredStatus: "processing" | "running" = "running"
): Promise<string | null> {
  const { data: inserted, error } = await db
    .from("automation_jobs")
    .insert({
      job_type: jobType,
      idempotency_key: key,
      payload,
      status: preferredStatus,
      attempts: 1,
      locked_at: new Date().toISOString(),
    })
    .select("id, status")
    .maybeSingle();

  if (!error && inserted) return inserted.id as string;

  if (error?.code !== "23505") {
    throw new Error(`Failed to claim automation job: ${error?.message ?? "unknown error"}`);
  }

  // Handle duplicate key: check existing state for safe retry or stalled recovery
  const { data: existing, error: lookupError } = await db
    .from("automation_jobs")
    .select("id, status, attempts, locked_at")
    .eq("idempotency_key", key)
    .single();

  if (lookupError) throw new Error(`Failed to inspect automation job: ${lookupError.message}`);

  const now = Date.now();
  const lockedTime = existing.locked_at ? new Date(existing.locked_at).getTime() : 0;
  const isStalled = (existing.status === "processing" || existing.status === "running") && now - lockedTime > 15 * 60 * 1000;

  if (existing.status === "failed" || existing.status === "retry" || isStalled) {
    const { data: retried, error: retryError } = await db
      .from("automation_jobs")
      .update({
        status: preferredStatus,
        payload,
        attempts: (existing.attempts || 0) + 1,
        locked_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", existing.id)
      .select("id")
      .maybeSingle();

    if (retryError) throw new Error(`Failed to retry automation job: ${retryError.message}`);
    return (retried?.id as string) ?? null;
  }

  return null;
}

export async function finishJob(
  db: ReturnType<typeof createSupabaseAdminClient>,
  id: string,
  status: "completed" | "failed" | "retry",
  error?: string
) {
  const { error: updateError } = await db
    .from("automation_jobs")
    .update({
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
      last_error: error ?? null,
    })
    .eq("id", id);

  if (updateError) throw new Error(`Failed to update automation job: ${updateError.message}`);

  const { error: activityError } = await db.from("activity_logs").insert({
    actor_id: null,
    action_type: `automation.job_${status}`,
    entity_type: "automation_job",
    entity_id: id,
    metadata: error ? { error, status } : { status },
  });

  if (activityError) throw new Error(`Failed to log automation activity: ${activityError.message}`);
}

// 1. OVERDUE TASK AUTOMATION
export async function overdueTaskNotifications(db: ReturnType<typeof createSupabaseAdminClient>, asOf: Date) {
  const { data: tasks, error } = await db
    .from("tasks")
    .select("id, title, due_at, due_date, assigned_to, employees!inner(id, profile_id)")
    .in("status", ACTIVE_TASK_STATUSES)
    .or(`due_at.lt.${asOf.toISOString()},due_date.lt.${dateOnly(asOf)}`);

  if (error) throw new Error(`Failed to load overdue tasks: ${error.message}`);

  let sent = 0;
  for (const task of (tasks ?? []) as Array<{
    id: string;
    title: string;
    due_at: string | null;
    due_date: string | null;
    assigned_to: string;
    employees: Array<{ id: string; profile_id: string }>;
  }>) {
    const employee = task.employees?.[0];
    if (!employee?.profile_id) continue;

    await notify({
      recipientId: employee.profile_id,
      type: "task.overdue",
      title: "Task overdue",
      body: `"${task.title}" is overdue.`,
      entityType: "task",
      entityId: task.id,
      preference: "task_notifications",
      dedupeKey: `automation:overdue-task:${task.id}:${dateOnly(asOf)}`,
      metadata: { due_at: task.due_at ?? task.due_date },
    });
    sent += 1;
  }
  return sent;
}

// 2 & 3. MISSING DAILY REPORT & LEAVE-AWARE REPORT SUPPRESSION
export async function missingDailyReportReminders(
  db: ReturnType<typeof createSupabaseAdminClient>,
  asOf = new Date()
) {
  const { data: employees, error: employeesError } = await db
    .from("employees")
    .select("id, profile_id, department_id, employment_status")
    .eq("employment_status", "active");

  if (employeesError) throw new Error(`Failed to load active employees: ${employeesError.message}`);

  // Fetch all assignments with work schedules
  const { data: assignments, error: assignmentsError } = await db
    .from("schedule_assignments")
    .select("employee_id, starts_on, ends_on, work_schedules(*)");

  if (assignmentsError) throw new Error(`Failed to load schedule assignments: ${assignmentsError.message}`);

  let sent = 0;

  for (const employee of (employees ?? []) as Array<{ id: string; profile_id: string; department_id: string | null }>) {
    const assignment = (assignments ?? []).find(
      (item) => item.employee_id === employee.id
    );
    const schedule = (assignment?.work_schedules as Schedule | null | undefined) ?? null;
    const tz = schedule?.timezone || "UTC";

    // Compute report date (yesterday in employee's schedule timezone)
    const yesterday = new Date(asOf.getTime() - 24 * 60 * 60 * 1000);
    const local = getLocalScheduleDetails(yesterday, tz);
    const reportDate = local.dateStr;

    // Check if employee is scheduled to work on this weekday
    if (!isScheduledForWorkday(schedule, local.weekday)) {
      continue; // Suppressed: not a scheduled workday
    }

    // Check holidays for reportDate
    const { data: holidays } = await db
      .from("holidays")
      .select("id, is_company_wide, department_id")
      .eq("holiday_date", reportDate);

    const isHoliday = (holidays ?? []).some(
      (h) => h.is_company_wide || (employee.department_id && h.department_id === employee.department_id)
    );
    if (isHoliday) {
      continue; // Suppressed: holiday
    }

    // Check approved leave for reportDate
    const { data: approvedLeave } = await db
      .from("leave_requests")
      .select("id")
      .eq("employee_id", employee.id)
      .eq("status", "approved")
      .lte("starts_on", reportDate)
      .gte("ends_on", reportDate);

    if (approvedLeave && approvedLeave.length > 0) {
      continue; // Suppressed: approved leave
    }

    // Check if report already submitted
    const { data: reports } = await db
      .from("daily_reports")
      .select("id")
      .eq("employee_id", employee.id)
      .eq("report_date", reportDate);

    if (reports && reports.length > 0) {
      continue; // Suppressed: report already exists
    }

    // Send missing report notification
    await notify({
      recipientId: employee.profile_id,
      type: "report.missing",
      title: "Daily report reminder",
      body: `Your daily report for ${reportDate} is missing.`,
      entityType: "daily_report",
      entityId: null,
      preference: "report_notifications",
      dedupeKey: `automation:missing-report:${employee.id}:${reportDate}`,
      metadata: { report_date: reportDate, timezone: tz },
    });
    sent += 1;
  }

  return sent;
}

// 4. ONBOARDING AUTOMATION
export async function onboardingCheck(db: ReturnType<typeof createSupabaseAdminClient>, asOf = new Date()) {
  // Find employees who are pending or newly joined active employees
  const { data: employees, error } = await db
    .from("employees")
    .select("id, profile_id, employment_status, joined_on, created_at")
    .in("employment_status", ["pending", "active"])
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load onboarding employees: ${error.message}`);

  let sent = 0;
  for (const emp of employees ?? []) {
    // Only target pending or active within last 14 days
    const createdTime = new Date(emp.created_at).getTime();
    const isRecent = asOf.getTime() - createdTime < 14 * 24 * 60 * 60 * 1000;
    if (emp.employment_status !== "pending" && !isRecent) continue;

    const notif = await notify({
      recipientId: emp.profile_id,
      type: "onboarding.reminder",
      title: "Welcome & Onboarding",
      body: "Please verify your profile details and complete your onboarding tasks.",
      entityType: "employee",
      entityId: emp.id,
      dedupeKey: `automation:onboarding:${emp.id}`,
      metadata: { employment_status: emp.employment_status },
    });

    if (notif) sent += 1;
  }
  return sent;
}

// 5. RECURRING TASKS GENERATION
export async function recurringTasksGeneration(db: ReturnType<typeof createSupabaseAdminClient>, asOf = new Date()) {
  const { data: recurringTasks, error } = await db
    .from("tasks")
    .select("id, title, description, project_id, assigned_to, priority, recurrence_interval, next_recurrence_at, last_recurrence_at")
    .eq("is_recurring", true)
    .lte("next_recurrence_at", asOf.toISOString());

  if (error) throw new Error(`Failed to load recurring tasks: ${error.message}`);

  let generated = 0;
  for (const task of recurringTasks ?? []) {
    const today = dateOnly(asOf);
    const instanceKey = `automation:recurring-spawn:${task.id}:${today}`;

    // Compute next recurrence date
    const interval = task.recurrence_interval || "daily";
    const nextDate = new Date(asOf);
    if (interval === "daily") nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    else if (interval === "weekly") nextDate.setUTCDate(nextDate.getUTCDate() + 7);
    else if (interval === "monthly") nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);

    // Create spawned task instance
    const { data: newTask, error: insertError } = await db
      .from("tasks")
      .insert({
        title: task.title,
        description: task.description,
        project_id: task.project_id,
        assigned_to: task.assigned_to,
        priority: task.priority,
        status: "todo",
        parent_task_id: task.id,
        created_by: task.assigned_to,
      })
      .select("id, title, assigned_to")
      .single();

    if (!insertError && newTask) {
      generated += 1;

      // Update parent recurring task tracking
      await db
        .from("tasks")
        .update({
          last_recurrence_at: asOf.toISOString(),
          next_recurrence_at: nextDate.toISOString(),
        })
        .eq("id", task.id);

      // Notify assignee if assigned
      if (task.assigned_to) {
        const { data: emp } = await db.from("employees").select("profile_id").eq("id", task.assigned_to).single();
        if (emp?.profile_id) {
          await notify({
            recipientId: emp.profile_id,
            type: "task.recurring_spawned",
            title: "New recurring task created",
            body: `Recurring task "${task.title}" has been created for you.`,
            entityType: "task",
            entityId: newTask.id,
            preference: "task_notifications",
            dedupeKey: instanceKey,
          });
        }
      }
    }
  }
  return generated;
}

// 6. LATE ATTENDANCE DETECTION
export async function lateAttendanceDetection(db: ReturnType<typeof createSupabaseAdminClient>, asOf = new Date()) {
  const { data: employees, error: employeesError } = await db
    .from("employees")
    .select("id, profile_id, department_id")
    .eq("employment_status", "active");

  if (employeesError) throw new Error(`Failed to load active employees: ${employeesError.message}`);

  const { data: assignments, error: assignmentsError } = await db
    .from("schedule_assignments")
    .select("employee_id, starts_on, ends_on, work_schedules(*)");

  if (assignmentsError) throw new Error(`Failed to load schedule assignments: ${assignmentsError.message}`);

  let lateCount = 0;

  for (const employee of (employees ?? []) as Array<{ id: string; profile_id: string; department_id: string | null }>) {
    const assignment = (assignments ?? []).find((a) => a.employee_id === employee.id);
    const schedule = (assignment?.work_schedules as Schedule | null | undefined) ?? null;
    const tz = schedule?.timezone || "UTC";

    const local = getLocalScheduleDetails(asOf, tz);
    const today = local.dateStr;

    // Check workday schedule
    if (!isScheduledForWorkday(schedule, local.weekday)) continue;

    // Check holiday suppression
    const { data: holidays } = await db
      .from("holidays")
      .select("id, is_company_wide, department_id")
      .eq("holiday_date", today);

    const isHoliday = (holidays ?? []).some(
      (h) => h.is_company_wide || (employee.department_id && h.department_id === employee.department_id)
    );
    if (isHoliday) continue;

    // Check approved leave suppression
    const { data: approvedLeave } = await db
      .from("leave_requests")
      .select("id")
      .eq("employee_id", employee.id)
      .eq("status", "approved")
      .lte("starts_on", today)
      .gte("ends_on", today);

    if (approvedLeave && approvedLeave.length > 0) continue;

    // Determine scheduled start time and grace period
    const startKey = `${local.weekday}_start`;
    const startMinutes = parseTimeToMinutes(schedule ? (schedule[startKey] as string) : "09:00:00") ?? 540;
    const graceMinutes = schedule?.grace_period_minutes ?? 15;
    const lateThresholdMinutes = startMinutes + graceMinutes;

    // Check employee's attendance record for today
    const { data: attendance } = await db
      .from("attendance")
      .select("id, check_in_at, is_late, minutes_late")
      .eq("employee_id", employee.id)
      .eq("attendance_date", today)
      .maybeSingle();

    if (attendance?.check_in_at) {
      // Employee checked in: calculate if check-in was late
      const checkInLocal = getLocalScheduleDetails(new Date(attendance.check_in_at), tz);
      if (checkInLocal.timeInMinutes > lateThresholdMinutes && !attendance.is_late) {
        const minutesLate = checkInLocal.timeInMinutes - startMinutes;
        await db
          .from("attendance")
          .update({
            is_late: true,
            minutes_late: minutesLate,
          })
          .eq("id", attendance.id);

        await notify({
          recipientId: employee.profile_id,
          type: "attendance.late",
          title: "Late attendance recorded",
          body: `You were marked late for your shift today by ${minutesLate} minutes.`,
          entityType: "attendance",
          entityId: attendance.id,
          dedupeKey: `automation:late-attendance:${employee.id}:${today}`,
          metadata: { minutes_late: minutesLate, attendance_date: today },
        });
        lateCount += 1;
      }
    } else if (!attendance && local.timeInMinutes > lateThresholdMinutes) {
      // Current time is past threshold and employee has not checked in at all
      await notify({
        recipientId: employee.profile_id,
        type: "attendance.missing_checkin",
        title: "Late check-in alert",
        body: "You have not checked in for your scheduled shift today.",
        entityType: "attendance",
        entityId: null,
        dedupeKey: `automation:late-checkin-alert:${employee.id}:${today}`,
        metadata: { attendance_date: today, scheduled_start: schedule ? schedule[startKey] : "09:00:00" },
      });
      lateCount += 1;
    }
  }

  return lateCount;
}

// 7. MAIN AUTOMATION ENGINE RUNNER
export async function runAutomation(asOf = new Date()) {
  const db = createSupabaseAdminClient();
  const todayStr = dateOnly(asOf);
  const yesterdayStr = previousDate(asOf);

  const jobs: Array<{
    type: JobType;
    key: string;
    payload: Record<string, unknown>;
    execute: () => Promise<number>;
  }> = [
    {
      type: "overdue_task_notifications",
      key: `automation:overdue-tasks:${todayStr}`,
      payload: { as_of: asOf.toISOString() },
      execute: () => overdueTaskNotifications(db, asOf),
    },
    {
      type: "missing_daily_report_reminders",
      key: `automation:missing-reports:${yesterdayStr}`,
      payload: { report_date: yesterdayStr },
      execute: () => missingDailyReportReminders(db, asOf),
    },
    {
      type: "onboarding_check",
      key: `automation:onboarding:${todayStr}`,
      payload: { as_of: asOf.toISOString() },
      execute: () => onboardingCheck(db, asOf),
    },
    {
      type: "recurring_tasks_generation",
      key: `automation:recurring-tasks:${todayStr}`,
      payload: { as_of: asOf.toISOString() },
      execute: () => recurringTasksGeneration(db, asOf),
    },
    {
      type: "late_attendance_detection",
      key: `automation:late-attendance:${todayStr}`,
      payload: { as_of: asOf.toISOString() },
      execute: () => lateAttendanceDetection(db, asOf),
    },
  ];

  const results: Record<string, number | string> = {};

  for (const job of jobs) {
    const id = await claimJob(db, job.type, job.key, job.payload);
    if (!id) {
      results[job.type] = "skipped_or_already_completed";
      continue;
    }
    try {
      const count = await job.execute();
      await finishJob(db, id, "completed");
      results[job.type] = count;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown automation error";
      await finishJob(db, id, "failed", message);
      results[job.type] = `failed: ${message}`;
    }
  }

  return { asOf: asOf.toISOString(), results };
}

// 8. ADMIN-READABLE EXECUTION HISTORY
export async function getAutomationHistory(options?: {
  status?: JobStatus;
  jobType?: JobType;
  limit?: number;
  page?: number;
}) {
  const db = createSupabaseAdminClient();
  const limit = Math.min(options?.limit ?? 50, 100);
  const page = Math.max(options?.page ?? 1, 1);
  const offset = (page - 1) * limit;

  let query = db
    .from("automation_jobs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (options?.status) {
    query = query.eq("status", options.status);
  }
  if (options?.jobType) {
    query = query.eq("job_type", options.jobType);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to fetch automation history: ${error.message}`);

  return {
    jobs: data ?? [],
    total: count ?? 0,
    page,
    limit,
  };
}
