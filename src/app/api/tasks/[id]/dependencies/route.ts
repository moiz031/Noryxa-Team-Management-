import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/roles";
import { getTaskById } from "@/lib/db/tasks";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { dependencySchema } from "@/lib/validation/batch3";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireUser(); const { id } = await params; if (!(await getTaskById(id))) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    const { data, error } = await createSupabaseAdminClient().from("task_dependencies").select("*").eq("task_id", id); if (error) throw error; return NextResponse.json({ dependencies: data ?? [] });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Unexpected server error" }, { status: 500 }); }
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const user = await requireUser(); const { id } = await params; const task = await getTaskById(id);
    if (!task) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const parsed = dependencySchema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: "Invalid dependency" }, { status: 400 });
    if (!(await getTaskById(parsed.data.depends_on_task_id))) return NextResponse.json({ error: "Dependency task not found or not accessible" }, { status: 403 });
    const { data, error } = await createSupabaseAdminClient().from("task_dependencies").insert({ task_id: id, ...parsed.data, created_by: user.user.id }).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 409 }); return NextResponse.json({ dependency: data }, { status: 201 });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Unexpected server error" }, { status: 500 }); }
}
