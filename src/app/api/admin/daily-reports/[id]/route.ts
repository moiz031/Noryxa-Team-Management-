import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications/engine";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const client = createSupabaseAdminClient();
    const { data: current, error: currentError } = await client.from("daily_reports").select("status").eq("id", id).maybeSingle();
    if (currentError) throw new Error(currentError.message);
    if (!current) return NextResponse.json({ error: "Daily report not found" }, { status: 404 });
    if (current.status !== "submitted") return NextResponse.json({ error: "Only submitted reports can be reviewed" }, { status: 409 });
    const { data, error } = await client.from("daily_reports").update({
      status: body.status === "reviewed" ? "reviewed" : "submitted",
      reviewed_by: admin.user.id,
      reviewed_at: new Date().toISOString(),
      updated_by: admin.user.id,
    }).eq("id", id).select("*").single();
    if (error) throw new Error(error.message);
    const { data: reportOwner } = await client.from("daily_reports").select("employee_id,employees!inner(profile_id)").eq("id", id).single();
    const owner = Array.isArray(reportOwner?.employees) ? reportOwner.employees[0] : reportOwner?.employees;
    if (owner?.profile_id) await notify({ recipientId: owner.profile_id, actorId: admin.user.id, type: "daily_report.reviewed", title: "Daily report reviewed", body: "Your daily report was reviewed.", entityType: "daily_report", entityId: id, preference: "report_notifications", dedupeKey: `report.reviewed:${id}:${data.updated_at}` });
    await client.rpc("log_activity", {
      p_action_type: "daily_report.reviewed",
      p_entity_type: "daily_report",
      p_entity_id: id,
      p_metadata: { status: data.status },
    });
    return NextResponse.json({ report: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: message.includes("Authentication required") ? 401 : 403 });
  }
}
