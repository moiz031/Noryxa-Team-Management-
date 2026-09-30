import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const auth = await requireAuth();
    const supabase = await createSupabaseServerClient();

    // Get employee record for the authenticated user
    const { data: employee, error } = await supabase
      .from("employees")
      .select(`
        id, employee_code, job_title, employment_status, joined_on,
        departments!left(id, name)
      `)
      .eq("profile_id", auth.user.id)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch employee: ${error.message}`);
    return NextResponse.json({ employee });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json(
      { error: message },
      { status: message.includes("Authentication required") ? 401 : 500 }
    );
  }
}
