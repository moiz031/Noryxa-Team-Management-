import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { timeEntrySchema } from "@/lib/validation/batch3";

export async function GET(request: Request) {
  try {
    const context = await requireUser();
    const employeeId = context.profile.employees?.[0]?.id;
    const url = new URL(request.url);
    const supabase = createSupabaseAdminClient();
    let query = supabase.from("time_entries").select("*").order("started_at", { ascending: false });
    if (context.role !== "admin") query = query.eq("employee_id", employeeId ?? "00000000-0000-0000-0000-000000000000");
    if (url.searchParams.get("taskId")) query = query.eq("task_id", url.searchParams.get("taskId")!);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ entries: data ?? [] });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected server error" }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const context = await requireUser();
    const employeeId = context.profile.employees?.[0]?.id;
    const parsed = timeEntrySchema.safeParse(await request.json());
    if (!parsed.success || (!employeeId && context.role !== "admin") || (context.role === "admin" && !parsed.data.employee_id)) return NextResponse.json({ error: "Invalid time entry" }, { status: 400 });
    const input = parsed.data;
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("time_entries").insert({
      task_id: input.task_id, employee_id: input.employee_id ?? employeeId, started_at: input.started_at ?? new Date().toISOString(),
      ended_at: input.ended_at ?? null, notes: input.notes ?? null,
    }).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: error.code === "23P01" || error.code === "23505" ? 409 : 400 });
    return NextResponse.json({ entry: data }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected server error" }, { status: 500 }); }
}
