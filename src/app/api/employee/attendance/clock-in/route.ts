import { NextResponse } from "next/server";
import { requireEmployee } from "@/lib/auth/roles";
import { getAttendanceByEmployeeAndDate, createAttendance } from "@/lib/db/attendance";
import { getEmployeeSchedule, isHoliday, isApprovedLeave, getScheduleDay } from "@/lib/db/schedules";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function getLocalDayTime(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    weekday: 'long',
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value;
  
  // Format MM/DD/YYYY to YYYY-MM-DD since en-US outputs MM/DD/YYYY natively for 2-digit
  const yyyy = get('year');
  const mm = get('month');
  const dd = get('day');
  
  let hh = get('hour');
  // Handle 24:00 which sometimes formats as 24 instead of 00 in hour12: false depending on Node version
  if (hh === '24') hh = '00';
  
  const min = get('minute');
  const weekday = get('weekday')?.toLowerCase();
  
  return {
    localDate: `${yyyy}-${mm}-${dd}`,
    localTime: `${hh}:${min}`,
    weekday: weekday
  };
}

export async function POST(request: Request) {
  try {
    const employee = await requireEmployee();
    const employeeId = employee.profile.employees?.[0]?.id;
    if (!employeeId) {
      return NextResponse.json({ error: "Employee record not found" }, { status: 404 });
    }

    const now = new Date();
    
    // Fetch schedule
    const schedule = await getEmployeeSchedule(employeeId, now.toISOString().slice(0,10));
    
    const timezone = schedule?.timezone || 'UTC';
    const { localDate, localTime, weekday } = getLocalDayTime(now, timezone);

    const departmentId = (employee.profile.employees?.[0] as { department_id?: string } | undefined)?.department_id;
    if (await isHoliday(localDate, departmentId)) {
      return NextResponse.json({ error: "Cannot clock in on a holiday", attendanceDate: localDate }, { status: 409 });
    }
    if (await isApprovedLeave(employeeId, localDate)) {
      return NextResponse.json({ error: "Cannot clock in while approved leave is active", attendanceDate: localDate }, { status: 409 });
    }
    if (schedule && weekday && !getScheduleDay(schedule, weekday).start) {
      return NextResponse.json({ error: "Cannot clock in on a non-working day", attendanceDate: localDate }, { status: 409 });
    }

    // Check for existing check-in today
    const existing = await getAttendanceByEmployeeAndDate(employeeId, localDate);
    if (existing) {
      return NextResponse.json({ error: "Already clocked in for today" }, { status: 409 });
    }

    let isLate = false;
    let minutesLate = 0;
    let status: "present" | "late" | "absent" | "half_day" | "remote" | "excused" = "present";

    // Only calculate late if schedule exists
    if (schedule && weekday) {
      const startKey = `${weekday}_start`;
      const scheduleStart = (schedule as Record<string, unknown>)[startKey] as string | null;

      if (scheduleStart) {
        // Parse time to minutes
        const [schH, schM] = scheduleStart.split(':').map(Number);
        const [curH, curM] = localTime.split(':').map(Number);
        
        const scheduleTotalMins = schH * 60 + schM;
        const currentTotalMins = curH * 60 + curM;
        
        const grace = schedule.grace_period_minutes || 0;
        
        if (currentTotalMins > (scheduleTotalMins + grace)) {
          isLate = true;
          minutesLate = currentTotalMins - scheduleTotalMins;
          status = "late";
        }
      }
    }

    // Create attendance
    const attendance = await createAttendance({
      employee_id: employeeId,
      attendance_date: localDate,
      status,
      check_in_at: now.toISOString(),
      created_by: employee.user.id,
    });
    
    // Optional: we can manually update is_late and minutes_late using admin client since the createAttendance helper does not have them typed yet, or update the helper. Let's update it via admin client to be safe if the helper types are strict.
    await createSupabaseAdminClient().from('attendance').update({
      is_late: isLate,
      minutes_late: minutesLate
    }).eq('id', attendance.id);

    await createSupabaseAdminClient()
      .from("activity_logs")
      .insert({ 
        actor_id: employee.user.id, 
        action_type: "attendance.clock_in", 
        entity_type: "attendance", 
        entity_id: attendance.id, 
        metadata: { attendance_date: localDate, is_late: isLate, minutes_late: minutesLate } 
      });
    
    // Re-fetch to include the updated fields
    const finalAttendance = await getAttendanceByEmployeeAndDate(employeeId, localDate);

    return NextResponse.json({ attendance: finalAttendance }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : message.includes("Admin access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
