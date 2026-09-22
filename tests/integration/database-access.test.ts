import { getTestContext, generateTestId, itDb, isSupabaseReachable } from "../helpers/test-client";

describe("Integration Tests: Database Access", () => {
  let ctx: Awaited<ReturnType<typeof getTestContext>>;
  const testIds: string[] = [];

  beforeAll(async () => {
    if (await isSupabaseReachable()) {
      ctx = await getTestContext();
    }
  });

  afterAll(async () => {
    if (ctx && testIds.length > 0) {
      await ctx.serviceClient.from("tasks").delete().in("id", testIds);
    }
  });

  itDb("can query system roles and departments via authenticated client", async () => {
    const { data: roles, error: rolesErr } = await ctx.adminClient
      .from("roles")
      .select("id, code");
    expect(rolesErr).toBeNull();
    expect(roles).toBeDefined();
    expect(roles!.length).toBeGreaterThan(0);

    const { data: depts, error: deptsErr } = await ctx.employeeClient
      .from("departments")
      .select("id, name");
    expect(deptsErr).toBeNull();
    expect(depts).toBeDefined();
  });

  itDb("can insert and read back an isolated test task", async () => {
    const testTitle = generateTestId("test_db_task");
    const { data: created, error: createErr } = await ctx.adminClient
      .from("tasks")
      .insert({
        title: testTitle,
        status: "todo",
        priority: "medium",
        created_by: ctx.adminId,
      })
      .select("id, title, status")
      .single();

    expect(createErr).toBeNull();
    expect(created).toBeDefined();
    expect(created!.title).toBe(testTitle);
    testIds.push(created!.id);

    const { data: readBack, error: readErr } = await ctx.adminClient
      .from("tasks")
      .select("id, title, status")
      .eq("id", created!.id)
      .single();

    expect(readErr).toBeNull();
    expect(readBack!.id).toBe(created!.id);
  });
});
