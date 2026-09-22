import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/roles";
import { getEmployeeById, updateEmployee, deleteEmployee } from "@/lib/db/employees";
import { logAuditEvent, AuditEventType } from "@/lib/audit/logger";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const employee = await getEmployeeById(id);
    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    return NextResponse.json({ employee });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : message.includes("Admin access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const existing = await getEmployeeById(id);
    const employee = await updateEmployee({ id, ...body, updated_by: admin.user.id });

    const targetStatus = body.employment_status || body.status;
    let eventType: AuditEventType = "employee.updated";
    if (targetStatus && targetStatus === "suspended" && existing?.employment_status !== "suspended") {
      eventType = "employee.suspended";
    } else if (targetStatus && targetStatus === "active" && existing?.employment_status === "suspended") {
      eventType = "employee.reactivated";
    } else if (body.role_id && existing?.profiles?.role_id && body.role_id !== existing.profiles.role_id) {
      eventType = "employee.role_changed";
    }

    await logAuditEvent({
      actorId: admin.user.id,
      event: eventType,
      entityType: "employee",
      entityId: id,
      metadata: {
        old_status: existing?.employment_status,
        new_status: targetStatus,
        old_role_id: existing?.profiles?.role_id,
        new_role_id: body.role_id,
        updated_fields: Object.keys(body),
      },
      request,
    });

    return NextResponse.json({ employee });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : message.includes("Admin access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    await deleteEmployee(id);
    await logAuditEvent({
      actorId: admin.user.id,
      event: "employee.deleted",
      entityType: "employee",
      entityId: id,
      request,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : message.includes("Admin access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}