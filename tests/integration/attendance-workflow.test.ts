import { getTestContext, itDb, isSupabaseReachable } from "../helpers/test-client";

describe("Integration Tests: Attendance Workflow", () => {
  let ctx: Awaited<ReturnType<typeof getTestContext>>;
  let attendanceId: string | null = null;

  beforeAll(async () => {
    if (await isSupabaseReachable()) {
      ctx = await getTestContext();
    }
  });

  afterAll(async () => {
    if (ctx && attendanceId) {
      await ctx.serviceClient.from("attendance").delete().eq("id", attendanceId);
    }
  });

  itDb("handles employee check-in and check-out", async () => {
    const today = "2026-12-25"; // specific date to avoid duplicates

    // 1. Employee checks in
    const { data: checkIn, error: checkInErr } = await ctx.employeeClient
      .from("attendance")
      .insert({
        employee_id: ctx.employeeId,
        attendance_date: today,
        check_in_at: new Date().toISOString(),
        status: "present",
        created_by: ctx.employeeProfileId,
      })
      .select("id, status")
      .single();

    expect(checkInErr).toBeNull();
    expect(checkIn).toBeDefined();
    attendanceId = checkIn!.id;
    expect(checkIn!.status).toBe("present");

    // 2. Employee checks out
    const { data: checkOut, error: checkOutErr } = await ctx.employeeClient
      .from("attendance")
      .update({
        check_out_at: new Date().toISOString(),
      })
      .eq("id", attendanceId)
      .select("id, check_out_at")
      .single();

    expect(checkOutErr).toBeNull();
    expect(checkOut?.check_out_at).toBeDefined();
  });
});
