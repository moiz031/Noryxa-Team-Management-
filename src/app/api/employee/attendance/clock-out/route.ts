import { NextResponse } from "next/server";
import { requireEmployee } from "@/lib/auth/roles";
import { getAttendanceByEmployeeAndDate, updateAttendance } from "@/lib/db/attendance";
import { getEmployeeSchedule } from "@/lib/db/schedules";
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
  
  const yyyy = get('year');
  const mm = get('month');
  const dd = get('day');
  
  return {
    localDate: `${yyyy}-${mm}-${dd}`
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
    
    // Fetch schedule to know timezone
    const schedule = await getEmployeeSchedule(employeeId, now.toISOString().slice(0,10));
    const timezone = schedule?.timezone || 'UTC';
    
    const { localDate } = getLocalDayTime(now, timezone);

    // Find attendance for today
    const existing = await getAttendanceByEmployeeAndDate(employeeId, localDate);
    if (!existing) {
      return NextResponse.json({ error: "Not clocked in today. Please clock in first." }, { status: 400 });
    }

    if (existing.check_out_at) {
      return NextResponse.json({ error: "Already clocked out for today." }, { status: 409 });
    }

    // Update attendance
    const attendance = await updateAttendance({
      id: existing.id,
      check_out_at: now.toISOString(),
      updated_by: employee.user.id
    });

    await createSupabaseAdminClient()
      .from("activity_logs")
      .insert({ 
        actor_id: employee.user.id, 
        action_type: "attendance.clock_out", 
        entity_type: "attendance", 
        entity_id: attendance.id, 
        metadata: { attendance_date: localDate } 
      });

    return NextResponse.json({ attendance }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : message.includes("Admin access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
