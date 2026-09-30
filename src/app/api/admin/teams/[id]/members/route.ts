import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const addMemberSchema = z.object({
  employee_id: z.string().uuid(),
  role: z.string().trim().max(80).nullable().optional(),
});

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id: team_id } = await params;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("team_members")
      .select(
        `employee_id, created_at,
        employees!inner(
          id, employee_code, job_title, employment_status,
          profiles!employees_profile_id_fkey(id, full_name, email, avatar_path, phone, timezone, is_active)
        )`
      )
      .eq("team_id", team_id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ members: data ?? [] });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id: team_id } = await params;
    const parsed = addMemberSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("team_members")
      .upsert(
        { team_id, employee_id: parsed.data.employee_id },
        { onConflict: "team_id,employee_id" }
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ member: data }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id: team_id } = await params;
    const { employee_id } = await request.json() as { employee_id: string };
    if (!employee_id)
      return NextResponse.json({ error: "employee_id required" }, { status: 400 });

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("team_id", team_id)
      .eq("employee_id", employee_id);
    if (error) throw new Error(error.message);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
