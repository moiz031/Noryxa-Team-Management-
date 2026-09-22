import { NextResponse } from "next/server";
import { requireEmployee } from "@/lib/auth/roles";
import { getTasks, getTaskById, updateTask } from "@/lib/db/tasks";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const employee = await requireEmployee();
    const url = new URL(request.url);
    const status = url.searchParams.get("status") as "backlog" | "todo" | "in_progress" | "blocked" | "review" | "completed" | "cancelled" | "all" | null;
    const projectId = url.searchParams.get("projectId");
    const priority = url.searchParams.get("priority") as "low" | "medium" | "high" | "urgent" | "all" | null;
    const search = url.searchParams.get("search");
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");

    const employeeId = employee.profile.employees?.[0]?.id;
    if (!employeeId) {
      return NextResponse.json({ tasks: [], total: 0, page, pageSize });
    }

    const { tasks, total } = await getTasks({
      status: status ?? "all",
      projectId: projectId ?? undefined,
      assignedTo: employeeId,
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