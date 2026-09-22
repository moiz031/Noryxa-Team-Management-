import { getTestContext, itDb, isSupabaseReachable } from "../helpers/test-client";
import { createClient } from "@supabase/supabase-js";

describe("Integration Tests: RLS-Sensitive Operations", () => {
  let ctx: Awaited<ReturnType<typeof getTestContext>>;

  beforeAll(async () => {
    if (await isSupabaseReachable()) {
      ctx = await getTestContext();
    }
  });

  itDb("permits admin and employee to read their own profile", async () => {
    const { data: adminProfile, error: adminErr } = await ctx.adminClient
      .from("profiles")
      .select("id, email")
      .eq("id", ctx.adminId)
      .single();

    expect(adminErr).toBeNull();
    expect(adminProfile?.id).toBe(ctx.adminId);

    const { data: empProfile, error: empErr } = await ctx.employeeClient
      .from("profiles")
      .select("id, email")
      .eq("id", ctx.employeeProfileId)
      .single();

    expect(empErr).toBeNull();
    expect(empProfile?.id).toBe(ctx.employeeProfileId);
  });

  itDb("blocks employee from reading admin employee record via RLS", async () => {
    const { data: adminEmp } = await ctx.serviceClient
      .from("employees")
      .select("id")
      .eq("profile_id", ctx.adminId)
      .maybeSingle();

    if (adminEmp) {
      const { data: empView } = await ctx.employeeClient
        .from("employees")
        .select("id")
        .eq("id", adminEmp.id);

      expect(empView?.length || 0).toBe(0);
    }
  });

  itDb("blocks anonymous client from querying profiles", async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const anon = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: profiles } = await anon.from("profiles").select("id").limit(5);
    expect(profiles?.length || 0).toBe(0);
  });
});
