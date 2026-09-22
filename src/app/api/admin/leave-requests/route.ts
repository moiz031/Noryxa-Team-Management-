import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/roles";
import { getLeaveRequests } from "@/lib/db/leave-requests";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const employeeId = url.searchParams.get("employeeId");
    const status = url.searchParams.get("status") as "pending" | "approved" | "rejected" | "cancelled" | "all" | null;
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");

    const { leaveRequests, total } = await getLeaveRequests({
      employeeId: employeeId ?? undefined,
      status: status ?? "all",
      page,
      pageSize,
    });

    return NextResponse.json({ leaveRequests, total, page, pageSize });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : message.includes("Admin access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}