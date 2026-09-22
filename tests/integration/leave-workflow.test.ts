import { getTestContext, itDb, isSupabaseReachable } from "../helpers/test-client";

describe("Integration Tests: Leave Workflow", () => {
  let ctx: Awaited<ReturnType<typeof getTestContext>>;
  let leaveId: string | null = null;

  beforeAll(async () => {
    if (await isSupabaseReachable()) {
      ctx = await getTestContext();
    }
  });

  afterAll(async () => {
    if (ctx && leaveId) {
      await ctx.serviceClient.from("leave_requests").delete().eq("id", leaveId);
    }
  });

  itDb("submits a leave request by employee and approves it by admin", async () => {
    const today = new Date().toISOString().slice(0, 10);

    // 1. Employee submits leave request
    const { data: created, error: createErr } = await ctx.employeeClient
      .from("leave_requests")
      .insert({
        employee_id: ctx.employeeId,
        leave_type: "vacation",
        starts_on: today,
        ends_on: today,
        status: "pending",
        reason: "Automated test leave application",
        created_by: ctx.employeeProfileId,
      })
      .select("id, status, employee_id")
      .single();

    expect(createErr).toBeNull();
    expect(created).toBeDefined();
    leaveId = created!.id;
    expect(created!.status).toBe("pending");

    // 2. Admin approves the leave
    const { data: approved, error: approveErr } = await ctx.adminClient
      .from("leave_requests")
      .update({
        status: "approved",
        reviewed_by: ctx.adminId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", leaveId)
      .select("id, status, reviewed_by")
      .single();

    expect(approveErr).toBeNull();
    expect(approved?.status).toBe("approved");
    expect(approved?.reviewed_by).toBe(ctx.adminId);
  });
});
