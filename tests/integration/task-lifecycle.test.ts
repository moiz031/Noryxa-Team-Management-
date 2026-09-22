import { getTestContext, generateTestId, itDb, isSupabaseReachable } from "../helpers/test-client";

describe("Integration Tests: Task Lifecycle", () => {
  let ctx: Awaited<ReturnType<typeof getTestContext>>;
  let createdTaskId: string | null = null;

  beforeAll(async () => {
    if (await isSupabaseReachable()) {
      ctx = await getTestContext();
    }
  });

  afterAll(async () => {
    if (ctx && createdTaskId) {
      await ctx.serviceClient.from("tasks").delete().eq("id", createdTaskId);
    }
  });

  itDb("completes full task lifecycle: creation, assignment, progression, and completion", async () => {
    const title = generateTestId("test_task_lifecycle");

    // 1. Admin creates task assigned to employee
    const { data: created, error: createErr } = await ctx.adminClient
      .from("tasks")
      .insert({
        title,
        status: "todo",
        priority: "high",
        assigned_to: ctx.employeeId,
        created_by: ctx.adminId,
      })
      .select("id, status, assigned_to")
      .single();

    expect(createErr).toBeNull();
    expect(created).toBeDefined();
    createdTaskId = created!.id;
    expect(created!.status).toBe("todo");
    expect(created!.assigned_to).toBe(ctx.employeeId);

    // 2. Employee updates status to in_progress
    const { data: inProg, error: inProgErr } = await ctx.employeeClient
      .from("tasks")
      .update({ status: "in_progress" })
      .eq("id", createdTaskId)
      .select("id, status")
      .single();

    expect(inProgErr).toBeNull();
    expect(inProg?.status).toBe("in_progress");

    // 3. Complete task and set completed_at
    const completedAt = new Date().toISOString();
    const { data: completed, error: compErr } = await ctx.employeeClient
      .from("tasks")
      .update({ status: "completed", completed_at: completedAt })
      .eq("id", createdTaskId)
      .select("id, status, completed_at")
      .single();

    expect(compErr).toBeNull();
    expect(completed?.status).toBe("completed");
    expect(completed?.completed_at).toBeDefined();
  });
});
