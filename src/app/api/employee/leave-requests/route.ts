import { NextResponse } from "next/server";
import { requireEmployee } from "@/lib/auth/roles";
import { getLeaveRequests, createLeaveRequest } from "@/lib/db/leave-requests";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications/engine";
import { leaveRequestSchema } from "@/lib/validation/batch2";

export async function GET(request: Request) {
  try {
    const employee = await requireEmployee();
    const url = new URL(request.url);
    const status = url.searchParams.get("status") as "pending" | "approved" | "rejected" | "cancelled" | "all" | null;
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");

    const employeeId = employee.profile.employees?.[0]?.id;
    if (!employeeId) {
      return NextResponse.json({ leaveRequests: [], total: 0, page, pageSize });
    }

    const { leaveRequests, total } = await getLeaveRequests({
      employeeId,
      status: status ?? "all",
      page,
      pageSize,
    });

    return NextResponse.json({ leaveRequests, total, page, pageSize });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : message.includes("Admin access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const employee = await requireEmployee();
    const parsed = leaveRequestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const body = parsed.data;
    
    const employeeId = employee.profile.employees?.[0]?.id;
    if (!employeeId) {
      return NextResponse.json({ error: "Employee record not found" }, { status: 404 });
    }
    
    const leaveRequest = await createLeaveRequest({
      employee_id: employeeId,
      leave_type: body.leaveType.trim(),
      starts_on: body.startsOn,
      ends_on: body.endsOn,
      reason: body.reason || null,
      status: "pending",
      created_by: employee.user.id,
    });
    
    await createSupabaseAdminClient()
      .from("activity_logs")
      .insert({ actor_id: employee.user.id, action_type: "leave_request.created", entity_type: "leave_request", entity_id: leaveRequest.id, metadata: { leave_type: body.leaveType, starts_on: body.startsOn, ends_on: body.endsOn } });
    const db = createSupabaseAdminClient();
    const { data: admins } = await db.from("profiles").select("id,roles!inner(code)").eq("is_active", true);
    for (const admin of admins ?? []) {
      const role = Array.isArray(admin.roles) ? admin.roles[0] : admin.roles;
      if (role?.code === "admin") await notify({ recipientId: admin.id, actorId: employee.user.id, type: "leave.requested", title: "New leave request", body: `${body.leaveType}: ${body.startsOn} to ${body.endsOn}`, entityType: "leave_request", entityId: leaveRequest.id, preference: "leave_notifications", dedupeKey: `leave.requested:${leaveRequest.id}:${admin.id}` });
    }
    
    return NextResponse.json({ leaveRequest }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : message.includes("Admin access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}