import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const sponsorSchema = z.object({
  member_employee_id: z.string().uuid(),
  sponsor_employee_id: z.string().uuid(),
});

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    const { data, error } = await createSupabaseAdminClient().from("member_sponsors").select("member_employee_id,sponsor_employee_id,created_at,updated_at").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return NextResponse.json({ sponsors: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    const parsed = sponsorSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { data, error } = await createSupabaseAdminClient().from("member_sponsors").upsert({ ...parsed.data, created_by: auth.user.id, updated_at: new Date().toISOString() }, { onConflict: "member_employee_id" }).select("*").single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ sponsor: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: message.includes("cycle") ? 400 : 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    const parsed = z.object({ member_employee_id: z.string().uuid() }).safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { error } = await createSupabaseAdminClient().from("member_sponsors").delete().eq("member_employee_id", parsed.data.member_employee_id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected server error" }, { status: 500 });
  }
}
