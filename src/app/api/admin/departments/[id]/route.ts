import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/roles";
import { getDepartmentById, updateDepartment, deleteDepartment } from "@/lib/db/departments";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const department = await getDepartmentById(id);
    if (!department) return NextResponse.json({ error: "Department not found" }, { status: 404 });
    return NextResponse.json({ department });
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
    const department = await updateDepartment({ id, ...body, updated_by: admin.user.id });
    await createSupabaseAdminClient()
      .from("activity_logs")
      .insert({ actor_id: admin.user.id, action_type: "department.updated", entity_type: "department", entity_id: id, metadata: body });
    return NextResponse.json({ department });
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
    await deleteDepartment(id);
    await createSupabaseAdminClient()
      .from("activity_logs")
      .insert({ actor_id: admin.user.id, action_type: "department.deleted", entity_type: "department", entity_id: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : message.includes("Admin access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}