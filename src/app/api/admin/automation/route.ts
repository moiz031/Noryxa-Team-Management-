import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/roles";
import { runAutomation, getAutomationHistory, JobStatus, JobType } from "@/lib/automation/engine";
import { withRateLimit } from "@/lib/api/rate-limit";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const status = (url.searchParams.get("status") as JobStatus) || undefined;
    const jobType = (url.searchParams.get("jobType") as JobType) || undefined;
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const page = parseInt(url.searchParams.get("page") || "1", 10);

    const history = await getAutomationHistory({ status, jobType, limit, page });
    return NextResponse.json(history);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : message.includes("Admin access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

async function postHandler(request: Request) {
  try {
    await requireAdmin();
    let asOf: Date | undefined;
    try {
      const body = await request.json();
      if (body?.asOf) {
        asOf = new Date(body.asOf);
      }
    } catch {
      // Body is optional
    }

    const report = await runAutomation(asOf);
    return NextResponse.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : message.includes("Admin access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// Automation may fan out into many database operations and notifications.
export const POST = withRateLimit(postHandler, { limit: 3, windowMs: 10 * 60_000 });
