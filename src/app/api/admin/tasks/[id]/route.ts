import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/roles";
import { getTaskById, updateTask, deleteTask } from "@/lib/db/tasks";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { taskMutationSchema } from "@/lib/validation/batch3";
import { notify } from "@/lib/notifications/engine";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const task = await getTaskById(id);
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
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
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const parsed = taskMutationSchema.safeParse({
      ...body, project_id: body.projectId ?? body.project_id, parent_task_id: body.parentTaskId ?? body.parent_task_id,
      assigned_to: body.assignedTo ?? body.assigned_to, start_date: body.startDate ?? body.start_date, due_date: body.dueDate ?? body.due_date,
    });
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid task" }, { status: 400 });
    const previous = await getTaskById(id);
    const task = await updateTask({ id, ...parsed.data, due_at: body.dueAt, updated_by: admin.user.id });
    if (parsed.data.assigned_to && parsed.data.assigned_to !== previous?.assigned_to) {
      const { data: employee } = await createSupabaseAdminClient().from("employees").select("profile_id").eq("id", parsed.data.assigned_to).single();
      if (employee?.profile_id) await notify({ recipientId: employee.profile_id, actorId: admin.user.id, type: "task.assigned", title: "Task assigned to you", body: task.title, entityType: "task", entityId: id, preference: "task_notifications", dedupeKey: `task.assigned:${id}:${parsed.data.assigned_to}:${task.updated_at}` });
    }
    if (parsed.data.status && parsed.data.status !== previous?.status && task.assigned_to) {
      const { data: employee } = await createSupabaseAdminClient().from("employees").select("profile_id").eq("id", task.assigned_to).single();
      if (employee?.profile_id) await notify({ recipientId: employee.profile_id, actorId: admin.user.id, type: "task.status_changed", title: "Task status changed", body: `${task.title}: ${parsed.data.status}`, entityType: "task", entityId: id, preference: "task_notifications", dedupeKey: `task.status:${id}:${task.updated_at}` });
    }
    await createSupabaseAdminClient()
      .from("activity_logs")
      .insert({ actor_id: admin.user.id, action_type: "task.updated", entity_type: "task", entity_id: id, metadata: body });
    return NextResponse.json({ task });
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
    await deleteTask(id);
    await createSupabaseAdminClient()
      .from("activity_logs")
      .insert({ actor_id: admin.user.id, action_type: "task.deleted", entity_type: "task", entity_id: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : message.includes("Admin access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}