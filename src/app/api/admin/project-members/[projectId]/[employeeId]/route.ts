import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit/logger";

const roleSchema = z.object({ role: z.enum(["owner", "manager", "member", "viewer"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ projectId: string; employeeId: string }> }) {
  try {
    const admin = await requireAdmin();
    const { projectId, employeeId } = await params;
    const parsed = roleSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("project_members")
      .update({ role: parsed.data.role })
      .eq("project_id", projectId)
      .eq("employee_id", employeeId)
      .select("*")
      .single();
    if (error) throw error;

    await logAuditEvent({
      actorId: admin.user.id,
      event: "project_member.role_changed",
      entityType: "project_member",
      entityId: data?.id || employeeId,
      metadata: {
        project_id: projectId,
        employee_id: employeeId,
        new_role: parsed.data.role,
      },
      request,
    });

    return NextResponse.json({ member: data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unexpected server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ projectId: string; employeeId: string }> }) {
  try {
    const admin = await requireAdmin();
    const { projectId, employeeId } = await params;
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("project_members")
      .delete()
      .eq("project_id", projectId)
      .eq("employee_id", employeeId);
    if (error) throw error;

    await logAuditEvent({
      actorId: admin.user.id,
      event: "project_member.removed",
      entityType: "project_member",
      entityId: employeeId,
      metadata: {
        project_id: projectId,
        employee_id: employeeId,
      },
      request,
    });

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unexpected server error" }, { status: 500 });
  }
}
