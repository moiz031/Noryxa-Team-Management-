import { NextResponse } from "next/server";
import { requireEmployee } from "@/lib/auth/roles";
import { getDailyReportById, updateDailyReport } from "@/lib/db/daily-reports";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { dailyReportSchema } from "@/lib/validation/batch2";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const employee = await requireEmployee();
    const { id } = await params;
    
    const employeeId = employee.profile.employees?.[0]?.id;
    const report = await getDailyReportById(id);
    if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
    if (report.employee_id !== employeeId) {
      return NextResponse.json({ error: "Not authorized to view this report" }, { status: 403 });
    }
    
    return NextResponse.json({ report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : message.includes("Admin access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const employee = await requireEmployee();
    const { id } = await params;
    const body = await request.json();
    
    const employeeId = employee.profile.employees?.[0]?.id;
    const report = await getDailyReportById(id);
    if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
    if (report.employee_id !== employeeId) {
      return NextResponse.json({ error: "Not authorized to update this report" }, { status: 403 });
    }
    
    // Employees can only update their own reports (and only if draft)
    if (report.status !== "draft") {
      return NextResponse.json({ error: "Cannot update submitted or reviewed report" }, { status: 400 });
    }
    
    const parsed = dailyReportSchema.partial().safeParse({
      reportDate: body.reportDate ?? report.report_date,
      summary: body.summary ?? report.summary,
      blockers: body.blockers ?? report.blockers,
      tomorrowPlan: body.tomorrowPlan ?? report.tomorrow_plan,
      status: body.status,
    });
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const updates: Record<string, unknown> = {};
    if ("summary" in body) updates.summary = parsed.data.summary;
    if ("blockers" in body) updates.blockers = parsed.data.blockers ?? null;
    if ("tomorrowPlan" in body) updates.tomorrow_plan = parsed.data.tomorrowPlan ?? null;
    if ("status" in body) updates.status = parsed.data.status;
    
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }
    
    const updatedReport = await updateDailyReport({ id, ...updates, updated_by: employee.user.id });
    
    await createSupabaseAdminClient()
      .from("activity_logs")
      .insert({ actor_id: employee.user.id, action_type: "daily_report.updated", entity_type: "daily_report", entity_id: id, metadata: updates });
    
    return NextResponse.json({ report: updatedReport });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : message.includes("Admin access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}