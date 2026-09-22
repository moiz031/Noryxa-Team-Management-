import { getTestContext, generateTestId, itDb, isSupabaseReachable } from "../helpers/test-client";

describe("Integration Tests: Project Workflow", () => {
  let ctx: Awaited<ReturnType<typeof getTestContext>>;
  let projectId: string | null = null;
  let clientId: string | null = null;

  beforeAll(async () => {
    if (await isSupabaseReachable()) {
      ctx = await getTestContext();
    }
  });

  afterAll(async () => {
    if (ctx && projectId) {
      await ctx.serviceClient.from("projects").delete().eq("id", projectId);
    }
    if (ctx && clientId) {
      await ctx.serviceClient.from("clients").delete().eq("id", clientId);
    }
  });

  itDb("handles project creation, member assignment, and employee access", async () => {
    const testPrefix = generateTestId("project_test");

    // 1. Admin creates a client first
    const { data: client, error: clientErr } = await ctx.adminClient
      .from("clients")
      .insert({
        name: `${testPrefix} Client`,
        status: "active",
      })
      .select("id")
      .single();

    expect(clientErr).toBeNull();
    clientId = client!.id;

    // 2. Admin creates a project for the client
    const { data: project, error: projErr } = await ctx.adminClient
      .from("projects")
      .insert({
        name: `${testPrefix} Project`,
        client_id: clientId,
        status: "active",
        created_by: ctx.adminId,
      })
      .select("id, name")
      .single();

    expect(projErr).toBeNull();
    projectId = project!.id;
    expect(project!.name).toContain(testPrefix);

    // 3. Admin assigns employee to the project
    const { error: assignErr } = await ctx.adminClient
      .from("project_members")
      .insert({
        project_id: projectId,
        employee_id: ctx.employeeId,
        role: "member",
        added_by: ctx.adminId,
      });

    expect(assignErr).toBeNull();

    // 4. Employee should be able to view the project (via RLS / policy)
    const { data: employeeProjects, error: empProjErr } = await ctx.employeeClient
      .from("projects")
      .select("id")
      .eq("id", projectId);

    expect(empProjErr).toBeNull();
    expect(employeeProjects?.length).toBeGreaterThan(0);
  });
});
