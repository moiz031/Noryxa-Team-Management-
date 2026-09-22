import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/roles";

const profileSchema = z.object({
  full_name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
});

export async function GET() {
  try {
    const auth = await requireAuth();
    const { data: profile, error } = await auth.supabase
      .from("profiles")
      .select("id, email, full_name, phone, timezone, avatar_path, is_active, role_id, updated_at")
      .eq("id", auth.user.id)
      .single();
    if (error) throw new Error(`Failed to fetch profile: ${error.message}`);
    return NextResponse.json({ profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: message.includes("Authentication required") ? 401 : 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth();
    const parsed = profileSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid profile data", issues: parsed.error.issues }, { status: 400 });
    const { data: profile, error } = await auth.supabase
      .from("profiles")
      .update({ ...parsed.data, updated_at: new Date().toISOString(), updated_by: auth.user.id })
      .eq("id", auth.user.id)
      .select("id, email, full_name, phone, timezone, avatar_path, is_active, role_id, updated_at")
      .single();
    if (error) throw new Error(`Failed to update profile: ${error.message}`);
    return NextResponse.json({ profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: message.includes("Authentication required") ? 401 : 500 });
  }
}
