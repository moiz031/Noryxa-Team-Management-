import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/roles";
import { calculateEmployeeScorecard } from "@/lib/db/scorecards";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    const url = new URL(request.url);

    const employeeIdParam = url.searchParams.get("employeeId");
    const period = (url.searchParams.get("period") as "weekly" | "monthly") || "monthly";
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    const ownEmployeeId = auth.profile.employees?.[0]?.id;

    // Authorization check
    let targetEmployeeId = ownEmployeeId;
    if (auth.role === "admin" && employeeIdParam) {
      targetEmployeeId = employeeIdParam;
    } else if (auth.role !== "admin" && employeeIdParam && employeeIdParam !== ownEmployeeId) {
      return NextResponse.json({ error: "Unauthorized access to employee scorecard" }, { status: 403 });
    }

    if (!targetEmployeeId) {
      return NextResponse.json({ error: "Employee record not found" }, { status: 404 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const windowDays = period === "weekly" ? 7 : 30;
    const defaultStart = new Date(Date.now() - windowDays * 86400000).toISOString().slice(0, 10);

    const resolvedStart = startDate || defaultStart;
    const resolvedEnd = endDate || today;

    const scorecard = await calculateEmployeeScorecard({
      employeeId: targetEmployeeId,
      startDate: resolvedStart,
      endDate: resolvedEnd,
      period,
    });

    return NextResponse.json({ scorecard });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
