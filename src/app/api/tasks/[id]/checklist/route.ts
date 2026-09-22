import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/roles";
import { getTaskById } from "@/lib/db/tasks";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checklistSchema } from "@/lib/validation/batch3";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireUser(); const { id } = await params; if (!(await getTaskById(id))) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    const { data, error } = await createSupabaseAdminClient().from("task_checklist_items").select("*").eq("task_id", id).order("position");
    if (error) throw error; return NextResponse.json({ items: data ?? [] });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Unexpected server error" }, { status: 500 }); }
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const user = await requireUser(); const { id } = await params; const task = await getTaskById(id);
    if (!task) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const parsed = checklistSchema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: "Invalid checklist item" }, { status: 400 });
    const { data, error } = await createSupabaseAdminClient().from("task_checklist_items").insert({ task_id: id, ...parsed.data, created_by: user.user.id, updated_by: user.user.id }).select("*").single();
    if (error) throw error; return NextResponse.json({ item: data }, { status: 201 });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Unexpected server error" }, { status: 500 }); }
}
