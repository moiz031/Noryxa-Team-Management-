import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/roles";
import { getAttendance } from "@/lib/db/attendance";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const employeeId = url.searchParams.get("employeeId");
    const status = url.searchParams.get("status") as "present" | "late" | "absent" | "half_day" | "remote" | "excused" | "all" | null;
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");

    const { attendance, total } = await getAttendance({
      employeeId: employeeId ?? undefined,
      status: status ?? "all",
      startDate: startDate ?? undefined,
      endDate: endDate ?? undefined,
      page,
      pageSize,
    });

    return NextResponse.json({ attendance, total, page, pageSize });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : message.includes("Admin access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}