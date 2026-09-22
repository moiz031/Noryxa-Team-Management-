import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/roles";
import { getAnnouncements } from "@/lib/db/announcements";
import { getEmployeeByProfileId } from "@/lib/db/employees";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const publishedOnly = url.searchParams.get("publishedOnly") !== "false";
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");

    // Get employee's department for department-specific announcements
    const employee = await getEmployeeByProfileId(user.user.id);
    const departmentId = employee?.department_id || null;

    const { announcements, total } = await getAnnouncements({
      publishedOnly,
      departmentId,
      page,
      pageSize,
    });

    return NextResponse.json({ announcements, total, page, pageSize });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : message.includes("Admin access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}