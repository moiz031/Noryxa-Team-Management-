import { NextResponse } from "next/server";
import { requireEmployee } from "@/lib/auth/roles";
import { getAttendance, getAttendanceByEmployeeAndDate, createAttendance, updateAttendance } from "@/lib/db/attendance";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const employee = await requireEmployee();
    const url = new URL(request.url);
    const status = url.searchParams.get("status") as "present" | "late" | "absent" | "half_day" | "remote" | "excused" | "all" | null;
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");

    const employeeId = employee.profile.employees?.[0]?.id;
    if (!employeeId) {
      return NextResponse.json({ attendance: [], total: 0, page, pageSize });
    }

    const { attendance, total } = await getAttendance({
      employeeId,
      status: status ?? "all",
      startDate: startDate ?? undefined,
      endDate: endDate ?? undefined,
      page,
      pageSize,
    });

    return NextResponse.json({ attendance, total, page, pageSize });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : message.includes("Admin access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const employee = await requireEmployee();
    const body = await request.json();
    
    const employeeId = employee.profile.employees?.[0]?.id;
    if (!employeeId) {
      return NextResponse.json({ error: "Employee record not found" }, { status: 404 });
    }
    
    if (!body.attendanceDate) {
      return NextResponse.json({ error: "Attendance date is required" }, { status: 400 });
    }
    
    const existing = await getAttendanceByEmployeeAndDate(employeeId, body.attendanceDate);
    if (existing) {
      return NextResponse.json({ error: "Attendance for this date already exists" }, { status: 409 });
    }
    
    const attendance = await createAttendance({
      employee_id: employeeId,
      attendance_date: body.attendanceDate,
      status: body.status || "present",
      check_in_at: body.checkInAt || null,
      check_out_at: body.checkOutAt || null,
      note: body.note?.trim() || null,
      created_by: employee.user.id,
    });
    
    await createSupabaseAdminClient()
      .from("activity_logs")
      .insert({ actor_id: employee.user.id, action_type: "attendance.created", entity_type: "attendance", entity_id: attendance.id, metadata: { attendance_date: body.attendanceDate, status: body.status } });
    
    return NextResponse.json({ attendance }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : message.includes("Admin access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}