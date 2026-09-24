import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getMemberEarningsSummary } from "@/lib/db/earnings";

export async function GET() {
  try {
    const auth = await requireAuth();
    const { data: employee, error } = await createSupabaseAdminClient().from("employees").select("id").eq("profile_id", auth.user.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!employee) return NextResponse.json({ error: "Member profile not found" }, { status: 404 });
    return NextResponse.json(await getMemberEarningsSummary(employee.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: message.includes("Authentication") ? 401 : 500 });
  }
}
