import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/roles";
import { getTasks, createTask } from "@/lib/db/tasks";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { taskMutationSchema } from "@/lib/validation/batch3";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const status = url.searchParams.get("status") as "backlog" | "todo" | "in_progress" | "blocked" | "review" | "completed" | "cancelled" | "all" | null;
    const projectId = url.searchParams.get("projectId");
    const assignedTo = url.searchParams.get("assignedTo");
    const priority = url.searchParams.get("priority") as "low" | "medium" | "high" | "urgent" | "all" | null;
    const search = url.searchParams.get("search");
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");

    const { tasks, total } = await getTasks({
      status: status ?? "all",
      projectId: projectId ?? undefined,
      assignedTo: assignedTo ?? undefined,
      priority: priority ?? "all",
      search: search ?? undefined,
      page,
      pageSize,
    });

    return NextResponse.json({ tasks, total, page, pageSize });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : message.includes("Admin access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const parsed = taskMutationSchema.extend({ title: taskMutationSchema.shape.title.unwrap() }).safeParse({
      ...body, project_id: body.projectId ?? body.project_id, parent_task_id: body.parentTaskId ?? body.parent_task_id,
      assigned_to: body.assignedTo ?? body.assigned_to, start_date: body.startDate ?? body.start_date, due_date: body.dueDate ?? body.due_date,
    });
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid task" }, { status: 400 });
    const task = await createTask({
      ...parsed.data,
      due_at: body.dueAt ?? (parsed.data.due_date ? `${parsed.data.due_date}T23:59:59Z` : null),
      created_by: admin.user.id,
    });
    await createSupabaseAdminClient()
      .from("activity_logs")
      .insert({ actor_id: admin.user.id, action_type: "task.created", entity_type: "task", entity_id: task.id, metadata: { title: task.title } });
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : message.includes("Admin access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}