import { NextResponse } from "next/server";
import { requireEmployee } from "@/lib/auth/roles";
import { getTaskById, updateTask } from "@/lib/db/tasks";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications/engine";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const employee = await requireEmployee();
    const { id } = await params;
    const task = await getTaskById(id);
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    
    const employeeId = employee.profile.employees?.[0]?.id;
    if (task.assigned_to !== employeeId) {
      return NextResponse.json({ error: "Not authorized to view this task" }, { status: 403 });
    }
    
    return NextResponse.json({ task });
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
    const employee = await requireEmployee();
    const { id } = await params;
    const body = await request.json();
    
    const employeeId = employee.profile.employees?.[0]?.id;
    const task = await getTaskById(id);
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    if (task.assigned_to !== employeeId) {
      return NextResponse.json({ error: "Not authorized to update this task" }, { status: 403 });
    }
    
    // Employees can only update status, not other fields
    const allowedFields = ["status"];
    const updates: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in body) updates[key] = body[key];
    }
    
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }
    
    const updatedTask = await updateTask({ id, ...updates, updated_by: employee.user.id });
    if (updates.status && updates.status !== task.status) {
      const { data: admins } = await createSupabaseAdminClient().from("profiles").select("id,roles!inner(code)").eq("is_active", true);
      for (const admin of admins ?? []) {
        const role = Array.isArray(admin.roles) ? admin.roles[0] : admin.roles;
        if (role?.code === "admin") await notify({ recipientId: admin.id, actorId: employee.user.id, type: "task.status_changed", title: "Task status changed", body: `${updatedTask.title}: ${updates.status}`, entityType: "task", entityId: id, preference: "task_notifications", dedupeKey: `task.status:${id}:${updatedTask.updated_at}` });
      }
    }
    
    await createSupabaseAdminClient()
      .from("activity_logs")
      .insert({ actor_id: employee.user.id, action_type: "task.status_changed", entity_type: "task", entity_id: id, metadata: { new_status: updates.status } });
    
    return NextResponse.json({ task: updatedTask });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : message.includes("Admin access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}