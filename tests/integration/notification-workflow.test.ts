import { getTestContext, generateTestId, itDb, isSupabaseReachable } from "../helpers/test-client";

describe("Integration Tests: Notification Workflow", () => {
  let ctx: Awaited<ReturnType<typeof getTestContext>>;
  let notificationId: string | null = null;

  beforeAll(async () => {
    if (await isSupabaseReachable()) {
      ctx = await getTestContext();
    }
  });

  afterAll(async () => {
    if (ctx && notificationId) {
      await ctx.serviceClient.from("notifications").delete().eq("id", notificationId);
    }
  });

  itDb("handles notification delivery and mark as read", async () => {
    const testTitle = generateTestId("test_notification");

    // 1. The server-side notification engine creates a notification for the employee.
    // Direct client inserts are intentionally denied by RLS; delivery uses the
    // service-role client after the originating action has been authorized.
    const { data: notification, error: notifErr } = await ctx.serviceClient
      .from("notifications")
      .insert({
        recipient_id: ctx.employeeProfileId,
        actor_id: ctx.adminId,
        type: "system_alert",
        title: testTitle,
        body: "Test notification body",
      })
      .select("id, read_at")
      .single();

    expect(notifErr).toBeNull();
    expect(notification).toBeDefined();
    notificationId = notification!.id;
    expect(notification!.read_at).toBeNull();

    // 2. Employee marks it as read
    const { data: readNotification, error: readErr } = await ctx.employeeClient
      .from("notifications")
      .update({
        read_at: new Date().toISOString(),
      })
      .eq("id", notificationId)
      .select("id, read_at")
      .single();

    expect(readErr).toBeNull();
    expect(readNotification?.read_at).not.toBeNull();
  });
});
