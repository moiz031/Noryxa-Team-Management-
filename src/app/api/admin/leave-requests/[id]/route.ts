import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications/engine";
import { logAuditEvent } from "@/lib/audit/logger";

const statuses = new Set(["approved", "rejected", "cancelled"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    if (!statuses.has(body.status)) return NextResponse.json({ error: "Invalid leave status" }, { status: 400 });
    const client = createSupabaseAdminClient();
    const { data: current, error: currentError } = await client.from("leave_requests").select("status").eq("id", id).maybeSingle();
    if (currentError) throw new Error(currentError.message);
    if (!current) return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    if (current.status !== "pending") return NextResponse.json({ error: "Only pending leave requests can be reviewed" }, { status: 409 });
    const { data, error } = await client.from("leave_requests").update({
      status: body.status,
      review_note: typeof body.reviewNote === "string" ? body.reviewNote.trim().slice(0, 2000) : null,
      reviewed_by: admin.user.id,
      reviewed_at: new Date().toISOString(),
      updated_by: admin.user.id,
    }).eq("id", id).select("*").single();
    if (error) throw new Error(error.message);
    const { data: owner } = await client.from("leave_requests").select("employee_id,employees!inner(profile_id)").eq("id", id).single();
    const profile = Array.isArray(owner?.employees) ? owner.employees[0] : owner?.employees;
    if (profile?.profile_id) await notify({ recipientId: profile.profile_id, actorId: admin.user.id, type: `leave.${body.status}`, title: `Leave request ${body.status}`, body: "Your leave request status was updated.", entityType: "leave_request", entityId: id, preference: "leave_notifications", dedupeKey: `leave.${body.status}:${id}:${data.updated_at}` });
    await logAuditEvent({
      actorId: admin.user.id,
      event: body.status === "approved" ? "leave.approved" : body.status === "rejected" ? "leave.rejected" : "leave.cancelled",
      entityType: "leave_request",
      entityId: id,
      metadata: { status: body.status, review_note: body.reviewNote || null },
      request,
    });
    return NextResponse.json({ leaveRequest: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: message.includes("Authentication required") ? 401 : 403 });
  }
}
