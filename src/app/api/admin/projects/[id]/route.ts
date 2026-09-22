import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/roles";
import { getProjectById, updateProject, deleteProject } from "@/lib/db/projects";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const project = await getProjectById(id);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json({ project });
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
    const project = await updateProject({ id, ...body, updated_by: admin.user.id });
    await createSupabaseAdminClient()
      .from("activity_logs")
      .insert({ actor_id: admin.user.id, action_type: "project.updated", entity_type: "project", entity_id: id, metadata: body });
    return NextResponse.json({ project });
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
    await deleteProject(id);
    await createSupabaseAdminClient()
      .from("activity_logs")
      .insert({ actor_id: admin.user.id, action_type: "project.deleted", entity_type: "project", entity_id: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : message.includes("Admin access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}