import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/roles";
import { getDepartments, createDepartment } from "@/lib/db/departments";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const activeOnly = url.searchParams.get("activeOnly") !== "false";
    const search = url.searchParams.get("search") ?? undefined;
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "20");
    const result = await getDepartments({ activeOnly, search, page, pageSize });
    return NextResponse.json({ ...result, page: Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1, pageSize: Number.isFinite(pageSize) ? Math.min(100, Math.max(1, Math.floor(pageSize))) : 20 });
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
      return NextResponse.json({ error: "Department name is required" }, { status: 400 });
    }
    const department = await createDepartment({ name: body.name.trim(), description: body.description?.trim() || null, created_by: admin.user.id });
    await createSupabaseAdminClient()
      .from("activity_logs")
      .insert({ actor_id: admin.user.id, action_type: "department.created", entity_type: "department", entity_id: department.id, metadata: { name: department.name } });
    return NextResponse.json({ department }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : message.includes("Admin access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}