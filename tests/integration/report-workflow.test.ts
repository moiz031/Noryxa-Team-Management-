import { getTestContext, itDb, isSupabaseReachable } from "../helpers/test-client";

describe("Integration Tests: Daily Report Workflow", () => {
  let ctx: Awaited<ReturnType<typeof getTestContext>>;
  let reportId: string | null = null;

  beforeAll(async () => {
    if (await isSupabaseReachable()) {
      ctx = await getTestContext();
    }
  });

  afterAll(async () => {
    if (ctx && reportId) {
      await ctx.serviceClient.from("daily_reports").delete().eq("id", reportId);
    }
  });

  itDb("handles report draft creation and submission", async () => {
    const testDate = "2026-11-20"; // far date to avoid clashing with real attendance

    // 1. Employee creates a draft report
    const { data: draft, error: draftErr } = await ctx.employeeClient
      .from("daily_reports")
      .insert({
        employee_id: ctx.employeeId,
        report_date: testDate,
        summary: "Automated test daily report draft",
        status: "draft",
        created_by: ctx.employeeProfileId,
      })
      .select("id, status, report_date")
      .single();

    expect(draftErr).toBeNull();
    expect(draft).toBeDefined();
    reportId = draft!.id;
    expect(draft!.status).toBe("draft");

    // 2. Submit report
    const { data: submitted, error: submitErr } = await ctx.employeeClient
      .from("daily_reports")
      .update({
        status: "submitted",
        summary: "Automated test daily report submitted successfully",
      })
      .eq("id", reportId)
      .select("id, status, summary")
      .single();

    expect(submitErr).toBeNull();
    expect(submitted?.status).toBe("submitted");
    expect(submitted?.summary).toContain("submitted successfully");
  });
});
