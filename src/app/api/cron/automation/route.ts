import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runAutomation } from "@/lib/automation/engine";
import { withJobLogging } from "@/lib/background/job-monitor";

export const runtime = "nodejs";

function hasValidCronSecret(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const authorization = request.headers.get("authorization") ?? "";
  const provided = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : request.headers.get("x-cron-secret") ?? "";

  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  return expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes);
}

/**
 * Vercel Cron (or another trusted scheduler) invokes this endpoint. The
 * automation engine remains idempotent, while the shared secret prevents a
 * public caller from triggering privileged service-role work.
 */
export async function GET(request: Request) {
  if (!hasValidCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const report = await withJobLogging("automation.cron", () => runAutomation(), {
      trigger: "cron",
    });
    return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Automation cron failed", error);
    return NextResponse.json({ error: "Automation run failed" }, { status: 500 });
  }
}
