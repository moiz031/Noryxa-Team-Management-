import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getEmployeeById, updateEmployee } from "@/lib/db/employees";
import { z } from "zod";

const statusSchema = z.object({
  status: z.enum(["active", "suspended", "inactive"]),
});

async function changeStatus(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const parsed = statusSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid employee status" }, { status: 400 });
    const nextStatus = parsed.data.status;
    const employee = await getEmployeeById(id);
    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    const activated = await updateEmployee({
      id,
      employment_status: nextStatus,
      updated_by: admin.user.id,
    });
    const { error: profileError } = await createSupabaseAdminClient()
      .from("profiles")
      .update({ is_active: nextStatus === "active", updated_by: admin.user.id, updated_at: new Date().toISOString() })
      .eq("id", employee.profile_id);
    if (profileError) throw new Error(`Failed to activate profile: ${profileError.message}`);
    await createSupabaseAdminClient().from("activity_logs").insert({
      actor_id: admin.user.id,
      action_type: `employee.${nextStatus}`,
      entity_type: "employee",
      entity_id: id,
      metadata: { previous_status: employee.employment_status, next_status: nextStatus },
    });
    return NextResponse.json({ employee: activated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : message.includes("Admin access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export const POST = changeStatus;
export const PATCH = changeStatus;
