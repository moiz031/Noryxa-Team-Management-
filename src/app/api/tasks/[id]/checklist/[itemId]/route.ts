import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/roles";
import { getTaskById } from "@/lib/db/tasks";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checklistSchema } from "@/lib/validation/batch3";

type RouteContext = { params: Promise<{ id: string; itemId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id, itemId } = await params;
    if (!(await getTaskById(id))) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    const parsed = checklistSchema.partial().safeParse(await request.json());
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ error: "Invalid checklist item" }, { status: 400 });
    }
    const { data, error } = await createSupabaseAdminClient()
      .from("task_checklist_items")
      .update({ ...parsed.data, updated_by: user.user.id, updated_at: new Date().toISOString() })
      .eq("id", itemId)
      .eq("task_id", id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: "Checklist item not found or not editable" }, { status: 404 });
    return NextResponse.json({ item: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected server error" }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id, itemId } = await params;
    if (!(await getTaskById(id))) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    const query = createSupabaseAdminClient()
      .from("task_checklist_items")
      .delete()
      .eq("id", itemId)
      .eq("task_id", id);
    if (user.role !== "admin") query.eq("created_by", user.user.id);
    const { error } = await query;
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected server error" }, { status: 500 });
  }
}
