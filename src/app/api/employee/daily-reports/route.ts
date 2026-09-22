import { NextResponse } from "next/server";
import { requireEmployee } from "@/lib/auth/roles";
import { getDailyReports, getDailyReportByEmployeeAndDate, createDailyReport, updateDailyReport } from "@/lib/db/daily-reports";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications/engine";
import { dailyReportSchema } from "@/lib/validation/batch2";

export async function GET(request: Request) {
  try {
    const employee = await requireEmployee();
    const url = new URL(request.url);
    const status = url.searchParams.get("status") as "draft" | "submitted" | "reviewed" | "all" | null;
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");

    const employeeId = employee.profile.employees?.[0]?.id;
    if (!employeeId) {
      return NextResponse.json({ reports: [], total: 0, page, pageSize });
    }

    const { reports, total } = await getDailyReports({
      employeeId,
      status: status ?? "all",
      startDate: startDate ?? undefined,
      endDate: endDate ?? undefined,
      page,
      pageSize,
    });

    return NextResponse.json({ reports, total, page, pageSize });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : message.includes("Admin access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const employee = await requireEmployee();
    const parsed = dailyReportSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const body = parsed.data;
    
    const employeeId = employee.profile.employees?.[0]?.id;
    if (!employeeId) {
      return NextResponse.json({ error: "Employee record not found" }, { status: 404 });
    }
    
    const existing = await getDailyReportByEmployeeAndDate(employeeId, body.reportDate);
    if (existing) {
      return NextResponse.json({ error: "Report for this date already exists" }, { status: 409 });
    }
    
    const report = await createDailyReport({
      employee_id: employeeId,
      report_date: body.reportDate,
      status: body.status || "draft",
      summary: body.summary.trim(),
      blockers: body.blockers || null,
      tomorrow_plan: body.tomorrowPlan || null,
      created_by: employee.user.id,
    });
    
    await createSupabaseAdminClient()
      .from("activity_logs")
      .insert({ actor_id: employee.user.id, action_type: "daily_report.created", entity_type: "daily_report", entity_id: report.id, metadata: { report_date: body.reportDate } });
    if (report.status === "submitted") {
      const db = createSupabaseAdminClient();
      const { data: admins } = await db.from("profiles").select("id,roles!inner(code)").eq("is_active", true);
      for (const admin of admins ?? []) {
        const role = Array.isArray(admin.roles) ? admin.roles[0] : admin.roles;
        if (role?.code === "admin") await notify({ recipientId: admin.id, actorId: employee.user.id, type: "daily_report.submitted", title: "Daily report submitted", body: `Report for ${report.report_date}`, entityType: "daily_report", entityId: report.id, preference: "report_notifications", dedupeKey: `report.submitted:${report.id}` });
      }
    }
    
    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : message.includes("Admin access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}