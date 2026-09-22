import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/roles";
import { getProjects, createProject } from "@/lib/db/projects";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const status = url.searchParams.get("status") as "planning" | "active" | "on_hold" | "completed" | "archived" | "all" | null;
    const departmentId = url.searchParams.get("departmentId");
    const search = url.searchParams.get("search");
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");

    const { projects, total } = await getProjects({
      status: status ?? "all",
      departmentId: departmentId ?? undefined,
      search: search ?? undefined,
      page,
      pageSize,
    });

    return NextResponse.json({ projects, total, page, pageSize });
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
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }
    const project = await createProject({
      name: body.name.trim(),
      description: body.description?.trim() || null,
      client_name: body.clientName?.trim() || null,
      status: body.status || "planning",
      department_id: body.departmentId || null,
      starts_on: body.startsOn || null,
      due_on: body.dueOn || null,
      created_by: admin.user.id,
    });
    await createSupabaseAdminClient()
      .from("activity_logs")
      .insert({ actor_id: admin.user.id, action_type: "project.created", entity_type: "project", entity_id: project.id, metadata: { name: project.name } });
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : message.includes("Admin access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}