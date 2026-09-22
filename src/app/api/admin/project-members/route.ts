import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/roles";
import { listBatch2, insertBatch2 } from "@/lib/db/batch2";
import { projectMemberSchema } from "@/lib/validation/batch2";
import { logAuditEvent } from "@/lib/audit/logger";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const project_id = new URL(request.url).searchParams.get("project_id") ?? undefined;
    return NextResponse.json({ members: await listBatch2("project_members", project_id ? { project_id } : {}) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unexpected server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const parsed = projectMemberSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const member = await insertBatch2("project_members", { ...parsed.data, added_by: admin.user.id });
    await logAuditEvent({
      actorId: admin.user.id,
      event: "project_member.added",
      entityType: "project_member",
      entityId: (member as { id?: string } | null)?.id || null,
      metadata: {
        project_id: parsed.data.project_id,
        employee_id: parsed.data.employee_id,
        role: parsed.data.role,
      },
      request,
    });
    return NextResponse.json({ member }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unexpected server error" }, { status: 500 });
  }
}
