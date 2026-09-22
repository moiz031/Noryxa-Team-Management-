import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireUser();
    const { id } = await params;
    const parsed = z.object({ ended_at: z.string().datetime().optional(), notes: z.string().max(2000).nullable().optional() }).safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid time entry" }, { status: 400 });
    const supabase = createSupabaseAdminClient();
    let query = supabase.from("time_entries").update({ ...parsed.data, ended_at: parsed.data.ended_at ?? new Date().toISOString() }).eq("id", id);
    if (context.role !== "admin") query = query.eq("employee_id", context.profile.employees?.[0]?.id ?? "00000000-0000-0000-0000-000000000000");
    const { data, error } = await query.select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ entry: data });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected server error" }, { status: 500 }); }
}
