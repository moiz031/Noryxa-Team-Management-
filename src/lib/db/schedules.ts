import { createSupabaseServerClient } from "@/lib/supabase/server";

export type WorkSchedule = {
  id: string;
  name: string;
  timezone: string;
  monday_start: string | null;
  monday_end: string | null;
  tuesday_start: string | null;
  tuesday_end: string | null;
  wednesday_start: string | null;
  wednesday_end: string | null;
  thursday_start: string | null;
  thursday_end: string | null;
  friday_start: string | null;
  friday_end: string | null;
  saturday_start: string | null;
  saturday_end: string | null;
  sunday_start: string | null;
  sunday_end: string | null;
  grace_period_minutes: number;
};

export async function getEmployeeSchedule(employeeId: string, targetDate: string): Promise<WorkSchedule | null> {
  const supabase = await createSupabaseServerClient();
  // Fetch active schedule assignment for the employee on the target date
  const { data: assignment, error: assignmentError } = await supabase
    .from("schedule_assignments")
    .select(`work_schedules (*)`)
    .eq("employee_id", employeeId)
    .lte("starts_on", targetDate)
    .or(`ends_on.is.null,ends_on.gte.${targetDate}`)
    .order("starts_on", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (assignmentError) throw new Error(`Failed to fetch schedule assignment: ${assignmentError.message}`);
  
  // If no specific schedule is assigned, fetch company default work schedule
  if (!assignment || !assignment.work_schedules) {
    const { data: defaultSchedule, error: defaultError } = await supabase
      .from("work_schedules")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (defaultError || !defaultSchedule) return null;
    return defaultSchedule as WorkSchedule;
  }
  
  // If it's an array for some reason
  const schedule = Array.isArray(assignment.work_schedules) ? assignment.work_schedules[0] : assignment.work_schedules;
  return schedule as WorkSchedule;
}

export async function isHoliday(date: string, departmentId?: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("holidays")
    .select("id")
    .eq("holiday_date", date);

  if (departmentId) {
    query = query.or(`is_company_wide.eq.true,department_id.eq.${departmentId}`);
  } else {
    query = query.eq("is_company_wide", true);
  }

  const { data, error } = await query.limit(1);
  if (error) throw new Error(`Failed to fetch holidays: ${error.message}`);
  return data && data.length > 0;
}

/** Returns true only when an approved leave request covers the target date. */
export async function isApprovedLeave(employeeId: string, date: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("leave_requests")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("status", "approved")
    .lte("starts_on", date)
    .gte("ends_on", date)
    .limit(1);
  if (error) throw new Error(`Failed to fetch approved leave: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

export function getScheduleDay(schedule: WorkSchedule, weekday: string) {
  const key = weekday.toLowerCase();
  return {
    start: schedule[`${key}_start` as keyof WorkSchedule] as string | null,
    end: schedule[`${key}_end` as keyof WorkSchedule] as string | null,
  };
}
