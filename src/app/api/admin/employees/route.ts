import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/roles";
import { employeeOnboardingSchema } from "@/lib/auth/validation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getEmployees } from "@/lib/db/employees";
import { withRateLimit } from "@/lib/api/rate-limit";
import { logAuditEvent } from "@/lib/audit/logger";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const status = url.searchParams.get("status") as "pending" | "active" | "suspended" | "inactive" | "all" | null;
    const departmentId = url.searchParams.get("departmentId");
    const search = url.searchParams.get("search");
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");

    const { employees, total } = await getEmployees({
      status: status ?? "all",
      departmentId: departmentId ?? undefined,
      search: search ?? undefined,
      page,
      pageSize,
    });

    return NextResponse.json({ employees, total, page, pageSize });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : message.includes("Admin access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

async function postHandler(request: Request) {
  try {
    const admin = await requireAdmin();
    const parsed = employeeOnboardingSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid employee data", issues: parsed.error.issues }, { status: 400 });
    const input = parsed.data;
    const supabase = createSupabaseAdminClient();
    const { data: existingProfiles, error: existingError } = await supabase.from("profiles").select("id").ilike("email", input.email).limit(1);
    if (existingError) return NextResponse.json({ error: `Could not check duplicate email: ${existingError.message}` }, { status: 500 });
    if (existingProfiles?.length) return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });

    const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(input.email, { data: { full_name: input.fullName } });
    if (inviteError || !invited.user) return NextResponse.json({ error: inviteError?.message ?? "Invitation failed" }, { status: 502 });
    const { error: profileError } = await supabase.from("profiles").update({ email: input.email, full_name: input.fullName, phone: input.phone || null }).eq("id", invited.user.id);
    if (profileError) {
      await supabase.auth.admin.deleteUser(invited.user.id);
      return NextResponse.json({ error: `Profile creation failed: ${profileError.message}` }, { status: 500 });
    }
    const { data: employee, error: employeeError } = await supabase.from("employees").update({ department_id: input.departmentId ?? null, job_title: input.jobTitle || null, joined_on: input.joinedOn ?? null, employment_status: input.employmentStatus, created_by: admin.user.id, updated_by: admin.user.id }).eq("profile_id", invited.user.id).select("id, profile_id, employment_status").single();
    if (employeeError || !employee) {
      await supabase.auth.admin.deleteUser(invited.user.id);
      return NextResponse.json({ error: employeeError?.message ?? "Employee record creation failed" }, { status: 500 });
    }
    await logAuditEvent({
      actorId: admin.user.id,
      event: "employee.invited",
      entityType: "employee",
      entityId: employee.id,
      metadata: { email: input.email, role: "employee" },
      request,
    });
    return NextResponse.json({ employee }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : message.includes("Admin access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// Invitations send email and create several records. This still permits a
// normal onboarding batch while preventing accidental resend storms.
export const POST = withRateLimit(postHandler, { limit: 20, windowMs: 10 * 60_000 });
